// Parallel Planner with Review — plan → execute → review → PR loop
//
// This template drives a multi-phase workflow:
//   Phase 0 (Gate):             The host resolves each open issue's blockers
//                               (GitHub "blocked by" links and "Blocked by #N"
//                               / "Depends on #N" lines) and holds back every
//                               issue whose blocker hasn't landed yet.
//   Phase 1 (Plan):             The planner analyzes the ready issues, builds
//                               a dependency graph, and outputs a <plan> JSON
//                               listing unblocked issues with branch names.
//   Phase 2 (Execute + Review): For each issue, a sandbox is created via
//                               createSandbox(). The implementer runs first.
//                               If the branch is then ahead of main (this
//                               run's commits or earlier ones), a reviewer
//                               runs in the same sandbox, and the branch is
//                               pushed and gets a pull request that closes its
//                               issue. All issue pipelines run concurrently
//                               via Promise.allSettled().
//
// The outer loop repeats up to MAX_ITERATIONS times so that newly unblocked
// issues are picked up after each round. Issues with an open PR are skipped,
// and the loop stops early when a round opens no pull request.
//
// Every role's model, effort, iteration cap and timeout comes from ROLE_AGENTS
// in lib/config.mts. The sandbox gets no GitHub token: the host reads GitHub
// with its own gh auth and passes each role what it needs through its prompt.
//
// Usage:
//   npx tsx .sandcastle/main.mts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.mts" }

import { existsSync, readFileSync } from "node:fs";
import { buildIssue } from "./lib/build.mts";
import { fetchMain } from "./lib/branches.mts";
import { MAX_ITERATIONS } from "./lib/config.mts";
import { gateIssues } from "./lib/gate.mts";
import { planRound } from "./lib/plan.mts";
import { usageReport } from "./lib/report.mts";
import { githubTokensIn } from "./lib/sandbox-env.mts";

const envFile = ".sandcastle/.env";
const leakedTokens = existsSync(envFile) ? githubTokensIn(readFileSync(envFile, "utf8")) : [];
if (leakedTokens.length > 0) {
  throw new Error(
    `${envFile} sets ${leakedTokens.join(" and ")}, which Sandcastle would pass into the sandbox. ` +
      "Remove it: the host uses its own gh auth, and agents must not reach GitHub.",
  );
}

try {
  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

    // -----------------------------------------------------------------------
    // Phase 0: Gate
    // -----------------------------------------------------------------------
    const { ready, blocked } = gateIssues();

    for (const { issue, reasons } of blocked) {
      console.log(`  ⏸ #${issue.number} is blocked: ${reasons.join("; ")}`);
    }

    if (ready.length === 0) {
      console.log(
        blocked.length > 0
          ? "Every open issue is waiting on a blocker. Exiting."
          : "No open Sandcastle issues. Exiting.",
      );
      break;
    }

    // -----------------------------------------------------------------------
    // Phase 1: Plan
    // -----------------------------------------------------------------------
    const issues = await planRound(ready);

    if (issues.length === 0) {
      // No unblocked work — either everything is done or everything is blocked.
      console.log("No unblocked issues to work on. Exiting.");
      break;
    }

    console.log(
      `Planning complete. ${issues.length} issue(s) to work in parallel:`,
    );
    for (const issue of issues) {
      console.log(`  ${issue.id}: ${issue.title} → ${issue.branch}`);
    }

    // -----------------------------------------------------------------------
    // Phase 2: Execute + Review
    //
    // Promise.allSettled means one failing pipeline doesn't cancel the others.
    // -----------------------------------------------------------------------
    fetchMain();

    const readyById = new Map(ready.map((issue) => [String(issue.number), issue]));
    const settled = await Promise.allSettled(
      // planRound keeps only ids from the ready list, so the lookup can't miss.
      issues.map((issue) => buildIssue(issue, readyById.get(issue.id)!)),
    );

    // Log any agents that threw (network error, sandbox crash, timeout, etc.).
    for (const [i, outcome] of settled.entries()) {
      if (outcome.status === "rejected") {
        console.error(
          `  ✗ ${issues[i]!.id} (${issues[i]!.branch}) failed: ${outcome.reason}`,
        );
      }
    }

    const published = settled.flatMap((outcome, i) =>
      outcome.status === "fulfilled" && outcome.value.prUrl
        ? [{ issue: issues[i]!, prUrl: outcome.value.prUrl }]
        : [],
    );

    console.log(`\nExecution complete. ${published.length} pull request(s):`);
    for (const { issue, prUrl } of published) {
      console.log(`  ${issue.id} (${issue.branch}) → ${prUrl}`);
    }

    if (published.length === 0) {
      // Nothing reached a PR, so the next plan would pick the same issues and
      // repeat the same round. Stop and let a human look.
      console.log("No pull requests opened this round. Stopping.");
      break;
    }
  }
} finally {
  console.log("\nToken usage by role:");
  const lines = usageReport.lines();
  console.log(lines.length > 0 ? lines.join("\n") : "  (no role ran)");
}

console.log("\nAll done.");
