import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

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

// Covers "`.sandcastle/work/` is gitignored" from issue #72: the architect's
// design note and other inter-role notes live there (lib/build.mts), and
// must never reach a commit. Checked with git itself, rather than by
// pattern-matching .sandcastle/.gitignore's text, since git's own matching
// rules (trailing slashes, anchoring) are what actually decide this.
describe(".sandcastle/.gitignore", () => {
  it("ignores .sandcastle/work/, the folder architect design notes and other inter-role files live in", () => {
    assert.doesNotThrow(
      () => execFileSync("git", ["check-ignore", "--quiet", ".sandcastle/work/72/design.md"], { cwd: repoRoot }),
      "expected git to ignore .sandcastle/work/72/design.md",
    );
  });
});
