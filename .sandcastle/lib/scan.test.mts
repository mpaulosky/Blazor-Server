import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addedLines } from "./scan.mts";

describe("addedLines", () => {
  it("keeps the lines a commit adds, without file headers or removed lines", () => {
    const patch = ["diff --git a/x b/x", "--- a/x", "+++ b/x", "@@ -1 +1 @@", "-old", "+new"].join("\n");

    assert.deepEqual(addedLines(patch), ["new"]);
  });

  it("keeps the lines a merge's combined diff adds in either column", () => {
    const patch = ["diff --cc x", "+++ b/x", "@@@ -1,1 -1,1 +1,1 @@@", "++both", "+ first", " +second", "- gone"].join("\n");

    assert.deepEqual(addedLines(patch), ["both", "first", "second"]);
  });
});
