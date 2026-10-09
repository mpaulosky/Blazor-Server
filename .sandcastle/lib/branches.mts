// Branch naming and fetching. Branch names come from code, never from a model,
// so re-planning an issue always lands on the branch that holds its earlier work.

import type { SandcastleIssue } from "./github.mts";
import { BASE_BRANCH } from "./config.mts";
import { git } from "./shell.mts";

const maxSlugLength = 50;

// The branch prefixes that name an issue, per docs/PROCESS.md: feature/ for new
// behaviour, fix/ for a bug fix and hotfix/ for an urgent fix.
const issuePrefixes = ["feature", "fix", "hotfix"] as const;

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

// Whether a branch is the issue's: feature/{n}-{slug}, fix/{n}-{slug} or
// hotfix/{n}-{slug}, with a slug scripts/check-branch-name.sh accepts. Only such
// a name is reused or counted as the issue's PR: a branch name reaches a shell,
// since review-prompt.md passes {{BRANCH}} to the `git diff` it runs in the
// sandbox, and anyone with push access could name a branch `fix/4-$(...)`.
export function isIssueBranch(branch: string, issueNumber: number): boolean {
  return new RegExp(`^(?:${issuePrefixes.join("|")})/${issueNumber}-[a-z0-9]+(?:-[a-z0-9]+)*$`).test(branch);
}

// The issue's branch: its existing feature/, fix/ or hotfix/{n}-{slug} branch on the
// remote when there is one, even if the title or labels have changed since, so
// earlier work is built on rather than redone. Otherwise fix/{n}-{slug} for a
// bug and feature/{n}-{slug} for everything else. No label marks a fix as
// urgent, so Sandcastle never names a hotfix/ branch itself.
export function branchFor(issue: BranchIssue, remoteBranches: readonly string[]): string {
  const existing = remoteBranches
    .filter((branch) => isIssueBranch(branch, issue.number))
    .sort()[0];
  if (existing) return existing;

  const prefix = issue.labels.includes("bug") ? "fix" : "feature";
  return `${prefix}/${issue.number}-${slugFor(issue.title)}`;
}

// Branch names from `git ls-remote --heads` output, without refs/heads/.
export function parseHeads(lsRemote: string): string[] {
  return lsRemote
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t")[1]!.replace(/^refs\/heads\//, ""));
}

// The remote git operations prepareBranches needs; tests pass a stub.
export type RemoteGit = {
  // The feature/*, fix/* and hotfix/* branches on origin.
  issueBranches(): string[];
  // Fetch origin's branch into its remote-tracking ref.
  fetch(branch: string): void;
};

const originGit: RemoteGit = {
  issueBranches: () =>
    parseHeads(git("ls-remote", "--heads", "origin", ...issuePrefixes.map((prefix) => `refs/heads/${prefix}/*`))),
  fetch: (branch) => {
    git("fetch", "--quiet", "origin", `+refs/heads/${branch}:refs/remotes/origin/${branch}`);
  },
};

// Count the commits on the issue branch that BASE_BRANCH doesn't have, the
// same range the reviewer diffs. Counted by ref in the main checkout, never in
// the branch's worktree (see lib/host-safety.mts). origin/main is refreshed
// once per round, before the pipelines start, because concurrent fetches from
// each pipeline would contend on the same ref lock.
export function commitsAhead(branch: string): number {
  return Number(git("rev-list", "--count", `${BASE_BRANCH}..refs/heads/${branch}`));
}

export function fetchMain(): void {
  git("fetch", "--quiet", "origin", "main");
}

// Name each issue's branch, and fetch the ones that already exist on origin
// into their remote-tracking refs so createSandbox() checks them out from
// origin/<branch>. Without the fetch, Sandcastle finds no such branch and
// silently starts a fresh one from main. The fetches run serially, before the
// pipelines start, for the same reason as fetchMain.
export function prepareBranches<T extends BranchIssue>(issues: T[], git: RemoteGit = originGit): { issue: T; branch: string }[] {
  const remoteBranches = git.issueBranches();
  return issues.map((issue) => {
    const branch = branchFor(issue, remoteBranches);
    if (remoteBranches.includes(branch)) git.fetch(branch);
    return { issue, branch };
  });
}
