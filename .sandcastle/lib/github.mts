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

export type GhIssue = {
  number: number;
  title: string;
  body: string;
  labels: string[];
  comments: { author: string; body: string }[];
};

export type SandcastleIssue = Omit<GhIssue, "comments"> & {
  // Only the comments of authors with write access to the repository; see ownerApproved.
  comments: string[];
};

// Whether the issue carries `label`. GitHub matches label names
// case-insensitively, so a hand-made "Sandcastle:Ready" is the same label.
export function hasLabel(issue: Pick<SandcastleIssue, "labels">, label: string): boolean {
  return issue.labels.some((name) => name.toLowerCase() === label.toLowerCase());
}

// Keep only the comments of authors with admin, maintain or write permission
// on `repo`, so text from anyone else never reaches a role's prompt.
// Permission rather than the owner's login decides this, because in a
// repository an organization owns the owner never comments (#214). A
// permission lookup that fails drops that author's comments, so an error
// never lets a stranger's text through. `canPush` caches each author's
// answer, so a caller that shares one map across issues looks each author up
// once. Only GitHub's answer is cached, never a failure: one transient error
// would otherwise drop a maintainer's guidance for the rest of the run. A
// failure goes in `failed` instead, which a caller shares across one round's
// issues and starts afresh each round: the author's comments are dropped
// without another lookup or warning until then, since a retry within the same
// burst would most likely fail too and deepen a rate limit.
export function ownerApproved(
  issue: GhIssue,
  repo: string = repoName(),
  run: typeof execFileSync = execFileSync,
  canPush: Map<string, boolean> = new Map(),
  warn: (message: string) => void = console.error,
  failed: Set<string> = new Set(),
): SandcastleIssue {
  const trusted = (author: string): boolean => {
    const cached = canPush.get(author);
    if (cached !== undefined) return cached;
    if (failed.has(author)) return false;
    const allowed = hasWriteAccess(author, repo, run, warn);
    if (allowed === undefined) failed.add(author);
    else canPush.set(author, allowed);
    return allowed ?? false;
  };
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    labels: issue.labels,
    comments: issue.comments.filter((comment) => trusted(comment.author)).map((comment) => comment.body),
  };
}

const PUSH_PERMISSIONS: ReadonlySet<unknown> = new Set(["admin", "maintain", "write"]);

// Whether `login` can push to `repo`. GitHub reports maintain as "write" in
// `.permission` and names it only in `.role_name`, so either field counts. A
// 404 whose message says the login "is not a user", as for the bare
// "github-actions" gh prints for a GitHub App's comment, is a definite no,
// cached and not reported. Any other 404 means the token can't see the
// repository, which says nothing about the author. Any other failure, or an answer with neither field, is reported
// through `warn` and returns undefined: it says nothing about the author's
// access.
function hasWriteAccess(
  login: string,
  repo: string,
  run: typeof execFileSync,
  warn: (message: string) => void,
): boolean | undefined {
  try {
    const answer = JSON.parse(
      ghWithStderr(run, ["api", `repos/${repo}/collaborators/${encodeURIComponent(login)}/permission`]),
    ) as { permission?: unknown; role_name?: unknown };
    if (typeof answer.permission !== "string" && typeof answer.role_name !== "string") {
      throw new Error(`unexpected answer: ${JSON.stringify(answer)}`);
    }
    return PUSH_PERMISSIONS.has(answer.permission) || PUSH_PERMISSIONS.has(answer.role_name);
  } catch (error) {
    if (/is not a user \(HTTP 404\)/.test(String(error))) return false;
    warn(`  ⚠ Couldn't read ${login}'s permission on ${repo}, so their comments are left out this time: ${error}`);
    return undefined;
  }
}

// Each comment author's answer from ownerApproved, kept for the whole run so
// no author is looked up twice, however many issues or rounds they comment on.
// The trade-off: write access revoked partway through a run isn't seen until
// the next run, so stop the run to cut someone off at once.
const commenterCanPush = new Map<string, boolean>();

// The open Sandcastle issues, with every comment dropped but those from
// authors with write access. The gate calls this once per round: `canPush`
// carries authors' answers across the run, and each call starts a fresh set
// of failed lookups, so a failure is retried next round.
export function listSandcastleIssues(
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
  canPush: Map<string, boolean> = commenterCanPush,
  warn: (message: string) => void = console.error,
): SandcastleIssue[] {
  const issues = JSON.parse(
    ghWithStderr(run, [
      "issue", "list", "--repo", repo, "--state", "open", "--label", "Sandcastle", "--limit", "1000",
      "--json", "number,title,body,labels,comments",
      "--jq", "[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[] | {author: .author.login, body}]}]",
    ]),
  ) as GhIssue[];
  const failed = new Set<string>();
  return issues.map((issue) => ownerApproved(issue, repo, run, canPush, warn, failed));
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

// The numbers of `issue`'s native "blocked by" links to issues in this
// repository. GitHub allows a link to another repository's issue, whose
// number means nothing here, so those are left out. Used to hand a split
// issue's blockers to its first child (see lib/intake.mts#applySplit).
export function sameRepoBlockers(
  issue: number,
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
): number[] {
  const blockers = jsonLines(
    ghWithStderr(run, [
      "api", "--paginate", `repos/${repo}/issues/${issue}/dependencies/blocked_by`,
      "--jq", ".[] | {number, repository_url} | @json",
    ]),
  ) as { number: number; repository_url: string }[];
  return blockers.filter((blocker) => blocker.repository_url.endsWith(`/repos/${repo}`)).map((blocker) => blocker.number);
}

// Creates an issue with `labels` already applied, for the child issues a
// split verdict drafts (see lib/intake.mts#applyVerdicts). Returns its
// number.
export function createIssue(
  title: string,
  body: string,
  labels: readonly string[],
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
): number {
  // The REST API takes the body as JSON on stdin and answers the number
  // directly, where gh issue create prints a URL to parse.
  const number = Number(
    ghWithStderr(
      run,
      ["api", "--method", "POST", `repos/${repo}/issues`, "--input", "-", "--jq", ".number"],
      JSON.stringify({ title, body, labels }),
    ).trim(),
  );
  if (!Number.isInteger(number) || number <= 0) throw new Error(`gh api didn't answer the new issue's number for "${title}"`);
  return number;
}

// Adds the native "parent has sub-issue child" relationship GitHub shows as a
// task list on the parent. Used to add each split child as a sub-issue of the
// original issue it was drafted from (see lib/intake.mts#applyVerdicts).
export function addSubIssue(
  parent: number,
  child: number,
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
): void {
  // As with addBlockedBy, the API names the sub-issue by its id, not its
  // number.
  const id = ghWithStderr(run, ["api", `repos/${repo}/issues/${child}`, "--jq", ".id"]).trim();
  ghWithStderr(run, ["api", "--method", "POST", `repos/${repo}/issues/${parent}/sub_issues`, "-F", `sub_issue_id=${id}`]);
}

// The state of one of an issue's native sub-issues (see addSubIssue): enough
// to tell whether it closed as completed (see lib/umbrella.mts).
export type SubIssue = { number: number; state: string; state_reason: string | null };

// The parent issue's sub-issues, in the order GitHub lists them.
export function subIssuesOf(
  parent: number,
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
): SubIssue[] {
  return jsonLines(
    ghWithStderr(run, [
      "api", "--paginate", `repos/${repo}/issues/${parent}/sub_issues`,
      "--jq", ".[] | {number, state, state_reason} | @json",
    ]),
  ) as SubIssue[];
}

// Closes an issue as completed: an umbrella whose children have all finished
// (see lib/umbrella.mts#closeFinishedUmbrellas).
export function closeIssueAsCompleted(
  number: number,
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
): void {
  ghWithStderr(run, ["issue", "close", String(number), "--repo", repo, "--reason", "completed"]);
}

// The open issues whose comments contain `marker`, found through GitHub's
// search index rather than reading every open issue's comments by hand. An
// umbrella loses Sandcastle, so this, not listSandcastleIssues, is how a
// later round finds it again (see lib/umbrella.mts). Search ignores the
// marker's punctuation, so each match's comments are read to keep only the
// issues where `poster`, the host (see hostLogin), posted the marker itself:
// anyone can comment on a public issue, and a pasted marker mustn't get an
// issue closed. Search lags new comments, so an umbrella can be missed for a
// round or two.
export function openIssuesWithComment(
  marker: string,
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
  poster: string = (signedInLogin ??= hostLogin(run)),
): number[] {
  const words = marker.replace(/<!--|-->/g, "").trim();
  const matches = JSON.parse(
    ghWithStderr(run, [
      "issue", "list", "--repo", repo, "--state", "open", "--search", `"${words}" in:comments`, "--limit", "1000",
      "--json", "number", "--jq", "[.[].number]",
    ]),
  ) as number[];
  return matches.filter((number) => {
    const comments = jsonLines(
      ghWithStderr(run, ["api", "--paginate", `repos/${repo}/issues/${number}/comments`, "--jq", ".[] | {body, author: .user.login} | @json"]),
    ) as { body: string; author: string }[];
    return comments.some((comment) => comment.author === poster && comment.body.includes(marker));
  });
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
    try {
      ghWithStderr(run, ["label", "create", label.name, "--repo", repo, "--color", label.color, "--description", label.description]);
    } catch (error) {
      // Another run starting at the same time created it first. --force would
      // also cover this, but would overwrite a colour or description a person
      // changed.
      if (!String(error).includes("already exists")) throw error;
    }
  }
}

// Adds `label` to the issue `number`, or every label in it, in one edit so
// they land together or not at all. The repository must already have them
// (see ensureLabels).
export function addIssueLabel(
  number: number,
  label: string | readonly string[],
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
): void {
  const labels = typeof label === "string" ? [label] : label;
  ghWithStderr(run, ["issue", "edit", String(number), "--repo", repo, ...labels.flatMap((name) => ["--add-label", name])]);
}

// Removes `label` from the issue `number`.
export function removeIssueLabel(
  number: number,
  label: string,
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
): void {
  ghWithStderr(run, ["issue", "edit", String(number), "--repo", repo, "--remove-label", label]);
}

// The names of the labels the issue `number` carries now, read fresh rather
// than from the round's listSandcastleIssues snapshot.
export function issueLabels(
  number: number,
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
): string[] {
  return JSON.parse(
    ghWithStderr(run, ["issue", "view", String(number), "--repo", repo, "--json", "labels", "--jq", "[.labels[].name]"]),
  ) as string[];
}

// The numbers of the open issues carrying `label`. As with
// listSandcastleIssues, the cap sits far above any real queue.
export function issuesWithLabel(
  label: string,
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
): number[] {
  return JSON.parse(
    ghWithStderr(run, [
      "issue", "list", "--repo", repo, "--state", "open", "--label", label, "--limit", "1000", "--json", "number", "--jq", "[.[].number]",
    ]),
  ) as number[];
}

// One "labeled" or "unlabeled" event from an issue's or PR's REST timeline.
export type TimelineLabelEvent = { event: "labeled" | "unlabeled"; label: string; createdAt: string };

// gh output printed as one line of JSON per item (@json), parsed item by item.
// The pages --paginate fetches concatenate into lines, so they parse alike.
function jsonLines(output: string): unknown[] {
  return output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as unknown);
}

// Every "labeled" and "unlabeled" event on the issue or PR `number`, oldest
// first. PRs share the issues API, so this covers both.
export function labelTimeline(
  number: number,
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
): TimelineLabelEvent[] {
  return jsonLines(
    ghWithStderr(run, [
      "api", "--paginate", `repos/${repo}/issues/${number}/timeline`,
      "--jq", '.[] | select(.event == "labeled" or .event == "unlabeled") | {event, label: .label.name, createdAt: .created_at} | @json',
    ]),
  ) as TimelineLabelEvent[];
}

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
// than let NaN quietly drop or keep a comment from the count, or decide
// whether a label is stale (lib/building.mts).
export function timestamp(time: string): number {
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

// Reads the host's login (see hostLogin) and keeps it for markerComments.
// Called once at startup, so a token that can't read /user fails the run
// before any role runs, rather than when the first failed attempt is recorded.
export function cacheHostLogin(run: typeof execFileSync = execFileSync): string {
  signedInLogin = hostLogin(run);
  return signedInLogin;
}

// The comments on the issue or PR `number` that carry `marker` and were posted
// since `label` was last removed (see markerCommentsSince). Only the host's own
// comments count (see hostLogin): anyone can comment on a public issue, so a
// stranger could otherwise paste the marker in to hand the issue back early.
// PRs share the issues API, so this covers both.
export function markerComments(
  number: number,
  label: string,
  marker: string,
  repo: string = repoName(),
  run: typeof execFileSync = execFileSync,
  poster: string = (signedInLogin ??= hostLogin(run)),
): TimestampedComment[] {
  const comments = jsonLines(
    ghWithStderr(run, [
      "api", "--paginate", `repos/${repo}/issues/${number}/comments`,
      "--jq", ".[] | {body, createdAt: .created_at, author: .user.login} | @json",
    ]),
  ) as TimestampedComment[];
  const timeline = labelTimeline(number, run, repo);
  const createdAt = ghWithStderr(run, ["api", `repos/${repo}/issues/${number}`, "--jq", ".created_at"]).trim();
  return markerCommentsSince(comments, timeline, label, marker, createdAt, poster);
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
