// Build one planned issue: implement, review and publish it from a single
// sandbox, so the implementer and reviewer share the same worktree.
// Nothing is merged locally: every change reaches main through a reviewed PR.

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { runRoleInSandbox } from "./agents.mts";
import { commitsAhead } from "./branches.mts";
import { copyToWorktree, hooks } from "./config.mts";
import type { SandcastleIssue } from "./github.mts";
import type { PlannedIssue } from "./plan.mts";
import { issuePromptArgs } from "./prompts.mts";
import { sh } from "./shell.mts";

// Push an issue branch from its worktree and open (or reuse) the PR that closes
// the issue. Pushing from the worktree matters: the pre-push hook checks the
// checked-out branch's name and runs lint and tests against that tree.
export function publish(
  issue: { id: string; title: string; branch: string },
  worktreePath: string,
  reviewed: boolean,
): string {
  sh(worktreePath, "git", "push", "--force-with-lease", "-u", "origin", issue.branch);

  const existing = sh(
    worktreePath, "gh", "pr", "list", "--head", issue.branch, "--state", "open",
    "--json", "url", "--jq", ".[0].url",
  );
  if (existing) return existing;

  return sh(
    worktreePath, "gh", "pr", "create", "--base", "main", "--head", issue.branch,
    "--title", issue.title,
    "--body", reviewed
      ? `Closes #${issue.id}\n\nImplemented and reviewed by Sandcastle.`
      : `Closes #${issue.id}\n\nImplemented by Sandcastle. ⚠️ The review step failed, so no agent has reviewed this PR.`,
  );
}

// The implementer runs first; if the branch is then ahead of main, the
// reviewer runs in the same sandbox, and the branch is pushed and gets a pull
// request that closes its issue. Returns the PR's URL, or undefined when the
// branch holds nothing to publish.
export async function buildIssue(
  planned: PlannedIssue,
  issue: SandcastleIssue,
): Promise<{ commits: { sha: string }[]; prUrl: string | undefined }> {
  const sandbox = await sandcastle.createSandbox({
    branch: planned.branch,
    sandbox: docker(),
    hooks,
    copyToWorktree,
  });

  try {
    const implement = await runRoleInSandbox(sandbox, "implementer", {
      promptFile: "./.sandcastle/implement-prompt.md",
      promptArgs: issuePromptArgs(issue, planned.branch),
    });

    // Review and publish whenever the branch holds work that main doesn't,
    // not only when this run added commits: a re-run of a finished issue
    // makes none, and its earlier work still needs a PR.
    if (commitsAhead(sandbox.worktreePath) === 0) {
      return { commits: implement.commits, prUrl: undefined };
    }

    let reviewCommits: typeof implement.commits = [];
    let reviewed = true;
    try {
      const review = await runRoleInSandbox(sandbox, "reviewer", {
        promptFile: "./.sandcastle/review-prompt.md",
        promptArgs: issuePromptArgs(issue, planned.branch),
      });
      reviewCommits = review.commits;
    } catch (error) {
      // A failed review shouldn't strand finished work: publish anyway and
      // say so in the PR, which gets a human review regardless.
      console.error(`  ⚠ ${planned.id}: reviewer failed, publishing unreviewed: ${error}`);
      reviewed = false;
    }

    // Publish while the worktree still exists; close() may remove it.
    return {
      commits: [...implement.commits, ...reviewCommits],
      prUrl: publish(planned, sandbox.worktreePath, reviewed),
    };
  } finally {
    await sandbox.close();
  }
}
