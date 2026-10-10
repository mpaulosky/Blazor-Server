// A crashed run leaves sandcastle:building on its issue forever, since
// nothing else removes it (lib/build.mts#buildIssue only unmarks on its own
// way out). That holds the issue back (lib/gate.mts) past the point any real
// build could still be running. This module clears a label that's stuck
// around longer than BUILDING_LABEL_MAX_AGE_MS, run once at startup alongside
// ensureLabels (see main.mts), while leaving a live run's label alone.

import { BUILDING_LABEL, BUILDING_LABEL_MAX_AGE_MS } from "./config.mts";
import type { TimelineLabelEvent } from "./github.mts";

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
  throw new Error("Not implemented");
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
  issuesWithLabel: () => {
    throw new Error("Not implemented");
  },
  labelTimeline: () => {
    throw new Error("Not implemented");
  },
  removeLabel: () => {
    throw new Error("Not implemented");
  },
};

// Clears `label` (sandcastle:building) from any issue whose most recent
// labelling is older than `maxAgeMs` (see labelIsStale), so a crashed run
// doesn't hold its issue back forever. A label a live run just added stays.
export function clearStaleBuildingLabels(
  github: BuildingGitHub = liveBuildingGitHub,
  label: string = BUILDING_LABEL,
  maxAgeMs: number = BUILDING_LABEL_MAX_AGE_MS,
  now: number = Date.now(),
): void {
  throw new Error("Not implemented");
}
