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

import {
  addBlockedBy,
  commentOnIssue,
  openPullRequestsIntoMain,
  pullRequestFiles,
  type OpenPullRequest,
} from "./github.mts";
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

const liveGitHub: OverlapGitHub = {
  openPullRequestsIntoMain,
  pullRequestFiles,
  addBlockedBy,
  comment: commentOnIssue,
};

// Why a pick waits: the shared path (none for a pick with no files), the issue
// or pull request it waits on, and whether it's linked as blocked by that
// issue, which holds it back in later runs too.
type Deferral = { file?: string; on: { kind: "issue" | "pr"; number: number }; linked: boolean };

// The comment posted on a deferred pick, naming the file and the issue or pull
// request it waits on, as the critique's deferral comment does.
export function overlapComment({ file, on, linked }: Deferral): string {
  const ref = `#${on.number}`;
  const what = `${on.kind === "issue" ? "issue" : "pull request"} ${ref}`;
  const reason =
    file === undefined
      ? `The planner named no files this issue will change, so it may touch anything ${what} changes.`
      : `It's expected to change \`${file}\`, which ${what} changes too.`;
  const after = linked
    ? `It won't be built until ${ref} lands. To override, delete the "blocked by ${ref}" link on this issue.`
    : "It won't be built in this run; a later run checks again.";
  return [`Sandcastle deferred this issue behind ${ref}, so the two don't conflict once one merges.`, `**Reason:** ${reason}`, after].join(
    "\n\n",
  );
}

// Return the picks still to build this round, in the planner's order. Each
// deferred pick gets one comment naming the shared file and the PR or issue it
// waits on, and reaches the run report as "deferred". A pick deferred behind a
// pick built this round is also linked as blocked by it; one deferred behind a
// pull request isn't, since a PR can't be a native blocker. A failed GitHub
// read throws, so nothing is built on an overlap the host couldn't check.
export function deferOverlaps(
  picks: readonly PlannedIssue[],
  github: OverlapGitHub = liveGitHub,
  log: (line: string) => void = console.log,
  report: OutcomeReport = outcomeReport,
): PlannedIssue[] {
  const openPrs = github
    .openPullRequestsIntoMain()
    .map((pr) => ({ number: pr.number, files: new Set(github.pullRequestFiles(pr.number)) }));

  const hasFiles = (issue: PlannedIssue): issue is PlannedIssue & { files: string[] } =>
    issue.files !== undefined && issue.files.length > 0;

  // Each path a kept pick will change, with that pick's number, so a later pick
  // names the first kept pick it collides with.
  const claimed = new Map<string, number>();
  const kept: PlannedIssue[] = [];
  const deferrals = new Map<PlannedIssue, Deferral>();

  // The first of the pick's files that a kept pick or an open PR changes. A
  // kept pick wins over a PR on the same file, since only a pick can be linked.
  const firstOverlap = (files: readonly string[]): Deferral | undefined => {
    for (const file of files) {
      const earlier = claimed.get(file);
      if (earlier !== undefined) return { file, on: { kind: "issue", number: earlier }, linked: true };
      const pr = openPrs.find((open) => open.files.has(file));
      if (pr) return { file, on: { kind: "pr", number: pr.number }, linked: false };
    }
    return undefined;
  };

  for (const issue of picks.filter(hasFiles)) {
    const deferral = firstOverlap(issue.files);
    if (deferral) {
      deferrals.set(issue, deferral);
      continue;
    }
    kept.push(issue);
    for (const file of issue.files) claimed.set(file, Number(issue.id));
  }

  // A pick with no files may touch anything, so it's built only alone with no
  // open PR. Otherwise it waits behind the first pick kept this round, or else
  // the first open PR, or else another pick that names no files, unlinked:
  // linking two such picks to each other would leave both waiting forever.
  const [firstKept] = kept;
  const [firstPr] = openPrs;
  for (const issue of picks.filter((pick) => !hasFiles(pick))) {
    if (picks.length === 1 && !firstPr) {
      kept.push(issue);
    } else if (firstKept) {
      deferrals.set(issue, { on: { kind: "issue", number: Number(firstKept.id) }, linked: true });
    } else if (firstPr) {
      deferrals.set(issue, { on: { kind: "pr", number: firstPr.number }, linked: false });
    } else {
      // With no open PR, the first branch kept this pick unless the round has
      // another, so the find can't miss.
      const other = picks.find((pick) => pick !== issue)!;
      deferrals.set(issue, { on: { kind: "issue", number: Number(other.id) }, linked: false });
    }
  }

  for (const issue of picks) {
    const deferral = deferrals.get(issue);
    if (!deferral) continue;
    const id = Number(issue.id);
    const ref = `#${deferral.on.number}`;
    if (deferral.linked) {
      try {
        github.addBlockedBy(id, deferral.on.number);
      } catch (error) {
        // Still deferred: building it beside the pick it overlaps is the
        // conflict this check exists to stop.
        log(`  ⚠ #${id} couldn't be linked as blocked by ${ref} (${error}); it's deferred for this run only.`);
        deferral.linked = false;
      }
    }
    report.record({ kind: "issue", number: id, outcome: "deferred", detail: `behind ${ref}` });
    const why = deferral.file === undefined ? "it names no files" : deferral.file;
    log(`  ⏸ The overlap check defers #${id} behind ${ref} (${why}).`);
    try {
      github.comment(id, overlapComment(deferral));
    } catch (error) {
      log(`  ⚠ #${id} is deferred behind ${ref}, but the comment explaining why couldn't be posted (${error}).`);
    }
  }

  return picks.filter((issue) => kept.includes(issue));
}
