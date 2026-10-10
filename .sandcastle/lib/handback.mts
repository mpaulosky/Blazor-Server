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

// GitHub rejects a comment body longer than this many characters.
const GITHUB_COMMENT_LIMIT = 65_536;

// The comment for the attempt that reaches BUILD_FAILURE_CAP: summarises
// every failed attempt since `sandcastle:needs-human` was last removed, by
// quoting each one's comment body, oldest first, ending with this attempt's.
// Each quote gets an equal share of GitHub's comment limit, so several long
// gate outputs can't make GitHub reject the comment; a longer one keeps its
// heading line and the end of its output, where the failure usually is.
export function needsHumanComment(branch: string, failures: readonly string[]): string {
  const intro = [
    // The summary is itself a failed attempt's comment, so it carries the
    // marker too; it's posted after the last one the count reads, so it never
    // counts twice.
    BUILD_FAILED_MARKER,
    `Sandcastle gave up on this issue after ${failures.length} failed build attempts, so it's handed back with ` +
      "`sandcastle:needs-human` and `sandcastle:ready` is removed. " +
      `\`${branch}\` keeps its commits. Once the cause is fixed, remove \`sandcastle:needs-human\` to put the issue back in ` +
      "the queue.",
  ].join("\n");
  // Room for each "### Attempt n" heading and the blank lines around it.
  const headingRoom = 32;
  const share = Math.floor((GITHUB_COMMENT_LIMIT - intro.length) / Math.max(failures.length, 1)) - headingRoom;
  return [
    intro,
    ...failures.flatMap((failure, i) => [
      "",
      `### Attempt ${i + 1}`,
      "",
      fit(quote(failure.replaceAll(BUILD_FAILED_MARKER, "").trim()), share),
    ]),
  ].join("\n");
}

// `quoted` cut to at most `max` characters: its first line, a note saying the
// start was trimmed, and as much of its end as fits.
function fit(quoted: string, max: number): string {
  if (quoted.length <= max) return quoted;
  const [head = "", ...rest] = quoted.split("\n");
  const note = "> _The start of this attempt's output is trimmed to fit GitHub's comment limit._";
  const tail = rest.join("\n").slice(-(max - head.length - note.length - 8));
  // Resume at a line start when one is near, so the quote markers line up.
  const lineStart = tail.indexOf("\n");
  const kept = lineStart !== -1 && lineStart < 200 ? tail.slice(lineStart + 1) : `> ${tail}`;
  // A code fence opened in the trimmed part would leave its closing line
  // opening a new block instead, so open it again before what's kept.
  const dropped = quoted.slice(0, quoted.length - kept.length);
  const reopen = (dropped.match(/^> ```/gm) ?? []).length % 2 === 1 ? ["> ```text"] : [];
  return [head, ">", note, ">", ...reopen, kept].join("\n");
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
  if (attempt < BUILD_FAILURE_CAP) {
    commentOnIssue(issueNumber, buildFailedComment(attempt, branch, detail), run, repo);
    return;
  }
  // The last attempt is quoted without buildFailedComment's "the issue stays
  // in the queue": this is the comment that takes it out.
  const lastAttempt = `**Failed build attempt ${attempt} of ${BUILD_FAILURE_CAP}** on \`${branch}\`.\n\n${detail}`;
  handBack(
    { kind: "issue", number: issueNumber },
    "sandcastle:needs-human",
    `${attempt} failed build attempts on ${branch}`,
    needsHumanComment(branch, [...priorFailures, lastAttempt]),
    run,
    repo,
    report,
  );
}
