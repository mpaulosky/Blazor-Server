import { posix } from "node:path";
import * as sandcastle from "@ai-hero/sandcastle";
import { z } from "zod";
import { runRole } from "./agents.mts";
import { hooks, OPTIONAL_ROLES, type OptionalRole } from "./config.mts";
import type { SandcastleIssue } from "./github.mts";
import { plannerPromptArgs } from "./prompts.mts";
import { agentSandbox } from "./skills.mts";

// The planner emits its plan as JSON inside <plan> tags; Output.object extracts
// and validates it against this schema. We use Zod here, but any Standard
// Schema validator works just as well — Valibot, ArkType, etc. See
// https://standardschema.dev. There's no branch field: the host names branches
// (see branchFor), so a re-plan can't move an issue's work to a new branch.
// `roles` is left as unknown rather than validated here: an invalid value
// (not an array, or naming a role resolveRoles doesn't recognise) must fall
// back to every optional role, not abort the whole plan the way a schema
// mismatch would (see "Phase 4: Plan" in docs/plans/sandcastle-workflow.md).
// `files` is the planner's prediction of the paths the issue will change; the
// host defers overlapping picks on it (see lib/overlap.mts). It's optional so
// a plan without it still parses: a pick with no files is treated as touching
// anything.
const planSchema = z.object({
  issues: z.array(
    z.object({ id: z.string(), title: z.string(), roles: z.unknown().optional(), files: z.array(z.string()).optional() }),
  ),
});

export type PlannedIssue = z.infer<typeof planSchema>["issues"][number];

// The optional roles (architect, UI developer, scribe) resolveRoles picks for
// one issue from the planner's raw `roles` field: the recognised ones,
// deduplicated and in build order, or every optional role when the field is
// missing, isn't an array, or names anything resolveRoles doesn't recognise
// (see OPTIONAL_ROLES in lib/config.mts). An empty array is valid on its own:
// it means the planner deliberately picked none.
export function resolveRoles(roles: unknown): OptionalRole[] {
  const known: readonly string[] = OPTIONAL_ROLES;
  if (!Array.isArray(roles) || !roles.every((role) => typeof role === "string" && known.includes(role))) {
    return [...OPTIONAL_ROLES];
  }
  return OPTIONAL_ROLES.filter((role) => roles.includes(role));
}

// The planner reads the ready issues, builds a dependency graph, and selects
// the issues that can be worked in parallel right now (i.e., no blocking
// dependencies on other open issues). Only issues that passed the blocker gate
// reach it, and the gate is enforced again in code afterwards, so a
// hallucinated or stale id can't start work on a blocked issue.
export async function planRound(ready: SandcastleIssue[]): Promise<PlannedIssue[]> {
  const plan = await runRole("planner", {
    hooks,
    sandbox: agentSandbox(),
    promptFile: "./.sandcastle/plan-prompt.md",
    promptArgs: plannerPromptArgs(ready),
    // Extract and validate the <plan> JSON into a typed object. Throws
    // StructuredOutputError if the tag is missing, the JSON is malformed, or
    // validation fails — which aborts the loop.
    output: sandcastle.Output.object({ tag: "plan", schema: planSchema }),
  });

  return readyPicks(plan.output.issues, ready);
}

// The planned issues that passed the blocker gate, in the planner's order, each
// once, with their `files` resolved (see resolveFiles). A repeated id is
// dropped: two pipelines on one branch would race each other's sandboxes and
// pushes.
export function readyPicks(
  planned: readonly PlannedIssue[],
  ready: readonly Pick<SandcastleIssue, "number">[],
  log: (line: string) => void = console.log,
): PlannedIssue[] {
  const readyIds = new Set(ready.map((issue) => String(issue.number)));
  const picked = new Set<string>();
  return planned.filter((issue) => {
    if (!readyIds.has(issue.id)) {
      log(`  ⏸ Dropping #${issue.id} from the plan: it didn't pass the blocker gate.`);
      return false;
    }
    if (picked.has(issue.id)) return false;
    picked.add(issue.id);
    return true;
  }).map((issue) => (issue.files === undefined ? issue : { ...issue, files: resolveFiles(issue.files) }));
}

// Where the repository is checked out inside a sandbox, so an absolute path the
// planner read there can be made repo-relative.
export const SANDBOX_REPO_ROOT = "/home/agent/workspace";

// The planner's `files` as clean repo-relative paths the overlap check can
// compare: an absolute path under `root` made relative, a leading `./` and
// trailing slashes dropped, and blanks, entries with control characters and
// paths outside `root` left out. A missing list is an empty one. The planner
// reads the repo in a sandbox, so it can name `/home/agent/workspace/x`, which
// as a string matches nothing an open PR changes (#425). A control character
// is dropped rather than cleaned: the path reaches the log, where a line break
// followed by `::` is a workflow command in GitHub Actions.
export function resolveFiles(files: readonly string[] | undefined, root: string = SANDBOX_REPO_ROOT): string[] {
  const base = posix.normalize(root).replace(/\/+$/, "");
  const resolved = new Set<string>();
  for (const entry of files ?? []) {
    const trimmed = entry.trim();
    if (trimmed === "" || /[\u0000-\u001f\u007f]/.test(trimmed)) continue;
    let relative = trimmed;
    if (trimmed.startsWith("/")) {
      const absolute = posix.normalize(trimmed);
      if (absolute !== base && !absolute.startsWith(`${base}/`)) continue;
      relative = absolute.slice(base.length);
    }
    const path = posix.normalize(relative).replace(/^\/+|\/+$/g, "");
    if (path === "" || path === "." || path === ".." || path.startsWith("../")) continue;
    resolved.add(path);
  }
  return [...resolved];
}

// The note on a held issue in the critique's unpicked list, which
// critique-prompt.md explains: the planner picked it, but it waits this round
// behind a pick or pull request that changes the same file.
const HELD_NOTE = "Held back this round by the overlap check: it shares a file with another pick or an open pull request. It's still work to come.";

// The ready issues the critique should treat as unpicked work: those the
// planner left out, and the picks the overlap check held back this round
// (`held`, their issue numbers), each with a `note` saying so. A kept pick, one
// of `kept`, is excluded. The critique's dependency check covers an unpicked
// ready issue, and a held issue is work still to come, so a pick that depends
// on one can be deferred behind it (#428).
export function unpickedReady(
  ready: readonly SandcastleIssue[],
  kept: readonly PlannedIssue[],
  held: readonly number[],
): (SandcastleIssue & { note?: string })[] {
  const keptIds = new Set(kept.map((issue) => issue.id));
  const heldIds = new Set(held);
  return ready
    .filter((issue) => !keptIds.has(String(issue.number)))
    .map((issue) => (heldIds.has(issue.number) ? { ...issue, note: HELD_NOTE } : issue));
}

// The issue each kept pick stands for, with the optional roles resolved from the
// planner's raw `roles` and the `files` it named, so the critique sees them:
// its prompt says each pick carries `files` (#425). Throws for a pick that
// isn't in `ready`, which readyPicks has already ruled out.
export function pickIssues(
  kept: readonly PlannedIssue[],
  ready: readonly SandcastleIssue[],
): (SandcastleIssue & { roles: OptionalRole[]; files: string[] })[] {
  const readyById = new Map(ready.map((issue) => [String(issue.number), issue]));
  return kept.map((pick) => {
    const issue = readyById.get(pick.id);
    if (issue === undefined) throw new Error(`#${pick.id} was picked but isn't a ready issue.`);
    return { ...issue, roles: resolveRoles(pick.roles), files: resolveFiles(pick.files) };
  });
}
