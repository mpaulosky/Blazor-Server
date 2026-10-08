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
} as const satisfies Record<string, RoleAgent>;

export type Role = keyof typeof ROLE_AGENTS;

// The ref each issue branch is compared with: every issue PR targets main,
// and fetchMain() refreshes origin/main before each round. The sandbox mounts
// the host's .git, so the ref resolves there too.
export const BASE_BRANCH = "origin/main";

// Maximum number of plan→execute→merge cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
export const MAX_ITERATIONS = 10;

// Gate-fixer runs allowed at each gate checkpoint before the issue's round is
// given up, and how much of the final gate output the issue comment quotes.
export const GATE_FIXER_ATTEMPTS = 2;
export const GATE_COMMENT_LINES = 100;

// Hooks run inside the sandbox before the agent starts each iteration.
// pnpm install ensures the sandbox always has fresh dependencies. The copied
// node_modules records the host's pnpm store, so pnpm may rebuild it against
// the sandbox's store; confirm-modules-purge=false lets it do that without a
// TTY prompt.
export const hooks = {
  sandbox: {
    onSandboxReady: [
      { command: "pnpm install --frozen-lockfile --config.confirm-modules-purge=false" },
    ],
  },
};

// Copy node_modules from the host into the worktree before each sandbox
// starts. Avoids a full pnpm install from scratch; the hook above handles
// platform-specific binaries and any packages added since the last copy.
export const copyToWorktree = ["node_modules"];
