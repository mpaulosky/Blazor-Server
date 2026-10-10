import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BUILDING_LABEL_MAX_AGE_MS, GATE_FIXER_ATTEMPTS, ROLE_AGENTS } from "./config.mts";

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
    });
  });
});

describe("BUILDING_LABEL_MAX_AGE_MS", () => {
  // A startup clears a sandcastle:building label older than this as a crashed
  // run's, so it must outlast the longest build a live run can make, or a
  // second run would clear a live build's label and build the issue too.
  // The roles lib/build.mts#buildIssue runs once each, with #72's architect,
  // UI developer and scribe counted ahead of time, plus the gate-fixer's
  // attempts at both checkpoints. Add a role here when buildIssue runs one.
  it("outlasts the longest build the role timeouts allow, with an hour for gates, sandboxes and publishing", () => {
    const once = ["architect", "tester", "backend", "ui", "scribe", "reviewer"] as const;
    const checkpoints = 2;
    const minutes =
      once.reduce((sum, role) => sum + ROLE_AGENTS[role].timeoutMinutes, 0) +
      checkpoints * GATE_FIXER_ATTEMPTS * ROLE_AGENTS["gate-fixer"].timeoutMinutes;
    const hour = 60;

    assert.ok(
      (minutes + hour) * 60_000 <= BUILDING_LABEL_MAX_AGE_MS,
      `the longest build takes ${minutes} minutes plus an hour, past BUILDING_LABEL_MAX_AGE_MS`,
    );
  });
});
