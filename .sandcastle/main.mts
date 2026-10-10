// Parallel Planner with Review — plan → execute → review → PR loop
//
// This template drives a multi-phase workflow:
//   Phase 0 (Gate):             The host resolves each open issue's blockers
//                               (GitHub "blocked by" links and "Blocked by #N"
//                               / "Depends on #N" lines) and holds back every
//                               issue whose blocker hasn't landed yet, that
//                               already has an open PR, or that another run is
//                               building (sandcastle:building).
//   Phase 1 (Plan):             The planner analyzes the ready issues, builds
//                               a dependency graph, and outputs a <plan> JSON
//                               listing unblocked issues.
//   Phase 1b (Critique):        A second run checks whether the picks are safe
//                               to build in parallel and defers the ones that
//                               aren't behind a native "blocked by" link. The
//                               host names each remaining pick's branch and
//                               fetches it if it exists.
//   Phase 2 (Execute + Review): For each issue, a sandbox is created via
//                               createSandbox(), and the issue carries
//                               sandcastle:building until its build ends,
//                               however it ends. The tester commits failing
//                               tests, then the backend developer makes them
//                               pass; if either fails, the issue stops for the
//                               round. If the branch is then ahead of main (this
//                               run's commits or earlier ones), the host runs
//                               scripts/gate.sh in the sandbox (checkpoint 1),
//                               a reviewer runs, and the gate runs again
//                               (checkpoint 2). A red gate gets two gate-fixer
//                               attempts per checkpoint; past that nothing is
//                               pushed. A red checkpoint or a failed tester or
//                               backend run is a failed build attempt: the
//                               first gets a comment, the second hands the
//                               issue back with sandcastle:needs-human
//                               (lib/handback.mts).
//                               Otherwise the host scans the commits for the
//                               sandbox's secrets, pushes the commit the gate
//                               passed on from the main checkout with git hooks
//                               off, and opens a pull request that closes its
//                               issue (lib/host-safety.mts). All issue
//                               pipelines run concurrently via
//                               Promise.allSettled().
//
// The outer loop repeats up to MAX_ITERATIONS times so that newly unblocked
// issues are picked up after each round. The loop stops early when a round
// opens no pull request, but not when the critique defers every pick.
//
// Every role's model, effort, iteration cap and timeout comes from ROLE_AGENTS
// in lib/config.mts. The sandbox gets no GitHub token: the host reads GitHub
// with its own gh auth and passes each role what it needs through its prompt.
//
// Usage:
//   pnpm run sandcastle

import { existsSync, readFileSync } from "node:fs";
import { buildIssue } from "./lib/build.mts";
import { clearStaleBuildingLabels, releaseAllBuildingLabels } from "./lib/building.mts";
import { fetchMain, prepareBranches } from "./lib/branches.mts";
import { BUILDING_LABEL, MAX_ITERATIONS } from "./lib/config.mts";
import { critiqueRound } from "./lib/critique.mts";
import { gateIssues } from "./lib/gate.mts";
import { cacheHostLogin, ensureLabels } from "./lib/github.mts";
import { protectHostGit } from "./lib/host-safety.mts";
import { planRound } from "./lib/plan.mts";
import { handBackReport, usageReport } from "./lib/report.mts";
import { roundSummary } from "./lib/round.mts";
import { githubTokensIn } from "./lib/sandbox-env.mts";
import { forgetGatedHead } from "./lib/shell.mts";

const envFile = ".sandcastle/.env";
const leakedTokens = existsSync(envFile) ? githubTokensIn(readFileSync(envFile, "utf8")) : [];
if (leakedTokens.length > 0) {
  throw new Error(
    `${envFile} sets ${leakedTokens.join(" and ")}, which Sandcastle would pass into the sandbox. ` +
      "Remove it: the host uses its own gh auth, and agents must not reach GitHub.",
  );
}

// Every git command this process starts, Sandcastle's included, runs with hooks
// off and its config pinned to this repository's .git: agents can write hooks
// and files that point git elsewhere. Throws if .git/commondir exists. See
// lib/host-safety.mts, which also keeps .git/config and .git/hooks read-only in
// every sandbox.
protectHostGit();
forgetGatedHead();

// The hand-backs and intake add sandcastle:* labels, which gh can't add until
// the repository has them. The host's login, which the failed-attempt count
// filters by, is read now so a token that can't read it fails before any work.
ensureLabels();
cacheHostLogin();

// Ctrl-C, SIGTERM and a crash skip buildIssue's finally, which would leave
// sandcastle:building holding the issue back for BUILDING_LABEL_MAX_AGE_MS.
// While a label is on, its sandbox is open, so Sandcastle's own signal
// handler is installed: it removes the containers and calls process.exit,
// which runs this listener. Only SIGKILL gets past it, and the startup
// clearing below covers that.
process.on("exit", () => {
  for (const issueNumber of releaseAllBuildingLabels()) {
    console.log(`  🧹 #${issueNumber}: removed ${BUILDING_LABEL} as the run stopped.`);
  }
});

// A run that crashed left sandcastle:building on the issue it was building.
// Only a label older than any real build is cleared, so a live run's stays.
for (const issueNumber of clearStaleBuildingLabels()) {
  console.log(`  🧹 #${issueNumber}: cleared a stale ${BUILDING_LABEL} label left by a run that didn't finish.`);
}

try {
  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

    // -----------------------------------------------------------------------
    // Phase 0: Gate
    // -----------------------------------------------------------------------
    const { ready, blocked } = gateIssues();

    for (const { issue, reasons } of blocked) {
      console.log(`  ⏸ #${issue.number} is held back: ${reasons.join("; ")}`);
    }

    if (ready.length === 0) {
      console.log(
        blocked.length > 0
          ? "Every open issue is waiting on a blocker, a pull request or another run. Exiting."
          : "No open Sandcastle issues. Exiting.",
      );
      break;
    }

    // -----------------------------------------------------------------------
    // Phase 1: Plan
    // -----------------------------------------------------------------------
    const planned = await planRound(ready);

    if (planned.length === 0) {
      // No unblocked work — either everything is done or everything is blocked.
      console.log("No unblocked issues to work on. Exiting.");
      break;
    }

    // planRound keeps only ids from the ready list, so the lookup can't miss.
    const readyById = new Map(ready.map((issue) => [String(issue.number), issue]));
    const picks = planned.map((issue) => readyById.get(issue.id)!);

    // -----------------------------------------------------------------------
    // Phase 1b: Critique
    // -----------------------------------------------------------------------
    const pickedNumbers = new Set(picks.map((issue) => issue.number));
    const issues = await critiqueRound({
      picks,
      inFlight: blocked.flatMap(({ issue, pr }) => (pr ? [{ issue, pr }] : [])),
      unpicked: ready.filter((issue) => !pickedNumbers.has(issue.number)),
    });

    if (issues.length === 0) {
      // Each deferral added a "blocked by" link, so the next round's gate
      // holds those issues back and the planner picks from what's left.
      console.log("The critique deferred every pick. Moving on to the next round.");
      continue;
    }

    // -----------------------------------------------------------------------
    // Phase 2: Execute + Review
    //
    // Promise.allSettled means one failing pipeline doesn't cancel the others.
    // -----------------------------------------------------------------------
    const base = fetchMain();
    const work = prepareBranches(issues);

    console.log(
      `Planning complete. ${work.length} issue(s) to work in parallel:`,
    );
    for (const { issue, branch } of work) {
      console.log(`  #${issue.number}: ${issue.title} → ${branch}`);
    }

    const settled = await Promise.allSettled(
      work.map(({ issue, branch }) => buildIssue(issue, branch, base)),
    );

    // Log any agents that threw (network error, sandbox crash, timeout, etc.).
    for (const [i, outcome] of settled.entries()) {
      if (outcome.status === "rejected") {
        console.error(
          `  ✗ #${work[i]!.issue.number} (${work[i]!.branch}) failed: ${outcome.reason}`,
        );
      }
    }

    const summary = roundSummary(work, settled);
    for (const line of summary.lines) {
      console.log(line);
    }

    if (summary.stop !== undefined) {
      // Nothing reached a PR, so the next plan would pick the same issues and
      // repeat the same round. Stop and let a human look.
      console.log(summary.stop);
      break;
    }
  }
} finally {
  console.log("\nToken usage by role:");
  const lines = usageReport.lines();
  console.log(lines.length > 0 ? lines.join("\n") : "  (no role ran)");

  // Only logged here. Ending the run red on a hand-back is the trigger
  // workflow's final step (#82), reading the list #81 writes to
  // .sandcastle/logs/handbacks.json; exiting non-zero here would make a local
  // run that hands something back look like a crash.
  const handBacks = handBackReport.items();
  if (handBacks.length > 0) {
    console.log("\nHanded back to a human:");
    for (const { target, label, reason } of handBacks) {
      console.log(`  ${target}: ${label} (${reason})`);
    }
  }
}

console.log("\nAll done.");
