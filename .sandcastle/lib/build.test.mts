import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Sandbox, SandboxRunOptions } from "@ai-hero/sandcastle";
import { buildIssue, isGitHubServerError, publicErrorText, publish, type BuildHost } from "./build.mts";
import { PUBLISH_RETRY_ATTEMPTS } from "./config.mts";

const issue = { number: 69, title: "Run the gate", body: "", labels: ["Sandcastle"], comments: [] };
const branch = "feature/69-run-the-gate";
// The commit fetchMain() resolved origin/main to.
const base = "f".repeat(40);

// A host whose sandbox records each role run and gate run in `steps`, and
// answers the gate with the queued exit codes in order. A role in `failing`
// throws, and one in `unfinished` ends without signalling completion.
function host(
  gateExitCodes: number[],
  {
    ahead = 1,
    statuses = [""],
    failing = [],
    unfinished = [],
    leaksSecret = false,
    worktreeProblems = [],
    publishError,
  }: {
    ahead?: number | number[];
    statuses?: string[];
    failing?: string[];
    unfinished?: string[];
    leaksSecret?: boolean;
    worktreeProblems?: string[];
    publishError?: string;
  } = {},
) {
  const steps: string[] = [];
  const runs: SandboxRunOptions[] = [];
  const logs: string[] = [];
  const comments: { issueNumber: number; body: string }[] = [];
  const aheadCounts = Array.isArray(ahead) ? [...ahead] : [ahead];
  const worktreeStatuses = [...statuses];
  let aheadIndex = 0;
  // Each role run commits, so HEAD is a new commit after every run.
  let headNumber = 0;
  const head = () => headNumber.toString(16).padStart(40, "0");
  const aheadBranches: string[] = [];
  const aheadBases: string[] = [];
  const scanned: string[] = [];
  const scannedBases: string[] = [];
  const pushed: { branch: string; commit: string }[] = [];
  const sandbox = {
    worktreePath: "/worktree",
    run: async (options: SandboxRunOptions) => {
      // runRoleInSandbox always names the run after its role.
      const role = options.name!;
      runs.push(options);
      headNumber++;
      steps.push(role === "gate-fixer" ? `gate-fixer ${options.promptArgs?.CHECKPOINT}` : role);
      if (failing.includes(role)) throw new Error(`${role} timed out`);
      return {
        iterations: [],
        commits: [{ sha: role }],
        completionSignal: unfinished.includes(role) ? undefined : "<promise>COMPLETE</promise>",
      };
    },
    exec: async (command: string) => {
      if (command.startsWith("git status")) {
        const stdout = worktreeStatuses.shift() ?? "";
        return { stdout, stderr: "", exitCode: 0 };
      }
      if (command === "git rev-parse HEAD") {
        return { stdout: `${head()}\n`, stderr: "", exitCode: 0 };
      }
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
    commitsAhead: (aheadBranch, aheadBase) => {
      aheadBranches.push(aheadBranch);
      aheadBases.push(aheadBase);
      const current = aheadCounts[Math.min(aheadIndex, aheadCounts.length - 1)] ?? 0;
      aheadIndex++;
      return current;
    },
    commentOnIssue: (issueNumber, body) => void comments.push({ issueNumber, body }),
    log: (line) => void logs.push(line),
    leaksSecret: (scanBase, commit) => {
      scannedBases.push(scanBase);
      scanned.push(commit);
      return leaksSecret;
    },
    publish: async (_issue, publishedBranch, commit, reviewed) => {
      if (publishError) throw new Error(publishError);
      pushed.push({ branch: publishedBranch, commit });
      steps.push(`publish${reviewed ? "" : " unreviewed"}`);
      return "https://github.com/o/r/pull/1";
    },
    worktreeProblems: () => worktreeProblems,
    publicError: (error) => publicErrorText(String(error instanceof Error ? error.message : error), () => false),
  };
  return { steps, runs, logs, comments, buildHost, aheadBranches, aheadBases, scanned, scannedBases, pushed, head };
}

describe("buildIssue", () => {
  it("runs the tester, the backend developer, checkpoint 1, the reviewer and checkpoint 2 before publishing", async () => {
    const { steps, comments, buildHost } = host([0, 0]);

    const result = await buildIssue(issue, branch, base, buildHost);

    assert.deepEqual(steps, [
      "tester",
      "backend",
      "gate: scripts/gate.sh 2>&1",
      "reviewer",
      "gate: scripts/gate.sh 2>&1",
      "publish",
      "close",
    ]);
    assert.equal(result.prUrl, "https://github.com/o/r/pull/1");
    assert.equal(result.publishFailed, false);
    assert.deepEqual(comments, []);
  });

  it("logs each role and checkpoint of a built issue in the order they ran", async () => {
    const { logs, buildHost } = host([0, 0]);

    await buildIssue(issue, branch, base, buildHost);

    assert.deepEqual(logs, [
      "  #69 tester finished",
      "  #69 backend finished",
      "  #69 checkpoint 1: gate passed",
      "  #69 reviewer finished",
      "  #69 checkpoint 2: gate passed",
    ]);
  });

  it("runs the tester and the backend developer from their role prompts, with the shared rules", async () => {
    const { runs, buildHost } = host([0, 0]);

    await buildIssue(issue, branch, base, buildHost);

    for (const role of ["tester", "backend"]) {
      const run = runs.find((options) => options.name === role)!;
      assert.equal(run.promptFile, `./.sandcastle/roles/${role}.md`);
      assert.equal(run.promptArgs?.TASK_ID, "69");
      assert.equal(run.promptArgs?.BRANCH, branch);
      assert.ok(run.promptArgs?.SHARED_RULES);
    }
  });

  for (const role of ["tester", "backend"]) {
    const stepsUntilClose = role === "tester" ? ["tester", "close"] : ["tester", "backend", "close"];

    it(`publishes nothing and runs no gate when the ${role} fails`, async () => {
      const { steps, buildHost } = host([], { failing: [role] });

      const result = await buildIssue(issue, branch, base, buildHost);

      assert.deepEqual(steps, stepsUntilClose);
      assert.equal(result.prUrl, undefined);
    });

    it(`comments on the issue with the error when the ${role} fails`, async () => {
      const { comments, buildHost } = host([], { failing: [role] });

      await buildIssue(issue, branch, base, buildHost);

      assert.equal(comments.length, 1);
      assert.equal(comments[0]!.issueNumber, 69);
      assert.match(comments[0]!.body, new RegExp(`the ${role} failed`));
      assert.match(comments[0]!.body, new RegExp(`${role} timed out`));
      assert.match(comments[0]!.body, new RegExp(`\`${branch}\` wasn't pushed`));
    });

    it(`publishes nothing and runs no gate when the ${role} runs out of iterations unfinished`, async () => {
      const { steps, logs, buildHost } = host([], { unfinished: [role] });

      const result = await buildIssue(issue, branch, base, buildHost);

      assert.deepEqual(steps, stepsUntilClose);
      assert.equal(result.prUrl, undefined);
      assert.ok(!logs.includes(`  #69 ${role} finished`));
    });

    it(`comments on the issue when the ${role} runs out of iterations unfinished`, async () => {
      const { comments, buildHost } = host([], { unfinished: [role] });

      await buildIssue(issue, branch, base, buildHost);

      assert.equal(comments.length, 1);
      assert.equal(comments[0]!.issueNumber, 69);
      assert.match(comments[0]!.body, new RegExp(`the ${role} ran out of iterations`));
      assert.match(comments[0]!.body, new RegExp(`\`${branch}\` wasn't pushed`));
    });
  }

  it("keeps the commits of a developer run that came before the failure", async () => {
    const { buildHost } = host([], { failing: ["backend"] });

    const result = await buildIssue(issue, branch, base, buildHost);

    assert.deepEqual(result.commits.map((commit) => commit.sha), ["tester"]);
  });

  it("gives a red gate to the gate-fixer and carries on once it passes", async () => {
    const { steps, buildHost } = host([1, 0, 1, 1, 0]);

    const result = await buildIssue(issue, branch, base, buildHost);

    assert.deepEqual(steps.filter((step) => !step.startsWith("gate:")), [
      "tester",
      "backend",
      "gate-fixer 1",
      "reviewer",
      "gate-fixer 2",
      "gate-fixer 2",
      "publish",
      "close",
    ]);
    assert.deepEqual(result.commits.map((commit) => commit.sha), [
      "tester", "backend", "gate-fixer", "reviewer", "gate-fixer", "gate-fixer",
    ]);
  });

  it("publishes nothing and comments on the issue when checkpoint 1 stays red", async () => {
    const { steps, comments, buildHost } = host([1, 1, 1]);

    const result = await buildIssue(issue, branch, base, buildHost);

    assert.deepEqual(steps.filter((step) => !step.startsWith("gate:")), ["tester", "backend", "gate-fixer 1", "gate-fixer 1", "close"]);
    assert.equal(result.prUrl, undefined);
    assert.equal(comments.length, 1);
    assert.equal(comments[0]!.issueNumber, 69);
    assert.match(comments[0]!.body, /checkpoint 1/);
    assert.match(comments[0]!.body, /gate output, exit 1/);
  });

  it("publishes nothing and comments on the issue when checkpoint 2 stays red", async () => {
    const { steps, comments, buildHost } = host([0, 1, 1, 1]);

    const result = await buildIssue(issue, branch, base, buildHost);

    assert.ok(!steps.includes("publish"));
    assert.equal(result.prUrl, undefined);
    assert.match(comments[0]!.body, /checkpoint 2/);
  });

  it("skips the gate when the branch holds nothing main doesn't", async () => {
    const { steps, buildHost } = host([], { ahead: 0 });

    const result = await buildIssue(issue, branch, base, buildHost);

    assert.deepEqual(steps, ["tester", "backend", "close"]);
    assert.equal(result.prUrl, undefined);
  });

  it("runs checkpoint 1 when the worktree is dirty even if no commits are ahead", async () => {
    const { steps, comments, buildHost } = host([0, 0, 0], {
      ahead: [0, 0],
      statuses: [" M src/App.razor\n", " M src/App.razor\n", " M src/App.razor\n", " M src/App.razor\n"],
    });

    const result = await buildIssue(issue, branch, base, buildHost);

    assert.deepEqual(steps.filter((step) => !step.startsWith("gate:")), ["tester", "backend", "gate-fixer 1", "gate-fixer 1", "close"]);
    assert.equal(result.prUrl, undefined);
    assert.equal(comments.length, 1);
    assert.match(comments[0]!.body, /checkpoint 1/);
    assert.match(comments[0]!.body, /uncommitted changes/);
  });
});

describe("buildIssue publishing", () => {
  it("counts the branch's commits by ref from the pinned base, not in the worktree", async () => {
    const { aheadBranches, aheadBases, buildHost } = host([0, 0]);

    await buildIssue(issue, branch, base, buildHost);

    assert.ok(aheadBranches.length > 0);
    assert.ok(aheadBranches.every((counted) => counted === branch));
    assert.ok(aheadBases.every((counted) => counted === base));
  });

  it("scans and pushes the commit checkpoint 2's gate passed on", async () => {
    const { pushed, scanned, scannedBases, head, buildHost } = host([0, 0]);

    await buildIssue(issue, branch, base, buildHost);

    // tester, backend and reviewer each committed once.
    assert.equal(head(), (3).toString(16).padStart(40, "0"));
    assert.deepEqual(pushed, [{ branch, commit: head() }]);
    assert.deepEqual(scanned, [head()]);
    assert.deepEqual(scannedBases, [base]);
  });

  it("pushes the commit after the gate-fixer's when checkpoint 2 needed it", async () => {
    const { pushed, head, buildHost } = host([0, 1, 0]);

    await buildIssue(issue, branch, base, buildHost);

    assert.equal(head(), (4).toString(16).padStart(40, "0"));
    assert.deepEqual(pushed, [{ branch, commit: head() }]);
  });

  it("publishes nothing when a commit holds a secret, and doesn't quote it", async () => {
    const { steps, comments, buildHost } = host([0, 0], { leaksSecret: true });

    const result = await buildIssue(issue, branch, base, buildHost);

    assert.ok(!steps.includes("publish"));
    assert.equal(result.prUrl, undefined);
    assert.equal(comments.length, 1);
    assert.match(comments[0]!.body, /holds one of the sandbox's secrets/);
    assert.match(comments[0]!.body, new RegExp(`\`${branch}\` wasn't pushed`));
  });

  it("comments on the issue, and closes the sandbox, when the push is rejected", async () => {
    const { steps, comments, buildHost } = host([0, 0], {
      publishError: "git push --quiet origin abc:refs/heads/x failed:\n ! [rejected] abc -> x (non-fast-forward)",
    });

    const result = await buildIssue(issue, branch, base, buildHost);

    assert.equal(result.prUrl, undefined);
    assert.equal(comments.length, 1);
    assert.match(comments[0]!.body, new RegExp(`couldn't publish \`${branch}\``));
    assert.match(comments[0]!.body, /non-fast-forward/);
    assert.equal(steps.at(-1), "close");
  });

  it("flags the result as a publish failure when publishing fails after its retries, unlike a round with nothing to publish", async () => {
    const failed = await buildIssue(
      issue,
      branch,
      base,
      host([0, 0], { publishError: "gh pr create failed:\n remote: Internal Server Error" }).buildHost,
    );
    const nothingToPublish = await buildIssue(issue, branch, base, host([], { ahead: 0 }).buildHost);

    assert.equal(failed.publishFailed, true);
    assert.equal(nothingToPublish.publishFailed, false);
  });

  it("closes the sandbox when its worktree still points at this repository", async () => {
    const { steps, buildHost } = host([0, 0]);

    await buildIssue(issue, branch, base, buildHost);

    assert.equal(steps.at(-1), "close");
  });

  it("leaves a worktree that no longer points at this repository, and says so on the issue", async () => {
    const { steps, comments, buildHost } = host([0, 0], { worktreeProblems: ["/worktree/.git doesn't point into /repo/.git/worktrees"] });

    await buildIssue(issue, branch, base, buildHost);

    assert.ok(!steps.includes("close"));
    assert.equal(comments.length, 1);
    assert.match(comments[0]!.body, /no longer points at this repository/);
  });
});

describe("publish", () => {
  // git's output for the Internal Server Error that #149 reports: a transient
  // GitHub failure that's worth retrying.
  const serverError =
    "git push --quiet origin abc:refs/heads/x failed:\nremote: Internal Server Error\nremote: (request ID A83C:231712:11AADA:1D38A9:6AC6797C)";
  // A push git itself refuses, not GitHub: retrying it would never help.
  const nonFastForward = "git push --quiet origin abc:refs/heads/x failed:\n ! [rejected] abc -> x (non-fast-forward)";

  // A push stub that throws `error` on its first `failures` calls, then
  // succeeds, and counts its calls.
  function flaky(failures: number, error: string) {
    let calls = 0;
    const push = (_branch: string, _commit: string): void => {
      calls++;
      if (calls <= failures) throw new Error(error);
    };
    return { push, calls: () => calls };
  }

  function recordedWaits() {
    const delays: number[] = [];
    return { delays, wait: async (ms: number) => void delays.push(ms) };
  }

  const neverCreatePr = (): string => {
    throw new Error("gh pr create shouldn't run");
  };

  it("retries a push that fails with a GitHub server error, and still publishes the PR", async () => {
    const { push, calls } = flaky(2, serverError);
    const { delays, wait } = recordedWaits();

    const prUrl = await publish(issue, branch, "a".repeat(40), true, push, () => "https://github.com/o/r/pull/1", wait);

    assert.equal(prUrl, "https://github.com/o/r/pull/1");
    assert.equal(calls(), 3);
    assert.equal(delays.length, 2);
    assert.ok(delays.every((delay) => delay > 0), "backs off before each retry");
  });

  it("retries a gh pr create that fails with a GitHub server error, and still publishes the PR", async () => {
    const { push, calls: pushCalls } = flaky(0, serverError);
    let prCreateCalls = 0;
    const createPullRequest = (): string => {
      prCreateCalls++;
      if (prCreateCalls <= 1) throw new Error("gh pr create failed:\nHTTP 503");
      return "https://github.com/o/r/pull/2";
    };
    const { wait } = recordedWaits();

    const prUrl = await publish(issue, branch, "a".repeat(40), true, push, createPullRequest, wait);

    assert.equal(prUrl, "https://github.com/o/r/pull/2");
    assert.equal(pushCalls(), 1);
    assert.equal(prCreateCalls, 2);
  });

  it("doesn't retry a push rejected for a reason other than a GitHub server error", async () => {
    const { push, calls } = flaky(1, nonFastForward);
    const { wait } = recordedWaits();

    await assert.rejects(
      () => publish(issue, branch, "a".repeat(40), true, push, neverCreatePr, wait),
      (error: unknown) => error instanceof Error && error.message === nonFastForward,
    );
    assert.equal(calls(), 1);
  });

  it("gives up and rethrows once every retry attempt still fails with a GitHub server error", async () => {
    const { push, calls } = flaky(Infinity, serverError);
    const { wait } = recordedWaits();

    await assert.rejects(() => publish(issue, branch, "a".repeat(40), true, push, neverCreatePr, wait));
    assert.equal(calls(), PUBLISH_RETRY_ATTEMPTS);
  });
});

describe("isGitHubServerError", () => {
  it("recognises the server errors git and gh report", () => {
    for (const output of [
      "git push failed:\nremote: Internal Server Error",
      "git push failed:\nerror: RPC failed; HTTP 500 curl 22 The requested URL returned error: 500",
      "git push failed:\nfatal: unable to access 'https://github.com/o/r/': The requested URL returned error: 502",
      "gh pr create failed:\nHTTP 503",
      "gh pr list failed:\nHTTP 502: Bad Gateway (https://api.github.com/graphql)",
      "gh pr create failed:\nService Unavailable",
      "gh pr create failed:\nGateway Timeout",
    ]) {
      assert.equal(isGitHubServerError(new Error(output)), true, output);
    }
  });

  it("doesn't take a rejected push, a client error or a 5xx in a branch name for a server error", () => {
    for (const output of [
      "git push --quiet origin abc:refs/heads/x failed:\n ! [rejected] abc -> x (non-fast-forward)",
      "git push --quiet origin abc:refs/heads/fix/500-retry failed:\n ! [rejected] (stale info)",
      "gh pr create failed:\nHTTP 422: Validation Failed",
      "gh pr create failed:\nHTTP 401: Bad credentials",
    ]) {
      assert.equal(isGitHubServerError(new Error(output)), false, output);
    }
  });
});

describe("publicErrorText", () => {
  it("strips colour codes and the credentials in a URL", () => {
    assert.equal(
      publicErrorText("\u001b[31merror\u001b[0m: failed to push to 'https://x-access:abc123@github.com/o/r.git'", () => false),
      "error: failed to push to 'https://***@github.com/o/r.git'",
    );
  });

  it("withholds an error that holds a secret", () => {
    assert.match(publicErrorText("token abcdefgh12345 rejected", (text) => text.includes("abcdefgh12345")), /isn't shown/);
  });
});
