// Hand-back helpers shared by the build pipeline, intake and PR follow-up:
// the comment text for a failed build attempt, and giving up on an issue
// after BUILD_FAILURE_CAP of them. See "Giving up and telling the human" in
// docs/plans/sandcastle-workflow.md.

import { execFileSync } from "node:child_process";
import { BUILD_FAILED_MARKER, BUILD_FAILURE_CAP } from "./config.mts";
import { handBack, repoName } from "./github.mts";
import { handBackReport, type HandBackReport } from "./report.mts";

// The comment for a failed build attempt under the cap: carries
// BUILD_FAILED_MARKER, so a restart can still count it (see
// lib/github.mts#markerCommentsSince), with the attempt number and `detail`
// (the tail of the gate output, or the role's error).
export function buildFailedComment(attempt: number, branch: string, detail: string): string {
  throw new Error("Not implemented");
}

// The comment for the attempt that reaches BUILD_FAILURE_CAP: summarises
// every failed attempt since `sandcastle:needs-human` was last removed, by
// quoting each one's comment body, oldest first, ending with this attempt's.
export function needsHumanComment(branch: string, failures: readonly string[]): string {
  throw new Error("Not implemented");
}

// Records this failed build attempt on the issue `issueNumber`: posts
// `buildFailedComment` when it's under the cap, or on the
// BUILD_FAILURE_CAPth attempt since `sandcastle:needs-human` was last
// removed, hands the issue back instead (see lib/github.mts#handBack) with
// `needsHumanComment` quoting every failure. `priorFailures` are this
// issue's already-posted qualifying marker comments (see
// lib/github.mts#markerCommentsSince), oldest first; this attempt is
// `priorFailures.length + 1`.
export function recordFailedAttempt(
  issueNumber: number,
  branch: string,
  detail: string,
  priorFailures: readonly string[],
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
  report: HandBackReport = handBackReport,
): void {
  throw new Error("Not implemented");
}
