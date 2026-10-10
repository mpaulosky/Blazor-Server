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
// `detail` is trimmed to fit GitHub's comment limit: a rejected comment saves
// no marker, so the attempt would never count and the issue never reach the cap.
export function buildFailedComment(attempt: number, branch: string, detail: string): string {
  const intro = [
    BUILD_FAILED_MARKER,
    `**Failed build attempt ${attempt} of ${BUILD_FAILURE_CAP}** on \`${branch}\`. The issue stays in the queue, and the next ` +
      `round builds it again; after ${BUILD_FAILURE_CAP} failed attempts it's handed back to a person.`,
    "",
  ].join("\n");
  return `${intro}\n${fit(detail, GITHUB_COMMENT_LIMIT - intro.length - 1)}`;
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
  // No BUILD_FAILED_MARKER: the summary is posted before the label edit, and
  // if that edit fails the issue stays in the queue. Its next failure then
  // counts only the real attempts, and hands the issue back again.
  const intro = [
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
      fit(quote(failure.replaceAll(BUILD_FAILED_MARKER, "").trim()), share, "> ", true),
    ]),
  ].join("\n");
}

// `text` cut to at most `max` characters: a note saying its start was
// trimmed, then as much of its end as fits. `prefix` begins every line ("> "
// for a block quote), and `keepHead` keeps the first line too, such as an
// attempt's heading.
function fit(text: string, max: number, prefix = "", keepHead = false): string {
  if (text.length <= max) return text;
  const lines = text.split("\n");
  const head = keepHead ? [lines.shift() ?? ""] : [];
  const blank = prefix.trimEnd();
  const note = `${prefix}_The start of this attempt's output is trimmed to fit GitHub's comment limit._`;
  const reopenLine = `${prefix}\`\`\`text`;
  const room = max - head.join("").length - note.length - reopenLine.length - 16;
  const tail = lines.join("\n").slice(-room);
  // Resume at a line start when one is near, so line prefixes line up.
  const lineStart = tail.indexOf("\n");
  const kept = lineStart !== -1 && lineStart < 200 ? tail.slice(lineStart + 1) : `${prefix}${tail}`;
  // A code fence opened in the trimmed part would leave its closing line
  // opening a new block instead, so open it again before what's kept.
  const dropped = lines.join("\n").slice(0, -kept.length);
  const fences = dropped.split("\n").filter((line) => line.startsWith(`${prefix}\`\`\``)).length;
  const reopen = fences % 2 === 1 ? [reopenLine] : [];
  return [...head, ...(keepHead ? [blank] : []), note, blank, ...reopen, kept].join("\n");
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
