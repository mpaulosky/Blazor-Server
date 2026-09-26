// Branch naming and fetching. Branch names come from code, never from a model,
// so re-planning an issue always lands on the branch that holds its earlier work.

import type { SandcastleIssue } from "./github.mts";
import { sh } from "./shell.mts";

const maxSlugLength = 50;

// The parts of an issue its branch name depends on.
type BranchIssue = Pick<SandcastleIssue, "number" | "title" | "labels">;

// The issue title as a branch slug: no conventional-commit prefix, lower case,
// apostrophes dropped so "haven't" stays one word, and runs of ASCII letters
// and digits joined with "-", cut to 50 characters at a "-" boundary.
export function slugFor(title: string): string {
  const words = title
    .replace(/^\s*[a-z]+(?:\([^)]*\))?!?:\s*/i, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .match(/[a-z0-9]+/g) ?? [];
  const slug = words.join("-");
  if (slug.length === 0) return "issue";
  if (slug.length <= maxSlugLength) return slug;

  const cut = slug.slice(0, maxSlugLength + 1);
  const boundary = cut.lastIndexOf("-");
  return boundary > 0 ? cut.slice(0, boundary) : slug.slice(0, maxSlugLength);
}

// Whether a branch belongs to the issue: feature/{n}-* or hotfix/{n}-*.
export function isIssueBranch(branch: string, issueNumber: number): boolean {
  return branch.startsWith(`feature/${issueNumber}-`) || branch.startsWith(`hotfix/${issueNumber}-`);
}

// The issue's branch: its existing feature/{n}-* or hotfix/{n}-* branch on the
// remote when there is one, even if the title or labels have changed since, so
// earlier work is built on rather than redone. Otherwise hotfix/{n}-{slug} for
// a bug and feature/{n}-{slug} for everything else.
export function branchFor(issue: BranchIssue, remoteBranches: readonly string[]): string {
  const existing = remoteBranches
    .filter((branch) => isIssueBranch(branch, issue.number))
    .sort()[0];
  if (existing) return existing;

  const prefix = issue.labels.includes("bug") ? "hotfix" : "feature";
  return `${prefix}/${issue.number}-${slugFor(issue.title)}`;
}

// The feature/* and hotfix/* branches on origin, without the refs/heads/ prefix.
function remoteIssueBranches(): string[] {
  return sh(process.cwd(), "git", "ls-remote", "--heads", "origin", "refs/heads/feature/*", "refs/heads/hotfix/*")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t")[1]!.replace(/^refs\/heads\//, ""));
}

// Count the commits on the worktree's branch that origin/main doesn't have.
// origin/main is refreshed once per round, before the pipelines start, because
// concurrent fetches from each pipeline would contend on the same ref lock.
export function commitsAhead(worktreePath: string): number {
  return Number(sh(worktreePath, "git", "rev-list", "--count", "origin/main..HEAD"));
}

export function fetchMain(): void {
  sh(process.cwd(), "git", "fetch", "--quiet", "origin", "main");
}

// Name each issue's branch, and fetch the ones that already exist on origin
// into their remote-tracking refs so createSandbox() checks them out from
// origin/<branch>. Without the fetch, Sandcastle finds no such branch and
// silently starts a fresh one from main. The fetches run serially, before the
// pipelines start, for the same reason as fetchMain.
export function prepareBranches<T extends BranchIssue>(issues: T[]): { issue: T; branch: string }[] {
  const remoteBranches = remoteIssueBranches();
  return issues.map((issue) => {
    const branch = branchFor(issue, remoteBranches);
    if (remoteBranches.includes(branch)) {
      sh(process.cwd(), "git", "fetch", "--quiet", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`);
    }
    return { issue, branch };
  });
}
