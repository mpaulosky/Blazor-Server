import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SANDBOX_SKILLS } from "./skills.mts";

const sandcastleFile = (path: string) => new URL(`../${path}`, import.meta.url);
const read = (path: string) => readFileSync(sandcastleFile(path), "utf8");

describe("developer role prompts", () => {
  it("retires implement-prompt.md", () => {
    assert.equal(existsSync(sandcastleFile("implement-prompt.md")), false);
  });

  for (const role of ["tester", "backend"]) {
    it(`gives the ${role} the shared rules`, () => {
      assert.match(read(`roles/${role}.md`), /\{\{SHARED_RULES\}\}/);
    });

    it(`lists every skill mounted into the sandbox for the ${role}`, () => {
      const prompt = read(`roles/${role}.md`);

      for (const skill of SANDBOX_SKILLS) {
        assert.match(prompt, new RegExp(`^- \`${skill}\`:`, "m"));
      }
    });
  }
});

describe("review prompt", () => {
  // Match key terms anywhere in the review process, so rewording a check
  // doesn't break these tests but dropping it does.
  const reviewProcess = () => {
    const prompt = read("review-prompt.md");
    const start = prompt.indexOf("# REVIEW PROCESS");
    assert.notEqual(start, -1, "review-prompt.md has no REVIEW PROCESS section");
    const end = prompt.indexOf("\n# ", start + 1);
    return prompt.slice(start, end === -1 ? undefined : end);
  };

  it("checks that the acceptance tests cover every acceptance criterion", () => {
    assert.match(reviewProcess(), /acceptance tests[\s\S]*every acceptance criterion/i);
  });

  it("checks that the developers didn't weaken the acceptance tests", () => {
    assert.match(reviewProcess(), /weaken/i);
  });
});
