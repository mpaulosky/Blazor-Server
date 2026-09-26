// The one place a role's agent is built. Every sandcastle.run() and
// sandbox.run() goes through runRole or runRoleInSandbox, which apply the
// role's model, effort, iteration cap and timeout from ROLE_AGENTS and record
// the run's token usage. The role is recorded before the run starts, so one
// that times out or fails still appears in the end-of-run report.

import * as sandcastle from "@ai-hero/sandcastle";
import { ROLE_AGENTS, type Role } from "./config.mts";
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

export function runRole<T>(
  role: Role,
  options: Omit<sandcastle.RunOptions, RoleFixed | "output"> & { output: sandcastle.OutputObjectDefinition<T> },
): Promise<sandcastle.RunResult & { output: T }>;
export function runRole(role: Role, options: Omit<sandcastle.RunOptions, RoleFixed>): Promise<sandcastle.RunResult>;
export async function runRole(role: Role, options: Omit<sandcastle.RunOptions, RoleFixed>): Promise<sandcastle.RunResult> {
  usageReport.record(role, []);
  const result = await sandcastle.run({ ...options, ...roleOptions(role) });
  usageReport.record(role, result.iterations);
  return result;
}

export async function runRoleInSandbox(
  sandbox: sandcastle.Sandbox,
  role: Role,
  options: Omit<sandcastle.SandboxRunOptions, RoleFixed>,
): Promise<sandcastle.SandboxRunResult> {
  usageReport.record(role, []);
  const result = await sandbox.run({ ...options, ...roleOptions(role) });
  usageReport.record(role, result.iterations);
  return result;
}
