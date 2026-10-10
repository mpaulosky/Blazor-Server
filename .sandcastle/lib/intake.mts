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
import { BUILDING_LABEL, hooks, INTAKE_BATCH_SIZE } from "./config.mts";
import { UncountedStopError } from "./errors.mts";
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

// Lenient where a slip is harmless, because one verdict that fails the schema
// costs every verdict in the block (#224): the issue JSON gives `number` as a
// number, so a numeric id is taken as a string, and a missing bug means false.
const intakeSchema = z.object({
  verdicts: z.array(
    z.object({
      id: z.union([z.string(), z.number()]).transform(String),
      verdict: z.enum(["ready", "needs-info"]),
      questions: z.array(z.string()).optional(),
      bug: z.boolean().default(false),
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

// The live intake run: the intake role on intake-prompt.md, in a sandbox,
// asking for an <intake> block checked against intakeSchema. Sandcastle
// throws StructuredOutputError when the tag is missing, the JSON is malformed
// or it doesn't match the schema. `run` and `sandbox` are Sandcastle's,
// passed in so a test can stub them.
export function intakeRunner(run: typeof runRole = runRole, sandbox: typeof agentSandbox = agentSandbox): IntakeRun {
  return async (promptArgs) => {
    const intake = await run("intake", {
      hooks,
      sandbox: sandbox(),
      promptFile: "./.sandcastle/intake-prompt.md",
      promptArgs,
      output: sandcastle.Output.object({ tag: "intake", schema: intakeSchema }),
    });
    return intake.output.verdicts;
  };
}

const runIntake: IntakeRun = intakeRunner();

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

    // Handing an issue back with no questions would leave its author nothing
    // to answer, so such a verdict counts as none: checked before the issue
    // counts as judged, so a valid verdict after it still applies (#224).
    if (verdict.verdict === "needs-info" && questionsOf(verdict).length === 0) {
      log(`  ⚠ Ignoring intake's needs-info verdict on ${ref}: it has no questions.`);
      continue;
    }
    judged.add(verdict.id);

    // A failed gh call before the verdict's labels land leaves the issue
    // unjudged, so the gate holds it back and intake judges it again in a
    // later round, or on the next run when nothing else is ready and this run
    // ends after the gate.
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
      log(`  ⚠ Couldn't apply intake's ${verdict.verdict} verdict on ${ref}, so it's judged again in a later round or run: ${error}`);
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
    if (!judged.has(id)) log(`  ⚠ Intake gave no verdict on #${id}, so it's judged again in a later round or run.`);
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
    `**Reason:** ${plainText(verdict.reason)}`,
    "To have intake judge it again, remove `sandcastle:ready`.",
  ].join("\n\n");
}

// The verdict's questions as one line each, ready to number: trimmed, with
// internal line breaks collapsed (a blank line would end the Markdown list
// and restart its numbering), any numbering intake added itself (a number,
// then . or ), then a space) removed, blank ones dropped, and the rest made
// plain text (see plainText).
function questionsOf(verdict: IntakeVerdict): string[] {
  return (verdict.questions ?? [])
    .map((question) => question.replace(/\s+/g, " ").trim().replace(/^\d+[.)]\s+/, ""))
    .filter((question) => question !== "")
    .map(plainText);
}

// `text` from intake, as plain text for an issue comment. Intake read
// untrusted issue text, and its words go to the issue's author, so nothing in
// them may restructure the comment or reach anyone else (#224, #227): it's
// kept to one line; backslashes and backticks are escaped (no code span or
// fence to swallow the re-queue instructions), and so are & (no character
// reference to decode into an @, # or . the rules below don't see) and < (no
// HTML tag, such as an unclosed <details>, or comment to hide them); a
// zero-width space after @, a # or GH- before digits, and the dot of
// github.com stops a mention, a cross-reference or a link to another issue or
// PR; and a leading Markdown marker is escaped so it can't start a list,
// heading or quote.
export function plainText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\\`]/g, "\\$&")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/@(?=[A-Za-z0-9])/g, "@\u200B")
    .replace(/#(?=\d)/g, "#\u200B")
    .replace(/\b(GH)-(?=\d)/gi, "$1-\u200B")
    .replace(/\b(github)\.(com)\b/gi, "$1\u200B.$2")
    .replace(/^[-+*#>]/, "\\$&")
    .replace(/^(\d+)([.)])(?=\s)/, "$1\\$2");
}

// The one comment on an issue intake handed back: why, the numbered
// questions a person must answer, and how to put it back in the queue.
export function needsInfoComment(verdict: IntakeVerdict): string {
  const questions = questionsOf(verdict);
  const bugNote = verdict.bug ? " and labelled `bug` (so its branch is `fix/`)" : "";
  return [
    `Sandcastle's intake found this issue doesn't meet the Definition of Ready yet, so it's handed back with \`sandcastle:needs-info\`${bugNote}. ` +
      "Sandcastle won't build it while it carries that label.",
    `**Reason:** ${plainText(verdict.reason)}`,
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
//
// Intake runs once per batch of INTAKE_BATCH_SIZE issues, so a malformed or
// truncated answer costs only its batch (#224). A batch whose run fails is
// logged and judged again in a later round or run, and the next batch is
// still judged, so one that fails every time can't starve the issues behind
// it (#227). An UncountedStopError (a usage limit or time budget) still ends
// the run.
export async function intakeRound(
  issues: readonly SandcastleIssue[],
  openPrs: readonly OpenPullRequest[],
  run: IntakeRun = runIntake,
  gh: typeof execFileSync = execFileSync,
  repo: string = repoName(),
  report: HandBackReport = handBackReport,
  log: (line: string) => void = console.log,
  warn: (message: string) => void = console.error,
): Promise<void> {
  const unjudged = needsIntake(issues, openPrs);
  for (let start = 0; start < unjudged.length; start += INTAKE_BATCH_SIZE) {
    const batch = unjudged.slice(start, start + INTAKE_BATCH_SIZE);
    const refs = batch.map((issue) => `#${issue.number}`).join(", ");
    log(`Intake is judging ${batch.length} issue(s) against the Definition of Ready: ${refs}`);
    try {
      const verdicts = await run(intakePromptArgs(batch));
      applyVerdicts(batch, verdicts, gh, repo, report, log);
    } catch (error) {
      if (error instanceof UncountedStopError) throw error;
      warn(`  ✗ Intake failed on ${refs}, so they're judged again in a later round or run: ${error}`);
    }
  }
}

// Phase 0a as main.mts runs it: load the queue and the open PRs, then run
// intake over them. Intake runs before the gate, over blocked issues too, so a
// human sees its questions while a blocker is still in flight. A failure,
// whether loading or judging, is logged and costs only the issues intake was
// judging this round: without sandcastle:ready the gate holds them back, and
// the issues already ready can still be built. They're judged again in a
// later round, or on the next run when nothing else is ready, since the run
// then ends after the gate. An UncountedStopError (a usage
// limit or time budget) still ends the run.
export async function intakePhase(
  load: () => { issues: readonly SandcastleIssue[]; openPrs: readonly OpenPullRequest[] },
  round: (issues: readonly SandcastleIssue[], openPrs: readonly OpenPullRequest[]) => Promise<void> = intakeRound,
  warn: (message: string) => void = console.error,
): Promise<void> {
  try {
    const { issues, openPrs } = load();
    await round(issues, openPrs);
  } catch (error) {
    if (error instanceof UncountedStopError) throw error;
    warn(`  ✗ Intake failed, so the issues it was judging wait for a later round or run: ${error}`);
  }
}
