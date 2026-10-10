import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// Extracts the fenced ```bash ... ``` Commands block from CLAUDE.md.
const commandsBlock = () => {
  const claudeMd = read("CLAUDE.md");
  const start = claudeMd.indexOf("## Commands");
  assert.notEqual(start, -1, "CLAUDE.md has no Commands section");
  const fenceStart = claudeMd.indexOf("```bash", start);
  assert.notEqual(fenceStart, -1, "Commands section has no ```bash block");
  const fenceEnd = claudeMd.indexOf("```", fenceStart + "```bash".length);
  assert.notEqual(fenceEnd, -1, "Commands ```bash block is not closed");
  return claudeMd.slice(fenceStart, fenceEnd);
};

// Extracts the "// Usage:" note from main.mts's header comment.
const usageNote = () => {
  const mainMts = read(".sandcastle/main.mts");
  const start = mainMts.indexOf("// Usage:");
  assert.notEqual(start, -1, "main.mts header has no Usage note");
  const end = mainMts.indexOf("\nimport", start);
  return mainMts.slice(start, end === -1 ? undefined : end);
};

describe("package.json scripts", () => {
  it("adds a sandcastle script that starts a Sandcastle run", () => {
    const packageJson: { scripts?: Record<string, string> } = JSON.parse(read("package.json"));

    assert.equal(packageJson.scripts?.sandcastle, "tsx .sandcastle/main.mts");
  });
});

describe("CLAUDE.md Commands block", () => {
  it("lists pnpm run sandcastle alongside the other commands", () => {
    assert.match(commandsBlock(), /^pnpm run sandcastle(?=\s|$)/m);
  });
});

describe("main.mts header", () => {
  it("points the usage note at pnpm run sandcastle", () => {
    assert.match(usageNote(), /pnpm run sandcastle/);
  });
});

// main.mts runs at import, so its wiring is checked in its source: intake
// must run before the blocker gate, so a human's questions reach them even
// while a blocker is still in flight (#74).
describe("main.mts's intake wiring", () => {
  it("runs intake before the blocker gate", () => {
    const mainMts = read(".sandcastle/main.mts");
    const intakeCall = mainMts.indexOf("intakePhase(");
    const gateCall = mainMts.indexOf("gateIssues()");

    assert.notEqual(intakeCall, -1, "main.mts doesn't call intakePhase(");
    assert.notEqual(gateCall, -1, "main.mts doesn't call gateIssues()");
    assert.ok(intakeCall < gateCall, "main.mts doesn't run intake before the blocker gate");
  });

  // Without the open PRs, intake would judge, and might hand back, an issue
  // whose work is already waiting for review.
  it("passes intake the open pull requests", () => {
    const mainMts = read(".sandcastle/main.mts");
    const call = mainMts.slice(mainMts.indexOf("intakePhase("), mainMts.indexOf(";", mainMts.indexOf("intakePhase(")));

    assert.match(call, /openPullRequests\(\)/);
  });
});

// Each round closes the umbrellas whose children have all finished (#75).
// It runs before intake and the gate, so it runs even in a round that ends
// early with nothing ready.
describe("main.mts's umbrella wiring", () => {
  it("checks for finished umbrellas in each round, before intake", () => {
    const mainMts = read(".sandcastle/main.mts");
    const loop = mainMts.indexOf("for (let iteration");
    const umbrellaCall = mainMts.indexOf("umbrellaPhase(");
    const intakeCall = mainMts.indexOf("intakePhase(");

    assert.notEqual(umbrellaCall, -1, "main.mts doesn't call umbrellaPhase(");
    assert.ok(loop < umbrellaCall && umbrellaCall < intakeCall, "main.mts doesn't check umbrellas in each round, before intake");
  });
});
