// The one place a role's agent is built. Every sandcastle.run() and
// sandbox.run() goes through runRole or runRoleInSandbox, which apply the
// role's model, effort, iteration cap and timeout from ROLE_AGENTS and record
// the run's token usage. The role is recorded before the run starts, so one
// that times out or fails still appears in the end-of-run report. Every role's
// prompt file also gets the shared role rules as {{SHARED_RULES}}.

import { readFileSync } from "node:fs";
import * as sandcastle from "@ai-hero/sandcastle";
import { ROLE_AGENTS, type Role } from "./config.mts";
import { RunLimits, runLimits } from "./limits.mts";
import { usageReport } from "./report.mts";

// The options a role fixes; callers supply everything else.
type RoleFixed = "name" | "agent" | "maxIterations" | "signal";

export function roleOptions(role: Role, timeout: (ms: number) => AbortSignal = AbortSignal.timeout) {
  const { model, effort, maxIterations, timeoutMinutes } = ROLE_AGENTS[role];
  return {
    name: role,
    agent: sandcastle.claudeCode(model, { effort }),
    maxIterations,
    signal: timeout(timeoutMinutes * 60_000),
  };
}

let sharedRules: string | undefined;

// Add .sandcastle/roles/shared-rules.md to a prompt file's arguments. An inline
// prompt is left alone: Sandcastle rejects prompt arguments for one.
export function withSharedRules<T extends { prompt?: string; promptFile?: string; promptArgs?: sandcastle.PromptArgs }>(
  options: T,
): T & { promptArgs?: sandcastle.PromptArgs } {
  if (options.promptFile === undefined) return options;
  sharedRules ??= readFileSync(new URL("../roles/shared-rules.md", import.meta.url), "utf8");
  return { ...options, promptArgs: { ...options.promptArgs, SHARED_RULES: sharedRules } };
}

export function runRole<T>(
  role: Role,
  options: Omit<sandcastle.RunOptions, RoleFixed | "output"> & { output: sandcastle.OutputObjectDefinition<T> },
  limits?: RunLimits,
): Promise<sandcastle.RunResult & { output: T }>;
export function runRole(
  role: Role,
  options: Omit<sandcastle.RunOptions, RoleFixed>,
  limits?: RunLimits,
): Promise<sandcastle.RunResult>;
export async function runRole(
  role: Role,
  options: Omit<sandcastle.RunOptions, RoleFixed>,
  limits: RunLimits = runLimits,
): Promise<sandcastle.RunResult> {
  usageReport.record(role, []);
  const result = await sandcastle.run({ ...withSharedRules(options), ...roleOptions(role) });
  usageReport.record(role, result.iterations);
  return result;
}

export async function runRoleInSandbox(
  sandbox: sandcastle.Sandbox,
  role: Role,
  options: Omit<sandcastle.SandboxRunOptions, RoleFixed>,
  limits: RunLimits = runLimits,
): Promise<sandcastle.SandboxRunResult> {
  usageReport.record(role, []);
  const result = await sandbox.run({ ...withSharedRules(options), ...roleOptions(role) });
  usageReport.record(role, result.iterations);
  return result;
}

// Runs one role through `start`. Before the run: limits.throwIfStopped(). If
// the run rejects with an error isUsageLimitError accepts: limits.hitUsageLimit(reason),
// then throws UncountedStopError(reason, { cause: error }). Any other error is
// rethrown unchanged.
export async function runWithinLimits<R>(role: Role, start: () => Promise<R>, limits: RunLimits = runLimits): Promise<R> {
  throw new Error("Not implemented");
}
