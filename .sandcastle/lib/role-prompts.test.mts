import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

  it("diffs the branch against {{BASE_BRANCH}}", () => {
    const prompt = read("review-prompt.md");

    assert.match(prompt, /git diff \{\{BASE_BRANCH\}\}\.\.\.\{\{BRANCH\}\}/);
    assert.match(prompt, /git log \{\{BASE_BRANCH\}\}\.\.\{\{BRANCH\}\}/);
  });
});

describe("every prompt", () => {
  // Inside createSandbox(), Sandcastle sets {{TARGET_BRANCH}} to the sandbox's
  // own branch, so a diff against it is always empty. Use {{BASE_BRANCH}}.
  const prompts = [
    ...readdirSync(sandcastleFile("")).filter((name) => name.endsWith(".md")),
    ...readdirSync(sandcastleFile("roles/")).filter((name) => name.endsWith(".md")).map((name) => `roles/${name}`),
  ];

  for (const prompt of prompts) {
    it(`${prompt} doesn't use Sandcastle's TARGET_BRANCH`, () => {
      assert.doesNotMatch(read(prompt), /TARGET_BRANCH/);
    });
  }
});
