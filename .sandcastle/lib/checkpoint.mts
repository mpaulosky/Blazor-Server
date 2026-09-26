// Gate checkpoints. The host runs scripts/gate.sh inside the sandbox after the
// last developer run (checkpoint 1) and just before publishing (checkpoint 2).
// The gate's exit code decides, never what an agent reports. A red gate gets up
// to GATE_FIXER_ATTEMPTS gate-fixer runs, with the gate re-run after each; a
// fixer run that throws or times out still uses up its attempt.

import type { Sandbox } from "@ai-hero/sandcastle";
import { GATE_COMMENT_LINES, GATE_FIXER_ATTEMPTS } from "./config.mts";

export type Checkpoint = 1 | 2;

export type GateRun = { passed: boolean; output: string };

// What a checkpoint does in the sandbox; tests pass stubs.
export type CheckpointSteps = {
  gate(): Promise<GateRun>;
  fix(checkpoint: Checkpoint, gateOutput: string): Promise<unknown>;
};

// The gate prints in colour, which only gets in the way of a prompt or an
// issue comment.
const ansiEscape = /\u001b\[[0-9;]*[A-Za-z]/g;

// Run the gate with stderr folded into stdout, so the output keeps the order
// it was printed in. A passing gate over a dirty worktree still fails: the gate
// checks BASE..HEAD and publish() pushes only commits, so uncommitted edits
// would be gated but never pushed.
export async function runGate(sandbox: Pick<Sandbox, "exec">): Promise<GateRun> {
  const { stdout, exitCode } = await sandbox.exec("scripts/gate.sh 2>&1");
  const output = stdout.replace(ansiEscape, "");
  if (exitCode !== 0) return { passed: false, output };

  const status = await sandbox.exec("git status --porcelain 2>&1");
  if (status.exitCode !== 0) {
    return { passed: false, output: `${output}\n❌ git status failed, so the worktree can't be shown to be clean:\n${status.stdout}` };
  }
  if (status.stdout.trim()) {
    return {
      passed: false,
      output:
        `${output}\n❌ The gate passed, but the worktree has uncommitted changes. Commit them, or discard ` +
        `them if they don't belong, so the pushed branch is exactly what the gate checked:\n${status.stdout}`,
    };
  }
  return { passed: true, output };
}

// Run the gate, and the gate-fixer while it's red and attempts are left.
// Returns the last gate run.
export async function runCheckpoint(
  checkpoint: Checkpoint,
  steps: CheckpointSteps,
  log: (line: string) => void,
): Promise<GateRun> {
  const prefix = `checkpoint ${checkpoint}:`;
  let result = await steps.gate();
  log(`${prefix} gate ${result.passed ? "passed" : "failed"}`);

  for (let attempt = 1; !result.passed && attempt <= GATE_FIXER_ATTEMPTS; attempt++) {
    const label = `gate-fixer attempt ${attempt}/${GATE_FIXER_ATTEMPTS}`;
    try {
      await steps.fix(checkpoint, result.output);
    } catch (error) {
      log(`${prefix} ${label} failed: ${error}`);
    }
    result = await steps.gate();
    log(`${prefix} gate ${result.passed ? "passed" : "failed"} after ${label}`);
  }

  return result;
}

// The last `lines` lines of the output.
export function tail(output: string, lines: number): string {
  return output.replace(/\n$/, "").split("\n").slice(-lines).join("\n");
}

// The issue comment for a checkpoint that stayed red past the fixer's attempts.
export function gateFailureComment(checkpoint: Checkpoint, branch: string, output: string): string {
  const quoted = tail(output, GATE_COMMENT_LINES);
  const longestRun = Math.max(0, ...[...quoted.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return [
    `Sandcastle stopped building this issue: \`scripts/gate.sh\` is still red at checkpoint ${checkpoint} ` +
      `after ${GATE_FIXER_ATTEMPTS} gate-fixer attempts, so \`${branch}\` wasn't pushed. The branch keeps its commits.`,
    "",
    `The last ${GATE_COMMENT_LINES} lines of the gate output:`,
    "",
    `${fence}text`,
    quoted,
    fence,
  ].join("\n");
}
