// The run's report: token usage per role, what became of each issue and PR it
// touched, its hand-backs and the PRs waiting on people — collected during the
// run and written at its end to .sandcastle/logs/ and the job summary (see
// "Observability" in docs/plans/sandcastle-workflow.md).

import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
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

// An issue or PR, as the report names and links it.
export type ReportTarget = { kind: "issue" | "pr"; number: number };

// https://github.com/<repo>/issues/<n> or /pull/<n>.
export function targetUrl(repo: string, target: ReportTarget): string {
  return `https://github.com/${repo}/${target.kind === "issue" ? "issues" : "pull"}/${target.number}`;
}

// What became of one issue or PR. "handed back" is never recorded here: the
// renderer adds that row from the hand-backs, so nothing is counted twice.
export type Outcome =
  | "published"
  | "deferred"
  | "role failed"
  | "timed out"
  | "gate failed"
  | "stopped"
  | "not published"
  | "updated"
  | "follow-up pass";

// `detail` is host-written text only, never raw error output (see the design
// note's Risks: the summary is public on a public repository).
export type OutcomeEntry = ReportTarget & { outcome: Outcome; detail: string };

export class OutcomeReport {
  private readonly entries: OutcomeEntry[] = [];

  record(entry: OutcomeEntry): void {
    this.entries.push(entry);
  }

  items(): readonly OutcomeEntry[] {
    return this.entries;
  }
}

// The one report every outcome this run reaches records into.
export const outcomeReport = new OutcomeReport();

// One hand-back this run made: an issue or PR that got `sandcastle:needs-info`
// or `sandcastle:needs-human`, and why.
export type HandBackEntry = ReportTarget & { label: string; reason: string; url: string };

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

// An open Sandcastle PR the latest sweep found with unresolved review threads
// a person opened (first comment not by a bot).
export type WaitingPrEntry = { pr: number; threads: number };

// Every PR the latest follow-up sweep found waiting on a person, replaced
// whole each sweep (see WaitingPrReport.replace), so the report shows the
// last sweep's view, not every round's.
export class WaitingPrReport {
  private entries: readonly WaitingPrEntry[] = [];

  replace(entries: readonly WaitingPrEntry[]): void {
    this.entries = entries;
  }

  items(): readonly WaitingPrEntry[] {
    return this.entries;
  }
}

// The one report the latest follow-up sweep replaces.
export const waitingPrReport = new WaitingPrReport();

// One review thread a follow-up pass kept from the follow-up role because
// someone other than the repository owner or a bot opened it
// (lib/follow-up-pass.mts#threadsForRole): left for a person, never acted on.
export type HumanThreadEntry = { pr: number; author: string | null; url: string };

// Every such thread this run found, so the run report lists them next to the
// hand-backs.
export class HumanThreadReport {
  private readonly entries: HumanThreadEntry[] = [];

  record(entry: HumanThreadEntry): void {
    this.entries.push(entry);
  }

  items(): readonly HumanThreadEntry[] {
    return this.entries;
  }
}

// The one report every follow-up pass this run makes records into.
export const humanThreadReport = new HumanThreadReport();

// How the run ended, so the summary tells a hand-back from a crash
// ("Notification: the run ends red" in docs/plans/sandcastle-workflow.md).
export type RunEnding = { kind: "finished" } | { kind: "stopped"; reason: string } | { kind: "crashed" };

// Everything renderSummary needs to render the run's Markdown report.
export type SummaryInput = {
  queue: string;
  repo: string | undefined;
  ending: RunEnding;
  outcomes: readonly OutcomeEntry[];
  handBacks: readonly HandBackEntry[];
  waitingPrs: readonly WaitingPrEntry[];
  humanThreads: readonly HumanThreadEntry[];
  usage: ReadonlyMap<string, IterationUsage>;
};

// The run's report as Markdown, for .sandcastle/logs/summary.md and (when set)
// $GITHUB_STEP_SUMMARY. See the design note at .sandcastle/work/81/design.md
// for the exact shape: queue and ending sentence, a table of every touched
// issue and PR with its outcome (plus one row per hand-back), the hand-backs
// themselves with links, the PRs waiting on a person, and a token-usage table
// by role with a total row.
export function renderSummary(_input: SummaryInput): string {
  throw new Error("Not implemented");
}

// handbacks.json: an array of `{ kind, number, label, reason, url }`, one per
// hand-back this run made; "[]\n" when there were none.
export function handBacksJson(_handBacks: readonly HandBackEntry[]): string {
  throw new Error("Not implemented");
}

// Where writeRunReport writes summary.md and handbacks.json.
export const REPORT_DIR = ".sandcastle/logs";

// The filesystem writeRunReport needs; tests pass a stub that records calls.
export type ReportFs = {
  mkdir(path: string): void;
  writeFile(path: string, text: string): void;
  appendFile(path: string, text: string): void;
};

export const liveReportFs: ReportFs = {
  mkdir: (path) => mkdirSync(path, { recursive: true }),
  writeFile: (path, text) => writeFileSync(path, text),
  appendFile: (path, text) => appendFileSync(path, text),
};

// Writes handbacks.json first, then summary.md, then appends `summary` to
// env.GITHUB_STEP_SUMMARY when it's set and non-empty. Each write has its own
// try/catch and failures go to `warn`: it runs in main.mts's finally, so it
// must never throw over the run's own error. A missing handbacks.json then
// fails the workflow step that reads it, which is the fail-closed outcome.
export function writeRunReport(
  _summary: string,
  _handBacks: readonly HandBackEntry[],
  _env: NodeJS.ProcessEnv = process.env,
  _fs: ReportFs = liveReportFs,
  _warn: (line: string) => void = console.error,
): void {
  throw new Error("Not implemented");
}
