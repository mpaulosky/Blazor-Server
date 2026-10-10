import assert from "node:assert/strict";
import type { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { BUILDING_LABEL, SANDCASTLE_LABELS } from "./config.mts";
import type { OpenPullRequest, SandcastleIssue } from "./github.mts";
import { applyVerdicts, intakeRound, needsIntake, type IntakeVerdict } from "./intake.mts";
import { HandBackReport } from "./report.mts";

const issue = (number: number, labels: string[] = ["Sandcastle"]): SandcastleIssue => ({
  number,
  title: `Issue ${number}`,
  body: `Body of ${number}`,
  labels,
  comments: [],
});

// A gh stub recording every call's args and stdin input, as handback.test.mts
// uses. It answers `issue view` (the labels applyVerdicts reads again before a
// verdict) with `labels`, and throws `fail`'s error for a call it matches.
function recordingGh(labels: string[] = ["Sandcastle"], fail?: (args: readonly string[]) => Error | undefined) {
  const calls: { args: readonly string[]; input: unknown }[] = [];
  const run = ((_cmd: string, args: readonly string[], options: { input?: unknown } = {}) => {
    calls.push({ args, input: options.input });
    const error = fail?.(args);
    if (error) throw error;
    return args[1] === "view" ? JSON.stringify(labels) : "";
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

  // Already built or being built: questions on it now would be noise for
  // whoever reviews the work.
  it("doesn't send an issue another run is building", () => {
    const sent = needsIntake([issue(1, ["Sandcastle", BUILDING_LABEL])]);

    assert.deepEqual(sent, []);
  });

  it("doesn't send an issue whose PR is open, and still sends the others", () => {
    const openPrs: OpenPullRequest[] = [{ number: 50, headRefName: "feature/1-add-a-thing" }];

    const sent = needsIntake([issue(1), issue(2)], openPrs);

    assert.deepEqual(sent.map((i) => i.number), [2]);
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
  // One edit, so the issue never carries sandcastle:ready without bug, and
  // never ends up on a feature/ branch.
  it("adds bug and sandcastle:ready in one edit", () => {
    const gh = recordingGh();

    applyVerdicts([issue(3)], [verdict(3, { bug: true })], gh.run, "o/r", new HandBackReport());

    const edits = gh.calls.filter((call) => call.args[1] === "edit").map((call) => call.args);
    assert.deepEqual(edits, [["issue", "edit", "3", "--repo", "o/r", "--add-label", "bug", "--add-label", "sandcastle:ready"]]);
  });

  // Labels before the comment: a failed edit posts nothing, so judging the
  // issue again next round can't leave a second "ready" comment on it.
  it("posts nothing when a ready verdict's label edit fails, and judges the issue again next round", () => {
    const gh = recordingGh(["Sandcastle"], (args) => (args[1] === "edit" ? new Error("HTTP 502") : undefined));
    const lines: string[] = [];

    applyVerdicts([issue(1)], [verdict(1)], gh.run, "o/r", new HandBackReport(), (line) => lines.push(line));

    assert.ok(!gh.calls.some((call) => call.args[1] === "comment"));
    assert.ok(lines.some((line) => line.includes("#1") && line.includes("judged again next round")), lines.join("\n"));
  });

  // Added before the hand-back, so a failed bug edit leaves the issue
  // unjudged, as the log says, rather than handed back without bug.
  it("adds bug before handing a needs-info verdict back, so a failed bug edit leaves the issue unjudged", () => {
    const gh = recordingGh(["Sandcastle"], (args) => (args[1] === "edit" && args.includes("bug") ? new Error("HTTP 502") : undefined));
    const report = new HandBackReport();
    const lines: string[] = [];

    applyVerdicts(
      [issue(4)],
      [verdict(4, { verdict: "needs-info", questions: ["Which page?"], bug: true })],
      gh.run,
      "o/r",
      report,
      (line) => lines.push(line),
    );

    assert.ok(!gh.calls.some((call) => call.args[1] === "comment"));
    assert.ok(!gh.calls.some((call) => call.args.includes("sandcastle:needs-info")));
    assert.deepEqual(report.items(), []);
    assert.ok(lines.some((line) => line.includes("#4") && line.includes("judged again next round")), lines.join("\n"));
  });

  // Handing an issue back without questions would leave its author nothing to
  // answer, so the verdict is treated as missing.
  for (const questions of [undefined, [], ["  "]]) {
    it(`leaves a needs-info verdict with questions ${JSON.stringify(questions)} unjudged, and logs it`, () => {
      const gh = recordingGh();
      const report = new HandBackReport();
      const lines: string[] = [];

      applyVerdicts(
        [issue(5)],
        [verdict(5, { verdict: "needs-info", ...(questions === undefined ? {} : { questions }) })],
        gh.run,
        "o/r",
        report,
        (line) => lines.push(line),
      );

      assert.ok(!gh.calls.some((call) => call.args[1] === "comment" || call.args[1] === "edit"));
      assert.deepEqual(report.items(), []);
      assert.ok(lines.some((line) => line.includes("#5") && line.includes("no questions")), lines.join("\n"));
    });
  }

  // Another Sandcastle run judged the issue after this round read the queue;
  // applying this verdict too would leave two comments, possibly conflicting.
  it("skips a verdict on an issue another run has judged since this round read it", () => {
    const gh = recordingGh(["Sandcastle", "Sandcastle:Ready"]);
    const lines: string[] = [];

    applyVerdicts([issue(6)], [verdict(6)], gh.run, "o/r", new HandBackReport(), (line) => lines.push(line));

    assert.deepEqual(gh.calls.map((call) => call.args[1]), ["view"]);
    assert.ok(lines.some((line) => line.includes("#6") && line.includes("another run")), lines.join("\n"));
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

  // The ready comment only explains labels already applied, so a rejected one
  // costs the explanation, not the verdict.
  it("keeps a ready issue's labels and logs it when its comment is rejected, and still applies the next verdict", () => {
    const gh = recordingGh(["Sandcastle"], (args) => (args[1] === "comment" && args[2] === "1" ? new Error("HTTP 422") : undefined));
    const lines: string[] = [];

    applyVerdicts([issue(1), issue(2)], [verdict(1), verdict(2)], gh.run, "o/r", new HandBackReport(), (line) => lines.push(line));

    const edits = gh.calls.filter((call) => call.args[1] === "edit");
    assert.deepEqual(edits.map((call) => call.args[2]), ["1", "2"]);
    assert.ok(lines.some((line) => line.includes("#1") && line.includes("HTTP 422")), lines.join("\n"));
  });

  // Removing a label takes triage access, which an issue's author may not
  // have, and their replies don't reach intake.
  it("tells an author without triage access to ask a maintainer to re-queue the issue", () => {
    const gh = recordingGh();

    applyVerdicts(
      [issue(7)],
      [verdict(7, { verdict: "needs-info", questions: ["Which page?"], reason: "the page isn't named" })],
      gh.run,
      "o/r",
      new HandBackReport(),
    );

    const body = gh.calls.find((call) => call.args[1] === "comment")!.input as string;
    assert.match(body, /ask a maintainer/);
  });

  // The comment is the only guidance the author gets, so the questions are
  // cleaned up before they're numbered.
  describe("the needs-info comment's questions", () => {
    const posted = (questions: string[]) => {
      const gh = recordingGh();
      applyVerdicts(
        [issue(8)],
        [verdict(8, { verdict: "needs-info", questions, reason: "unclear" })],
        gh.run,
        "o/r",
        new HandBackReport(),
      );
      const body = gh.calls.find((call) => call.args[1] === "comment")!.input as string;
      return body.split("\n").filter((line) => /^\d+\. /.test(line));
    };

    it("drops a blank question", () => {
      assert.deepEqual(posted(["Which page?", "  "]), ["1. Which page?"]);
    });

    it("keeps a question with a blank line in it to one numbered line", () => {
      assert.deepEqual(posted(["Which page?\n\nThe menu or the footer?", "Which Theme?"]), [
        "1. Which page? The menu or the footer?",
        "2. Which Theme?",
      ]);
    });

    it("doesn't number a question twice when intake numbered it", () => {
      assert.deepEqual(posted(["1. Which page?", "2) Which Theme?"]), ["1. Which page?", "2. Which Theme?"]);
    });
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

// gh issue edit --add-label fails for a label the repository doesn't have,
// which would leave every verdict unapplied and Sandcastle building nothing.
describe("the labels intake adds", () => {
  it("are all created at startup by ensureLabels", () => {
    const ensured = SANDCASTLE_LABELS.map((label) => label.name);

    for (const label of ["sandcastle:ready", "sandcastle:needs-info", "bug"]) {
      assert.ok(ensured.includes(label), `${label} isn't in SANDCASTLE_LABELS`);
    }
  });
});

describe("intakeRound", () => {
  it("doesn't judge an issue whose PR is open", async () => {
    let ran = false;

    await intakeRound(
      [issue(1)],
      [{ number: 50, headRefName: "fix/1-a-thing" }],
      async () => {
        ran = true;
        return [];
      },
      recordingGh().run,
      "o/r",
      new HandBackReport(),
    );

    assert.equal(ran, false);
  });

  it("skips the intake run when every issue already has a verdict label", async () => {
    let ran = false;
    const report = new HandBackReport();
    const noGh = (() => "") as unknown as typeof execFileSync;

    await intakeRound(
      [issue(1, ["Sandcastle", "sandcastle:ready"])],
      [],
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
      [],
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
