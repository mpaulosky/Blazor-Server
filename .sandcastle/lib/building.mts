// A crashed run leaves sandcastle:building on its issue forever, since
// nothing else removes it (lib/build.mts#buildIssue only unmarks on its own
// way out). That holds the issue back (lib/gate.mts) past the point any real
// build could still be running. This module clears a label that's stuck
// around longer than BUILDING_LABEL_MAX_AGE_MS, run once at startup alongside
// ensureLabels (see main.mts), while leaving a live run's label alone.

import { BUILDING_LABEL, BUILDING_LABEL_MAX_AGE_MS } from "./config.mts";
import { issuesWithLabel, labelTimeline, removeIssueLabel, timestamp, type TimelineLabelEvent } from "./github.mts";

// Whether `label`'s most recent "labeled" event in `timeline` happened more
// than `maxAgeMs` before `now`. No "labeled" event for `label` in `timeline`
// counts as not stale: there's nothing a crashed run could have left behind
// to clear.
export function labelIsStale(
  timeline: readonly TimelineLabelEvent[],
  label: string,
  maxAgeMs: number,
  now: number,
): boolean {
  const labelled = timeline
    .filter((event) => event.event === "labeled" && event.label.toLowerCase() === label.toLowerCase())
    .map((event) => timestamp(event.createdAt));
  if (labelled.length === 0) return false;
  return now - Math.max(...labelled) > maxAgeMs;
}

// What clearStaleBuildingLabels needs from GitHub; tests pass a stub.
export type BuildingGitHub = {
  // Numbers of the open issues currently carrying `label`.
  issuesWithLabel(label: string): number[];
  // The issue's own "labeled"/"unlabeled" timeline events.
  labelTimeline(issueNumber: number): TimelineLabelEvent[];
  removeLabel(issueNumber: number, label: string): void;
};

export const liveBuildingGitHub: BuildingGitHub = {
  issuesWithLabel: (label) => issuesWithLabel(label),
  labelTimeline: (issueNumber) => labelTimeline(issueNumber),
  removeLabel: (issueNumber, label) => removeIssueLabel(issueNumber, label),
};

// Clears `label` (sandcastle:building) from any issue whose most recent
// labelling is older than `maxAgeMs` (see labelIsStale), so a crashed run
// doesn't hold its issue back forever. A label a live run just added stays.
// Returns the numbers of the issues it cleared, for the startup log. A
// timeline that can't be read throws, failing the run before any work,
// rather than guess whether another run is still building the issue.
export function clearStaleBuildingLabels(
  github: BuildingGitHub = liveBuildingGitHub,
  label: string = BUILDING_LABEL,
  maxAgeMs: number = BUILDING_LABEL_MAX_AGE_MS,
  now: number = Date.now(),
): number[] {
  const cleared: number[] = [];
  for (const issueNumber of github.issuesWithLabel(label)) {
    if (!labelIsStale(github.labelTimeline(issueNumber), label, maxAgeMs, now)) continue;
    github.removeLabel(issueNumber, label);
    cleared.push(issueNumber);
  }
  return cleared;
}
