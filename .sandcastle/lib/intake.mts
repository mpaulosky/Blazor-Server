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
import { BUILDING_LABEL, hooks } from "./config.mts";
import { openPrReason } from "./gate.mts";
import {
  addIssueLabel,
  commentOnIssue,
  handBack,
  hasLabel,
  issueLabels,
  repoName,
  type OpenPullRequest,
  type SandcastleIssue,
} from "./github.mts";
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

// The labels that mean intake has judged the issue, or a person has to act
// on it before anything else happens.
const JUDGED_LABELS = ["sandcastle:ready", "sandcastle:needs-info", "sandcastle:needs-human"];

// The open Sandcastle issues intake hasn't judged yet: carrying none of
// sandcastle:ready, sandcastle:needs-info and sandcastle:needs-human.
// Includes blocked issues, so a human sees intake's questions while a
// blocker is still in flight; the blocker gate runs after intake. Leaves out
// an issue another run is building (sandcastle:building) or whose PR is in
// `openPrs`: its work is already done or under way, so questions on it would
// only be noise for whoever reviews it.
export function needsIntake(issues: readonly SandcastleIssue[], openPrs: readonly OpenPullRequest[] = []): SandcastleIssue[] {
  return issues.filter(
    (issue) =>
      !JUDGED_LABELS.some((label) => hasLabel(issue, label)) &&
      !hasLabel(issue, BUILDING_LABEL) &&
      openPrReason(issue.number, [...openPrs]) === undefined,
  );
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
  const sent = new Map(issues.map((issue) => [String(issue.number), issue]));
  const judged = new Set<string>();

  for (const verdict of verdicts) {
    const ref = `#${verdict.id}`;
    const issue = sent.get(verdict.id);
    if (!issue) {
      log(`  ⚠ Ignoring intake's verdict on ${ref}: it wasn't sent to intake.`);
      continue;
    }
    if (judged.has(verdict.id)) {
      log(`  ⚠ Ignoring another intake verdict on ${ref}: it already has a verdict.`);
      continue;
    }
    judged.add(verdict.id);

    // Handing an issue back with no questions would leave its author nothing
    // to answer, so such a verdict counts as none.
    if (verdict.verdict === "needs-info" && !(verdict.questions ?? []).some((question) => question.trim() !== "")) {
      log(`  ⚠ Ignoring intake's needs-info verdict on ${ref}: it has no questions, so it's judged again next round.`);
      continue;
    }

    // A failed gh call before the verdict's labels land leaves the issue
    // unjudged, so the gate holds it back and the next round's intake judges
    // it again.
    try {
      // Another Sandcastle run may have judged the issue since this round read
      // the queue: applying this verdict too would leave two comments,
      // possibly conflicting ones.
      if (JUDGED_LABELS.some((label) => hasLabel({ labels: issueLabels(issue.number, run, repo) }, label))) {
        log(`  ⚠ Skipping intake's verdict on ${ref}: another run has judged it since this round read the queue.`);
        continue;
      }
      applyVerdict(issue.number, verdict, run, repo, report, log);
    } catch (error) {
      log(`  ⚠ Couldn't apply intake's ${verdict.verdict} verdict on ${ref}, so it's judged again next round: ${error}`);
      continue;
    }
    const bugNote = verdict.bug ? " (a bug)" : "";
    log(
      verdict.verdict === "ready"
        ? `  ✓ Intake marks ${ref} ready${bugNote}: ${verdict.reason}`
        : `  ✋ Intake hands ${ref} back with sandcastle:needs-info${bugNote}: ${verdict.reason}`,
    );
  }

  for (const id of sent.keys()) {
    if (!judged.has(id)) log(`  ⚠ Intake gave no verdict on #${id}, so it's judged again next round.`);
  }
}

// Adds the verdict's labels and posts its one comment.
//
// A ready verdict adds bug, when it carries bug: true, and sandcastle:ready in
// one edit, so the issue never gets built on a feature/ branch, and the
// comment comes after: a failed edit posts nothing, so judging the issue again
// next round can't leave a second comment, and a rejected comment costs only
// the explanation of labels already on the issue, which is logged.
//
// A needs-info verdict adds bug first, so a failed bug edit leaves the issue
// unjudged rather than handed back without it. The hand-back then posts the
// questions before adding sandcastle:needs-info, as everywhere handBack is
// used: a label without its questions would leave the author nothing to
// answer, which is worse than the second comment a failed label edit can cost.
function applyVerdict(
  number: number,
  verdict: IntakeVerdict,
  run: typeof execFileSync,
  repo: string,
  report: HandBackReport,
  log: (line: string) => void,
): void {
  if (verdict.verdict === "needs-info") {
    if (verdict.bug) addIssueLabel(number, "bug", run, repo);
    handBack({ kind: "issue", number }, "sandcastle:needs-info", verdict.reason, needsInfoComment(verdict), run, repo, report);
    return;
  }
  addIssueLabel(number, verdict.bug ? ["bug", "sandcastle:ready"] : "sandcastle:ready", run, repo);
  try {
    commentOnIssue(number, readyComment(verdict), run, repo);
  } catch (error) {
    log(`  ⚠ #${number} is marked sandcastle:ready, but posting intake's reason failed: ${error}`);
  }
}

// The comment on an issue intake judged ready: what the host did, and why.
export function readyComment(verdict: IntakeVerdict): string {
  const labels = verdict.bug ? "`sandcastle:ready` and `bug` (so its branch is `fix/`)" : "`sandcastle:ready`";
  return [
    `Sandcastle's intake found this issue meets the Definition of Ready, so it added ${labels}. It's built once its blockers, if any, have landed.`,
    `**Reason:** ${verdict.reason}`,
    "To have intake judge it again, remove `sandcastle:ready`.",
  ].join("\n\n");
}

// The one comment on an issue intake handed back: why, the numbered
// questions a person must answer, and how to put it back in the queue.
export function needsInfoComment(verdict: IntakeVerdict): string {
  const questions = verdict.questions ?? [];
  const bugNote = verdict.bug ? " and labelled `bug` (so its branch is `fix/`)" : "";
  return [
    `Sandcastle's intake found this issue doesn't meet the Definition of Ready yet, so it's handed back with \`sandcastle:needs-info\`${bugNote}. ` +
      "Sandcastle won't build it while it carries that label.",
    `**Reason:** ${verdict.reason}`,
    ...(questions.length > 0
      ? ["Please answer these questions by editing the issue:", questions.map((question, i) => `${i + 1}. ${question}`).join("\n")]
      : []),
    "Once the issue is edited, remove `sandcastle:needs-info` to put it back in the queue, and intake judges it again. " +
      "Removing a label takes triage access: if you can't, ask a maintainer to remove it. A reply alone doesn't re-queue it.",
  ].join("\n\n");
}

// Judge every issue intake hasn't judged yet against the Definition of Ready,
// and apply the verdicts. Skipped, without running intake, when there's
// nothing left to judge. `openPrs` are the open pull requests, whose issues
// intake leaves alone (see needsIntake).
export async function intakeRound(
  issues: readonly SandcastleIssue[],
  openPrs: readonly OpenPullRequest[],
  run: IntakeRun = runIntake,
  gh: typeof execFileSync = execFileSync,
  repo: string = repoName(),
  report: HandBackReport = handBackReport,
  log: (line: string) => void = console.log,
): Promise<void> {
  const toJudge = needsIntake(issues, openPrs);
  if (toJudge.length === 0) return;
  log(`Intake is judging ${toJudge.length} issue(s) against the Definition of Ready: ${toJudge.map((issue) => `#${issue.number}`).join(", ")}`);
  const verdicts = await run(intakePromptArgs(toJudge));
  applyVerdicts(toJudge, verdicts, gh, repo, report, log);
}
