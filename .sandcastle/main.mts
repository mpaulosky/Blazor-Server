// Parallel Planner with Review — plan → execute → review → PR loop
//
// This template drives a multi-phase workflow:
//   Phase 1 (Plan):             An opus agent analyzes open issues, builds a
//                               dependency graph, and outputs a <plan> JSON
//                               listing unblocked issues with branch names.
//   Phase 2 (Execute + Review): For each issue, a sandbox is created via
//                               createSandbox(). The implementer runs first
//                               (100 iterations). If the branch is then ahead
//                               of main (this run's commits or earlier ones),
//                               a reviewer runs in the same sandbox (1
//                               iteration), and the branch is pushed and gets
//                               a pull request that closes its issue. All
//                               issue pipelines run concurrently via
//                               Promise.allSettled().
//
// The outer loop repeats up to MAX_ITERATIONS times so that newly unblocked
// issues are picked up after each round. Issues with an open PR are skipped,
// and the loop stops early when a round opens no pull request.
//
// Usage:
//   npx tsx .sandcastle/main.mts
// Or add to package.json:
//   "scripts": { "sandcastle": "npx tsx .sandcastle/main.mts" }

import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { execFileSync } from "node:child_process";
import { z } from "zod";

// Run a command on the host in `cwd` and return trimmed stdout. Throws on failure.
const sh = (cwd: string, cmd: string, ...args: string[]) =>
  execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

// Push an issue branch from its worktree and open (or reuse) the PR that closes
// the issue. Pushing from the worktree matters: the pre-push hook checks the
// checked-out branch's name and runs lint and tests against that tree.
function publish(
  issue: { id: string; title: string; branch: string },
  worktreePath: string,
  reviewed: boolean,
): string {
  sh(worktreePath, "git", "push", "--force-with-lease", "-u", "origin", issue.branch);

  const existing = sh(
    worktreePath, "gh", "pr", "list", "--head", issue.branch, "--state", "open",
    "--json", "url", "--jq", ".[0].url",
  );
  if (existing) return existing;

  return sh(
    worktreePath, "gh", "pr", "create", "--base", "main", "--head", issue.branch,
    "--title", issue.title,
    "--body", reviewed
      ? `Closes #${issue.id}\n\nImplemented and reviewed by Sandcastle.`
      : `Closes #${issue.id}\n\nImplemented by Sandcastle. ⚠️ The review step failed, so no agent has reviewed this PR.`,
  );
}

// Count the commits on the worktree's branch that origin/main doesn't have.
// origin/main is refreshed once per round, before the pipelines start, because
// concurrent fetches from each pipeline would contend on the same ref lock.
function commitsAhead(worktreePath: string): number {
  return Number(sh(worktreePath, "git", "rev-list", "--count", "origin/main..HEAD"));
}

// The planner emits its plan as JSON inside <plan> tags; Output.object extracts
// and validates it against this schema. We use Zod here, but any Standard
// Schema validator works just as well — Valibot, ArkType, etc. See
// https://standardschema.dev.
const planSchema = z.object({
  issues: z.array(
    z.object({ id: z.string(), title: z.string(), branch: z.string() }),
  ),
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Maximum number of plan→execute→merge cycles before stopping.
// Raise this if your backlog is large; lower it for a quick smoke-test run.
const MAX_ITERATIONS = 10;

// Hooks run inside the sandbox before the agent starts each iteration.
// npm install ensures the sandbox always has fresh dependencies.
const hooks = {
  sandbox: { onSandboxReady: [{ command: "npm install" }] },
};

// Copy node_modules from the host into the worktree before each sandbox
// starts. Avoids a full npm install from scratch; the hook above handles
// platform-specific binaries and any packages added since the last copy.
const copyToWorktree = ["node_modules"];

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
  console.log(`\n=== Iteration ${iteration}/${MAX_ITERATIONS} ===\n`);

  // -------------------------------------------------------------------------
  // Phase 1: Plan
  //
  // The planning agent (opus, for deeper reasoning) reads the open issue list,
  // builds a dependency graph, and selects the issues that can be worked in
  // parallel right now (i.e., no blocking dependencies on other open issues).
  //
  // It outputs a <plan> JSON block — Output.object parses and validates it.
  // -------------------------------------------------------------------------
  const plan = await sandcastle.run({
    hooks,
    sandbox: docker(),
    name: "planner",
    // One iteration is enough: the planner just needs to read and reason,
    // not write code. (Structured output requires maxIterations: 1.)
    maxIterations: 1,
    // Opus for planning: dependency analysis benefits from deeper reasoning.
    agent: sandcastle.claudeCode("claude-opus-5-5"),
    promptFile: "./.sandcastle/plan-prompt.md",
    // Extract and validate the <plan> JSON into a typed object. Throws
    // StructuredOutputError if the tag is missing, the JSON is malformed, or
    // validation fails — which aborts the loop.
    output: sandcastle.Output.object({ tag: "plan", schema: planSchema }),
  });

  const issues = plan.output.issues;

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

  // -------------------------------------------------------------------------
  // Phase 2: Execute + Review
  //
  // For each issue, create a sandbox via createSandbox() so the implementer
  // and reviewer share the same sandbox instance per branch. The implementer
  // runs first; if the branch is ahead of main, the reviewer runs in the same
  // sandbox, and then the branch is pushed and gets a pull request that closes
  // its issue.
  // Nothing is merged locally: every change reaches main through a reviewed PR.
  //
  // Promise.allSettled means one failing pipeline doesn't cancel the others.
  // -------------------------------------------------------------------------

  sh(process.cwd(), "git", "fetch", "--quiet", "origin", "main");

  const settled = await Promise.allSettled(
    issues.map(async (issue) => {
      const sandbox = await sandcastle.createSandbox({
        branch: issue.branch,
        sandbox: docker(),
        hooks,
        copyToWorktree,
      });

      try {
        // Run the implementer
        const implement = await sandbox.run({
          name: "implementer",
          maxIterations: 100,
          agent: sandcastle.claudeCode("claude-opus-5-5"),
          promptFile: "./.sandcastle/implement-prompt.md",
          promptArgs: {
            TASK_ID: issue.id,
            ISSUE_TITLE: issue.title,
            BRANCH: issue.branch,
          },
        });

        // Review and publish whenever the branch holds work that main doesn't,
        // not only when this run added commits: a re-run of a finished issue
        // makes none, and its earlier work still needs a PR.
        if (commitsAhead(sandbox.worktreePath) === 0) {
          return { commits: implement.commits, prUrl: undefined };
        }

        let reviewCommits: typeof implement.commits = [];
        let reviewed = true;
        try {
          const review = await sandbox.run({
            name: "reviewer",
            maxIterations: 1,
            agent: sandcastle.claudeCode("claude-opus-5-5"),
            promptFile: "./.sandcastle/review-prompt.md",
            promptArgs: {
              BRANCH: issue.branch,
            },
          });
          reviewCommits = review.commits;
        } catch (error) {
          // A failed review shouldn't strand finished work: publish anyway and
          // say so in the PR, which gets a human review regardless.
          console.error(`  ⚠ ${issue.id}: reviewer failed, publishing unreviewed: ${error}`);
          reviewed = false;
        }

        // Publish while the worktree still exists; close() may remove it.
        return {
          commits: [...implement.commits, ...reviewCommits],
          prUrl: publish(issue, sandbox.worktreePath, reviewed),
        };
      } finally {
        await sandbox.close();
      }
    }),
  );

  // Log any agents that threw (network error, sandbox crash, etc.).
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

console.log("\nAll done.");
