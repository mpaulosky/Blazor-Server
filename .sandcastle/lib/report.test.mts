import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UsageReport } from "./report.mts";

const usage = (inputTokens: number, cacheCreationInputTokens: number, cacheReadInputTokens: number, outputTokens: number) =>
  ({ inputTokens, cacheCreationInputTokens, cacheReadInputTokens, outputTokens });

describe("UsageReport", () => {
  it("sums every iteration's usage per role", () => {
    const report = new UsageReport();

    report.record("planner", [{ usage: usage(1, 2, 3, 4) }]);
    report.record("implementer", [{ usage: usage(10, 20, 30, 40) }, { usage: usage(1, 1, 1, 1) }]);
    report.record("implementer", [{ usage: usage(100, 0, 0, 0) }]);

    assert.deepEqual(report.totals(), new Map([
      ["planner", usage(1, 2, 3, 4)],
      ["implementer", usage(111, 21, 31, 41)],
    ]));
  });

  it("counts a run with no captured usage as zero", () => {
    const report = new UsageReport();

    report.record("reviewer", [{}]);

    assert.deepEqual(report.totals().get("reviewer"), usage(0, 0, 0, 0));
  });

  it("lists each role's input, cache-creation, cache-read and output tokens", () => {
    const report = new UsageReport();
    report.record("planner", [{ usage: usage(1, 2, 3, 4) }]);

    const lines = report.lines();

    assert.deepEqual(lines, ["  planner: input 1, cache creation 2, cache read 3, output 4"]);
  });
});
