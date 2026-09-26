import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roleOptions } from "./agents.mts";

describe("roleOptions", () => {
  it("names the run after the role and applies its iteration cap", () => {
    const options = roleOptions("tester");

    assert.equal(options.name, "tester");
    assert.equal(options.maxIterations, 3);
  });

  it("runs the role's model at its effort", () => {
    const { command } = roleOptions("scribe").agent.buildPrintCommand({ prompt: "", dangerouslySkipPermissions: true });

    assert.match(command, /--model 'claude-sonnet-5'/);
    assert.match(command, /--effort medium/);
  });

  it("aborts the run after the role's timeout", () => {
    const requested: number[] = [];
    const signal = new AbortController().signal;

    const options = roleOptions("backend", (ms) => {
      requested.push(ms);
      return signal;
    });

    assert.deepEqual(requested, [45 * 60_000]);
    assert.equal(options.signal, signal);
  });
});
