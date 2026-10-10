// ---------------------------------------------------------------------------
// Follow-up pass
//
// The sweep (lib/follow-up.mts) decides which PRs need a pass; this module is
// the pass itself. One pass resets the PR's worktree to its head, merges main
// in when the PR needs it, runs the follow-up role to resolve the merge and
// the PR's bot and owner review threads, gates and pushes the result, then
// replies to and resolves the role's verdicts and posts a pass-summary
// comment. See docs/plans/sandcastle-workflow.md, "Phase 1: Follow-up sweep",
// and this issue's design note (.sandcastle/work/78/design.md) for the
// step-by-step this module follows.
// ---------------------------------------------------------------------------

import * as sandcastle from "@ai-hero/sandcastle";
import type { PassTarget } from "./follow-up.mts";
import type { ReviewThread, SandcastleIssue } from "./github.mts";
import type { RunLimits } from "./limits.mts";
import { runLimits } from "./limits.mts";
import type { IsOwner } from "./queue.mts";
import type { HumanThreadEntry } from "./report.mts";

// One review thread given to the follow-up role, trimmed to only what it
// needs (see threadsForRole): never a stranger's comment, and never more
// than a bot's or the repository owner's. Also the shape of each entry in
// lib/prompts.mts#followUpPromptArgs's THREADS_JSON.
export type PromptThread = {
  threadId: string;
  from: "bot" | "owner";
  path: string | null;
  line: number | null;
  outdated: boolean;
  comments: { author: string | null; body: string }[];
};

// Sorts a PR's open review threads for the follow-up role (runPass's step
// 2). A resolved thread is dropped outright. A thread whose first comment's
// author is a bot goes to the role as "bot". A thread the repository owner
// opened goes to the role as "owner", unless its last comment already
// carries FOLLOW_UP_REPLY_MARKER (lib/config.mts): that means the host
// already answered it and is waiting on the owner, so it's dropped from
// every list rather than handed to the role again. Any other thread,
// including one with no author at all, goes to `leftForHuman`
// (lib/report.mts#recordHumanThread records each one). A thread whose first
// author `isOwner` can't answer for goes to `unknown`, so a pass never
// decides from partial information: runPass skips the round when `unknown`
// isn't empty. Inside a kept thread, a comment by neither a bot nor the
// owner is dropped before the thread reaches the role.
export function threadsForRole(
  threads: readonly ReviewThread[],
  isOwner: IsOwner,
): { forRole: PromptThread[]; leftForHuman: ReviewThread[]; unknown: ReviewThread[] } {
  throw new Error("Not implemented");
}

// One entry of the follow-up role's .sandcastle/follow-up.json, one per
// thread it was given (see parseVerdicts). `commit` names the fix when
// `verdict` is "fixed". `invalid` (meaningful only when `verdict` is
// "declined") marks a factually wrong bot suggestion, so the host resolves
// the thread INVALID rather than WONT_FIX.
export type ThreadVerdict = {
  threadId: string;
  verdict: "fixed" | "declined" | "outdated";
  reason: string;
  commit?: string;
  invalid?: boolean;
};

// Parses the follow-up role's .sandcastle/follow-up.json (runPass's step 8),
// read from inside the sandbox, never from the host. Throws unless the whole
// file is a JSON array: that's the follow-up run having failed outright, not
// a single bad verdict. Each entry is checked against ThreadVerdict's shape
// on its own; one that doesn't fit goes in `rejected` rather than failing
// every other entry in the file.
export function parseVerdicts(text: string): { verdicts: ThreadVerdict[]; rejected: unknown[] } {
  throw new Error("Not implemented");
}

// How the host resolves a bot thread on GitHub (lib/github.mts#resolveReviewThread
// takes no resolution of its own, so this only ever reaches a reply and the
// pass summary): ADDRESSED for a fix or an outdated concern, WONT_FIX or
// INVALID for one declined.
export type Resolution = "ADDRESSED" | "WONT_FIX" | "INVALID";

// One verdict matched to the thread it answers (see threadActions), and how
// the host resolves it on GitHub: undefined for an owner thread, which the
// host replies to but never resolves.
export type ThreadAction = { thread: PromptThread; verdict: ThreadVerdict; resolve: Resolution | undefined };

// Matches each of `verdicts` to the thread in `given` (the threads the
// follow-up role was actually given) it answers. A verdict naming a thread
// not in `given` — an unknown id, a stranger's thread, or one already
// resolved — goes in `ignored` by its threadId rather than acted on, and so
// does a second verdict for a thread that already has one (runPass's step
// 12 relies on `actions` holding at most one entry per thread). `resolve` is
// ADDRESSED for "fixed" or "outdated", WONT_FIX for "declined" (INVALID
// instead when the verdict's `invalid` is set), and always undefined for an
// owner thread.
export function threadActions(
  verdicts: readonly ThreadVerdict[],
  given: readonly PromptThread[],
): { actions: ThreadAction[]; ignored: string[] } {
  throw new Error("Not implemented");
}

// The reply the host posts on a thread for `action` (runPass's step 12):
// FOLLOW_UP_REPLY_MARKER, a first line naming the verdict (and, for a bot
// thread, the resolution, such as "Resolved: won't fix"), then the reason —
// through `publicError`, which breaks any @mention or #123 reference in the
// model's text — and "Fixed in <commit>" when the verdict names one. Cut to
// fit GitHub's comment limit.
export function replyBody(action: ThreadAction, publicError: (text: string) => string): string {
  throw new Error("Not implemented");
}

// One pass's outcome, for passSummaryComment: which attempt this was, what
// commit was pushed (undefined when nothing needed pushing), whether main
// needed merging in and how that went, every thread action taken, the
// ignored verdicts, any GitHub write that failed, and how many threads were
// left for a person.
export type PassReport = {
  pass: number;
  pushed: string | undefined;
  merged: "none" | "clean" | "conflicts";
  actions: ThreadAction[];
  ignored: string[];
  failedWrites: string[];
  leftForHuman: number;
};

// The PR comment a pass posts once it's done (runPass's step 13):
// FOLLOW_UP_MARKER, "Follow-up pass n of FOLLOW_UP_PASS_CAP", what was
// pushed, and one line per thread action naming its verdict and resolution,
// or "left open for the owner" for one that was only replied to.
export function passSummaryComment(report: PassReport): string {
  throw new Error("Not implemented");
}

// The PR hand-back comment for a pass that gave up (runPass's step 4, 9, 10,
// 11): why, then the tail of the last gate output or the role's error (when
// given) in a fence longer than any backtick run in it, and how to re-queue
// the PR (remove sandcastle:needs-human).
export function giveUpComment(reason: string, output: string | undefined): string {
  throw new Error("Not implemented");
}

// What one call to runPass decided or did:
// - "skipped": nothing counted against FOLLOW_UP_PASS_CAP (the head moved
//   since the sweep read it, there's nothing a pass handles yet, or
//   markBuilding said another run already has the issue);
// - "passed": the pass ran to completion; `pushed` is the commit pushed, or
//   undefined when nothing needed pushing;
// - "push-failed": the gated commit failed to push (for example, someone
//   pushed to the PR meanwhile, so it's non-fast-forward); not counted and
//   not a give-up, so the next sweep tries again with the PR's new head;
// - "gave-up": the PR was handed back with sandcastle:needs-human.
export type PassOutcome =
  | { kind: "skipped"; reason: string }
  | { kind: "passed"; pushed: string | undefined }
  | { kind: "push-failed"; error: string }
  | { kind: "gave-up"; reason: string };

// What runPass needs from outside the pass itself; tests pass a stub. The
// live wiring sits at the bottom of this module.
export type PassHost = {
  // branches.mts's originGit.fetch, so the sandbox's createSandbox(branch)
  // checks the PR's head out from its remote-tracking ref.
  fetchBranch(branch: string): void;
  // lib/github.mts#reviewThreadsOf.
  reviewThreads(pr: number): { headRefOid: string; threads: ReviewThread[] };
  // lib/queue.mts#ownerCheck(signedInHostLogin, pushAccess).
  isOwner: IsOwner;
  // FOLLOW_UP_MARKER comments posted since sandcastle:needs-human was last
  // removed (lib/github.mts#markerComments), counted against
  // FOLLOW_UP_PASS_CAP.
  passCount(pr: number): number;
  // git merge-base --is-ancestor, in the main checkout.
  contains(commit: string, ancestor: string): boolean;
  // lib/building.mts#claimBuildingLabel.
  markBuilding(issue: number): boolean;
  // lib/building.mts#releaseBuildingLabel.
  unmarkBuilding(issue: number): void;
  createSandbox(branch: string): Promise<sandcastle.Sandbox>;
  // lib/host-safety.mts's worktree-tamper check, as lib/build.mts#BuildHost
  // already exposes it.
  worktreeProblems(path: string): string[];
  // lib/scan.mts#publishedText, checked with lib/sandbox-env.mts#containsSandboxSecret.
  leaksSecret(base: string, commit: string): boolean;
  // A plain push of the gated commit to the PR's branch, retried on a
  // GitHub server error the way lib/build.mts#publish's push is.
  push(branch: string, commit: string): Promise<void>;
  // lib/github.mts#replyToReviewThread.
  replyToThread(threadId: string, body: string): void;
  // lib/github.mts#resolveReviewThread.
  resolveThread(threadId: string): void;
  // lib/github.mts#commentOnPullRequest.
  commentOnPullRequest(pr: number, body: string): void;
  // lib/github.mts#handBack({ kind: "pr", number: pr }, "sandcastle:needs-human", reason, body).
  handBack(pr: number, reason: string, body: string): void;
  // lib/report.mts#humanThreadReport.record.
  recordHumanThread(entry: HumanThreadEntry): void;
  // lib/build.mts#publicErrorText, checked against the sandbox's secrets.
  publicError(text: unknown): string;
  // The run's limits (lib/limits.mts#runLimits): runPass runs the follow-up
  // role and the gate-fixer through runRoleInSandbox(..., host.limits).
  limits: RunLimits;
  log(line: string): void;
};

// Throws for every PassHost method the live host doesn't wire up yet: the
// backend and UI developer connect each one to lib/github.mts,
// lib/branches.mts, lib/building.mts, lib/agents.mts, lib/checkpoint.mts and
// lib/scan.mts, as this issue's design note lays out.
function notImplemented(): never {
  throw new Error("Not implemented");
}

// The live PassHost. Left unwired until the backend and UI developer connect
// it, as every other *.mts module's live host does at the bottom of its own
// file.
export const livePassHost: PassHost = {
  fetchBranch: notImplemented,
  reviewThreads: notImplemented,
  isOwner: notImplemented,
  passCount: notImplemented,
  contains: notImplemented,
  markBuilding: notImplemented,
  unmarkBuilding: notImplemented,
  createSandbox: notImplemented,
  worktreeProblems: notImplemented,
  leaksSecret: notImplemented,
  push: notImplemented,
  replyToThread: notImplemented,
  resolveThread: notImplemented,
  commentOnPullRequest: notImplemented,
  handBack: notImplemented,
  recordHumanThread: notImplemented,
  publicError: notImplemented,
  limits: runLimits,
  log: notImplemented,
};

// Runs one follow-up pass on `target`, a PR the sweep (lib/follow-up.mts)
// marked as needing one, for its issue. See this module's header and the
// design note at .sandcastle/work/78/design.md for the step-by-step: reset
// the PR's worktree to its head, merge main in when the PR needs it, run the
// follow-up role, gate and push, then reply to and resolve the role's
// verdicts and post the pass summary.
export async function runPass(
  target: PassTarget,
  issue: SandcastleIssue,
  base: string,
  host: PassHost = livePassHost,
): Promise<PassOutcome> {
  throw new Error("Not implemented");
}

// main.mts's pass phase: fetches every target's branch serially first (a
// failed fetch skips that PR for the round, as prepareBranches'
// lib/branches.mts#fetchMain-style fetches do), then runs runPass for each
// PR whose issue is in `issues` with Promise.allSettled, logging each
// outcome. A rejection is logged and the PR is swept again next round. Once
// every pass has settled, the first UncountedStopError among them (a usage
// or time-budget stop from the follow-up role or the gate-fixer) is
// rethrown, so main.mts's catch ends the run cleanly rather than the round
// carrying on as if nothing had stopped it.
export async function followUpPassPhase(
  targets: readonly PassTarget[],
  issues: readonly SandcastleIssue[],
  base: string,
  host: PassHost = livePassHost,
): Promise<PassOutcome[]> {
  throw new Error("Not implemented");
}
