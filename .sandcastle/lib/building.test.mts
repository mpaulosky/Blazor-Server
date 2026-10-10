import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUILDING_LABEL, BUILDING_LABEL_MAX_AGE_MS } from "./config.mts";
import type { TimelineLabelEvent } from "./github.mts";
import { clearStaleBuildingLabels, labelIsStale, type BuildingGitHub } from "./building.mts";

const labeled = (createdAt: string): TimelineLabelEvent => ({ event: "labeled", label: BUILDING_LABEL, createdAt });
const unlabeled = (createdAt: string): TimelineLabelEvent => ({ event: "unlabeled", label: BUILDING_LABEL, createdAt });

describe("labelIsStale", () => {
  const now = Date.parse("2026-10-10T12:00:00Z");

  it("is stale once the label's most recent labeled event is more than the max age old", () => {
    const timeline = [labeled("2026-10-10T05:00:00Z")]; // 7h before `now`

    assert.equal(labelIsStale(timeline, BUILDING_LABEL, BUILDING_LABEL_MAX_AGE_MS, now), true);
  });

  it("isn't stale while the label's most recent labeled event is within the max age", () => {
    const timeline = [labeled("2026-10-10T09:00:00Z")]; // 3h before `now`

    assert.equal(labelIsStale(timeline, BUILDING_LABEL, BUILDING_LABEL_MAX_AGE_MS, now), false);
  });

  it("uses the label's most recent labeled event, not an earlier one", () => {
    // Labelled a day ago, then again 2h ago: a second run picked the issue up
    // after the first one cleared it.
    const timeline = [labeled("2026-10-09T00:00:00Z"), unlabeled("2026-10-09T01:00:00Z"), labeled("2026-10-10T10:00:00Z")];

    assert.equal(labelIsStale(timeline, BUILDING_LABEL, BUILDING_LABEL_MAX_AGE_MS, now), false);
  });

  it("isn't stale when the timeline has no labeled event for this label", () => {
    const timeline: TimelineLabelEvent[] = [{ event: "labeled", label: "sandcastle:ready", createdAt: "2026-01-01T00:00:00Z" }];

    assert.equal(labelIsStale(timeline, BUILDING_LABEL, BUILDING_LABEL_MAX_AGE_MS, now), false);
  });
});

describe("clearStaleBuildingLabels", () => {
  function github(timelines: Record<number, TimelineLabelEvent[]>): BuildingGitHub & { removed: number[] } {
    const removed: number[] = [];
    return {
      removed,
      issuesWithLabel: () => Object.keys(timelines).map(Number),
      labelTimeline: (issueNumber) => timelines[issueNumber] ?? [],
      removeLabel: (issueNumber) => void removed.push(issueNumber),
    };
  }

  const now = Date.parse("2026-10-10T12:00:00Z");

  it("removes the label from an issue whose most recent labeling is older than the max age", () => {
    const gh = github({ 42: [labeled("2026-10-10T05:00:00Z")] });

    clearStaleBuildingLabels(gh, BUILDING_LABEL, BUILDING_LABEL_MAX_AGE_MS, now);

    assert.deepEqual(gh.removed, [42]);
  });

  it("keeps the label on an issue a live run labelled recently", () => {
    const gh = github({ 42: [labeled("2026-10-10T11:00:00Z")] });

    clearStaleBuildingLabels(gh, BUILDING_LABEL, BUILDING_LABEL_MAX_AGE_MS, now);

    assert.deepEqual(gh.removed, []);
  });

  it("checks every issue carrying the label and clears only the stale ones", () => {
    const gh = github({
      42: [labeled("2026-10-10T05:00:00Z")], // stale
      43: [labeled("2026-10-10T11:30:00Z")], // fresh
    });

    clearStaleBuildingLabels(gh, BUILDING_LABEL, BUILDING_LABEL_MAX_AGE_MS, now);

    assert.deepEqual(gh.removed, [42]);
  });

  it("only reads the timeline of issues carrying the label", () => {
    const read: number[] = [];
    const gh: BuildingGitHub = {
      issuesWithLabel: () => [42],
      labelTimeline: (issueNumber) => {
        read.push(issueNumber);
        return [labeled("2026-10-10T00:00:00Z")];
      },
      removeLabel: () => {},
    };

    clearStaleBuildingLabels(gh, BUILDING_LABEL, BUILDING_LABEL_MAX_AGE_MS, now);

    assert.deepEqual(read, [42]);
  });
});
