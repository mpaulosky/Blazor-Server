import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { execFileSync } from "node:child_process";
import { BUILD_FAILED_MARKER, BUILD_FAILURE_CAP } from "./config.mts";
import { buildFailedComment, needsHumanComment, recordFailedAttempt } from "./handback.mts";
import { HandBackReport } from "./report.mts";

// A gh stub recording every call's args and stdin input.
function recordingGh() {
  const calls: { args: readonly string[]; input: unknown }[] = [];
  const run = ((_cmd: string, args: readonly string[], options: { input?: unknown }) => {
    calls.push({ args, input: options.input });
    return "";
  }) as unknown as typeof execFileSync;
  return { calls, run };
}

describe("buildFailedComment", () => {
  it("carries the marker, the attempt number and the detail", () => {
    const comment = buildFailedComment(1, "feature/69-run-the-gate", "the tester failed: Error: timed out");

    assert.ok(comment.includes(BUILD_FAILED_MARKER));
    assert.match(comment, /attempt 1/);
    assert.match(comment, /the tester failed: Error: timed out/);
    assert.match(comment, /`feature\/69-run-the-gate`/);
  });
});

describe("needsHumanComment", () => {
  it("quotes every failure, oldest first", () => {
    const comment = needsHumanComment("feature/69-run-the-gate", ["first failure detail", "second failure detail"]);

    const firstIndex = comment.indexOf("first failure detail");
    const secondIndex = comment.indexOf("second failure detail");
    assert.ok(firstIndex >= 0 && secondIndex >= 0);
    assert.ok(firstIndex < secondIndex);
  });
});

describe("recordFailedAttempt", () => {
  it("posts the marker comment for the first failed attempt and leaves the issue in the queue", () => {
    const { calls, run } = recordingGh();
    const report = new HandBackReport();

    recordFailedAttempt(69, "feature/69-run-the-gate", "the tester failed: Error: timed out", [], run, "o/r", report);

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.args, ["issue", "comment", "69", "--repo", "o/r", "--body-file", "-"]);
    const body = calls[0]!.input as string;
    assert.ok(body.includes(BUILD_FAILED_MARKER));
    assert.match(body, /attempt 1/);
    assert.match(body, /the tester failed: Error: timed out/);
    assert.deepEqual(report.items(), []);
  });

  it(`hands the issue back on the ${BUILD_FAILURE_CAP}nd failed attempt since sandcastle:needs-human was last removed`, () => {
    const { calls, run } = recordingGh();
    const report = new HandBackReport();
    const firstFailure = buildFailedComment(1, "feature/69-run-the-gate", "the tester failed: Error: timed out");

    recordFailedAttempt(69, "feature/69-run-the-gate", "the gate is still red at checkpoint 1", [firstFailure], run, "o/r", report);

    const edits = calls.filter((call) => call.args[1] === "edit");
    const comments = calls.filter((call) => call.args[1] === "comment");
    assert.deepEqual(edits[0]!.args, [
      "issue", "edit", "69", "--repo", "o/r", "--add-label", "sandcastle:needs-human", "--remove-label", "sandcastle:ready",
    ]);
    assert.equal(comments.length, 1);
    const summary = comments[0]!.input as string;
    assert.match(summary, /the tester failed: Error: timed out/);
    assert.match(summary, /the gate is still red at checkpoint 1/);
    assert.equal(report.items().length, 1);
    assert.equal(report.items()[0]!.target, "issue #69");
    assert.equal(report.items()[0]!.label, "sandcastle:needs-human");
    assert.match(report.items()[0]!.reason, /feature\/69-run-the-gate/);
  });
});
