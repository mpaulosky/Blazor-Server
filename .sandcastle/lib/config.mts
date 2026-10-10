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

// The roles the planner may pick per issue, besides the tester, backend
// developer and reviewer, which always run (see "Phase 4: Plan" and
// "Phase 6: Build" in docs/plans/sandcastle-workflow.md). lib/plan.mts#resolveRoles
// validates the planner's roles field against this list, falling back to
// every one of them when the field is missing or invalid.
export const OPTIONAL_ROLES = ["architect", "ui", "scribe"] as const satisfies readonly Role[];

export type OptionalRole = (typeof OPTIONAL_ROLES)[number];

// Marks an issue comment as the architect's design note (lib/build.mts), so
// a re-run can find its own latest one and keep building on the same design
// rather than starting blind.
export const DESIGN_MARKER = "<!-- sandcastle:design -->";

// The roles lib/build.mts#buildIssue runs, each at most once per build,
// besides the gate-fixer, which runs up to GATE_FIXER_ATTEMPTS times at each
// checkpoint. BUILDING_LABEL_MAX_AGE_MS is sized from these roles' timeouts:
// config.test.mts checks the sum fits, and build.test.mts that buildIssue runs
// no role outside the list.
export const BUILD_ROLES = ["architect", "tester", "backend", "ui", "scribe", "reviewer"] as const satisfies readonly Role[];

// The ref each issue branch is compared with: every issue PR targets main,
// and fetchMain() refreshes origin/main before each round. The sandbox mounts
// the host's .git, so the ref resolves there too.
export const BASE_BRANCH = "origin/main";

// Maximum number of plan→execute→merge cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
export const MAX_ITERATIONS = 10;

// How many issues one intake run judges. A malformed or truncated <intake>
// block costs every verdict in it, so a large backlog is judged a batch per
// round rather than in one answer (#224); the rest wait for a later round or
// run.
export const INTAKE_BATCH_SIZE = 10;

// Gate-fixer runs allowed at each gate checkpoint before the issue's round is
// given up, and how much of the final gate output the issue comment quotes.
export const GATE_FIXER_ATTEMPTS = 2;
export const GATE_COMMENT_LINES = 100;

// Attempts allowed for a publish step (git push, gh pr create) that keeps
// failing with a GitHub server error, before Sandcastle gives up on the round
// and comments on the issue. A push rejected for any other reason isn't
// retried at all.
export const PUBLISH_RETRY_ATTEMPTS = 4;

// A label the host manages: created at startup if the repository doesn't
// have it yet (see docs/plans/sandcastle-workflow.md, "Labels").
export type SandcastleLabel = { name: string; color: string; description: string };

// Marks an issue while a sandbox is building it (see lib/build.mts#buildIssue
// and lib/gate.mts), so a second Sandcastle run doesn't start building the
// same issue too (#150, a near-miss on #71).
export const BUILDING_LABEL = "sandcastle:building";

// How old a sandcastle:building label must be before startup clears it as a
// crashed run's (see lib/building.mts#clearStaleBuildingLabels). It outlasts
// any real build: every role's timeoutMinutes, even with two gate-fixer
// attempts at each of the two checkpoints, adds up to well under 6 hours.
// config.test.mts checks that sum (see BUILD_ROLES), with an hour to spare,
// stays below it.
export const BUILDING_LABEL_MAX_AGE_MS = 6 * 60 * 60 * 1000;

// Every label from the Labels table that the host, not a human, is
// responsible for creating. `Sandcastle` is a human's to add. `bug` is
// GitHub's default label, but intake adds it too (#74), and an add fails for a
// label a repository has deleted.
export const SANDCASTLE_LABELS: readonly SandcastleLabel[] = [
  { name: "sandcastle:ready", color: "0E8A16", description: "The issue passed the Definition of Ready and isn't re-checked." },
  {
    name: BUILDING_LABEL,
    color: "1D76DB",
    description: "Sandcastle is building this issue right now. Leave it alone until the label clears.",
  },
  {
    name: "sandcastle:needs-info",
    color: "FBCA04",
    description: "The issue's text is the problem: answer the questions and edit the issue.",
  },
  {
    name: "sandcastle:needs-human",
    color: "D93F0B",
    description: "Sandcastle tried and couldn't. A person needs to look at this issue or pull request.",
  },
  { name: "bug", color: "d73a4a", description: "Something isn't working" },
];

// The HTML comment marking an issue comment as a failed build attempt, so the
// count survives a restart (see lib/github.mts#markerCommentsSince).
export const BUILD_FAILED_MARKER = "<!-- sandcastle:build-failed -->";

// Failed build attempts, counted by BUILD_FAILED_MARKER comments posted since
// `sandcastle:needs-human` was last removed, before the issue is handed back
// (see "Giving up and telling the human" in docs/plans/sandcastle-workflow.md).
export const BUILD_FAILURE_CAP = 2;

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
