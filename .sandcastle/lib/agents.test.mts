import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { Sandbox, SandboxRunOptions } from "@ai-hero/sandcastle";
import { roleOptions, runRoleInSandbox, withSharedRules } from "./agents.mts";
import { usageReport } from "./report.mts";

const sharedRules = readFileSync(new URL("../roles/shared-rules.md", import.meta.url), "utf8");

describe("roleOptions", () => {
  it("names the run after the role and applies its iteration cap", () => {
    const options = roleOptions("tester");

    assert.equal(options.name, "tester");
    assert.equal(options.maxIterations, 3);
  });

  it("runs the role's model at its effort", () => {
    const { command } = roleOptions("scribe").agent.buildPrintCommand({ prompt: "", dangerouslySkipPermissions: true });

    assert.match(command, /--model 'claude-sonnet-5'/);
    assert.match(command, /--effort medium/);
  });

  it("aborts the run after the role's timeout", () => {
    const requested: number[] = [];
    const signal = new AbortController().signal;

    const options = roleOptions("backend", (ms) => {
      requested.push(ms);
      return signal;
    });

    assert.deepEqual(requested, [45 * 60_000]);
    assert.equal(options.signal, signal);
  });
});

describe("runRoleInSandbox", () => {
  it("lists a role that ran even when its run fails", async () => {
    const failing = { run: () => Promise.reject(new Error("timed out")) } as unknown as Sandbox;

    await assert.rejects(runRoleInSandbox(failing, "ui", { prompt: "" }), /timed out/);

    assert.ok(usageReport.totals().has("ui"));
  });

  it("gives the role's prompt the shared rules alongside its own arguments", async () => {
    const runs: SandboxRunOptions[] = [];
    const sandbox = {
      run: async (options: SandboxRunOptions) => {
        runs.push(options);
        return { iterations: [], commits: [] };
      },
    } as unknown as Sandbox;

    await runRoleInSandbox(sandbox, "reviewer", { promptFile: "./review.md", promptArgs: { TASK_ID: "3" } });

    assert.deepEqual(runs[0]!.promptArgs, { TASK_ID: "3", SHARED_RULES: sharedRules });
  });
});

describe("withSharedRules", () => {
  it("adds the shared rules to a prompt file's arguments", () => {
    const options = withSharedRules({ promptFile: "./plan.md" });

    assert.deepEqual(options.promptArgs, { SHARED_RULES: sharedRules });
  });

  it("leaves an inline prompt alone, since Sandcastle rejects arguments for one", () => {
    assert.deepEqual(withSharedRules({ prompt: "Say hi" }), { prompt: "Say hi" });
  });
});
