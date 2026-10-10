import assert from "node:assert/strict";
import type { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import type { SandcastleIssue } from "./github.mts";
import { applyVerdicts, intakeRound, needsIntake, type IntakeVerdict } from "./intake.mts";
import { HandBackReport } from "./report.mts";

const issue = (number: number, labels: string[] = ["Sandcastle"]): SandcastleIssue => ({
  number,
  title: `Issue ${number}`,
  body: `Body of ${number}`,
  labels,
  comments: [],
});

// A gh stub recording every call's args and stdin input, as handback.test.mts uses.
function recordingGh() {
  const calls: { args: readonly string[]; input: unknown }[] = [];
  const run = ((_cmd: string, args: readonly string[], options: { input?: unknown } = {}) => {
    calls.push({ args, input: options.input });
    return "";
  }) as unknown as typeof execFileSync;
  return { calls, run };
}

const verdict = (id: number, overrides: Partial<IntakeVerdict> = {}): IntakeVerdict => ({
  id: String(id),
  verdict: "ready",
  bug: false,
  reason: "has a Summary, a checkable acceptance criterion and no open question",
  ...overrides,
});

describe("needsIntake", () => {
  it("sends an issue without sandcastle:ready to intake", () => {
    const sent = needsIntake([issue(1, ["Sandcastle"])]);

    assert.deepEqual(sent.map((i) => i.number), [1]);
  });

  it("doesn't send an issue that already has sandcastle:ready", () => {
    const sent = needsIntake([issue(1, ["Sandcastle", "sandcastle:ready"])]);

    assert.deepEqual(sent, []);
  });

  it("doesn't send an issue labelled sandcastle:needs-info", () => {
    const sent = needsIntake([issue(1, ["Sandcastle", "sandcastle:needs-info"])]);

    assert.deepEqual(sent, []);
  });

  it("doesn't send an issue labelled sandcastle:needs-human", () => {
    const sent = needsIntake([issue(1, ["Sandcastle", "sandcastle:needs-human"])]);

    assert.deepEqual(sent, []);
  });

  it("sends a blocked issue too, so questions reach the human while a blocker is still in flight", () => {
    const sent = needsIntake([{ ...issue(1, ["Sandcastle"]), body: "Blocked by #2" }]);

    assert.deepEqual(sent.map((i) => i.number), [1]);
  });
});

describe("applyVerdicts", () => {
  it("adds sandcastle:ready and comments why, for a ready verdict", () => {
    const gh = recordingGh();
    const report = new HandBackReport();

    applyVerdicts(
      [issue(1)],
      [verdict(1, { reason: "has a Summary, a checkable acceptance criterion and no open question" })],
      gh.run,
      "o/r",
      report,
    );

    const edits = gh.calls.filter((call) => call.args[0] === "issue" && call.args[1] === "edit");
    const comments = gh.calls.filter((call) => call.args[0] === "issue" && call.args[1] === "comment");
    assert.deepEqual(edits.map((call) => call.args), [["issue", "edit", "1", "--repo", "o/r", "--add-label", "sandcastle:ready"]]);
    assert.equal(comments.length, 1);
    assert.match(comments[0]!.input as string, /has a Summary, a checkable acceptance criterion and no open question/);
    assert.deepEqual(report.items(), []);
  });

  it("leaves a needs-info verdict with Sandcastle and sandcastle:needs-info, a comment of numbered questions, and a hand-back entry", () => {
    const gh = recordingGh();
    const report = new HandBackReport();

    applyVerdicts(
      [issue(7)],
      [
        verdict(7, {
          verdict: "needs-info",
          questions: ["What should happen when the input is empty?", "Which page shows this?"],
          reason: "no acceptance criterion is objectively checkable",
        }),
      ],
      gh.run,
      "o/r",
      report,
    );

    const edits = gh.calls.filter((call) => call.args[0] === "issue" && call.args[1] === "edit");
    const comments = gh.calls.filter((call) => call.args[0] === "issue" && call.args[1] === "comment");
    assert.deepEqual(edits.map((call) => call.args), [["issue", "edit", "7", "--repo", "o/r", "--add-label", "sandcastle:needs-info"]]);
    assert.ok(!edits[0]!.args.includes("--remove-label"), "a needs-info verdict must leave Sandcastle on the issue");
    assert.equal(comments.length, 1);
    const body = comments[0]!.input as string;
    assert.match(body, /1\.\s*What should happen when the input is empty\?/);
    assert.match(body, /2\.\s*Which page shows this\?/);
    assert.equal(report.items().length, 1);
    assert.equal(report.items()[0]!.target, "issue #7");
    assert.equal(report.items()[0]!.label, "sandcastle:needs-info");
  });

  it("adds the bug label when a ready verdict carries bug: true", () => {
    const gh = recordingGh();
    const report = new HandBackReport();

    applyVerdicts([issue(3)], [verdict(3, { bug: true })], gh.run, "o/r", report);

    const edits = gh.calls.filter((call) => call.args[0] === "issue" && call.args[1] === "edit");
    assert.ok(edits.some((call) => call.args.includes("bug")), JSON.stringify(edits));
  });

  it("adds the bug label when a needs-info verdict carries bug: true", () => {
    const gh = recordingGh();
    const report = new HandBackReport();

    applyVerdicts(
      [issue(4)],
      [verdict(4, { verdict: "needs-info", questions: ["Which page?"], bug: true, reason: "unclear" })],
      gh.run,
      "o/r",
      report,
    );

    const edits = gh.calls.filter((call) => call.args[0] === "issue" && call.args[1] === "edit");
    assert.ok(edits.some((call) => call.args.includes("bug")), JSON.stringify(edits));
  });

  it("ignores and logs a verdict for an id that wasn't sent to intake", () => {
    const gh = recordingGh();
    const report = new HandBackReport();
    const lines: string[] = [];

    applyVerdicts([issue(1)], [verdict(9)], gh.run, "o/r", report, (line) => lines.push(line));

    assert.equal(gh.calls.length, 0);
    assert.deepEqual(report.items(), []);
    assert.ok(lines.some((line) => line.includes("#9") && line.includes("wasn't sent")));
  });
});

describe("applyVerdicts beyond the acceptance criteria", () => {
  it("adds bug before sandcastle:ready, so a failed bug edit leaves the issue unready", () => {
    const gh = recordingGh();

    applyVerdicts([issue(3)], [verdict(3, { bug: true })], gh.run, "o/r", new HandBackReport());

    const added = gh.calls.filter((call) => call.args[1] === "edit").map((call) => call.args.at(-1));
    assert.deepEqual(added, ["bug", "sandcastle:ready"]);
  });

  it("applies only the first verdict on an issue and logs the rest", () => {
    const gh = recordingGh();
    const lines: string[] = [];

    applyVerdicts(
      [issue(1)],
      [verdict(1), verdict(1, { verdict: "needs-info", questions: ["Why?"] })],
      gh.run,
      "o/r",
      new HandBackReport(),
      (line) => lines.push(line),
    );

    const edits = gh.calls.filter((call) => call.args[1] === "edit");
    assert.deepEqual(edits.map((call) => call.args.at(-1)), ["sandcastle:ready"]);
    assert.ok(lines.some((line) => line.includes("#1") && line.includes("already has a verdict")), lines.join("\n"));
  });

  it("logs an issue intake gave no verdict on, and labels nothing", () => {
    const gh = recordingGh();
    const lines: string[] = [];

    applyVerdicts([issue(1), issue(2)], [verdict(1)], gh.run, "o/r", new HandBackReport(), (line) => lines.push(line));

    assert.ok(!gh.calls.some((call) => call.args[2] === "2"));
    assert.ok(lines.some((line) => line.includes("#2") && line.includes("no verdict")), lines.join("\n"));
  });

  it("leaves an issue unlabelled when its comment is rejected, and still applies the next verdict", () => {
    const calls: (readonly string[])[] = [];
    const run = ((_cmd: string, args: readonly string[]) => {
      calls.push(args);
      if (args[1] === "comment" && args[2] === "1") throw new Error("HTTP 422");
      return "";
    }) as unknown as typeof execFileSync;
    const lines: string[] = [];

    applyVerdicts([issue(1), issue(2)], [verdict(1), verdict(2)], run, "o/r", new HandBackReport(), (line) => lines.push(line));

    const edits = calls.filter((args) => args[1] === "edit");
    assert.deepEqual(edits.map((args) => args[2]), ["2"]);
    assert.ok(lines.some((line) => line.includes("#1") && line.includes("HTTP 422")), lines.join("\n"));
  });

  it("explains in the needs-info comment why, and how to re-queue the issue", () => {
    const gh = recordingGh();

    applyVerdicts(
      [issue(7)],
      [verdict(7, { verdict: "needs-info", questions: ["Which page?"], reason: "the page isn't named" })],
      gh.run,
      "o/r",
      new HandBackReport(),
    );

    const body = gh.calls.find((call) => call.args[1] === "comment")!.input as string;
    assert.match(body, /the page isn't named/);
    assert.match(body, /remove `sandcastle:needs-info`/);
  });
});

describe("intakeRound", () => {
  it("skips the intake run when every issue already has a verdict label", async () => {
    let ran = false;
    const report = new HandBackReport();
    const noGh = (() => "") as unknown as typeof execFileSync;

    await intakeRound(
      [issue(1, ["Sandcastle", "sandcastle:ready"])],
      async () => {
        ran = true;
        return [];
      },
      noGh,
      "o/r",
      report,
    );

    assert.equal(ran, false);
  });

  it("runs intake and applies its verdicts for an issue that still needs one", async () => {
    const gh = recordingGh();
    const report = new HandBackReport();
    let sentIds: string[] | undefined;

    await intakeRound(
      [issue(2, ["Sandcastle"])],
      async (promptArgs) => {
        sentIds = JSON.parse(promptArgs.ISSUES_JSON).map((i: { number: number }) => String(i.number));
        return [verdict(2, { reason: "clear and checkable" })];
      },
      gh.run,
      "o/r",
      report,
    );

    assert.deepEqual(sentIds, ["2"]);
    const edits = gh.calls.filter((call) => call.args[0] === "issue" && call.args[1] === "edit");
    assert.deepEqual(edits.map((call) => call.args), [["issue", "edit", "2", "--repo", "o/r", "--add-label", "sandcastle:ready"]]);
  });
});
