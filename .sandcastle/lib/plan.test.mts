import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readyPicks } from "./plan.mts";

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
});
