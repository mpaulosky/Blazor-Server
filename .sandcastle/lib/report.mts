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
