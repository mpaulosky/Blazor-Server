import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SubIssue } from "./github.mts";
import { closeFinishedUmbrellas, type UmbrellaGitHub } from "./umbrella.mts";

const child = (number: number, state: "open" | "closed", stateReason: string | null = null): SubIssue => ({
  number,
  state,
  state_reason: stateReason,
});

// An UmbrellaGitHub stub serving each umbrella number's children from
// `umbrellas`, and recording every umbrella it's asked to close.
function stubGithub(umbrellas: Record<number, SubIssue[]>) {
  const closed: number[] = [];
  const github: UmbrellaGitHub = {
    openUmbrellas: () => Object.keys(umbrellas).map(Number),
    subIssues: (parent) => umbrellas[parent] ?? [],
    closeCompleted: (number) => {
      closed.push(number);
    },
  };
  return { github, closed };
}

describe("closeFinishedUmbrellas", () => {
  it("closes an umbrella as completed once every child has closed as completed", () => {
    const { github, closed } = stubGithub({
      10: [child(11, "closed", "completed"), child(12, "closed", "completed")],
    });

    const result = closeFinishedUmbrellas(github, () => {});

    assert.deepEqual(closed, [10]);
    assert.deepEqual(result, [10]);
  });

  it("leaves an umbrella open while a child is still open", () => {
    const { github, closed } = stubGithub({
      10: [child(11, "closed", "completed"), child(12, "open")],
    });

    const result = closeFinishedUmbrellas(github, () => {});

    assert.deepEqual(closed, []);
    assert.deepEqual(result, []);
  });

  it("leaves an umbrella open while a child closed as not planned", () => {
    const { github, closed } = stubGithub({
      10: [child(11, "closed", "completed"), child(12, "closed", "not_planned")],
    });

    const result = closeFinishedUmbrellas(github, () => {});

    assert.deepEqual(closed, []);
    assert.deepEqual(result, []);
  });

  // [].every(...) is vacuously true, so an umbrella with no children yet
  // (created but not yet linked, or read mid-split) must be checked for
  // explicitly rather than closed by accident.
  it("doesn't close an umbrella that has no children yet", () => {
    const { github, closed } = stubGithub({ 10: [] });

    const result = closeFinishedUmbrellas(github, () => {});

    assert.deepEqual(closed, [], "an umbrella with no children shouldn't close vacuously");
    assert.deepEqual(result, []);
  });

  it("closes several finished umbrellas in one round and leaves the unfinished ones open", () => {
    const { github, closed } = stubGithub({
      10: [child(11, "closed", "completed")],
      20: [child(21, "open")],
      30: [child(31, "closed", "completed"), child(32, "closed", "completed")],
    });

    const result = closeFinishedUmbrellas(github, () => {});

    assert.deepEqual([...closed].sort(), [10, 30]);
    assert.deepEqual([...result].sort(), [10, 30]);
  });

  it("logs why an umbrella stays open, naming the child that's still open", () => {
    const { github } = stubGithub({ 10: [child(11, "open")] });
    const lines: string[] = [];

    closeFinishedUmbrellas(github, (line) => lines.push(line));

    assert.ok(lines.some((line) => line.includes("#10") && line.includes("#11")), lines.join("\n"));
  });

  it("still closes the other finished umbrellas when one umbrella's children can't be read", () => {
    const { github, closed } = stubGithub({
      10: [child(11, "closed", "completed")],
      30: [child(31, "closed", "completed")],
    });
    const subIssues = github.subIssues;
    github.subIssues = (parent) => {
      if (parent === 10) throw new Error("HTTP 502");
      return subIssues(parent);
    };
    const lines: string[] = [];

    const result = closeFinishedUmbrellas(github, (line) => lines.push(line));

    assert.deepEqual(closed, [30]);
    assert.deepEqual(result, [30]);
    assert.ok(lines.some((line) => line.includes("#10") && line.includes("HTTP 502")), lines.join("\n"));
  });
});
