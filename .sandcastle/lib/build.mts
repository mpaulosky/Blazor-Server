// Build one planned issue: test, implement, gate, review, gate again and publish it
// from a single sandbox, so every role and the gate share the same worktree.
// Nothing is merged locally: every change reaches main through a reviewed PR.

import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import * as sandcastle from "@ai-hero/sandcastle";
import { runRoleInSandbox } from "./agents.mts";
import { commitsAhead } from "./branches.mts";
import { gateFailureComment, runCheckpoint, runGate, type Checkpoint } from "./checkpoint.mts";
import {
  BASE_BRANCH,
  BUILD_FAILED_MARKER,
  BUILDING_LABEL,
  copyToWorktree,
  DESIGN_MARKER,
  hooks,
  PUBLISH_RETRY_ATTEMPTS,
  type OptionalRole,
} from "./config.mts";
import { UncountedStopError } from "./errors.mts";
import { claimBuildingLabel, releaseBuildingLabel } from "./building.mts";
import { commentOnIssue, markerComments, openPullRequest, type SandcastleIssue } from "./github.mts";
import { recordFailedAttempt } from "./handback.mts";
import { repoGitDir, worktreeLinkProblems, worktreePathFor } from "./host-safety.mts";
import { architectPromptArgs, gateFixerPromptArgs, issuePromptArgs } from "./prompts.mts";
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
//
// `docsFailed` is true when the planner picked the scribe for this issue and
// its run failed. Unlike an architect, tester, backend or UI failure, that
// doesn't stop the pipeline (see "When a role fails" in
// docs/plans/sandcastle-workflow.md): the PR still publishes, with a note
// that the documentation step failed.
export async function publish(
  issue: SandcastleIssue,
  branch: string,
  commit: string,
  reviewed: boolean,
  docsFailed: boolean,
  push: (branch: string, commit: string) => void = (pushBranch, pushCommit) =>
    void git("push", "--quiet", "origin", `${pushCommit}:refs/heads/${pushBranch}`),
  createPullRequest: (branch: string, title: string, body: string) => string = openPullRequest,
  wait: (ms: number) => Promise<void> = (ms) => sleep(ms),
): Promise<string> {
  await retryOnServerError(() => push(branch, commit), wait);
  const body =
    (reviewed
      ? `Closes #${issue.number}\n\nImplemented and reviewed by Sandcastle.`
      : `Closes #${issue.number}\n\nImplemented by Sandcastle. ⚠️ The review step failed, so no agent has reviewed this PR.`) +
    (docsFailed ? "\n\n⚠️ The documentation step failed, so this PR may leave `CONTEXT.md`, `README.md` or the guides out of date." : "");
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

// The issue comment for an architect, tester, backend or UI run that stopped
// the build.
function developerFailureComment(failure: string, branch: string): string {
  return `Sandcastle stopped building this issue: ${failure}, so \`${branch}\` wasn't pushed. The branch keeps its commits.`;
}

// GitHub refuses a comment over 65,536 characters; this leaves room for the
// design comment's own lines around the note.
const DESIGN_NOTE_LIMIT = 60_000;

// The design note cut to fit in an issue comment, saying where the whole of it
// is when it's cut.
function truncateDesignNote(note: string, path: string): string {
  if (note.length <= DESIGN_NOTE_LIMIT) return note;
  return `${note.slice(0, DESIGN_NOTE_LIMIT)}\n\n(Cut short to fit in a comment. The whole note is in the sandbox's \`${path}\`.)`;
}

// An issue with the optional roles the planner picked for it (see
// resolveRoles in lib/plan.mts): architect, UI developer and/or scribe, each
// run only when listed, alongside the tester, backend developer and
// reviewer, which always run (see "Phase 6: Build" in
// docs/plans/sandcastle-workflow.md).
export type RoledIssue = SandcastleIssue & { roles: readonly OptionalRole[] };

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
  // Adds sandcastle:building to the issue, so the gate (lib/gate.mts) holds it
  // back for a second Sandcastle run while this one builds it (#150). Returns
  // false, without adding it, when the issue already carries the label:
  // another run marked it after this round's gate read the labels.
  markBuilding(issueNumber: number): boolean;
  // Removes sandcastle:building, however the build stopped: called from
  // buildIssue's finally, only when markBuilding added it, so a failed,
  // red-gated or thrown-out build doesn't leave the issue held back forever,
  // and a build that stood aside never removes another run's label.
  unmarkBuilding(issueNumber: number): void;
  // The body of the architect's latest design note comment on this issue
  // (see DESIGN_MARKER in lib/config.mts), so a re-run's architect builds on
  // its own earlier decisions instead of starting blind. .sandcastle/work/ is
  // gitignored, so a fresh sandbox may not have the earlier run's file.
  // Undefined when the architect hasn't posted one yet.
  latestDesignNote(issueNumber: number): string | undefined;
  // Whether what the commits from `base` to `commit` publish (see
  // lib/scan.mts) holds one of the sandbox's secrets or a token-shaped string.
  leaksSecret(base: string, commit: string): boolean;
  publish: typeof publish;
  // What's wrong with how the worktree finds its repository (see
  // lib/host-safety.mts); empty when nothing is.
  worktreeProblems(worktreePath: string): string[];
  // Text from the sandbox (a failed publish's error, the architect's design
  // note), made safe to post on the public issue.
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
  return holdsSecret(cleaned) ? "(This text isn't shown: it looked like it held a secret. See the run log.)" : cleaned;
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
  // Scoped like the failed-attempt count: a person who re-queues a handed-back
  // issue may have rewritten it, so the architect starts that issue afresh
  // rather than build on a design that went with the failed attempts.
  latestDesignNote: (issueNumber) =>
    markerComments(issueNumber, "sandcastle:needs-human", DESIGN_MARKER).at(-1)?.body.replace(DESIGN_MARKER, "").trim(),
  markBuilding: (issueNumber) => claimBuildingLabel(issueNumber),
  unmarkBuilding: (issueNumber) => releaseBuildingLabel(issueNumber),
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
//
// The issue carries sandcastle:building from before its sandbox is created
// until after it closes (#150), so a second Sandcastle run's gate holds it
// back, and a run that finds another already marked it never creates or
// closes a sandbox on the worktree that run is using (worktreePathFor names
// it after the branch alone).
export async function buildIssue(
  issue: RoledIssue,
  branch: string,
  base: string,
  host: BuildHost = liveHost,
): Promise<BuildResult> {
  // A label that can't be added stops the build: building unmarked is how two
  // runs end up on one issue. The throw reaches main.mts's allSettled, so it
  // skips this issue for the round without counting an attempt.
  if (!host.markBuilding(issue.number)) {
    console.error(`  ⏸ #${issue.number}: another run marked it ${BUILDING_LABEL} after this round's gate, so this run leaves it alone.`);
    return { commits: [], prUrl: undefined, publishFailed: false };
  }
  try {
    return await buildMarkedIssue(issue, branch, base, host);
  } finally {
    // A label that can't be removed mustn't replace the build's own outcome.
    // The issue stays remembered, so this run's exit tries again (see
    // main.mts), and failing that a later startup clears the label as stale
    // (lib/building.mts).
    try {
      host.unmarkBuilding(issue.number);
    } catch (error) {
      console.error(
        `  ⚠ #${issue.number}: removing ${BUILDING_LABEL} failed, so it's tried again when this run exits: ${error}`,
      );
    }
  }
}

type BuildResult = { commits: { sha: string }[]; prUrl: string | undefined; publishFailed: boolean };

// buildIssue's work once the issue is marked: everything from creating the
// sandbox to closing it.
async function buildMarkedIssue(
  issue: RoledIssue,
  branch: string,
  base: string,
  host: BuildHost,
): Promise<BuildResult> {
  const sandbox = await host.createSandbox(branch);

  const promptArgs = issuePromptArgs(issue, branch);
  const commits: { sha: string }[] = [];
  const notPublished = { commits, prUrl: undefined, publishFailed: false };
  const log = (line: string) => host.log(`  #${issue.number} ${line}`);

  // Run the architect, the tester, the backend developer or the UI developer.
  // Returns false when the run threw, timed out or used up its iterations
  // without signalling completion: the design, the tests or the code aren't
  // done, so the issue stops for this round. Whatever the run committed stays
  // on the branch for the next round, and the failure counts as one of the
  // issue's build attempts, as a checkpoint that stays red does. An
  // UncountedStopError is rethrown instead.
  async function developerFinishes(role: "architect" | "tester" | "backend" | "ui"): Promise<boolean> {
    // Read outside the try: a gh failure reading the earlier design note is
    // the host's, not the architect's, so it mustn't count as a failed attempt.
    const roleArgs = role === "architect" ? architectPromptArgs(issue, branch, host.latestDesignNote(issue.number)) : promptArgs;
    let failure: string;
    try {
      const run = await runRoleInSandbox(sandbox, role, {
        promptFile: `./.sandcastle/roles/${role}.md`,
        promptArgs: roleArgs,
      });
      commits.push(...run.commits);
      if (run.completionSignal !== undefined) {
        log(`${role} finished`);
        return true;
      }
      failure = `the ${role} ran out of iterations unfinished`;
    } catch (error) {
      // Nothing throws UncountedStopError yet: recognising a usage-limit or
      // time-budget stop in the role runner is #147's. Until it lands, such a
      // stop counts as a failed attempt; runs are started by hand until then,
      // and removing sandcastle:needs-human undoes a wrong hand-back.
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

  // Post the architect's design note on the issue, so it outlives the
  // sandbox: .sandcastle/work/ is gitignored, and a re-run's architect reads
  // it back through host.latestDesignNote. The file is read inside the
  // sandbox, not from the host, since an agent wrote it (it could be a
  // symlink to a host file). A missing note or a failed comment is logged,
  // not a failed build: this build's roles still read the file itself.
  async function postDesignNote(): Promise<void> {
    const path = `.sandcastle/work/${issue.number}/design.md`;
    const read = await sandbox.exec(`cat ${path} 2>/dev/null`);
    const note = read.exitCode === 0 ? read.stdout.trim() : "";
    if (note === "") {
      console.error(`  ⚠ #${issue.number}: the architect wrote no design note at ${path}, so none is posted.`);
      return;
    }
    const body =
      `${DESIGN_MARKER}\n` +
      `Sandcastle's architect wrote this design note for \`${branch}\`. The tester and developers build from it, and ` +
      `the reviewer checks it was followed.\n\n${truncateDesignNote(host.publicError(note), path)}`;
    try {
      host.commentOnIssue(issue.number, body);
    } catch (error) {
      console.error(`  ⚠ #${issue.number}: posting the design note failed: ${error}`);
    }
  }

  try {
    if (issue.roles.includes("architect")) {
      if (!(await developerFinishes("architect"))) return notPublished;
      await postDesignNote();
    }
    if (!(await developerFinishes("tester"))) return notPublished;
    if (!(await developerFinishes("backend"))) return notPublished;
    if (issue.roles.includes("ui") && !(await developerFinishes("ui"))) return notPublished;

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

    // A failed scribe doesn't strand finished work: the code is gated, so
    // publish anyway and say so in the PR. Out of usage or time, leave the
    // branch for a later round, as the reviewer does below.
    let docsFailed = false;
    if (issue.roles.includes("scribe")) {
      try {
        const scribe = await runRoleInSandbox(sandbox, "scribe", {
          promptFile: "./.sandcastle/roles/scribe.md",
          promptArgs,
        });
        commits.push(...scribe.commits);
        if (scribe.completionSignal === undefined) {
          console.error(`  ⚠ #${issue.number}: the scribe ran out of iterations unfinished, publishing with a note.`);
          docsFailed = true;
        } else {
          log("scribe finished");
        }
      } catch (error) {
        if (error instanceof UncountedStopError) throw error;
        console.error(`  ⚠ #${issue.number}: scribe failed, publishing with a note: ${error}`);
        docsFailed = true;
      }
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
      const prUrl = await host.publish(issue, branch, gated, reviewed, docsFailed);
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
