import assert from "node:assert/strict";
import type { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { BUILDING_LABEL, INTAKE_BATCH_SIZE, SANDCASTLE_LABELS } from "./config.mts";
import type { OpenPullRequest, SandcastleIssue } from "./github.mts";
import { UncountedStopError } from "./errors.mts";
import {
  applyVerdicts,
  intakePhase,
  intakeRound,
  intakeRunner,
  needsInfoComment,
  needsIntake,
  readyComment,
  type IntakeVerdict,
} from "./intake.mts";
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
    assert.ok(lines.some((line) => line.includes("#1") && line.includes("judged again in a later round or run")), lines.join("\n"));
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
    assert.ok(lines.some((line) => line.includes("#4") && line.includes("judged again in a later round or run")), lines.join("\n"));
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

  // An ignored verdict isn't the issue's verdict, so a valid one after it
  // still applies (#224).
  it("applies a valid verdict that follows an ignored needs-info verdict with no questions", () => {
    const gh = recordingGh();
    const lines: string[] = [];

    applyVerdicts(
      [issue(5)],
      [verdict(5, { verdict: "needs-info", questions: [] }), verdict(5)],
      gh.run,
      "o/r",
      new HandBackReport(),
      (line) => lines.push(line),
    );

    assert.ok(gh.calls.some((call) => call.args[1] === "edit" && call.args.includes("sandcastle:ready")));
    assert.ok(!lines.some((line) => line.includes("already has a verdict")), lines.join("\n"));
  });

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

    it("leaves a question that starts with a number alone", () => {
      assert.deepEqual(posted(["2.0 or 3.0: which API version?", "3.5 seconds or 5?"]), [
        "1. 2.0 or 3.0: which API version?",
        "2. 3.5 seconds or 5?",
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
  // One bad or truncated answer then costs at most its batch, while the rest
  // of the backlog is still judged (#224, #227).
  it("judges every batch in the same round, INTAKE_BATCH_SIZE issues at a time", async () => {
    const issues = Array.from({ length: INTAKE_BATCH_SIZE + 2 }, (_, i) => issue(i + 1));
    const sent: number[][] = [];

    await intakeRound(
      issues,
      [],
      async (promptArgs) => {
        sent.push(JSON.parse(promptArgs.ISSUES_JSON).map((i: { number: number }) => i.number));
        return [];
      },
      recordingGh().run,
      "o/r",
      new HandBackReport(),
      () => {},
      () => {},
    );

    assert.deepEqual(sent, [issues.slice(0, INTAKE_BATCH_SIZE).map((i) => i.number), [INTAKE_BATCH_SIZE + 1, INTAKE_BATCH_SIZE + 2]]);
  });

  // Otherwise a batch that fails every time would starve the issues behind
  // it (#227). When both halves of the batch fail too, the trouble isn't one
  // issue, so intake gives up on the batch for this round.
  it("logs a batch whose intake run fails in both halves, and still judges the next batch", async () => {
    const issues = Array.from({ length: INTAKE_BATCH_SIZE + 1 }, (_, i) => issue(i + 1));
    const last = INTAKE_BATCH_SIZE + 1;
    const gh = recordingGh();
    const warnings: string[] = [];
    let runs = 0;

    await intakeRound(
      issues,
      [],
      async (promptArgs) => {
        runs += 1;
        const sent: number[] = JSON.parse(promptArgs.ISSUES_JSON).map((i: { number: number }) => i.number);
        if (!sent.includes(last)) throw new Error("no <intake> block");
        return [verdict(last, { reason: "clear and checkable" })];
      },
      gh.run,
      "o/r",
      new HandBackReport(),
      () => {},
      (message) => warnings.push(message),
    );

    assert.equal(runs, 4, "the batch, its two halves and the next batch");
    assert.equal(warnings.length, 1, warnings.join("\n"));
    assert.match(warnings[0]!, /#1, .*#10,/);
    assert.match(warnings[0]!, /no <intake> block/);
    assert.match(warnings[0]!, /a later round or run/);
    assert.ok(gh.calls.some((call) => call.args.includes("edit") && call.args.includes(String(last))), JSON.stringify(gh.calls));
  });

  // Batches are slices of the unjudged issues, so a failed batch re-forms
  // with the same issues every round: without splitting, one bad issue would
  // keep its batch-mates unjudged for good.
  it("splits a batch whose intake run fails until only the issue that breaks it is left unjudged", async () => {
    const issues = Array.from({ length: INTAKE_BATCH_SIZE }, (_, i) => issue(i + 1));
    const bad = 3;
    const gh = recordingGh();
    const warnings: string[] = [];

    await intakeRound(
      issues,
      [],
      async (promptArgs) => {
        const sent: number[] = JSON.parse(promptArgs.ISSUES_JSON).map((i: { number: number }) => i.number);
        if (sent.includes(bad)) throw new Error("truncated <intake> block");
        return sent.map((number) => verdict(number, { reason: "clear and checkable" }));
      },
      gh.run,
      "o/r",
      new HandBackReport(),
      () => {},
      (message) => warnings.push(message),
    );

    const edited = issues
      .map((i) => i.number)
      .filter((number) => gh.calls.some((call) => call.args.includes("edit") && call.args.includes(String(number))));
    assert.deepEqual(edited, issues.map((i) => i.number).filter((number) => number !== bad));
    assert.ok(warnings.some((warning) => /Intake failed on #3,/.test(warning) && /a later round or run/.test(warning)), warnings.join("\n"));
  });

  // A usage limit or time budget ends the whole run, not just one batch.
  it("rethrows an UncountedStopError from a batch without judging the next", async () => {
    const issues = Array.from({ length: INTAKE_BATCH_SIZE + 1 }, (_, i) => issue(i + 1));
    const stop = new UncountedStopError("usage limit");
    let runs = 0;

    await assert.rejects(
      intakeRound(
        issues,
        [],
        async () => {
          runs += 1;
          throw stop;
        },
        recordingGh().run,
        "o/r",
        new HandBackReport(),
        () => {},
        () => {},
      ),
      (error) => error === stop,
    );
    assert.equal(runs, 1);
  });

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

// main.mts's Phase 0a: a failed intake costs only the issues it was judging
// this round, and the run carries on to the gate.
describe("intakePhase", () => {
  // When nothing else is ready the run ends after the gate, so the retry may
  // only come with the next Sandcastle run, and the log says so.
  it("logs an intake run that throws, and carries on", async () => {
    const warnings: string[] = [];

    await intakePhase(
      () => ({ issues: [issue(1)], openPrs: [] }),
      async () => {
        throw new Error("StructuredOutputError: no <intake> tag");
      },
      (message) => warnings.push(message),
    );

    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /no <intake> tag/);
    assert.match(warnings[0]!, /a later round or run/);
  });

  it("logs a queue that can't be read, and carries on without running intake", async () => {
    let ran = false;
    const warnings: string[] = [];

    await intakePhase(
      () => {
        throw new Error("gh issue list failed:\nHTTP 502");
      },
      async () => {
        ran = true;
      },
      (message) => warnings.push(message),
    );

    assert.equal(ran, false);
    assert.match(warnings[0]!, /502/);
  });

  // A usage limit or time budget ends the whole run, not just intake.
  it("rethrows an UncountedStopError", async () => {
    const stop = new UncountedStopError("usage limit reached");

    await assert.rejects(
      intakePhase(
        () => ({ issues: [issue(1)], openPrs: [] }),
        async () => {
          throw stop;
        },
        () => {},
      ),
      (error) => error === stop,
    );
  });

  it("passes intake the issues and open PRs it loaded", async () => {
    const openPrs = [{ number: 50, headRefName: "feature/2-a-thing" }];
    let received: unknown;

    await intakePhase(
      () => ({ issues: [issue(1)], openPrs }),
      async (issues, prs) => {
        received = { issues: issues.map((i) => i.number), prs };
      },
      () => {},
    );

    assert.deepEqual(received, { issues: [1], prs: openPrs });
  });
});

// The live intake run, with Sandcastle's runRole stubbed. Sandcastle itself
// turns a missing <intake> tag or invalid JSON into a StructuredOutputError;
// what's ours is the role, prompt, tag and schema it's given.
describe("intakeRunner", () => {
  // A runRole stub that records its call and answers with `verdicts`.
  function stubRunRole(verdicts: IntakeVerdict[] = []) {
    const calls: { role: string; options: { promptFile?: string; promptArgs?: unknown; output: { tag: string; schema: unknown } } }[] = [];
    const runRole = (async (role: string, options: (typeof calls)[number]["options"]) => {
      calls.push({ role, options });
      return { iterations: [], commits: [], output: { verdicts } };
    }) as unknown as Parameters<typeof intakeRunner>[0];
    return { calls, runRole };
  }
  const noSandbox = (() => ({})) as unknown as Parameters<typeof intakeRunner>[1];
  // Validates `value` with the schema runIntake hands Sandcastle, as
  // Sandcastle does with the parsed <intake> JSON.
  async function validate(schema: unknown, value: unknown) {
    type Result = { issues?: unknown[]; value?: { verdicts: IntakeVerdict[] } };
    return (schema as { "~standard": { validate(value: unknown): Promise<Result> | Result } })["~standard"].validate(value);
  }

  it("runs the intake role on intake-prompt.md, asking for an <intake> block, and returns its verdicts", async () => {
    const { calls, runRole } = stubRunRole([verdict(3)]);

    const verdicts = await intakeRunner(runRole, noSandbox)({ ISSUES_JSON: "[]" });

    assert.deepEqual(verdicts, [verdict(3)]);
    assert.equal(calls[0]!.role, "intake");
    assert.equal(calls[0]!.options.promptFile, "./.sandcastle/intake-prompt.md");
    assert.deepEqual(calls[0]!.options.promptArgs, { ISSUES_JSON: "[]" });
    assert.equal(calls[0]!.options.output.tag, "intake");
  });

  it("gives Sandcastle a schema that accepts the prompt's example verdicts", async () => {
    const { calls, runRole } = stubRunRole();
    await intakeRunner(runRole, noSandbox)({ ISSUES_JSON: "[]" });

    const result = await validate(calls[0]!.options.output.schema, {
      verdicts: [
        { id: "42", verdict: "ready", bug: false, reason: "Clear." },
        { id: "43", verdict: "needs-info", bug: false, questions: ["Which scales?"], reason: "Open question." },
      ],
    });

    assert.equal(result.issues, undefined);
  });

  // The issue JSON gives `number` as a number, so a model may echo it as one;
  // and one verdict without bug would otherwise cost the whole batch (#224).
  it("gives Sandcastle a schema that takes a numeric id as a string and a missing bug as false", async () => {
    const { calls, runRole } = stubRunRole();
    await intakeRunner(runRole, noSandbox)({ ISSUES_JSON: "[]" });

    const result = await validate(calls[0]!.options.output.schema, { verdicts: [{ id: 42, verdict: "ready", reason: "Clear." }] });

    assert.equal(result.issues, undefined);
    assert.deepEqual(result.value!.verdicts, [{ id: "42", verdict: "ready", bug: false, reason: "Clear." }]);
  });

  for (const [what, value] of [
    ["an unknown verdict", { verdicts: [{ id: "1", verdict: "maybe", bug: false, reason: "?" }] }],
    ["no verdicts list", { verdict: "ready" }],
  ] as const) {
    it(`gives Sandcastle a schema that rejects ${what}`, async () => {
      const { calls, runRole } = stubRunRole();
      await intakeRunner(runRole, noSandbox)({ ISSUES_JSON: "[]" });

      const result = await validate(calls[0]!.options.output.schema, value);

      assert.ok(result.issues && result.issues.length > 0);
    });
  }
});

// The reason and questions come from a model that read untrusted issue text,
// so they're posted as plain text (#224).
describe("intake's comments", () => {
  const hostile =
    "Use ``` here, cc @someone, see #123 and owner/repo#45, GH-67 and https://github.com/owner/repo/issues/89 <details><summary>ok</summary> <!-- hidden, &#64;someone &commat;someone &#35;123 github&#46;com";

  for (const [name, body] of [
    ["the ready comment's reason", () => readyComment(verdict(1, { reason: hostile }))],
    ["the needs-info comment's reason", () => needsInfoComment(verdict(1, { verdict: "needs-info", questions: ["Which?"], reason: hostile }))],
    ["a needs-info question", () => needsInfoComment(verdict(1, { verdict: "needs-info", questions: [hostile], reason: "r" }))],
  ] as const) {
    it(`posts ${name} without a code fence, HTML, mention or cross-reference`, () => {
      const text = body();

      assert.doesNotMatch(text, /(^|[^\\])```/m);
      assert.doesNotMatch(text, /@someone/);
      assert.doesNotMatch(text, /#123/);
      assert.doesNotMatch(text, /#45/);
      assert.doesNotMatch(text, /GH-67/i);
      assert.doesNotMatch(text, /github\.com/i);
      assert.doesNotMatch(text, /<details|<summary|<!--/);
      // A character reference would decode into the @, # or . the rules above
      // break, so every & must be escaped.
      assert.doesNotMatch(text, /&(?!amp;|lt;)/);
      assert.match(text, /Use \\`\\`\\` here/);
    });
  }

  it("keeps a reason with line breaks on its one line", () => {
    const text = readyComment(verdict(1, { reason: "First.\n\n```\nSecond." }));

    assert.match(text, /\*\*Reason:\*\* First\. \\`\\`\\` Second\./);
  });

  for (const [question, posted] of [
    ["- a list item?", "1. \\- a list item?"],
    ["# a heading?", "1. \\# a heading?"],
    ["> a quote?", "1. \\> a quote?"],
  ] as const) {
    it(`escapes a question that starts with ${question.slice(0, 1)}`, () => {
      const text = needsInfoComment(verdict(1, { verdict: "needs-info", questions: [question], reason: "r" }));

      assert.ok(text.split("\n").includes(posted), text);
    });
  }
});
