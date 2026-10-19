import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deferOverlaps, type OverlapGitHub } from "./overlap.mts";
import type { PlannedIssue } from "./plan.mts";
import { OutcomeReport } from "./report.mts";

const pick = (id: number, files?: string[]): PlannedIssue => ({
  id: String(id),
  title: `Issue ${id}`,
  ...(files === undefined ? {} : { files }),
});

// A GitHub stub: `prs` maps each open PR into main to the files it changes, and
// writes are recorded instead of sent.
const github = (prs: Record<number, string[]> = {}) => {
  const links: [number, number][] = [];
  const comments: [number, string][] = [];
  const stub: OverlapGitHub = {
    openPullRequestsIntoMain: () => Object.keys(prs).map((number) => ({ number: Number(number), headRefName: `branch-${number}` })),
    pullRequestFiles: (number) => prs[number] ?? [],
    addBlockedBy: (id, blocker) => {
      links.push([id, blocker]);
    },
    comment: (id, body) => {
      comments.push([id, body]);
    },
  };
  return { stub, links, comments };
};

const ids = (picks: readonly PlannedIssue[]): string[] => picks.map((p) => p.id);

describe("deferOverlaps", () => {
  it("builds only the first of two picks that name the same file, and says which file and issue it waits on", () => {
    const gh = github();

    const kept = deferOverlaps([pick(1, ["lib/build.mts"]), pick(2, ["lib/build.mts", "lib/plan.mts"])], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1"]);
    assert.deepEqual(gh.links, [[2, 1]]);
    assert.equal(gh.comments.length, 1);
    const [id, body] = gh.comments[0]!;
    assert.equal(id, 2);
    assert.match(body, /lib\/build\.mts/);
    assert.match(body, /#1/);
  });

  it("defers a pick naming a file an open pull request changes, whoever opened it, and names the file and the PR", () => {
    const gh = github({ 90: ["src/UI/Program.cs", "docs/README.md"] });

    const kept = deferOverlaps([pick(5, ["src/UI/Program.cs"])], gh.stub, () => {});

    assert.deepEqual(ids(kept), []);
    assert.equal(gh.comments.length, 1);
    const [id, body] = gh.comments[0]!;
    assert.equal(id, 5);
    assert.match(body, /src\/UI\/Program\.cs/);
    assert.match(body, /#90/);
  });

  it("doesn't link a pick deferred behind a pull request, since a PR can't be a native blocker", () => {
    const gh = github({ 90: ["a.mts"] });

    deferOverlaps([pick(5, ["a.mts"])], gh.stub, () => {});

    assert.deepEqual(gh.links, []);
  });

  it("builds disjoint picks together and writes nothing to GitHub", () => {
    const gh = github({ 90: ["unrelated.md"] });

    const kept = deferOverlaps([pick(1, ["a.mts"]), pick(2, ["b.mts"]), pick(3, ["c.mts"])], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1", "2", "3"]);
    assert.deepEqual(gh.links, []);
    assert.deepEqual(gh.comments, []);
  });

  it("defers a pick with no files when another pick is in the round", () => {
    const gh = github();

    const kept = deferOverlaps([pick(1, ["a.mts"]), pick(2)], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1"]);
    assert.equal(gh.comments.length, 1);
    assert.equal(gh.comments[0]![0], 2);
  });

  it("defers a pick with an empty files list when another pick is in the round", () => {
    const gh = github();

    const kept = deferOverlaps([pick(1, []), pick(2, ["b.mts"])], gh.stub, () => {});

    assert.ok(!ids(kept).includes("1"));
    assert.ok(gh.comments.some(([id]) => id === 1));
  });

  it("builds a pick with no files when it's the round's only pick and no pull request is open", () => {
    const gh = github();

    const kept = deferOverlaps([pick(1)], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1"]);
    assert.deepEqual(gh.comments, []);
  });

  it("defers a pick with no files when any pull request into main is open", () => {
    const gh = github({ 90: ["anything.md"] });

    const kept = deferOverlaps([pick(1)], gh.stub, () => {});

    assert.deepEqual(ids(kept), []);
    assert.equal(gh.comments.length, 1);
    assert.match(gh.comments[0]![1], /#90/);
  });

  it("keeps the planner's order and compares a later pick only with the picks kept before it", () => {
    const gh = github();

    // #2 is deferred behind #1, so #3 overlaps only a deferred pick and is built.
    const kept = deferOverlaps([pick(1, ["a.mts"]), pick(2, ["a.mts", "b.mts"]), pick(3, ["b.mts"])], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1", "3"]);
  });

  it("records each deferral in the run report as deferred", () => {
    const gh = github();
    const report = new OutcomeReport();

    deferOverlaps([pick(1, ["a.mts"]), pick(2, ["a.mts"])], gh.stub, () => {}, report);

    const outcomes = report.items().filter((entry) => entry.outcome === "deferred");
    assert.deepEqual(outcomes.map((entry) => entry.number), [2]);
  });
});
