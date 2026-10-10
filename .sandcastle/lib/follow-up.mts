// ---------------------------------------------------------------------------
// Follow-up sweep
//
// Nothing acted on a Sandcastle PR once it was open: it could fall behind
// main, miss its Copilot review, or close without merging while its issue
// stayed open. Each round, before intake, the host sweeps every open,
// non-draft, same-repo PR into main from a matching issue branch that it
// itself published (see isSandcastlePullRequest), and acts on the ones that
// need no agent: re-requesting a stale Copilot review, updating a branch
// that's only behind main, and handing an issue back when its latest PR
// closed without merging. A PR that needs more than that (DIRTY, a red
// check, an unresolved bot thread) is only logged here: the agent pass that
// fixes it is a later issue (#77).
// ---------------------------------------------------------------------------

import type { BranchRefs } from "./branches.mts";
import {
  closedPullRequests,
  handBack,
  labelTimeline,
  listSandcastleIssues,
  openPullRequestsForSweep,
  requestCopilotReview,
  signedInHostLogin,
  updatePullRequestBranch,
  type ClosedPullRequest,
  type PullRequestIdentity,
  type TimelineLabelEvent,
} from "./github.mts";

// One check run or status on a PR's head commit, normalised from either
// GraphQL shape (CheckRun or StatusContext) by lib/github.mts#openPullRequestsForSweep.
export type CheckState = { name: string; completed: boolean; green: boolean; completedAt: string | null };

// An open PR with everything the sweep decides from, normalised from one
// paginated GraphQL query (lib/github.mts#openPullRequestsForSweep).
export type SweepPullRequest = PullRequestIdentity & {
  id: string;
  headRefOid: string;
  isDraft: boolean;
  labels: string[];
  mergeStateStatus: string;
  // The logins GitHub still has pending a review request from.
  reviewRequests: string[];
  reviews: { author: string | null; commitOid: string | null }[];
  // byBot: whether the thread's first comment's author is a Bot.
  threads: { resolved: boolean; byBot: boolean }[];
  checks: CheckState[];
  // review_requested timeline events naming Copilot, oldest first.
  copilotRequestedAt: string[];
  // Set when any nested list (reviews, threads, checks, ...) was truncated by
  // GraphQL's page size, so the sweep can't decide safely from partial data.
  truncated: boolean;
};

// Whether `login` is Copilot's code-review account. GitHub names it
// differently across REST, GraphQL and review requests ("Copilot",
// "copilot-pull-request-reviewer" and "...[bot]"), so every form is accepted.
export function isCopilot(login: string | null): boolean {
  throw new Error("Not implemented");
}

// The issue number a PR's head branch names, read from
// feature/{n}-..., fix/{n}-... or hotfix/{n}-..., but only when it's a branch
// name isIssueBranch (lib/branches.mts) actually accepts: a branch name
// reaches a shell elsewhere in the pipeline.
export function issueNumberOf(headRefName: string): number | undefined {
  throw new Error("Not implemented");
}

// Whether the host published `pr` itself: not a fork, into main, authored by
// the repository owner's own login (the account the host publishes with,
// never an organization's, see #214), carrying PR_MARKER, and on an issue
// branch. A collaborator's PR on a matching branch, or one of the host's own
// from before this marker existed, is never this.
export function isSandcastlePullRequest(pr: PullRequestIdentity, host: string): boolean {
  throw new Error("Not implemented");
}

// The first reason the sweep skips `pr`, checked in this order: a fork, not
// into main, not an issue branch, the issue isn't open and in scope, a draft,
// labelled sandcastle:needs-human, not the host's, no PR_MARKER, or
// truncated. Undefined when none applies, so the sweep decides from it.
export function sweepSkipReason(pr: SweepPullRequest, inScope: ReadonlySet<number>, host: string): string | undefined {
  throw new Error("Not implemented");
}

// What the sweep does about one PR, decided by `decide`.
export type SweepDecision =
  | { action: "wait"; reason: string }
  | { action: "request-review" }
  | { action: "update-branch" }
  | { action: "needs-pass"; reasons: string[] }
  | { action: "leave"; reason: string };

// What the sweep does about a PR that isn't skipped (see sweepSkipReason):
// wait while CI or Copilot's review is still in flight, ask Copilot again
// once CI has been done for a while with no review or pending request,
// update a settled PR that's only behind main, flag one that needs more than
// that for a later pass, or leave a clean or merge-blocked one alone.
export function decide(pr: SweepPullRequest, now: number): SweepDecision {
  throw new Error("Not implemented");
}

// The issue's latest Sandcastle PR among `prs` (the highest number among
// those isSandcastlePullRequest accepts on one of the issue's branches),
// returned only when it closed without merging (state "CLOSED"). Undefined
// when the latest such PR merged, or none exists.
export function closedWithoutMerging(
  prs: readonly ClosedPullRequest[],
  issueNumber: number,
  host: string,
): ClosedPullRequest | undefined {
  throw new Error("Not implemented");
}

// The hand-back comment for an issue whose latest PR closed without merging.
// Its first sentence is the issue's own wording, word for word (see the
// "Closed without merging" acceptance criterion).
export function closedPrHandBackComment(pr: ClosedPullRequest): string {
  throw new Error("Not implemented");
}

// What the follow-up sweep needs from GitHub; tests pass a stub.
export type FollowUpGitHub = {
  hostLogin(): string;
  openPullRequests(): SweepPullRequest[];
  closedPullRequests(author: string): ClosedPullRequest[];
  // live: listSandcastleIssues().
  inScopeIssues(): { number: number; labels: string[] }[];
  labelTimeline(issueNumber: number): TimelineLabelEvent[];
  requestCopilotReview(pullRequestId: string): void;
  updateBranch(number: number, expectedHeadSha: string): void;
  // live: handBack({ kind: "issue", number: issueNumber }, "sandcastle:needs-human", reason, body).
  handBack(issueNumber: number, reason: string, body: string): void;
};

export const liveFollowUpGitHub: FollowUpGitHub = {
  hostLogin: () => signedInHostLogin(),
  openPullRequests: () => openPullRequestsForSweep(),
  closedPullRequests: (author) => closedPullRequests(author),
  inScopeIssues: () => listSandcastleIssues().map((issue) => ({ number: issue.number, labels: issue.labels })),
  labelTimeline: (issueNumber) => labelTimeline(issueNumber),
  requestCopilotReview: (pullRequestId) => requestCopilotReview(pullRequestId),
  updateBranch: (number, expectedHeadSha) => updatePullRequestBranch(number, expectedHeadSha),
  handBack: (issueNumber, reason, body) => handBack({ kind: "issue", number: issueNumber }, "sandcastle:needs-human", reason, body),
};

// Reads the host's login, the in-scope issues and the open PRs once, then
// for each PR either skips it (sweepSkipReason) or applies `decide`, logging
// what happened. Each PR runs in its own try/catch, so one failure doesn't
// stop the rest. Once that's done, hands back any in-scope issue, not
// labelled sandcastle:needs-human and with no open PR, whose latest
// Sandcastle PR closed without merging (closedWithoutMerging), each in its
// own try/catch too.
export function sweepPullRequests(
  github: FollowUpGitHub = liveFollowUpGitHub,
  log: (line: string) => void = console.log,
  now: number = Date.now(),
): void {
  throw new Error("Not implemented");
}

// The follow-up sweep as main.mts runs it at the start of each round, before
// intake. A failure, such as GitHub's API being unavailable, is logged and
// the sweep runs again next round: it's housekeeping, never a reason to stop
// building.
export function followUpPhase(sweep: () => void = () => sweepPullRequests(), warn: (message: string) => void = console.error): void {
  throw new Error("Not implemented");
}

// Deletes the refs of `branch` that still hold the work of `issueNumber`'s
// latest Sandcastle PR, when that PR was closed without merging, so the
// build starts from main. Returns undefined when there's no such PR, or when
// its branch isn't the one being built (the build's branch never held that
// work). Called from lib/build.mts#buildMarkedIssue, before createSandbox(),
// so a throw from discardClosedWork propagates before any sandbox exists.
export function startFromMain(
  issueNumber: number,
  branch: string,
  base: string,
  github: Pick<FollowUpGitHub, "hostLogin" | "closedPullRequests"> = liveFollowUpGitHub,
  refs?: BranchRefs,
): { pr: number; deleted: string[] } | undefined {
  throw new Error("Not implemented");
}
