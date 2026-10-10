// Token usage per role, summed over every run in this process and logged at
// the end of the run.

import type { IterationUsage } from "@ai-hero/sandcastle";

type Usage = { -readonly [K in keyof IterationUsage]: number };

const zero = (): Usage => ({ inputTokens: 0, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, outputTokens: 0 });

export class UsageReport {
  private readonly byRole = new Map<string, Usage>();

  // An iteration without usage (capture off, or the agent didn't report it)
  // still marks the role as having run.
  record(role: string, iterations: readonly { readonly usage?: IterationUsage }[]): void {
    const total = this.byRole.get(role) ?? zero();
    for (const { usage } of iterations) {
      if (!usage) continue;
      total.inputTokens += usage.inputTokens;
      total.cacheCreationInputTokens += usage.cacheCreationInputTokens;
      total.cacheReadInputTokens += usage.cacheReadInputTokens;
      total.outputTokens += usage.outputTokens;
    }
    this.byRole.set(role, total);
  }

  totals(): ReadonlyMap<string, IterationUsage> {
    return this.byRole;
  }

  lines(): string[] {
    return [...this.byRole].map(
      ([role, usage]) =>
        `  ${role}: input ${usage.inputTokens}, cache creation ${usage.cacheCreationInputTokens}, ` +
        `cache read ${usage.cacheReadInputTokens}, output ${usage.outputTokens}`,
    );
  }
}

// The one report every role run records into.
export const usageReport = new UsageReport();

// One hand-back this run made: an issue or PR that got `sandcastle:needs-info`
// or `sandcastle:needs-human`, and why.
export type HandBackEntry = { target: string; label: string; reason: string };

// Every hand-back this run made, so a final workflow step can fail the job
// when the list isn't empty: the owner's PAT means GitHub never notifies
// anyone about Sandcastle's own labels or comments (see "Notification: the
// run ends red" in docs/plans/sandcastle-workflow.md).
export class HandBackReport {
  private readonly entries: HandBackEntry[] = [];

  record(entry: HandBackEntry): void {
    this.entries.push(entry);
  }

  items(): readonly HandBackEntry[] {
    return this.entries;
  }
}

// The one report every hand-back this run makes records into.
export const handBackReport = new HandBackReport();
