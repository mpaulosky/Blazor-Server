// ---------------------------------------------------------------------------
// Overlap check
//
// Before the critique runs, the host defers, in code and with no agent, any
// pick whose predicted `files` (lib/plan.mts) share a path with a pick kept
// earlier in the planner's order or with an open pull request into main, from
// any author or queue. Two builds of one file conflict once the first merges
// (#421). A pick with no files, or an empty list, is treated as touching
// anything: it's built only as the round's only pick with no open PR into main.
// ---------------------------------------------------------------------------

import type { OpenPullRequest } from "./github.mts";
import type { PlannedIssue } from "./plan.mts";
import { outcomeReport, type OutcomeReport } from "./report.mts";

// The GitHub reads and writes the check needs; tests pass a stub. Each one
// throws when GitHub can't answer.
export type OverlapGitHub = {
  // Every open pull request whose base is main, whoever opened it.
  openPullRequestsIntoMain(): OpenPullRequest[];
  pullRequestFiles(pr: number): string[];
  addBlockedBy(issue: number, blocker: number): void;
  comment(issue: number, body: string): void;
};

// Return the picks still to build this round, in the planner's order. Each
// deferred pick gets one comment naming the shared file and the PR or issue it
// waits on, and reaches the run report as "deferred". A pick deferred behind an
// earlier pick is also linked as blocked by it; one deferred behind a pull
// request isn't, since a PR can't be a native blocker.
export function deferOverlaps(
  picks: readonly PlannedIssue[],
  github: OverlapGitHub,
  log: (line: string) => void = console.log,
  report: OutcomeReport = outcomeReport,
): PlannedIssue[] {
  void picks, github, log, report;
  throw new Error("Not implemented");
}
