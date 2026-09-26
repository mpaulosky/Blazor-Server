// gh helpers. Only the host talks to GitHub: the sandbox gets no token, so
// everything a role needs from GitHub reaches it through its prompt.

import { sh } from "./shell.mts";

let repo: string | undefined;

// "owner/name" of the repository in the current directory. Read on first use
// rather than at import, so importing a module never shells out to gh.
export function repoName(): string {
  repo ??= sh(process.cwd(), "gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner");
  return repo;
}

export function repoOwner(): string {
  return repoName().split("/")[0]!;
}

export type SandcastleIssue = {
  number: number;
  title: string;
  body: string;
  labels: string[];
  // Only the repository owner's comments; see ownerApproved.
  comments: string[];
};

export type GhIssue = {
  number: number;
  title: string;
  body: string;
  labels: string[];
  comments: { author: string; body: string }[];
};

// Keep only the owner's comments, so text from anyone else never reaches a
// role's prompt.
export function ownerApproved(issue: GhIssue, owner: string): SandcastleIssue {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
    comments: issue.comments.filter((comment) => comment.author === owner).map((comment) => comment.body),
  };
}

// The open Sandcastle issues, with everyone's comments but the owner's dropped.
export function listSandcastleIssues(): SandcastleIssue[] {
  const issues = JSON.parse(
    sh(
      process.cwd(), "gh", "issue", "list", "--state", "open", "--label", "Sandcastle", "--limit", "100",
      "--json", "number,title,body,labels,comments",
      "--jq", "[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[] | {author: .author.login, body}]}]",
    ),
  ) as GhIssue[];
  const owner = repoOwner();
  return issues.map((issue) => ownerApproved(issue, owner));
}

// Head branches that already have an open pull request.
export function openPrBranches(): string[] {
  return sh(
    process.cwd(), "gh", "pr", "list", "--state", "open", "--limit", "100",
    "--json", "headRefName", "--jq", ".[].headRefName",
  )
    .split("\n")
    .filter(Boolean);
}
