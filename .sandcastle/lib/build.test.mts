import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Sandbox, SandboxRunOptions } from "@ai-hero/sandcastle";
import { buildIssue, type BuildHost } from "./build.mts";

const issue = { number: 69, title: "Run the gate", body: "", labels: ["Sandcastle"], comments: [] };
const branch = "feature/69-run-the-gate";

// A host whose sandbox records each role run and gate run in `steps`, and
// answers the gate with the queued exit codes in order.
function host(gateExitCodes: number[], { ahead = 1 } = {}) {
  const steps: string[] = [];
  const comments: { issueNumber: number; body: string }[] = [];
  const sandbox = {
    worktreePath: "/worktree",
    run: async (options: SandboxRunOptions) => {
      steps.push(options.name === "gate-fixer" ? `gate-fixer ${options.promptArgs?.CHECKPOINT}` : options.name!);
      return { iterations: [], commits: [{ sha: options.name! }] };
    },
    exec: async (command: string) => {
      steps.push(`gate: ${command}`);
      const exitCode = gateExitCodes.shift();
      if (exitCode === undefined) throw new Error("the gate ran more often than the test expected");
      return { stdout: `gate output, exit ${exitCode}\n`, stderr: "", exitCode };
    },
    close: async () => {
      steps.push("close");
      return {};
    },
  } as unknown as Sandbox;
  const buildHost: BuildHost = {
    createSandbox: async () => sandbox,
    commitsAhead: () => ahead,
    commentOnIssue: (issueNumber, body) => void comments.push({ issueNumber, body }),
    publish: (_issue, _branch, _worktreePath, reviewed) => {
      steps.push(`publish${reviewed ? "" : " unreviewed"}`);
      return "https://github.com/o/r/pull/1";
    },
  };
  return { steps, comments, buildHost };
}

describe("buildIssue", () => {
  it("runs the gate after the implementer and again just before publishing", async () => {
    const { steps, comments, buildHost } = host([0, 0]);

    const result = await buildIssue(issue, branch, buildHost);

    assert.deepEqual(steps, [
      "implementer",
      "gate: scripts/gate.sh 2>&1",
      "reviewer",
      "gate: scripts/gate.sh 2>&1",
      "publish",
      "close",
    ]);
    assert.equal(result.prUrl, "https://github.com/o/r/pull/1");
    assert.deepEqual(comments, []);
  });

  it("gives a red gate to the gate-fixer and carries on once it passes", async () => {
    const { steps, buildHost } = host([1, 0, 1, 1, 0]);

    const result = await buildIssue(issue, branch, buildHost);

    assert.deepEqual(steps.filter((step) => !step.startsWith("gate:")), [
      "implementer",
      "gate-fixer 1",
      "reviewer",
      "gate-fixer 2",
      "gate-fixer 2",
      "publish",
      "close",
    ]);
    assert.deepEqual(result.commits.map((commit) => commit.sha), [
      "implementer", "gate-fixer", "reviewer", "gate-fixer", "gate-fixer",
    ]);
  });

  it("publishes nothing and comments on the issue when checkpoint 1 stays red", async () => {
    const { steps, comments, buildHost } = host([1, 1, 1]);

    const result = await buildIssue(issue, branch, buildHost);

    assert.deepEqual(steps.filter((step) => !step.startsWith("gate:")), ["implementer", "gate-fixer 1", "gate-fixer 1", "close"]);
    assert.equal(result.prUrl, undefined);
    assert.equal(comments.length, 1);
    assert.equal(comments[0]!.issueNumber, 69);
    assert.match(comments[0]!.body, /checkpoint 1/);
    assert.match(comments[0]!.body, /gate output, exit 1/);
  });

  it("publishes nothing and comments on the issue when checkpoint 2 stays red", async () => {
    const { steps, comments, buildHost } = host([0, 1, 1, 1]);

    const result = await buildIssue(issue, branch, buildHost);

    assert.ok(!steps.includes("publish"));
    assert.equal(result.prUrl, undefined);
    assert.match(comments[0]!.body, /checkpoint 2/);
  });

  it("skips the gate when the branch holds nothing main doesn't", async () => {
    const { steps, buildHost } = host([], { ahead: 0 });

    const result = await buildIssue(issue, branch, buildHost);

    assert.deepEqual(steps, ["implementer", "close"]);
    assert.equal(result.prUrl, undefined);
  });
});
