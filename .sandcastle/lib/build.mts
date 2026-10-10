// Build one planned issue: test, implement, gate, review, gate again and publish it
// from a single sandbox, so every role and the gate share the same worktree.
// Nothing is merged locally: every change reaches main through a reviewed PR.

import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import * as sandcastle from "@ai-hero/sandcastle";
import { runRoleInSandbox } from "./agents.mts";
import { commitsAhead } from "./branches.mts";
import { gateFailureComment, runCheckpoint, runGate, type Checkpoint } from "./checkpoint.mts";
import { BASE_BRANCH, BUILD_FAILED_MARKER, copyToWorktree, hooks, PUBLISH_RETRY_ATTEMPTS } from "./config.mts";
import { UncountedStopError } from "./errors.mts";
import { commentOnIssue, markerComments, openPullRequest, type SandcastleIssue } from "./github.mts";
import { recordFailedAttempt } from "./handback.mts";
import { repoGitDir, worktreeLinkProblems, worktreePathFor } from "./host-safety.mts";
import { gateFixerPromptArgs, issuePromptArgs } from "./prompts.mts";
import { containsSandboxSecret, containsSecret } from "./sandbox-env.mts";
import { publishedText } from "./scan.mts";
import { git } from "./shell.mts";
import { agentSandbox } from "./skills.mts";

// Re-exported for the callers and tests that already import it from here.
export { UncountedStopError };

// Push the commit checkpoint 2's gate passed on to the issue branch, and open
// (or reuse) the PR that closes the issue. Both run in the main checkout, with
// git hooks off. Pushing from the worktree would run its pre-push hook: the
// branch's own .github/hooks/pre-push, scripts/gate.sh and test code, files the
// agents wrote, on the host with its gh auth, Docker socket and home directory.
// The sandbox already ran the gate on this commit, and CI runs it again on the
// PR. The commit is pushed by its id, so nothing committed after the gate can
// ride along, and without force: a push that doesn't fast-forward origin's
// branch fails, and buildIssue reports it on the issue, rather than drop the
// work already there.
//
// A GitHub server error (a 5xx or "Internal Server Error" in git's or gh's
// output) is transient, so the push and the PR creation are each tried up to
// PUBLISH_RETRY_ATTEMPTS times in all, with backoff, before giving up. Any
// other failure, such as a push that doesn't fast-forward, isn't retried: a
// person needs to look at it regardless.
export async function publish(
  issue: SandcastleIssue,
  branch: string,
  commit: string,
  reviewed: boolean,
  push: (branch: string, commit: string) => void = (pushBranch, pushCommit) =>
    void git("push", "--quiet", "origin", `${pushCommit}:refs/heads/${pushBranch}`),
  createPullRequest: (branch: string, title: string, body: string) => string = openPullRequest,
  wait: (ms: number) => Promise<void> = (ms) => sleep(ms),
): Promise<string> {
  await retryOnServerError(() => push(branch, commit), wait);
  const body = reviewed
    ? `Closes #${issue.number}\n\nImplemented and reviewed by Sandcastle.`
    : `Closes #${issue.number}\n\nImplemented by Sandcastle. ⚠️ The review step failed, so no agent has reviewed this PR.`;
  // A retry after a create that GitHub carried out but answered with an error
  // finds that PR rather than open a second one: openPullRequest looks for an
  // open PR from the branch first.
  return retryOnServerError(() => createPullRequest(branch, issue.title, body), wait);
}

// Whether a git or gh failure is GitHub's own server error, which a later
// attempt may not hit. Matches what git and gh print for one ("remote: Internal
// Server Error", "returned error: 502", "HTTP 503: Service Unavailable", and
// GraphQL's "Something went wrong while executing your query", which GitHub
// sends with HTTP 200 on a timeout), not a bare 5xx, since a branch name can
// hold one (fix/500-...). Only the command's
// output after "failed:" is read: the command line before it quotes branch
// names, and could quote an issue title that mentions a server error.
export function isGitHubServerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const outputStart = message.indexOf("failed:\n");
  const output = outputStart === -1 ? message : message.slice(outputStart + "failed:\n".length);
  return /\bHTTP(?:\/[\d.]+)? 5\d\d\b|returned error: 5\d\d\b|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Time-?out|Something went wrong while executing your query/i.test(
    output,
  );
}

// The first backoff before a retried publish step; each later one doubles it.
const PUBLISH_RETRY_DELAY_MS = 5_000;

// Run a publish step, retrying it with backoff while it fails with a GitHub
// server error, up to PUBLISH_RETRY_ATTEMPTS attempts in all. Any other
// failure, or the last attempt's, is rethrown.
async function retryOnServerError<T>(step: () => T, wait: (ms: number) => Promise<void>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return step();
    } catch (error) {
      if (attempt >= PUBLISH_RETRY_ATTEMPTS || !isGitHubServerError(error)) throw error;
      const delay = PUBLISH_RETRY_DELAY_MS * 2 ** (attempt - 1);
      console.error(`  ⚠ GitHub server error, retrying in ${delay / 1000}s (attempt ${attempt + 1} of ${PUBLISH_RETRY_ATTEMPTS}): ${error}`);
      await wait(delay);
    }
  }
}

// The issue comment for a tester or backend run that stopped the build.
function developerFailureComment(failure: string, branch: string): string {
  return `Sandcastle stopped building this issue: ${failure}, so \`${branch}\` wasn't pushed. The branch keeps its commits.`;
}


// What buildIssue needs from outside the pipeline; tests pass stubs.
export type BuildHost = {
  createSandbox(branch: string): Promise<sandcastle.Sandbox>;
  // The commits on the branch that `base` doesn't have, counted by ref.
  commitsAhead(branch: string, base: string): number;
  commentOnIssue(issueNumber: number, body: string): void;
  // Records a failed build attempt (anything that stops the issue's
  // pipeline, see "When a role fails" in docs/plans/sandcastle-workflow.md):
  // posts the issue's `sandcastle:build-failed` comment with this attempt's
  // number and `detail` (the tail of the gate output, or the role's error),
  // and once that's the BUILD_FAILURE_CAPth attempt since
  // `sandcastle:needs-human` was last removed, hands the issue back instead
  // (see lib/handback.mts#recordFailedAttempt). Never called for a role run
  // that threw UncountedStopError.
  recordBuildFailure(issueNumber: number, branch: string, detail: string): void;
  // Whether what the commits from `base` to `commit` publish (see
  // lib/scan.mts) holds one of the sandbox's secrets or a token-shaped string.
  leaksSecret(base: string, commit: string): boolean;
  publish: typeof publish;
  // What's wrong with how the worktree finds its repository (see
  // lib/host-safety.mts); empty when nothing is.
  worktreeProblems(worktreePath: string): string[];
  // A failed publish's error, made safe to post on the public issue.
  publicError(error: unknown): string;
  log(line: string): void;
};

// An error's text as it can go on a public issue: no colour codes, no
// credentials in a URL, and nothing at all if it holds a secret.
export function publicErrorText(text: string, holdsSecret: (text: string) => boolean = (t) => containsSecret(t, [])): string {
  const cleaned = text
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, "")
    .replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/gi, "$1***@")
    .trim();
  return holdsSecret(cleaned) ? "(The error isn't shown: it looked like it held a secret. See the run log.)" : cleaned;
}

const worktreeProblems = (worktreePath: string) => worktreeLinkProblems(worktreePath, repoGitDir());

const liveHost: BuildHost = {
  // Sandcastle reuses a branch's worktree that's still there, running git in
  // it first, so check that one before handing it over.
  createSandbox: (branch) => {
    const existing = worktreePathFor(process.cwd(), branch);
    const problems = existsSync(existing) ? worktreeProblems(existing) : [];
    if (problems.length > 0) {
      return Promise.reject(new Error(`the worktree left at ${existing} was tampered with: ${problems.join("; ")}`));
    }
    return sandcastle.createSandbox({ branch, sandbox: agentSandbox(), hooks, copyToWorktree });
  },
  commitsAhead,
  commentOnIssue,
  recordBuildFailure: (issueNumber, branch, detail) =>
    recordFailedAttempt(
      issueNumber,
      branch,
      detail,
      markerComments(issueNumber, "sandcastle:needs-human", BUILD_FAILED_MARKER).map((comment) => comment.body),
    ),
  leaksSecret: (base, commit) => containsSandboxSecret(publishedText(base, commit)),
  publicError: (error) => publicErrorText(String(error instanceof Error ? error.message : error), containsSandboxSecret),
  publish,
  worktreeProblems,
  log: console.log,
};

// The branch comes from prepareBranches, which has already fetched it when it
// exists on origin. `base` is the commit fetchMain() resolved origin/main to
// before any sandbox of the round started: the ref itself is in the shared .git,
// which agents can write, so moving it mustn't be able to shrink the range the
// secret scan reads. The tester commits failing tests for the acceptance
// criteria, then the backend developer makes them pass. If the branch is then
// ahead of main, the gate runs (checkpoint 1), the reviewer runs, and the gate
// runs again (checkpoint 2) before the branch is pushed and gets a pull request
// that closes its issue. Returns the PR's URL, or undefined when a developer
// run failed, the branch holds nothing to publish or a checkpoint's gate
// stayed red. `publishFailed` is true only when the branch passed both
// checkpoints but publishing it still failed, so the caller's round summary can
// tell that apart from a round that built nothing.
export async function buildIssue(
  issue: SandcastleIssue,
  branch: string,
  base: string,
  host: BuildHost = liveHost,
): Promise<{ commits: { sha: string }[]; prUrl: string | undefined; publishFailed: boolean }> {
  const sandbox = await host.createSandbox(branch);

  const promptArgs = issuePromptArgs(issue, branch);
  const commits: { sha: string }[] = [];
  const notPublished = { commits, prUrl: undefined, publishFailed: false };
  const log = (line: string) => host.log(`  #${issue.number} ${line}`);

  // Run the tester or the backend developer. Returns false when the run threw,
  // timed out or used up its iterations without signalling completion: the
  // tests aren't written or aren't green, so the issue stops for this round.
  // Whatever the run committed stays on the branch for the next round, and the
  // failure counts as one of the issue's build attempts, as a checkpoint that
  // stays red does. An UncountedStopError is rethrown instead.
  async function developerFinishes(role: "tester" | "backend"): Promise<boolean> {
    let failure: string;
    try {
      const run = await runRoleInSandbox(sandbox, role, {
        promptFile: `./.sandcastle/roles/${role}.md`,
        promptArgs,
      });
      commits.push(...run.commits);
      if (run.completionSignal !== undefined) {
        log(`${role} finished`);
        return true;
      }
      failure = `the ${role} ran out of iterations unfinished`;
    } catch (error) {
      if (error instanceof UncountedStopError) throw error;
      failure = `the ${role} failed: ${error}`;
    }
    console.error(`  ✗ #${issue.number}: ${failure}, so ${branch} isn't published.`);
    host.recordBuildFailure(issue.number, branch, developerFailureComment(failure, branch));
    return false;
  }

  // Run a gate checkpoint, with the gate-fixer while the gate is red. Returns
  // the commit the gate passed on. When it's still red past the fixer's
  // attempts, nothing is published: the branch keeps its commits, and the
  // issue's failed build attempt is recorded with the tail of the gate output.
  // A gate-fixer run that stopped with UncountedStopError is rethrown.
  async function gatePasses(checkpoint: Checkpoint): Promise<string | undefined> {
    const result = await runCheckpoint(
      checkpoint,
      {
        gate: () => runGate(sandbox),
        fix: async (at, gateOutput) => {
          const fixer = await runRoleInSandbox(sandbox, "gate-fixer", {
            promptFile: "./.sandcastle/roles/gate-fixer.md",
            promptArgs: gateFixerPromptArgs(issue, branch, at, gateOutput),
          });
          commits.push(...fixer.commits);
        },
        uncounted: (error) => error instanceof UncountedStopError,
      },
      log,
    );
    if (!result.passed || result.head === undefined) {
      console.error(`  ✗ #${issue.number}: the gate is still red at checkpoint ${checkpoint}, so ${branch} isn't published.`);
      host.recordBuildFailure(issue.number, branch, gateFailureComment(checkpoint, branch, result.output));
      return undefined;
    }
    return result.head;
  }

  try {
    if (!(await developerFinishes("tester"))) return notPublished;
    if (!(await developerFinishes("backend"))) return notPublished;

    // Gate, review and publish whenever the branch holds work that main
    // doesn't, not only when this run added commits: a re-run of a finished
    // issue makes none, and its earlier work still needs a PR.
    if (host.commitsAhead(branch, base) === 0) {
      const status = await sandbox.exec("git status --porcelain 2>&1");
      if (status.exitCode === 0 && status.stdout.trim() === "") {
        return notPublished;
      }
    }

    if ((await gatePasses(1)) === undefined) return notPublished;
    if (host.commitsAhead(branch, base) === 0) {
      return notPublished;
    }

    let reviewed = true;
    try {
      const review = await runRoleInSandbox(sandbox, "reviewer", {
        promptFile: "./.sandcastle/review-prompt.md",
        promptArgs,
      });
      commits.push(...review.commits);
      log("reviewer finished");
    } catch (error) {
      // Out of usage or time, the review didn't fail: leave the branch for a
      // later round to review rather than publish it unreviewed.
      if (error instanceof UncountedStopError) throw error;
      // A failed review shouldn't strand finished work: publish anyway and
      // say so in the PR, which gets a human review regardless.
      console.error(`  ⚠ #${issue.number}: reviewer failed, publishing unreviewed: ${error}`);
      reviewed = false;
    }

    const gated = await gatePasses(2);
    if (gated === undefined) return notPublished;

    // The push is public, and the sandbox holds the Claude token or API key.
    // The comment doesn't say where the secret is, since the issue is public too.
    if (host.leaksSecret(base, gated)) {
      console.error(`  ✗ #${issue.number}: a commit holds a secret, so ${branch} isn't published.`);
      host.commentOnIssue(
        issue.number,
        `Sandcastle didn't publish this issue: a commit on \`${branch}\` holds one of the sandbox's secrets, or something ` +
          `shaped like a Claude or GitHub token, so \`${branch}\` wasn't pushed. Find it with ` +
          `\`git log -p ${BASE_BRANCH}..${branch}\` before anything pushes the branch, and rotate the secret if it has ` +
          "left this machine.",
      );
      return notPublished;
    }

    // host.publish retries a GitHub server error, but not a push that doesn't
    // fast-forward origin's branch (an agent rewrote a commit an earlier round
    // pushed) or any other git or gh failure. Whatever still fails needs a
    // person, so the issue gets git's or gh's error rather than only the run log.
    try {
      const prUrl = await host.publish(issue, branch, gated, reviewed);
      return { commits, prUrl, publishFailed: false };
    } catch (error) {
      console.error(`  ✗ #${issue.number}: publishing ${branch} failed: ${error}`);
      const detail = host.publicError(error);
      const fence = "`".repeat(Math.max(3, ...[...detail.matchAll(/`+/g)].map((match) => match[0].length + 1)));
      host.commentOnIssue(
        issue.number,
        `Sandcastle couldn't publish \`${branch}\`: it passed the gate, but pushing it or opening its pull request ` +
          "failed. The branch keeps its commits. A person needs to look at it. First check whether a pull request " +
          "from it is already open: GitHub can create one and still answer with an error. Once GitHub recovers from " +
          `a server error: if origin's \`${branch}\` isn't at \`${gated}\`, the commit the gate passed, push it ` +
          "from its worktree; if it is, the push succeeded and opening the pull request failed, so open one by hand " +
          `with \`Closes #${issue.number}\` in ` +
          "its body. If origin's branch has commits the local one doesn't (an agent rewrote one an earlier round " +
          `pushed), the two need reconciling before Sandcastle can push it.\n\n${fence}text\n${detail}\n${fence}`,
      );
      return { commits, prUrl: undefined, publishFailed: true };
    }
  } finally {
    // Sandcastle's close() runs git in the worktree; leave one that no longer
    // points at this repository, with its sandbox, for a person to look at.
    const problems = host.worktreeProblems(sandbox.worktreePath);
    if (problems.length > 0) {
      console.error(`  ✗ #${issue.number}: left ${sandbox.worktreePath} and its sandbox in place: ${problems.join("; ")}`);
      host.commentOnIssue(
        issue.number,
        `Sandcastle stopped: the worktree for \`${branch}\` no longer points at this repository, so it was left for a ` +
          "person to look at. Don't run git in it.",
      );
    } else {
      await sandbox.close();
    }
  }
}
