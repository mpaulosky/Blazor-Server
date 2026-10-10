import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roundSummary } from "./round.mts";

const work = [
  { issue: { number: 71 }, branch: "feature/71-a" },
  { issue: { number: 72 }, branch: "feature/72-b" },
];

const built = (prUrl: string | undefined, publishFailed = false): PromiseSettledResult<{ prUrl: string | undefined; publishFailed: boolean }> => ({
  status: "fulfilled",
  value: { prUrl, publishFailed },
});

describe("roundSummary", () => {
  it("names a publish failure, not a round that opened nothing, when every gated branch failed to publish", () => {
    const summary = roundSummary(work, [built(undefined, true), { status: "rejected", reason: new Error("sandbox crashed") }]);

    assert.equal(summary.stop, "Publishing failed for every gated branch this round. Stopping.");
    assert.ok(summary.lines.includes("  #71 (feature/71-a): see the comment on the issue"));
  });

  it("stops on no pull requests opened when nothing was gated and published", () => {
    const summary = roundSummary(work, [built(undefined), { status: "rejected", reason: new Error("sandbox crashed") }]);

    assert.equal(summary.stop, "No pull requests opened this round. Stopping.");
    assert.ok(!summary.lines.some((line) => line.includes("stranded")));
  });

  it("lists the opened pull requests and the stranded branches, and doesn't stop, when a pull request opened", () => {
    const summary = roundSummary(work, [built("https://github.com/o/r/pull/1"), built(undefined, true)]);

    assert.equal(summary.stop, undefined);
    assert.deepEqual(summary.lines, [
      "\nExecution complete. 1 pull request(s):",
      "  #71 (feature/71-a) → https://github.com/o/r/pull/1",
      "\n1 gated branch(es) couldn't be published, so their work is stranded:",
      "  #72 (feature/72-b): see the comment on the issue",
    ]);
  });
});
