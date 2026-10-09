// Build one planned issue: test, implement, gate, review, gate again and publish it
// from a single sandbox, so every role and the gate share the same worktree.
// Nothing is merged locally: every change reaches main through a reviewed PR.

import { existsSync } from "node:fs";
import * as sandcastle from "@ai-hero/sandcastle";
import { runRoleInSandbox } from "./agents.mts";
import { commitsAhead } from "./branches.mts";
import { gateFailureComment, runCheckpoint, runGate, type Checkpoint } from "./checkpoint.mts";
import { BASE_BRANCH, copyToWorktree, hooks } from "./config.mts";
import { commentOnIssue, openPullRequest, type SandcastleIssue } from "./github.mts";
import { repoGitDir, worktreeLinkProblems, worktreePathFor } from "./host-safety.mts";
import { gateFixerPromptArgs, issuePromptArgs } from "./prompts.mts";
import { containsSandboxSecret, containsSecret } from "./sandbox-env.mts";
import { publishedText } from "./scan.mts";
import { git } from "./shell.mts";
import { agentSandbox } from "./skills.mts";

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
function publish(issue: SandcastleIssue, branch: string, commit: string, reviewed: boolean): string {
  git("push", "--quiet", "origin", `${commit}:refs/heads/${branch}`);
  return openPullRequest(
    branch,
    issue.title,
    reviewed
      ? `Closes #${issue.number}\n\nImplemented and reviewed by Sandcastle.`
      : `Closes #${issue.number}\n\nImplemented by Sandcastle. ⚠️ The review step failed, so no agent has reviewed this PR.`,
  );
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
// stayed red.
export async function buildIssue(
  issue: SandcastleIssue,
  branch: string,
  base: string,
  host: BuildHost = liveHost,
): Promise<{ commits: { sha: string }[]; prUrl: string | undefined }> {
  const sandbox = await host.createSandbox(branch);

  const promptArgs = issuePromptArgs(issue, branch);
  const commits: { sha: string }[] = [];
  const log = (line: string) => host.log(`  #${issue.number} ${line}`);

  // Run the tester or the backend developer. Returns false when the run threw,
  // timed out or used up its iterations without signalling completion: the
  // tests aren't written or aren't green, so the issue stops for this round.
  // Whatever the run committed stays on the branch for the next round, and the
  // issue gets a comment, as it does when a checkpoint stays red.
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
      failure = `the ${role} failed: ${error}`;
    }
    console.error(`  ✗ #${issue.number}: ${failure}, so ${branch} isn't published.`);
    host.commentOnIssue(issue.number, developerFailureComment(failure, branch));
    return false;
  }

  // Run a gate checkpoint, with the gate-fixer while the gate is red. Returns
  // the commit the gate passed on. When it's still red past the fixer's
  // attempts, nothing is published: the branch keeps its commits, and the issue
  // gets the tail of the gate output.
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
      },
      log,
    );
    if (!result.passed || result.head === undefined) {
      console.error(`  ✗ #${issue.number}: the gate is still red at checkpoint ${checkpoint}, so ${branch} isn't published.`);
      host.commentOnIssue(issue.number, gateFailureComment(checkpoint, branch, result.output));
      return undefined;
    }
    return result.head;
  }

  try {
    if (!(await developerFinishes("tester"))) return { commits, prUrl: undefined };
    if (!(await developerFinishes("backend"))) return { commits, prUrl: undefined };

    // Gate, review and publish whenever the branch holds work that main
    // doesn't, not only when this run added commits: a re-run of a finished
    // issue makes none, and its earlier work still needs a PR.
    if (host.commitsAhead(branch, base) === 0) {
      const status = await sandbox.exec("git status --porcelain 2>&1");
      if (status.exitCode === 0 && status.stdout.trim() === "") {
        return { commits, prUrl: undefined };
      }
    }

    if ((await gatePasses(1)) === undefined) return { commits, prUrl: undefined };
    if (host.commitsAhead(branch, base) === 0) {
      return { commits, prUrl: undefined };
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
      // A failed review shouldn't strand finished work: publish anyway and
      // say so in the PR, which gets a human review regardless.
      console.error(`  ⚠ #${issue.number}: reviewer failed, publishing unreviewed: ${error}`);
      reviewed = false;
    }

    const gated = await gatePasses(2);
    if (gated === undefined) return { commits, prUrl: undefined };

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
      return { commits, prUrl: undefined };
    }

    // A push that doesn't fast-forward origin's branch (an agent rewrote a
    // commit an earlier round pushed) fails, and so can gh. Either needs a
    // person, so the issue gets git's or gh's error rather than only the run log.
    try {
      return { commits, prUrl: host.publish(issue, branch, gated, reviewed) };
    } catch (error) {
      console.error(`  ✗ #${issue.number}: publishing ${branch} failed: ${error}`);
      const detail = host.publicError(error);
      const fence = "`".repeat(Math.max(3, ...[...detail.matchAll(/`+/g)].map((match) => match[0].length + 1)));
      host.commentOnIssue(
        issue.number,
        `Sandcastle couldn't publish \`${branch}\`. A person needs to look at it: if origin's branch has commits the ` +
          "local one doesn't (an agent rewrote one an earlier round pushed), the two need reconciling before Sandcastle " +
          `can push it.\n\n${fence}text\n${detail}\n${fence}`,
      );
      return { commits, prUrl: undefined };
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
