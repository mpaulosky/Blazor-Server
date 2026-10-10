// gh helpers. Only the host talks to GitHub: the sandbox gets no token, so
// everything a role needs from GitHub reaches it through its prompt. Every gh
// command runs in the main checkout, never in a worktree, and names the
// repository itself (--repo, or repos/<owner>/<name> for gh api) rather than
// working it out from the git remote of wherever it runs.

import { execFileSync } from "node:child_process";
import { SANDCASTLE_LABELS, type SandcastleLabel } from "./config.mts";
import { handBackReport, type HandBackReport } from "./report.mts";
import { sh } from "./shell.mts";

let repo: string | undefined;

// "owner/name" of the repository in the current directory, the main checkout.
// Read on first use rather than at import, so importing a module never shells
// out to gh.
export function repoName(): string {
  repo ??= sh(process.cwd(), "gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner");
  return repo;
}

export function repoOwner(): string {
  return repoName().split("/")[0]!;
}

export type GhIssue = {
  number: number;
  title: string;
  body: string;
  labels: string[];
  comments: { author: string; body: string }[];
};

export type SandcastleIssue = Omit<GhIssue, "comments"> & {
  // Only the repository owner's comments; see ownerApproved.
  comments: string[];
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
      process.cwd(), "gh", "issue", "list", "--repo", repoName(), "--state", "open", "--label", "Sandcastle", "--limit", "1000",
      "--json", "number,title,body,labels,comments",
      "--jq", "[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[] | {author: .author.login, body}]}]",
    ),
  ) as GhIssue[];
  const owner = repoOwner();
  return issues.map((issue) => ownerApproved(issue, owner));
}

export type OpenPullRequest = { number: number; headRefName: string };

// An open pull request as gh pr list reports it.
export type ListedPullRequest = OpenPullRequest & { isCrossRepository: boolean; url?: string };

// Only the pull requests whose branch is in this repository. Anyone can open a
// pull request from a fork, with any branch name: matching those by name would
// let an outsider hold an issue back, pass a fork's PR off as the one the host
// opened, or get the fork's changed paths in front of the critique.
export function sameRepository<T extends Pick<ListedPullRequest, "isCrossRepository">>(pullRequests: readonly T[]): T[] {
  return pullRequests.filter((pr) => pr.isCrossRepository === false);
}

// The open pull requests from this repository's branches, and their head
// branches. gh pages through results up to --limit, so the cap sits far above
// any real queue: a PR missed here would let its issue be built twice.
export function openPullRequests(): OpenPullRequest[] {
  const listed = JSON.parse(
    sh(
      process.cwd(), "gh", "pr", "list", "--repo", repoName(), "--state", "open", "--limit", "1000",
      "--json", "number,headRefName,isCrossRepository",
    ),
  ) as ListedPullRequest[];
  return sameRepository(listed).map(({ number, headRefName }) => ({ number, headRefName }));
}

// The open pull request from this repository's `branch`, or a new one for it
// with the title and body, as its URL. A fork's PR from a branch of the same
// name doesn't count.
// Run gh with its stderr captured, and throw with that stderr in the message,
// so a caller can say why it failed.
function ghWithStderr(run: typeof execFileSync, args: string[], input?: string): string {
  try {
    return run("gh", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      ...(input === undefined ? {} : { input }),
    });
  } catch (error) {
    const stderr = (error as { stderr?: unknown }).stderr;
    const detail = typeof stderr === "string" ? stderr.trim() : "";
    throw new Error(`gh ${args.slice(0, 2).join(" ")} failed${detail ? `:\n${detail}` : ""}`, { cause: error });
  }
}

export function openPullRequest(
  branch: string,
  title: string,
  body: string,
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
): string {
  const listed = JSON.parse(
    ghWithStderr(run, [
      "pr", "list", "--repo", repo, "--head", branch, "--state", "open", "--json", "number,headRefName,isCrossRepository,url",
    ]),
  ) as ListedPullRequest[];
  const existing = sameRepository(listed).find((pr) => pr.headRefName === branch)?.url;
  if (existing) return existing;
  return ghWithStderr(
    run,
    ["pr", "create", "--repo", repo, "--base", "main", "--head", branch, "--title", title, "--body-file", "-"],
    body,
  ).trim();
}

// The paths an open PR changes.
export function pullRequestFiles(pr: number): string[] {
  return JSON.parse(
    sh(process.cwd(), "gh", "pr", "view", String(pr), "--repo", repoName(), "--json", "files", "--jq", "[.files[].path]"),
  ) as string[];
}

// Any issue's body, or "" when it has none.
export function issueBody(number: number): string {
  return sh(process.cwd(), "gh", "api", `repos/${repoName()}/issues/${number}`, "--jq", '.body // ""');
}

// Add the native "#issue blocked by #blocker" link. The API names the blocker
// by its id, not its number.
export function addBlockedBy(issue: number, blocker: number): void {
  const id = sh(process.cwd(), "gh", "api", `repos/${repoName()}/issues/${blocker}`, "--jq", ".id");
  sh(
    process.cwd(), "gh", "api", "--method", "POST", `repos/${repoName()}/issues/${issue}/dependencies/blocked_by`,
    "-F", `issue_id=${id}`,
  );
}

export function commentOnIssue(
  issue: number,
  body: string,
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
): void {
  run("gh", ["issue", "comment", String(issue), "--repo", repo, "--body-file", "-"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
    input: body,
  });
}

// Creates any of `labels` this repository doesn't already have, with its
// colour and description. Run once at the host's startup, before the first
// round, so a fresh repository (or one whose labels were deleted) always has
// them (see docs/plans/sandcastle-workflow.md, "Labels").
export function ensureLabels(
  labels: readonly SandcastleLabel[] = SANDCASTLE_LABELS,
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
): void {
  const existing = new Set(
    (JSON.parse(ghWithStderr(run, ["label", "list", "--repo", repo, "--limit", "1000", "--json", "name", "--jq", "[.[].name]"])) as string[])
      // GitHub matches label names case-insensitively, so creating one that
      // differs only in case would fail.
      .map((name) => name.toLowerCase()),
  );
  for (const label of labels) {
    if (existing.has(label.name.toLowerCase())) continue;
    ghWithStderr(run, ["label", "create", label.name, "--repo", repo, "--color", label.color, "--description", label.description]);
  }
}

// One "labeled" or "unlabeled" event from an issue's or PR's REST timeline.
export type TimelineLabelEvent = { event: "labeled" | "unlabeled"; label: string; createdAt: string };

// One comment, with when it was posted, so markerCommentsSince can tell
// which side of a label's removal it falls on, and who posted it.
export type TimestampedComment = { body: string; createdAt: string; author: string };

// The comments in `comments` that `poster` posted and that carry `marker`,
// posted after `label` was last removed from this issue or PR (its most
// recent "unlabeled" event naming `label` in `timeline`), or since
// `createdAt` when `label` was never removed. Counting from the timeline rather than a running counter means the
// count survives a restart, and a human re-queueing by removing the label
// resets it (see docs/plans/sandcastle-workflow.md, "Giving up and telling
// the human").
export function markerCommentsSince(
  comments: readonly TimestampedComment[],
  timeline: readonly TimelineLabelEvent[],
  label: string,
  marker: string,
  createdAt: string,
  poster: string,
): TimestampedComment[] {
  const since = Math.max(
    timestamp(createdAt),
    ...timeline.filter((event) => event.event === "unlabeled" && event.label === label).map((event) => timestamp(event.createdAt)),
  );
  return comments.filter(
    (comment) => comment.author === poster && comment.body.includes(marker) && timestamp(comment.createdAt) >= since,
  );
}

// An ISO 8601 time as milliseconds. Throws on one that doesn't parse rather
// than let NaN quietly drop or keep a comment from the count.
function timestamp(time: string): number {
  const ms = Date.parse(time);
  if (Number.isNaN(ms)) throw new Error(`GitHub returned a time that doesn't parse: ${JSON.stringify(time)}`);
  return ms;
}

// The login gh is signed in as: the account every host comment is posted
// from. Not the repository owner, which is an organization for a repository
// an organization owns, and never posts a comment itself.
export function hostLogin(run: typeof execFileSync = execFileSync): string {
  return ghWithStderr(run, ["api", "user", "--jq", ".login"]).trim();
}

let signedInLogin: string | undefined;

// The comments on the issue or PR `number` that carry `marker` and were posted
// since `label` was last removed (see markerCommentsSince). Only the host's own
// comments count (see hostLogin): anyone can comment on a public issue, so a
// stranger could otherwise paste the marker in to hand the issue back early.
// PRs share the issues API, so this covers both.
export function markerComments(number: number, label: string, marker: string, repo: string = repoName()): TimestampedComment[] {
  const lines = (output: string) =>
    output
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as unknown);
  signedInLogin ??= hostLogin();
  // Each item is printed as one line of JSON (@json), so the pages
  // --paginate fetches concatenate into lines that parse one at a time.
  const comments = lines(
    sh(
      process.cwd(), "gh", "api", "--paginate", `repos/${repo}/issues/${number}/comments`,
      "--jq", ".[] | {body, createdAt: .created_at, author: .user.login} | @json",
    ),
  ) as TimestampedComment[];
  const timeline = lines(
    sh(
      process.cwd(), "gh", "api", "--paginate", `repos/${repo}/issues/${number}/timeline`,
      "--jq", '.[] | select(.event == "labeled" or .event == "unlabeled") | {event, label: .label.name, createdAt: .created_at} | @json',
    ),
  ) as TimelineLabelEvent[];
  const createdAt = sh(process.cwd(), "gh", "api", `repos/${repo}/issues/${number}`, "--jq", ".created_at");
  return markerCommentsSince(comments, timeline, label, marker, createdAt, signedInLogin);
}

// A label only the host or a human applies to hand work back: the issue's or
// PR's text, or Sandcastle's own effort, is the problem.
export type HandBackLabel = "sandcastle:needs-info" | "sandcastle:needs-human";

export type HandBackTarget = { kind: "issue" | "pr"; number: number };

// Hands `target` back to a human: adds `label`, with one comment carrying
// `body`, and records the hand-back in `report` (see lib/report.mts) under
// `reason`, for the run's final summary. An issue-level
// `sandcastle:needs-human` also removes `sandcastle:ready`, so a re-queue
// re-runs intake on the current text before the build starts again; a
// PR-level one leaves `sandcastle:ready` alone (see "Giving up and telling
// the human").
export function handBack(
  target: HandBackTarget,
  label: HandBackLabel,
  reason: string,
  body: string,
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
  report: HandBackReport = handBackReport,
): void {
  const number = String(target.number);
  const removeReady = target.kind === "issue" && label === "sandcastle:needs-human" ? ["--remove-label", "sandcastle:ready"] : [];
  // The comment goes first: if GitHub rejects it, the labels are untouched and
  // the work stays in the queue, rather than leaving it with no explanation.
  ghWithStderr(run, [target.kind, "comment", number, "--repo", repo, "--body-file", "-"], body);
  ghWithStderr(run, [target.kind, "edit", number, "--repo", repo, "--add-label", label, ...removeReady]);
  report.record({ target: `${target.kind} #${target.number}`, label, reason });
}
