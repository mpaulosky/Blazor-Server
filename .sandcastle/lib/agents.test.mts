import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { Sandbox, SandboxRunOptions } from "@ai-hero/sandcastle";
import { roleOptions, runRoleInSandbox, runWithinLimits, withSharedRules } from "./agents.mts";
import { UncountedStopError } from "./errors.mts";
import { RunLimits } from "./limits.mts";
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

  // #147: a run must stop cleanly at the time budget or Claude's usage limit,
  // without starting another role.
  it("never calls sandbox.run, and rejects with UncountedStopError, when the limits have already stopped the run", async () => {
    const limits = new RunLimits();
    limits.hitUsageLimit("usage limit reached during the backend run");
    let ran = false;
    const sandbox = {
      run: async () => {
        ran = true;
        return { iterations: [], commits: [] };
      },
    } as unknown as Sandbox;

    await assert.rejects(
      () => runRoleInSandbox(sandbox, "backend", { prompt: "" }, limits),
      (error: unknown) => error instanceof UncountedStopError,
    );
    assert.equal(ran, false);
  });
});

describe("runWithinLimits", () => {
  it("throws the stop reason before the run starts when the limits have already stopped the run", async () => {
    const limits = new RunLimits();
    limits.hitUsageLimit("usage limit reached");
    let started = false;

    await assert.rejects(
      () =>
        runWithinLimits(
          "backend",
          async () => {
            started = true;
            return "done";
          },
          limits,
        ),
      (error: unknown) => error instanceof UncountedStopError,
    );
    assert.equal(started, false);
  });

  it("records the usage limit and rethrows as an UncountedStopError carrying the original error as its cause", async () => {
    const limits = new RunLimits();
    const original = new Error("claude-code exited with code 1:\nClaude AI usage limit reached");

    await assert.rejects(
      () => runWithinLimits("backend", () => Promise.reject(original), limits),
      (error: unknown) => error instanceof UncountedStopError && error.cause === original,
    );
    assert.ok(limits.usageLimitReason()?.includes("backend"), String(limits.usageLimitReason()));
  });

  it("rethrows any other error unchanged, without recording a usage-limit stop", async () => {
    const limits = new RunLimits();
    const original = new Error("the backend failed: a real bug");

    await assert.rejects(
      () => runWithinLimits("backend", () => Promise.reject(original), limits),
      (error: unknown) => error === original,
    );
    assert.equal(limits.usageLimitReason(), undefined);
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
