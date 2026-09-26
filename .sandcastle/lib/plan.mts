import * as sandcastle from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";
import { z } from "zod";
import { runRole } from "./agents.mts";
import { hooks } from "./config.mts";
import { openPrBranches, type SandcastleIssue } from "./github.mts";
import { plannerPromptArgs } from "./prompts.mts";

// The planner emits its plan as JSON inside <plan> tags; Output.object extracts
// and validates it against this schema. We use Zod here, but any Standard
// Schema validator works just as well — Valibot, ArkType, etc. See
// https://standardschema.dev.
const planSchema = z.object({
  issues: z.array(
    z.object({ id: z.string(), title: z.string(), branch: z.string() }),
  ),
});

export type PlannedIssue = z.infer<typeof planSchema>["issues"][number];

// The planner reads the ready issues, builds a dependency graph, and selects
// the issues that can be worked in parallel right now (i.e., no blocking
// dependencies on other open issues). Only issues that passed the blocker gate
// reach it, and the gate is enforced again in code afterwards, so a
// hallucinated or stale id can't start work on a blocked issue.
export async function planRound(ready: SandcastleIssue[]): Promise<PlannedIssue[]> {
  const plan = await runRole("planner", {
    hooks,
    sandbox: docker(),
    promptFile: "./.sandcastle/plan-prompt.md",
    promptArgs: plannerPromptArgs(ready, openPrBranches()),
    // Extract and validate the <plan> JSON into a typed object. Throws
    // StructuredOutputError if the tag is missing, the JSON is malformed, or
    // validation fails — which aborts the loop.
    output: sandcastle.Output.object({ tag: "plan", schema: planSchema }),
  });

  const readyIds = new Set(ready.map((issue) => String(issue.number)));
  return plan.output.issues.filter((issue) => {
    if (readyIds.has(issue.id)) return true;
    console.log(`  ⏸ Dropping #${issue.id} from the plan: it didn't pass the blocker gate.`);
    return false;
  });
}
