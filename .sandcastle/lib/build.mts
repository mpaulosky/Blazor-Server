// Build one planned issue: test, implement, gate, review, gate again and publish it
// from a single sandbox, so every role and the gate share the same worktree.
// Nothing is merged locally: every change reaches main through a reviewed PR.

import * as sandcastle from "@ai-hero/sandcastle";
import { runRoleInSandbox } from "./agents.mts";
import { commitsAhead } from "./branches.mts";
import { gateFailureComment, runCheckpoint, runGate, type Checkpoint } from "./checkpoint.mts";
import { copyToWorktree, hooks } from "./config.mts";
import { commentOnIssue, type SandcastleIssue } from "./github.mts";
import { gateFixerPromptArgs, issuePromptArgs } from "./prompts.mts";
import { sh } from "./shell.mts";
import { agentSandbox } from "./skills.mts";

// Push an issue branch from its worktree and open (or reuse) the PR that closes
// the issue. Pushing from the worktree matters: the pre-push hook refuses a
// commit other than the checkout's HEAD, because its gate tests the working tree.
function publish(
  issue: SandcastleIssue,
  branch: string,
  worktreePath: string,
  reviewed: boolean,
): string {
  sh(worktreePath, "git", "push", "--force-with-lease", "-u", "origin", branch);

  const existing = sh(
    worktreePath, "gh", "pr", "list", "--head", branch, "--state", "open",
    "--json", "url", "--jq", ".[0].url",
  );
  if (existing) return existing;

  return sh(
    worktreePath, "gh", "pr", "create", "--base", "main", "--head", branch,
    "--title", issue.title,
    "--body", reviewed
      ? `Closes #${issue.number}\n\nImplemented and reviewed by Sandcastle.`
      : `Closes #${issue.number}\n\nImplemented by Sandcastle. ⚠️ The review step failed, so no agent has reviewed this PR.`,
  );
}

// What buildIssue needs from outside the pipeline; tests pass stubs.
export type BuildHost = {
  createSandbox(branch: string): Promise<sandcastle.Sandbox>;
  commitsAhead(worktreePath: string): number;
  commentOnIssue(issueNumber: number, body: string): void;
  publish: typeof publish;
  log(line: string): void;
};

const liveHost: BuildHost = {
  createSandbox: (branch) => sandcastle.createSandbox({ branch, sandbox: agentSandbox(), hooks, copyToWorktree }),
  commitsAhead,
  commentOnIssue,
  publish,
  log: console.log,
};

// The branch comes from prepareBranches, which has already fetched it when it
// exists on origin. The tester commits failing tests for the acceptance
// criteria, then the backend developer makes them pass. If the branch is then
// ahead of main, the gate runs (checkpoint 1), the reviewer runs, and the gate
// runs again (checkpoint 2) before the branch is pushed and gets a pull request
// that closes its issue. Returns the PR's URL, or undefined when a developer
// run failed, the branch holds nothing to publish or a checkpoint's gate
// stayed red.
export async function buildIssue(
  issue: SandcastleIssue,
  branch: string,
  host: BuildHost = liveHost,
): Promise<{ commits: { sha: string }[]; prUrl: string | undefined }> {
  const sandbox = await host.createSandbox(branch);

  const promptArgs = issuePromptArgs(issue, branch);
  const commits: { sha: string }[] = [];
  const log = (line: string) => host.log(`  #${issue.number} ${line}`);

  // Run the tester or the backend developer. Returns false when the run threw,
  // timed out or used up its iterations without signalling completion: the
  // tests aren't written or aren't green, so the issue stops for this round.
  // Whatever the run committed stays on the branch for the next round.
  async function developerFinishes(role: "tester" | "backend"): Promise<boolean> {
    try {
      const run = await runRoleInSandbox(sandbox, role, {
        promptFile: `./.sandcastle/roles/${role}.md`,
        promptArgs,
      });
      commits.push(...run.commits);
      if (run.completionSignal === undefined) {
        console.error(`  ✗ #${issue.number}: the ${role} ran out of iterations unfinished, so ${branch} isn't published.`);
        return false;
      }
    } catch (error) {
      console.error(`  ✗ #${issue.number}: the ${role} failed, so ${branch} isn't published: ${error}`);
      return false;
    }
    log(`${role} finished`);
    return true;
  }

  // Run a gate checkpoint, with the gate-fixer while the gate is red. When it's
  // still red past the fixer's attempts, nothing is published: the branch keeps
  // its commits, and the issue gets the tail of the gate output.
  async function gatePasses(checkpoint: Checkpoint): Promise<boolean> {
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
    if (!result.passed) {
      console.error(`  ✗ #${issue.number}: the gate is still red at checkpoint ${checkpoint}, so ${branch} isn't published.`);
      host.commentOnIssue(issue.number, gateFailureComment(checkpoint, branch, result.output));
    }
    return result.passed;
  }

  async function recordGatedHead(): Promise<void> {
    const result = await sandbox.exec("git config --local sandcastle.gatedHead \"$(git rev-parse HEAD)\"");
    if (result.exitCode !== 0) {
      throw new Error(`failed to record checkpoint-2 success for HEAD: ${result.stderr || result.stdout}`);
    }
  }

  try {
    if (!(await developerFinishes("tester"))) return { commits, prUrl: undefined };
    if (!(await developerFinishes("backend"))) return { commits, prUrl: undefined };

    // Gate, review and publish whenever the branch holds work that main
    // doesn't, not only when this run added commits: a re-run of a finished
    // issue makes none, and its earlier work still needs a PR.
    if (host.commitsAhead(sandbox.worktreePath) === 0) {
      const status = await sandbox.exec("git status --porcelain 2>&1");
      if (status.exitCode === 0 && status.stdout.trim() === "") {
        return { commits, prUrl: undefined };
      }
    }

    if (!(await gatePasses(1))) return { commits, prUrl: undefined };
    if (host.commitsAhead(sandbox.worktreePath) === 0) {
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

    if (!(await gatePasses(2))) return { commits, prUrl: undefined };
    await recordGatedHead();

    // Publish while the worktree still exists; close() may remove it.
    return { commits, prUrl: host.publish(issue, branch, sandbox.worktreePath, reviewed) };
  } finally {
    await sandbox.close();
  }
}
