import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ROLE_AGENTS } from "./config.mts";

const opus = "claude-opus-5-5";
const sonnet = "claude-sonnet-5";

describe("ROLE_AGENTS", () => {
  it("configures every role with the spec's model, effort, iterations and timeout", () => {
    assert.deepEqual(ROLE_AGENTS, {
      intake: { model: sonnet, effort: "medium", maxIterations: 1, timeoutMinutes: 15 },
      planner: { model: opus, effort: "high", maxIterations: 1, timeoutMinutes: 15 },
      critique: { model: sonnet, effort: "high", maxIterations: 1, timeoutMinutes: 15 },
      architect: { model: opus, effort: "high", maxIterations: 1, timeoutMinutes: 15 },
      tester: { model: sonnet, effort: "high", maxIterations: 3, timeoutMinutes: 30 },
      backend: { model: opus, effort: "high", maxIterations: 10, timeoutMinutes: 45 },
      ui: { model: sonnet, effort: "high", maxIterations: 10, timeoutMinutes: 45 },
      scribe: { model: sonnet, effort: "medium", maxIterations: 1, timeoutMinutes: 15 },
      reviewer: { model: opus, effort: "high", maxIterations: 1, timeoutMinutes: 15 },
      "gate-fixer": { model: sonnet, effort: "high", maxIterations: 1, timeoutMinutes: 20 },
      "follow-up": { model: sonnet, effort: "high", maxIterations: 1, timeoutMinutes: 30 },
      implementer: { model: opus, effort: "high", maxIterations: 100, timeoutMinutes: 45 },
    });
  });
});
