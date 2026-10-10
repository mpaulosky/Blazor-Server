// The build pipeline's failed attempts: the comment each one posts, and
// giving up on an issue after BUILD_FAILURE_CAP of them through the hand-back
// that intake and PR follow-up share (lib/github.mts#handBack). See "Giving up
// and telling the human" in docs/plans/sandcastle-workflow.md.

import { execFileSync } from "node:child_process";
import { BUILD_FAILED_MARKER, BUILD_FAILURE_CAP } from "./config.mts";
import { commentOnIssue, handBack, repoName } from "./github.mts";
import { handBackReport, type HandBackReport } from "./report.mts";

// The comment for a failed build attempt under the cap: carries
// BUILD_FAILED_MARKER, so a restart can still count it (see
// lib/github.mts#markerCommentsSince), with the attempt number and `detail`
// (the tail of the gate output, or the role's error).
export function buildFailedComment(attempt: number, branch: string, detail: string): string {
  return [
    BUILD_FAILED_MARKER,
    `**Failed build attempt ${attempt} of ${BUILD_FAILURE_CAP}** on \`${branch}\`. The issue stays in the queue, and the next ` +
      `round builds it again; after ${BUILD_FAILURE_CAP} failed attempts it's handed back to a person.`,
    "",
    detail,
  ].join("\n");
}

// The comment for the attempt that reaches BUILD_FAILURE_CAP: summarises
// every failed attempt since `sandcastle:needs-human` was last removed, by
// quoting each one's comment body, oldest first, ending with this attempt's.
export function needsHumanComment(branch: string, failures: readonly string[]): string {
  return [
    // The summary is itself a failed attempt's comment, so it carries the
    // marker too; it's posted after the last one the count reads, so it never
    // counts twice.
    BUILD_FAILED_MARKER,
    `Sandcastle gave up on this issue after ${failures.length} failed build attempts, so it's handed back with ` +
      "`sandcastle:needs-human` and `sandcastle:ready` is removed. " +
      `\`${branch}\` keeps its commits. Once the cause is fixed, remove \`sandcastle:needs-human\` to put the issue back in ` +
      "the queue.",
    ...failures.flatMap((failure, i) => ["", `### Attempt ${i + 1}`, "", quote(failure.replaceAll(BUILD_FAILED_MARKER, "").trim())]),
  ].join("\n");
}

// Markdown block quote of `text`, every line prefixed, so a fenced code block
// inside it stays inside the quote.
function quote(text: string): string {
  return text
    .split("\n")
    .map((line) => (line === "" ? ">" : `> ${line}`))
    .join("\n");
}

// Records a failed build attempt on the issue `issueNumber`. `priorFailures`
// are the bodies of the attempts already counted since `sandcastle:needs-human`
// was last removed (see lib/github.mts#markerCommentsSince), oldest first.
// Under the cap it posts `buildFailedComment`; the attempt that reaches
// BUILD_FAILURE_CAP hands the issue back instead, with `needsHumanComment`
// quoting every failure.
export function recordFailedAttempt(
  issueNumber: number,
  branch: string,
  detail: string,
  priorFailures: readonly string[],
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
  report: HandBackReport = handBackReport,
): void {
  const attempt = priorFailures.length + 1;
  const comment = buildFailedComment(attempt, branch, detail);
  if (attempt < BUILD_FAILURE_CAP) {
    commentOnIssue(issueNumber, comment, run, repo);
    return;
  }
  handBack(
    { kind: "issue", number: issueNumber },
    "sandcastle:needs-human",
    `${attempt} failed build attempts on ${branch}`,
    needsHumanComment(branch, [...priorFailures, comment]),
    run,
    repo,
    report,
  );
}
