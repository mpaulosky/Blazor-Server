import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { OPTIONAL_ROLES } from "./config.mts";
import { pickIssues, readyPicks, resolveFiles, resolveRoles, unpickedReady } from "./plan.mts";
import type { SandcastleIssue } from "./github.mts";

describe("readyPicks", () => {
  const ready = [{ number: 4 }, { number: 5 }];

  it("keeps each ready pick once, in the planner's order", () => {
    const picks = readyPicks(
      [
        { id: "5", title: "B" },
        { id: "4", title: "A" },
        { id: "5", title: "B again" },
      ],
      ready,
      () => {},
    );

    assert.deepEqual(picks.map((pick) => pick.id), ["5", "4"]);
  });

  it("drops a pick that didn't pass the blocker gate, and says so", () => {
    const lines: string[] = [];

    const picks = readyPicks([{ id: "6", title: "C" }, { id: "4", title: "A" }], ready, (line) => lines.push(line));

    assert.deepEqual(picks.map((pick) => pick.id), ["4"]);
    assert.match(lines.join("\n"), /#6/);
  });

  it("keeps a pick's roles field unchanged", () => {
    const picks = readyPicks([{ id: "4", title: "A", roles: ["scribe"] }], ready, () => {});

    assert.deepEqual(picks[0]?.roles, ["scribe"]);
  });
});

// Covers "A plan with a missing or invalid roles field runs every role for
// that issue" from issue #72: resolveRoles is what main.mts asks for that
// fallback, since the plan schema itself can't reject an invalid field
// without aborting the whole plan (see plan.mts).
describe("resolveRoles", () => {
  it("runs every optional role when the field is missing", () => {
    assert.deepEqual(resolveRoles(undefined), [...OPTIONAL_ROLES]);
  });

  it("runs every optional role when the field isn't an array", () => {
    assert.deepEqual(resolveRoles("architect"), [...OPTIONAL_ROLES]);
    assert.deepEqual(resolveRoles(null), [...OPTIONAL_ROLES]);
    assert.deepEqual(resolveRoles({ architect: true }), [...OPTIONAL_ROLES]);
  });

  it("runs every optional role when the array names something resolveRoles doesn't recognise", () => {
    assert.deepEqual(resolveRoles(["architect", "backend"]), [...OPTIONAL_ROLES]);
    assert.deepEqual(resolveRoles(["frontend"]), [...OPTIONAL_ROLES]);
  });

  it("keeps only the roles the planner picked, in build order", () => {
    assert.deepEqual(resolveRoles(["scribe"]), ["scribe"]);
    assert.deepEqual(resolveRoles(["scribe", "architect"]), ["architect", "scribe"]);
  });

  it("deliberately picking none is valid: an empty array runs no optional role", () => {
    assert.deepEqual(resolveRoles([]), []);
  });

  it("drops a repeated role rather than running it twice", () => {
    assert.deepEqual(resolveRoles(["ui", "ui"]), ["ui"]);
  });
});

// AC of #421: plan-prompt.md asks the planner for each pick's `files`, the
// paths it expects the issue to change, which the host defers overlaps on.
describe("plan-prompt.md", () => {
  const prompt = readFileSync(new URL("../plan-prompt.md", import.meta.url), "utf8");

  it("asks the planner for a files list per pick", () => {
    assert.match(prompt, /`files`/);
    assert.match(prompt, /"files": \[/);
  });
});

// AC 3: the planner's `files` are made into clean repo-relative paths.
describe("resolveFiles", () => {
  const root = "/home/agent/workspace";

  it("turns an absolute path under the repo root into a repo-relative one", () => {
    assert.deepEqual(resolveFiles([`${root}/.sandcastle/lib/build.mts`], root), [".sandcastle/lib/build.mts"]);
  });

  it("uses the sandbox's checkout as the root by default", () => {
    assert.deepEqual(resolveFiles(["/home/agent/workspace/.sandcastle/lib/build.mts"]), [".sandcastle/lib/build.mts"]);
  });

  it("leaves a path that is already repo-relative as it is", () => {
    assert.deepEqual(resolveFiles(["src/UI/Program.cs"], root), ["src/UI/Program.cs"]);
  });

  it("drops a leading ./", () => {
    assert.deepEqual(resolveFiles(["./lib/plan.mts"], root), ["lib/plan.mts"]);
  });

  it("drops trailing slashes, so a folder is a bare path", () => {
    assert.deepEqual(resolveFiles(["src/UI/", "docs//"], root), ["src/UI", "docs"]);
  });

  it("trims surrounding spaces", () => {
    assert.deepEqual(resolveFiles(["  lib/plan.mts \t"], root), ["lib/plan.mts"]);
  });

  it("drops blank entries", () => {
    assert.deepEqual(resolveFiles(["", "   ", "a.mts"], root), ["a.mts"]);
  });

  it("drops an entry that is only a ./ or the repo root itself", () => {
    assert.deepEqual(resolveFiles(["./", root, `${root}/`, "a.mts"], root), ["a.mts"]);
  });

  it("drops an entry with a line break or other control character", () => {
    assert.deepEqual(
      resolveFiles(["a.mts\n::error::injected", "b\r.mts", "c\u0000.mts", "d\u001b[31m.mts", "e\u007f.mts", "ok.mts"], root),
      ["ok.mts"],
    );
  });

  it("drops an absolute path outside the repo root rather than guess at it", () => {
    assert.deepEqual(resolveFiles(["/etc/passwd", "/home/agent/workspace-other/a.mts", "a.mts"], root), ["a.mts"]);
  });

  it("keeps each path once", () => {
    assert.deepEqual(resolveFiles(["a.mts", `${root}/a.mts`, "./a.mts"], root), ["a.mts"]);
  });

  it("reads a missing list as an empty one", () => {
    assert.deepEqual(resolveFiles(undefined, root), []);
  });
});

describe("readyPicks files", () => {
  it("resolves each pick's files, so the overlap check compares clean paths", () => {
    const picks = readyPicks(
      [{ id: "4", title: "A", files: ["/home/agent/workspace/.sandcastle/lib/build.mts", "./x.mts", ""] }],
      [{ number: 4 }],
      () => {},
    );

    assert.deepEqual(picks[0]!.files, [".sandcastle/lib/build.mts", "x.mts"]);
  });

  it("leaves a pick that named no files without any, so it is still treated as touching anything", () => {
    const picks = readyPicks([{ id: "4", title: "A" }], [{ number: 4 }], () => {});

    assert.equal((picks[0]!.files ?? []).length, 0);
  });
});

// AC 5: the critique gets each pick's files, and an overlap-deferred pick isn't
// passed to it as unpicked.
describe("pickIssues", () => {
  const issue = (number: number): SandcastleIssue =>
    ({ number, title: `Issue ${number}`, body: "", labels: [], comments: [] }) as unknown as SandcastleIssue;

  it("gives each kept pick the files the planner named", () => {
    const picks = pickIssues([{ id: "4", title: "A", files: ["a.mts", "b/"] }], [issue(4), issue(5)]);

    assert.deepEqual(picks.map((pick) => pick.number), [4]);
    assert.deepEqual(picks[0]!.files, ["a.mts", "b"]);
  });

  it("gives a pick that named no files an empty list", () => {
    const picks = pickIssues([{ id: "4", title: "A" }], [issue(4)]);

    assert.deepEqual(picks[0]!.files, []);
  });

  it("resolves each pick's optional roles from the planner's raw field", () => {
    const picks = pickIssues([{ id: "4", title: "A", roles: ["scribe"] }, { id: "5", title: "B" }], [issue(4), issue(5)]);

    assert.deepEqual(picks[0]!.roles, ["scribe"]);
    assert.deepEqual(picks[1]!.roles, [...OPTIONAL_ROLES]);
  });
});

describe("unpickedReady", () => {
  const issue = (number: number) => ({ number, title: `Issue ${number}` }) as unknown as SandcastleIssue;

  it("leaves out every pick that goes to the critique", () => {
    const ready = [issue(1), issue(2), issue(3)];

    const unpicked = unpickedReady(ready, [{ id: "1", title: "A" }, { id: "2", title: "B" }], []);

    assert.deepEqual(unpicked.map((entry) => entry.number), [3]);
  });

  // #428: the critique's dependency check is the safety net for a dependency
  // the planner missed, and a held issue is work still to come.
  it("passes an overlap-held issue as unpicked, with a note that it's held", () => {
    const ready = [issue(1), issue(2), issue(3)];

    // #2 was planned and held behind #1 by the overlap check; #3 was never picked.
    const unpicked = unpickedReady(ready, [{ id: "1", title: "A" }], [{ id: 2, behind: { kind: "issue", number: 1 }, file: "a.mts" }]);

    assert.deepEqual(unpicked.map((entry) => entry.number), [2, 3]);
    const [held, other] = unpicked;
    assert.match(String(held?.note), /held/i);
    assert.equal(other?.note, undefined, "an issue that isn't held carries no note");
  });

  it("says what a held issue shares and waits on when it shares a file", () => {
    const [held] = unpickedReady([issue(2)], [], [{ id: 2, behind: { kind: "pr", number: 90 }, file: "src/UI/Program.cs" }]);

    assert.match(String(held?.note), /src\/UI\/Program\.cs/);
    assert.match(String(held?.note), /pull request #90/);
  });

  it("doesn't claim a shared file for a held issue that named no files", () => {
    const [held] = unpickedReady([issue(2)], [], [{ id: 2, behind: { kind: "issue", number: 1 } }]);

    assert.match(String(held?.note), /names no files/);
    assert.match(String(held?.note), /pick #1/);
    assert.doesNotMatch(String(held?.note), /shares/);
  });

  it("never passes a kept pick as unpicked, even when it is also named as held", () => {
    const unpicked = unpickedReady([issue(1), issue(2)], [{ id: "1", title: "A" }], [{ id: 1, behind: { kind: "issue", number: 1 } }]);

    assert.deepEqual(unpicked.map((entry) => entry.number), [2]);
  });
});
