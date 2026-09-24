// Parallel Planner with Review — plan → execute → review → PR loop
//
// This template drives a multi-phase workflow:
//   Phase 0 (Gate):             The host resolves each open issue's blockers
//                               (GitHub "blocked by" links and "Blocked by #N"
//                               / "Depends on #N" lines) and holds back every
//                               issue whose blocker hasn't landed yet.
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

// ---------------------------------------------------------------------------
// Blocker gate
//
// An issue is blocked while any issue it depends on is unfinished. Blockers
// come from two places: GitHub's native "blocked by" relationships and lines
// in the issue body that start with "Blocked by #N" or "Depends on #N". A
// blocker is finished only when it closed as completed (for an issue) or was
// merged (for a PR). An open blocker, one closed as not planned or duplicate,
// or a PR closed without merging keeps the dependent issue blocked, since the
// code it needs never reached main.
// ---------------------------------------------------------------------------

type SandcastleIssue = {
  number: number;
  title: string;
  body: string;
  labels: string[];
  comments: string[];
};

type Blocker = {
  number: number;
  state: string;
  state_reason: string | null;
  merged_at: string | null;
  is_pr: boolean;
};

const blockerFields =
  "{number, state, state_reason, merged_at: (.pull_request.merged_at // null), is_pr: (.pull_request != null)}";

const REPO = sh(process.cwd(), "gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner");

const blockerCache = new Map<number, Blocker>();

// Undefined when the lookup fails (a mistyped number 404s, the network drops).
// Callers treat that as still blocking, so one bad reference holds back only
// its own issue instead of aborting the whole run.
function fetchBlocker(number: number): Blocker | undefined {
  let blocker = blockerCache.get(number);
  if (!blocker) {
    try {
      blocker = JSON.parse(
        sh(process.cwd(), "gh", "api", `repos/${REPO}/issues/${number}`, "--jq", blockerFields),
      ) as Blocker;
    } catch {
      return undefined;
    }
    blockerCache.set(number, blocker);
  }
  return blocker;
}

// Issue numbers named on "Blocked by #N" / "Depends on #N" lines in the body.
// Only line starts count, so prose such as "reuses the generator from #22"
// doesn't create a dependency.
function bodyBlockers(body: string): number[] {
  const numbers: number[] = [];
  for (const line of body.split("\n")) {
    const match = /^\s*(?:[-*]\s+)?\**(?:blocked by|depends on)\**:?\s*(.*)$/i.exec(line);
    if (!match) continue;
    for (const ref of match[1]!.matchAll(/(?<![\w/])#(\d+)\b/g)) numbers.push(Number(ref[1]));
  }
  return numbers;
}

// Why a blocker still blocks, or undefined when it has landed.
function unfinishedReason(blocker: Blocker): string | undefined {
  const ref = `#${blocker.number}`;
  if (blocker.state === "open") return `${ref} is still open`;
  if (blocker.is_pr) return blocker.merged_at ? undefined : `${ref} was closed without merging`;
  if (blocker.state_reason === "completed") return undefined;
  return `${ref} was closed as ${blocker.state_reason ?? "unknown"}, so its work never landed`;
}

// Split the open Sandcastle issues into those ready to plan and those waiting
// on an unfinished blocker, with the reasons for each held-back issue.
function gateIssues(): { ready: SandcastleIssue[]; blocked: { issue: SandcastleIssue; reasons: string[] }[] } {
  const issues = JSON.parse(
    sh(
      process.cwd(), "gh", "issue", "list", "--state", "open", "--label", "Sandcastle", "--limit", "100",
      "--json", "number,title,body,labels,comments",
      "--jq", "[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]",
    ),
  ) as SandcastleIssue[];

  const ready: SandcastleIssue[] = [];
  const blocked: { issue: SandcastleIssue; reasons: string[] }[] = [];

  for (const issue of issues) {
    let native: Blocker[];
    try {
      native = sh(
        process.cwd(), "gh", "api", "--paginate", `repos/${REPO}/issues/${issue.number}/dependencies/blocked_by`,
        "--jq", `.[] | ${blockerFields}`,
      )
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Blocker);
    } catch {
      // Without its native links the issue's blockers are unknown, so hold it back.
      blocked.push({ issue, reasons: ["its GitHub \"blocked by\" links couldn't be read"] });
      continue;
    }
    for (const blocker of native) blockerCache.set(blocker.number, blocker);

    const numbers = new Set([...native.map((b) => b.number), ...bodyBlockers(issue.body)]);
    numbers.delete(issue.number);

    const reasons = [...numbers]
      .map((number) => {
        const blocker = fetchBlocker(number);
        return blocker ? unfinishedReason(blocker) : `#${number} couldn't be fetched`;
      })
      .filter((reason): reason is string => reason !== undefined);

    if (reasons.length > 0) blocked.push({ issue, reasons });
    else ready.push(issue);
  }

  return { ready, blocked };
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
  // Phase 0: Gate
  //
  // Blockers are resolved afresh every round: an issue whose blocker's PR
  // merged during the previous round becomes ready now.
  // -------------------------------------------------------------------------
  blockerCache.clear();
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

  // -------------------------------------------------------------------------
  // Phase 1: Plan
  //
  // The planning agent (opus, for deeper reasoning) reads the ready issues,
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
    // Only issues that passed the blocker gate reach the planner.
    promptArgs: { ISSUES_JSON: JSON.stringify(ready) },
    // Extract and validate the <plan> JSON into a typed object. Throws
    // StructuredOutputError if the tag is missing, the JSON is malformed, or
    // validation fails — which aborts the loop.
    output: sandcastle.Output.object({ tag: "plan", schema: planSchema }),
  });

  // The planner only saw ready issues, but enforce the gate in code so a
  // hallucinated or stale id can't start work on a blocked issue.
  const readyIds = new Set(ready.map((issue) => String(issue.number)));
  const issues = plan.output.issues.filter((issue) => {
    if (readyIds.has(issue.id)) return true;
    console.log(`  ⏸ Dropping #${issue.id} from the plan: it didn't pass the blocker gate.`);
    return false;
  });

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
