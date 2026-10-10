import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUILDING_LABEL, BUILDING_LABEL_MAX_AGE_MS } from "./config.mts";
import type { TimelineLabelEvent } from "./github.mts";
import {
  claimBuildingLabel,
  clearStaleBuildingLabels,
  labelIsStale,
  releaseAllBuildingLabels,
  releaseBuildingLabel,
  type BuildingGitHub,
  type BuildingLabels,
} from "./building.mts";

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

// A BuildingLabels stub over an in-memory label list per issue, recording
// every call. `failRemove` makes removing the label from those issues throw.
function labelStub(labels: Record<number, string[]> = {}, failRemove: number[] = []) {
  const calls: string[] = [];
  const github: BuildingLabels = {
    issueLabels: (issueNumber) => {
      calls.push(`labels #${issueNumber}`);
      return [...(labels[issueNumber] ?? [])];
    },
    addLabel: (issueNumber, label) => {
      calls.push(`add #${issueNumber}`);
      (labels[issueNumber] ??= []).push(label);
    },
    removeLabel: (issueNumber, label) => {
      calls.push(`remove #${issueNumber}`);
      if (failRemove.includes(issueNumber)) throw new Error("gh issue edit failed:\nHTTP 502: Bad Gateway");
      labels[issueNumber] = (labels[issueNumber] ?? []).filter((name) => name !== label);
    },
  };
  return { calls, github, labels };
}

describe("claimBuildingLabel", () => {
  it("adds the label to an issue that doesn't carry it and remembers the issue", () => {
    const { calls, github, labels } = labelStub({ 150: ["Sandcastle"] });
    const marked = new Set<number>();

    const claimed = claimBuildingLabel(150, github, marked);

    assert.equal(claimed, true);
    assert.deepEqual(calls, ["labels #150", "add #150"]);
    assert.deepEqual(labels[150], ["Sandcastle", BUILDING_LABEL]);
    assert.deepEqual([...marked], [150]);
  });

  // Another run's gate read the labels before this one's add, so both picked
  // the issue: the one that marks it second must leave it alone.
  it("leaves an issue another run already marked, without adding the label or remembering the issue", () => {
    const { calls, github } = labelStub({ 150: ["Sandcastle", "Sandcastle:Building"] });
    const marked = new Set<number>();

    const claimed = claimBuildingLabel(150, github, marked);

    assert.equal(claimed, false);
    assert.deepEqual(calls, ["labels #150"]);
    assert.deepEqual([...marked], []);
  });
});

describe("releaseBuildingLabel", () => {
  it("removes the label and forgets the issue", () => {
    const { github, labels } = labelStub({ 150: [BUILDING_LABEL] });
    const marked = new Set([150]);

    releaseBuildingLabel(150, github, marked);

    assert.deepEqual(labels[150], []);
    assert.deepEqual([...marked], []);
  });

  // Still remembered, so releaseAllBuildingLabels tries again on exit.
  it("keeps remembering the issue when the label can't be removed", () => {
    const { github } = labelStub({ 150: [BUILDING_LABEL] }, [150]);
    const marked = new Set([150]);

    assert.throws(() => releaseBuildingLabel(150, github, marked), /502/);

    assert.deepEqual([...marked], [150]);
  });
});

describe("releaseAllBuildingLabels", () => {
  // Ctrl-C, SIGTERM and a crash skip buildIssue's finally; main.mts calls
  // this from the process's exit listener instead.
  it("removes the label from every issue this run still holds and returns them", () => {
    const { github, labels } = labelStub({ 71: [BUILDING_LABEL], 150: [BUILDING_LABEL] });
    const marked = new Set([71, 150]);

    const released = releaseAllBuildingLabels(github, marked, () => {});

    assert.deepEqual(released, [71, 150]);
    assert.deepEqual(labels, { 71: [], 150: [] });
    assert.deepEqual([...marked], []);
  });

  it("carries on past an issue whose label can't be removed, and reports it", () => {
    const { github, labels } = labelStub({ 71: [BUILDING_LABEL], 150: [BUILDING_LABEL] }, [71]);
    const warnings: string[] = [];

    const released = releaseAllBuildingLabels(github, new Set([71, 150]), (message) => warnings.push(message));

    assert.deepEqual(released, [150]);
    assert.deepEqual(labels[150], []);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /#71/);
  });
});
