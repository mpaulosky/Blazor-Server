// Why an unattended run must stop starting work: the time budget and
// Claude's usage limit. The role runner (lib/agents.mts#runWithinLimits)
// checks this before every role run, and main.mts checks it once at the top
// of each round, so a run never starts a round or a role once the budget has
// passed or the usage limit has been hit (#147).

import { UncountedStopError } from "./errors.mts";

// Keeps the run's own stop state. A module singleton (see runLimits), like
// usageReport and the queue scope: tests pass their own instance through the
// injected parameters and never touch the shared one.
export class RunLimits {
  constructor(private readonly now: () => number = Date.now) {}

  // Starts the budget clock at now(). Before start() is called there's no
  // budget, so tests and modules used without main.mts never stop.
  start(budgetMinutes: number): void {
    throw new Error("Not implemented");
  }

  // Records a usage-limit stop. Only the first is kept.
  hitUsageLimit(reason: string): void {
    throw new Error("Not implemented");
  }

  // The usage-limit reason, if one was recorded.
  usageLimitReason(): string | undefined {
    throw new Error("Not implemented");
  }

  // Why the run must stop starting work, or undefined. A usage stop comes
  // first. Otherwise the budget has passed once
  // now() - start >= budgetMinutes * 60_000, and the reason reads like
  // "the run's 240-minute time budget has passed".
  stopReason(): string | undefined {
    throw new Error("Not implemented");
  }

  // Throws new UncountedStopError(stopReason()) when stopReason() is set.
  throwIfStopped(): void {
    throw new Error("Not implemented");
  }
}

// The run's own limits. main.mts calls runLimits.start(...) at startup.
export const runLimits: RunLimits = new RunLimits();

// Whether a failed role run's error is Claude's usage or rate limit. Reads
// the error's message, String(error) and its `cause` chain (up to 5 levels
// deep: Sandcastle rejects through Effect, which may wrap the AgentError).
// Sandcastle's AgentError message is "claude-code exited with code N:\n
// <stderr, else the result text, else the last 20 stdout lines>".
export function isUsageLimitError(error: unknown): boolean {
  throw new Error("Not implemented");
}

// Re-exported so a caller that only needs the stop error doesn't also have
// to import errors.mts.
export { UncountedStopError };
