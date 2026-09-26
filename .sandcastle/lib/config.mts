// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

import type { ClaudeCodeOptions } from "@ai-hero/sandcastle";

const opus = "claude-opus-5-5";
const sonnet = "claude-sonnet-5";

export type RoleAgent = {
  model: string;
  effort: NonNullable<ClaudeCodeOptions["effort"]>;
  maxIterations: number;
  timeoutMinutes: number;
};

// Every role's agent and budget, from the "Roles, models and budgets" table in
// docs/plans/sandcastle-workflow.md. Opus goes where a wrong answer costs a
// whole round; Sonnet goes where the gate, the reviewer or CI checks the
// output anyway. Structured-output roles must stay at one iteration.
export const ROLE_AGENTS = {
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
  // Temporary: does the tester's and backend's work until the role team
  // replaces it (#71).
  implementer: { model: opus, effort: "high", maxIterations: 100, timeoutMinutes: 45 },
} as const satisfies Record<string, RoleAgent>;

export type Role = keyof typeof ROLE_AGENTS;

// Maximum number of plan→execute→merge cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
export const MAX_ITERATIONS = 10;

// Hooks run inside the sandbox before the agent starts each iteration.
// npm install ensures the sandbox always has fresh dependencies.
export const hooks = {
  sandbox: { onSandboxReady: [{ command: "npm install" }] },
};

// Copy node_modules from the host into the worktree before each sandbox
// starts. Avoids a full npm install from scratch; the hook above handles
// platform-specific binaries and any packages added since the last copy.
export const copyToWorktree = ["node_modules"];
