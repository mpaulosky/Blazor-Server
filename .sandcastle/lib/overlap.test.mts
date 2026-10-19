import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OVERLAP_MARKER } from "./config.mts";
import { carriedHold, deferOverlaps, lastingHolds, overlapComment, pullRequestNumber, type OverlapGitHub } from "./overlap.mts";
import type { PlannedIssue } from "./plan.mts";
import { OutcomeReport } from "./report.mts";

const pick = (id: number, files?: string[]): PlannedIssue => ({
  id: String(id),
  title: `Issue ${id}`,
  ...(files === undefined ? {} : { files }),
});

// A GitHub stub: `prs` maps each open PR into main to the files it changes, and
// writes are recorded instead of sent. `commented` lists the issues the host has
// already posted a deferral comment on.
const github = (prs: Record<number, string[]> = {}, commented: number[] = []) => {
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
    commented: (id) => commented.includes(id),
  };
  return { stub, links, comments };
};

const ids = (picks: readonly PlannedIssue[]): string[] => picks.map((p) => p.id);

describe("deferOverlaps", () => {
  it("builds only the first of two picks that name the same file, and says which file and issue it waits on", () => {
    const gh = github();

    const { kept } = deferOverlaps([pick(1, ["lib/build.mts"]), pick(2, ["lib/build.mts", "lib/plan.mts"])], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1"]);
    assert.deepEqual(gh.links, [], "a hold behind a pick isn't final, so it isn't linked");
    assert.equal(gh.comments.length, 1);
    const [id, body] = gh.comments[0]!;
    assert.equal(id, 2);
    assert.match(body, /lib\/build\.mts/);
    assert.match(body, /#1/);
  });

  it("defers a pick naming a file an open pull request changes, whoever opened it, and names the file and the PR", () => {
    const gh = github({ 90: ["src/UI/Program.cs", "docs/README.md"] });

    const { kept } = deferOverlaps([pick(5, ["src/UI/Program.cs"])], gh.stub, () => {});

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

    const { kept } = deferOverlaps([pick(1, ["a.mts"]), pick(2, ["b.mts"]), pick(3, ["c.mts"])], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1", "2", "3"]);
    assert.deepEqual(gh.links, []);
    assert.deepEqual(gh.comments, []);
  });

  it("defers a pick with no files when another pick is in the round", () => {
    const gh = github();

    const { kept } = deferOverlaps([pick(1, ["a.mts"]), pick(2)], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1"]);
    assert.equal(gh.comments.length, 1);
    assert.equal(gh.comments[0]![0], 2);
  });

  it("defers a pick with an empty files list when another pick is in the round", () => {
    const gh = github();

    const { kept } = deferOverlaps([pick(1, []), pick(2, ["b.mts"])], gh.stub, () => {});

    assert.ok(!ids(kept).includes("1"));
    assert.ok(gh.comments.some(([id]) => id === 1));
  });

  it("builds a pick with no files when it's the round's only pick and no pull request is open", () => {
    const gh = github();

    const { kept } = deferOverlaps([pick(1)], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1"]);
    assert.deepEqual(gh.comments, []);
  });

  it("defers a pick with no files when any pull request into main is open", () => {
    const gh = github({ 90: ["anything.md"] });

    const { kept } = deferOverlaps([pick(1)], gh.stub, () => {});

    assert.deepEqual(ids(kept), []);
    assert.equal(gh.comments.length, 1);
    assert.match(gh.comments[0]![1], /#90/);
  });

  it("keeps the planner's order and compares a later pick only with the picks kept before it", () => {
    const gh = github();

    // #2 is deferred behind #1, so #3 overlaps only a deferred pick and is built.
    const { kept } = deferOverlaps([pick(1, ["a.mts"]), pick(2, ["a.mts", "b.mts"]), pick(3, ["b.mts"])], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1", "3"]);
  });

  it("records each deferral in the run report as deferred", () => {
    const gh = github();
    const report = new OutcomeReport();

    deferOverlaps([pick(1, ["a.mts"]), pick(2, ["a.mts"])], gh.stub, () => {}, report);

    const outcomes = report.items().filter((entry) => entry.outcome === "deferred");
    assert.deepEqual(outcomes.map((entry) => entry.number), [2]);
  });

  // AC 1: picks with no files never block each other.
  it("builds the first of two picks that name no files, and holds the second behind it", () => {
    const gh = github();

    const { kept, holds } = deferOverlaps([pick(1), pick(2)], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1"]);
    assert.deepEqual(holds, [{ id: 2, behind: { kind: "issue", number: 1 } }]);
    assert.deepEqual(gh.comments.map(([id]) => id), [2]);
    assert.match(gh.comments[0]![1], /#1/);
  });

  it("builds the first of several picks with no files, treating an empty list as no files", () => {
    const gh = github();

    const { kept, holds } = deferOverlaps([pick(1, []), pick(2), pick(3, [])], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1"]);
    assert.deepEqual(holds.map((hold) => hold.id), [2, 3]);
    assert.ok(holds.every((hold) => hold.behind.kind === "issue" && hold.behind.number === 1));
  });

  it("holds every pick with no files behind a kept pick that names files", () => {
    const gh = github();

    const { kept, holds } = deferOverlaps([pick(1), pick(2), pick(3, ["c.mts"])], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["3"]);
    assert.deepEqual(holds, [
      { id: 1, behind: { kind: "issue", number: 3 } },
      { id: 2, behind: { kind: "issue", number: 3 } },
    ]);
  });

  it("holds every pick with no files behind an open pull request", () => {
    const gh = github({ 90: ["x.md"] });

    const { kept, holds } = deferOverlaps([pick(1), pick(2)], gh.stub, () => {});

    assert.deepEqual(ids(kept), []);
    assert.deepEqual(holds, [
      { id: 1, behind: { kind: "pr", number: 90 } },
      { id: 2, behind: { kind: "pr", number: 90 } },
    ]);
  });

  // AC 2: a hold is released when the pick it waits on builds no PR.
  it("reports a hold behind a kept pick, and one behind a pull request, with what each waits on", () => {
    const gh = github({ 90: ["p.md"] });

    const { holds } = deferOverlaps([pick(1, ["a.mts"]), pick(2, ["a.mts"]), pick(3, ["p.md"])], gh.stub, () => {});

    assert.deepEqual(holds, [
      { id: 2, behind: { kind: "issue", number: 1 }, file: "a.mts" },
      { id: 3, behind: { kind: "pr", number: 90 }, file: "p.md" },
    ]);
  });

  it("releases a hold behind a pick that opened no pull request", () => {
    const holds = [{ id: 2, behind: { kind: "issue" as const, number: 1 } }];

    assert.deepEqual(lastingHolds(holds, new Set()), []);
  });

  it("releases a hold behind a pick the critique deferred, which never reaches the build", () => {
    const holds = [{ id: 2, behind: { kind: "issue" as const, number: 1 } }];

    assert.deepEqual(lastingHolds(holds, new Set([7])), []);
  });

  it("keeps a hold behind a pick that opened a pull request for the rest of the run", () => {
    const holds = [{ id: 2, behind: { kind: "issue" as const, number: 1 } }];

    assert.deepEqual(lastingHolds(holds, new Set([1])), [2]);
  });

  it("keeps a hold behind an open pull request for the rest of the run", () => {
    const holds = [{ id: 3, behind: { kind: "pr" as const, number: 90 } }];

    assert.deepEqual(lastingHolds(holds, new Set()), [3]);
  });

  it("keeps only the lasting holds when some are released", () => {
    const holds = [
      { id: 2, behind: { kind: "issue" as const, number: 1 } },
      { id: 4, behind: { kind: "issue" as const, number: 3 } },
      { id: 5, behind: { kind: "pr" as const, number: 90 } },
    ];

    assert.deepEqual(lastingHolds(holds, new Set([3])), [4, 5]);
  });

  // AC 3: a folder covers the paths under it.
  it("defers a pick naming a folder that a kept pick's file sits under", () => {
    const gh = github();

    const { kept } = deferOverlaps([pick(1, ["src/UI/Program.cs"]), pick(2, ["src/UI"])], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1"]);
  });

  it("defers a pick naming a file under a folder that a kept pick names", () => {
    const gh = github();

    const { kept } = deferOverlaps([pick(1, ["src/UI"]), pick(2, ["src/UI/Program.cs"])], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1"]);
  });

  it("defers a pick naming a folder that an open pull request changes a file under", () => {
    const gh = github({ 90: [".sandcastle/lib/build.mts"] });

    const { kept } = deferOverlaps([pick(5, [".sandcastle/lib"])], gh.stub, () => {});

    assert.deepEqual(ids(kept), []);
    assert.match(gh.comments[0]![1], /#90/);
  });

  it("doesn't treat a folder as covering a sibling that only shares its prefix", () => {
    const gh = github({ 90: ["src/UIKit/a.cs"] });

    const { kept } = deferOverlaps([pick(1, ["src/UI"]), pick(2, ["src/UI2/b.cs"])], gh.stub, () => {});

    assert.deepEqual(ids(kept), ["1", "2"]);
  });

  // AC 6: a deferral is commented on once.
  it("doesn't comment again on a pick the host already commented on, but still defers and reports it", () => {
    const gh = github({ 90: ["a.mts"] }, [5]);
    const report = new OutcomeReport();

    const { kept } = deferOverlaps([pick(5, ["a.mts"])], gh.stub, () => {}, report);

    assert.deepEqual(ids(kept), []);
    assert.deepEqual(gh.comments, []);
    assert.deepEqual(report.items().filter((entry) => entry.outcome === "deferred").map((entry) => entry.number), [5]);
  });

  it("still comments on a deferred pick the host hasn't commented on while skipping one it has", () => {
    const gh = github({}, [2]);

    deferOverlaps([pick(1, ["a.mts"]), pick(2, ["a.mts"]), pick(3, ["a.mts"])], gh.stub, () => {});

    assert.deepEqual(gh.comments.map(([id]) => id), [3]);
  });

  // #428: a transient gh error on the comments read doesn't end the run.
  it("still defers a pick whose comments can't be read, logs a warning, and doesn't throw", () => {
    const gh = github();
    gh.stub.commented = () => {
      throw new Error("gh: HTTP 502");
    };
    const report = new OutcomeReport();
    const lines: string[] = [];

    const { kept, holds } = deferOverlaps([pick(1, ["a.mts"]), pick(2, ["a.mts"])], gh.stub, (line) => lines.push(line), report);

    assert.deepEqual(ids(kept), ["1"]);
    assert.deepEqual(holds, [{ id: 2, behind: { kind: "issue", number: 1 }, file: "a.mts" }]);
    assert.deepEqual(report.items().filter((entry) => entry.outcome === "deferred").map((entry) => entry.number), [2]);
    assert.ok(lines.some((line) => line.includes("⚠") && line.includes("#2") && line.includes("HTTP 502")), lines.join("\n"));
  });

  it("skips only the comment of the pick whose comments can't be read", () => {
    const gh = github();
    gh.stub.commented = (id) => {
      if (id === 2) throw new Error("gh: HTTP 502");
      return false;
    };

    const { holds } = deferOverlaps([pick(1, ["a.mts"]), pick(2, ["a.mts"]), pick(3, ["a.mts"])], gh.stub, () => {});

    assert.deepEqual(holds.map((hold) => hold.id), [2, 3]);
    assert.deepEqual(gh.comments.map(([id]) => id), [3]);
  });

  it("reads every pick's comments before writing any, even when one read fails", () => {
    const order: string[] = [];
    const gh = github();
    gh.stub.commented = (id) => {
      order.push(`read ${id}`);
      if (id === 2) throw new Error("gh: HTTP 502");
      return false;
    };
    gh.stub.comment = (id) => {
      order.push(`write ${id}`);
    };

    deferOverlaps([pick(1, ["a.mts"]), pick(2, ["a.mts"]), pick(3, ["a.mts"])], gh.stub, () => {});

    assert.deepEqual(order, ["read 2", "read 3", "write 3"]);
  });

  // A failed read of the open PRs or their files can't be guessed around: the
  // check would build on an overlap it couldn't see.
  it("throws and posts no comment when the open pull requests can't be read", () => {
    const gh = github();
    gh.stub.openPullRequestsIntoMain = () => {
      throw new Error("gh: HTTP 502");
    };

    assert.throws(() => deferOverlaps([pick(1, ["a.mts"]), pick(2, ["a.mts"])], gh.stub, () => {}), /HTTP 502/);
    assert.deepEqual(gh.comments, []);
  });

  it("throws and posts no comment when an open pull request's files can't be read", () => {
    const gh = github({ 90: ["a.mts"] });
    gh.stub.pullRequestFiles = () => {
      throw new Error("gh: HTTP 502");
    };

    assert.throws(() => deferOverlaps([pick(1, ["a.mts"]), pick(2, ["b.mts"])], gh.stub, () => {}), /HTTP 502/);
    assert.deepEqual(gh.comments, []);
  });
});

describe("overlapComment", () => {
  it("carries the marker the host finds its earlier deferral comment by", () => {
    const body = overlapComment({ file: "a.mts", on: { kind: "pr", number: 90 }, linked: false });

    assert.ok(body.includes(OVERLAP_MARKER));
  });
});

// #428: a lasting hold is stored for later rounds, where its blocker is no
// longer a pick.
describe("carriedHold", () => {
  it("points a hold behind a published pick at that pick's pull request", () => {
    const hold = { id: 2, behind: { kind: "issue" as const, number: 1 }, file: "a.mts" };

    assert.deepEqual(carriedHold(hold, new Map([[1, 95]])), { id: 2, behind: { kind: "pr", number: 95 }, file: "a.mts" });
  });

  it("leaves a hold behind an open pull request as it was", () => {
    const hold = { id: 3, behind: { kind: "pr" as const, number: 90 } };

    assert.deepEqual(carriedHold(hold, new Map([[90, 95]])), hold);
  });

  it("leaves a hold behind a pick with no known pull request as it was", () => {
    const hold = { id: 2, behind: { kind: "issue" as const, number: 1 } };

    assert.deepEqual(carriedHold(hold, new Map()), hold);
  });
});

describe("pullRequestNumber", () => {
  it("reads the number from a pull request URL", () => {
    assert.equal(pullRequestNumber("https://github.com/o/r/pull/95"), 95);
  });

  it("returns undefined for a URL without one", () => {
    assert.equal(pullRequestNumber("https://github.com/o/r/issues/95"), undefined);
  });
});
