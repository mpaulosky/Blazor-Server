// ---------------------------------------------------------------------------
// Overlap check
//
// Before the critique runs, the host defers, in code and with no agent, any
// pick whose predicted `files` (lib/plan.mts) share a path with a pick kept
// earlier in the planner's order or with an open pull request into main, from
// any author or queue. Two builds of one file conflict once the first merges
// (#421). A folder covers the paths under it. A pick with no files, or an
// empty list, is treated as touching anything: it waits behind the first kept
// pick or open PR, and with neither, the first such pick is built and the rest
// wait behind it. Each deferral is a hold, released if what it waits on is a
// pick that opens no PR this round (see lastingHolds).
// ---------------------------------------------------------------------------

import {
  addBlockedBy,
  commentOnIssue,
  hostCommentedWith,
  openPullRequestsIntoMain,
  pullRequestFiles,
  type OpenPullRequest,
} from "./github.mts";
import { OVERLAP_MARKER } from "./config.mts";
import { resolveFiles, type PlannedIssue } from "./plan.mts";
import { outcomeReport, type OutcomeReport } from "./report.mts";

// The GitHub reads and writes the check needs; tests pass a stub. Each one
// throws when GitHub can't answer.
export type OverlapGitHub = {
  // Every open pull request whose base is main, whoever opened it.
  openPullRequestsIntoMain(): OpenPullRequest[];
  pullRequestFiles(pr: number): string[];
  // Not called since #425, which stopped linking a hold behind a pick: the
  // hold is released when that pick opens no PR, and a link would outlast it.
  addBlockedBy(issue: number, blocker: number): void;
  comment(issue: number, body: string): void;
  // Whether the host already posted an overlap deferral comment (OVERLAP_MARKER)
  // on the issue, so a later run doesn't post another.
  commented(issue: number): boolean;
};

const liveGitHub: OverlapGitHub = {
  openPullRequestsIntoMain,
  pullRequestFiles,
  addBlockedBy,
  comment: commentOnIssue,
  commented: (issue) => hostCommentedWith(issue, OVERLAP_MARKER),
};

// Why a pick waits: the shared path (none for a pick with no files), the issue
// or pull request it waits on, and whether it's linked as blocked by that
// issue. deferOverlaps no longer links (#425): a hold behind a pick is released
// when that pick opens no PR, and a link would outlast the release.
type Deferral = { file?: string; on: { kind: "issue" | "pr"; number: number }; linked: boolean };

// The comment posted on a deferred pick, naming the file and the issue or pull
// request it waits on, as the critique's deferral comment does. It carries
// OVERLAP_MARKER, so a later run that defers the pick again finds it and
// doesn't post another (#425).
export function overlapComment({ file, on, linked }: Deferral): string {
  const ref = `#${on.number}`;
  const what = `${on.kind === "issue" ? "issue" : "pull request"} ${ref}`;
  const reason =
    file === undefined
      ? `The planner named no files this issue will change, so it may touch anything ${what} changes.`
      : `It's expected to change \`${file}\`, which ${what} changes too.`;
  let after: string;
  if (linked) {
    after = `It won't be built until ${ref} lands. To override, delete the "blocked by ${ref}" link on this issue.`;
  } else if (on.kind === "issue") {
    after = `It waits while ${ref} is built. If ${ref} opens no pull request, a later round of this run can build it; otherwise a later run checks again.`;
  } else {
    after = "It won't be built in this run; a later run checks again.";
  }
  return [
    OVERLAP_MARKER,
    `Sandcastle deferred this issue behind ${ref}, so the two don't conflict once one merges.`,
    `**Reason:** ${reason}`,
    after,
  ].join("\n\n");
}

// A pick the check held back, and what it waits on.
export type OverlapHold = { id: number; behind: { kind: "issue" | "pr"; number: number } };

// The picks still to build this round, in the planner's order, and the holds on
// the rest.
export type OverlapResult = { kept: PlannedIssue[]; holds: OverlapHold[] };

// Whether two repo-relative paths touch the same file: they're equal, or one is
// a folder the other sits under. `src/UI` covers `src/UI/Program.cs` but not
// `src/UIKit/a.cs`.
function sharesPath(a: string, b: string): boolean {
  return a === b || b.startsWith(`${a}/`) || a.startsWith(`${b}/`);
}

// Return the picks still to build this round, in the planner's order, and a
// hold on each deferred pick saying what it waits on. Each deferred pick
// reaches the run report as "deferred", and gets one comment naming the shared
// file and the PR or issue it waits on, unless the host already posted one in
// an earlier run. The holds aren't final: main.mts keeps only lastingHolds
// once the critique and the build have run. A failed read of the open PRs or
// their files throws, so nothing is built on an overlap the host couldn't
// check; a failed comments read only skips that pick's comment (#428).
export function deferOverlaps(
  picks: readonly PlannedIssue[],
  github: OverlapGitHub = liveGitHub,
  log: (line: string) => void = console.log,
  report: OutcomeReport = outcomeReport,
): OverlapResult {
  const openPrs = github
    .openPullRequestsIntoMain()
    .map((pr) => ({ number: pr.number, files: github.pullRequestFiles(pr.number) }));

  // readyPicks has resolved the files already; resolving again keeps a path
  // that would reach the log clean whoever calls this.
  const resolved = picks.map((issue) => ({ issue, files: resolveFiles(issue.files) }));

  // Each path a kept pick will change, with that pick's number, so a later pick
  // names the first kept pick it collides with.
  const claimed: { file: string; id: number }[] = [];
  const kept: PlannedIssue[] = [];
  const deferrals = new Map<PlannedIssue, Deferral>();

  // The first of the pick's files that a kept pick or an open PR changes. A
  // kept pick wins over a PR on the same file.
  const firstOverlap = (files: readonly string[]): Deferral | undefined => {
    for (const file of files) {
      const earlier = claimed.find((claim) => sharesPath(claim.file, file));
      if (earlier) return { file, on: { kind: "issue", number: earlier.id }, linked: false };
      const pr = openPrs.find((open) => open.files.some((changed) => sharesPath(changed, file)));
      if (pr) return { file, on: { kind: "pr", number: pr.number }, linked: false };
    }
    return undefined;
  };

  for (const { issue, files } of resolved.filter((pick) => pick.files.length > 0)) {
    const deferral = firstOverlap(files);
    if (deferral) {
      deferrals.set(issue, deferral);
      continue;
    }
    kept.push(issue);
    for (const file of files) claimed.push({ file, id: Number(issue.id) });
  }

  // A pick with no files may touch anything, so it waits behind the first pick
  // kept this round, or else the first open PR. With neither in its way, the
  // first such pick is built and the rest wait behind it: holding each behind
  // another would leave them all waiting for nothing (#425).
  const [firstKept] = kept;
  const [firstPr] = openPrs;
  let blocker: Deferral["on"] | undefined;
  if (firstKept) {
    blocker = { kind: "issue", number: Number(firstKept.id) };
  } else if (firstPr) {
    blocker = { kind: "pr", number: firstPr.number };
  }
  for (const { issue } of resolved.filter((pick) => pick.files.length === 0)) {
    if (blocker === undefined) {
      kept.push(issue);
      blocker = { kind: "issue", number: Number(issue.id) };
    } else {
      deferrals.set(issue, { on: blocker, linked: false });
    }
  }

  // Every read before any write. The deferral doesn't depend on the comments
  // read, so a failed read skips only that pick's comment rather than end the
  // run on one transient gh error (#428); not posting is the safe side, since
  // a duplicate comment is the only other outcome.
  const deferred = picks.flatMap((issue) => {
    const deferral = deferrals.get(issue);
    return deferral ? [{ id: Number(issue.id), deferral }] : [];
  });
  const skipComment = new Set<number>();
  for (const { id, deferral } of deferred) {
    try {
      if (github.commented(id)) skipComment.add(id);
    } catch (error) {
      skipComment.add(id);
      log(`  ⚠ #${id} is deferred behind #${deferral.on.number}, but its comments couldn't be read, so no comment is posted (${error}).`);
    }
  }

  const holds: OverlapHold[] = [];
  for (const { id, deferral } of deferred) {
    const ref = `#${deferral.on.number}`;
    holds.push({ id, behind: deferral.on });
    report.record({ kind: "issue", number: id, outcome: "deferred", detail: `behind ${ref}` });
    const why = deferral.file === undefined ? "it names no files" : deferral.file;
    log(`  ⏸ The overlap check defers #${id} behind ${ref} (${why}).`);
    if (skipComment.has(id)) continue;
    try {
      github.comment(id, overlapComment(deferral));
    } catch (error) {
      log(`  ⚠ #${id} is deferred behind ${ref}, but the comment explaining why couldn't be posted (${error}).`);
    }
  }

  return { kept: picks.filter((issue) => kept.includes(issue)), holds };
}

// The numbers of the held issues whose hold lasts the rest of the run: those
// behind a pull request, and those behind a pick that opened a PR (`published`
// holds those picks' numbers). A hold behind a pick the critique deferred, or
// whose build opened no PR, is released, so the held pick can be planned again
// in a later round of this run rather than wait out the run for nothing (#425).
export function lastingHolds(holds: readonly OverlapHold[], published: ReadonlySet<number>): number[] {
  return holds.filter(({ behind }) => behind.kind === "pr" || published.has(behind.number)).map((hold) => hold.id);
}
