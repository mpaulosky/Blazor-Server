import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const skillFile = (path: string) => new URL(`../../.claude/skills/code-review/${path}`, import.meta.url);
const read = (path: string) => readFileSync(skillFile(path), "utf8");

describe("code-review skill: Sandcastle role prompt consistency", () => {
  // Match key terms anywhere in the "What to check" section, so rewording a
  // check doesn't break these tests but dropping it does.
  const whatToCheck = () => {
    const skill = read("SKILL.md");
    const start = skill.indexOf("## What to check");
    assert.notEqual(start, -1, "SKILL.md has no 'What to check' section");
    const end = skill.indexOf("\n## ", start + 1);
    return skill.slice(start, end === -1 ? undefined : end);
  };

  // Only look at paragraphs this skill already scopes to .sandcastle/, so a
  // requirement phrased elsewhere in the file (about an unrelated check)
  // can't make these tests pass on its own.
  const sandcastlePromptChecks = () => {
    const paragraphs = whatToCheck()
      .split(/\n\n+/)
      .filter((paragraph) => /\.sandcastle\//.test(paragraph));
    assert.notEqual(paragraphs.length, 0, "no check in SKILL.md is scoped to .sandcastle/");
    return paragraphs.join("\n\n");
  };

  it("requires every case a .sandcastle/ role prompt allows to end in a reachable <promise>COMPLETE</promise>", () => {
    assert.match(sandcastlePromptChecks(), /reachable[\s\S]*<promise>COMPLETE<\/promise>/i);
  });

  it("requires that no instruction in a .sandcastle/ role prompt contradicts an exemption stated elsewhere, including in another role's prompt", () => {
    assert.match(sandcastlePromptChecks(), /contradict[\s\S]*exemption/i);
    assert.match(sandcastlePromptChecks(), /another role/i);
  });
});
