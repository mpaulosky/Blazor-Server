// ---------------------------------------------------------------------------
// Intake
//
// A run before the blocker gate judges every unjudged Sandcastle issue
// against the Definition of Ready (see docs/plans/sandcastle-workflow.md,
// "Phase 2: Intake"), so a human sees numbered questions on an unclear issue
// instead of Sandcastle guessing at it. Its only verdicts here are "ready"
// (sandcastle:ready) and "needs-info" (hands the issue back with
// sandcastle:needs-info and one comment of numbered questions); splitting an
// oversized issue is #75's job. Every verdict can also carry bug: true,
// which adds the bug label so the issue's branch is fix/.
// ---------------------------------------------------------------------------

import { execFileSync } from "node:child_process";
import * as sandcastle from "@ai-hero/sandcastle";
import { z } from "zod";
import { runRole } from "./agents.mts";
import { hooks } from "./config.mts";
import { repoName, type SandcastleIssue } from "./github.mts";
import { intakePromptArgs } from "./prompts.mts";
import { handBackReport, type HandBackReport } from "./report.mts";
import { agentSandbox } from "./skills.mts";

const intakeSchema = z.object({
  verdicts: z.array(
    z.object({
      id: z.string(),
      verdict: z.enum(["ready", "needs-info"]),
      questions: z.array(z.string()).optional(),
      bug: z.boolean(),
      reason: z.string(),
    }),
  ),
});

export type IntakeVerdict = z.infer<typeof intakeSchema>["verdicts"][number];

// The open Sandcastle issues intake hasn't judged yet: carrying none of
// sandcastle:ready, sandcastle:needs-info and sandcastle:needs-human.
// Includes blocked issues, so a human sees intake's questions while a
// blocker is still in flight; the blocker gate runs after intake.
export function needsIntake(issues: readonly SandcastleIssue[]): SandcastleIssue[] {
  throw new Error("Not implemented");
}

export type IntakeRun = (promptArgs: ReturnType<typeof intakePromptArgs>) => Promise<IntakeVerdict[]>;

// Throws StructuredOutputError when the <intake> tag is missing, the JSON is
// malformed or it doesn't match the schema.
const runIntake: IntakeRun = async (promptArgs) => {
  const intake = await runRole("intake", {
    hooks,
    sandbox: agentSandbox(),
    promptFile: "./.sandcastle/intake-prompt.md",
    promptArgs,
    output: sandcastle.Output.object({ tag: "intake", schema: intakeSchema }),
  });
  return intake.output.verdicts;
};

// Apply intake's verdicts to the issues sent to it. A ready verdict adds
// sandcastle:ready with one comment saying why. A needs-info verdict hands
// the issue back (lib/github.mts#handBack) with sandcastle:needs-info and one
// comment of numbered questions, recording the hand-back in `report` for the
// run's summary; the issue keeps Sandcastle either way. Either verdict can
// also add the bug label, when it carries bug: true. A verdict for an id that
// wasn't sent to intake is ignored and logged.
export function applyVerdicts(
  issues: readonly SandcastleIssue[],
  verdicts: readonly IntakeVerdict[],
  run: typeof execFileSync = execFileSync,
  repo: string = repoName(),
  report: HandBackReport = handBackReport,
  log: (line: string) => void = console.log,
): void {
  throw new Error("Not implemented");
}

// Judge every issue intake hasn't judged yet against the Definition of Ready,
// and apply the verdicts. Skipped, without running intake, when there's
// nothing left to judge.
export async function intakeRound(
  issues: readonly SandcastleIssue[],
  run: IntakeRun = runIntake,
  gh: typeof execFileSync = execFileSync,
  repo: string = repoName(),
  report: HandBackReport = handBackReport,
  log: (line: string) => void = console.log,
): Promise<void> {
  throw new Error("Not implemented");
}
