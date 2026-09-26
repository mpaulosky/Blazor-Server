import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { branchFor, parseHeads, prepareBranches, slugFor } from "./branches.mts";

// The pre-push hook's rule for issue branches (.github/hooks/pre-push).
const prePushBranch = /^(feature|hotfix)\/[0-9]+-[a-z0-9]+(-[a-z0-9]+)*$/;

const issue = (number: number, title: string, labels: string[] = ["Sandcastle"]) => ({ number, title, labels });

describe("slugFor", () => {
  it("drops the conventional-commit prefix, lower-cases and joins words with hyphens", () => {
    assert.equal(
      slugFor("feat(sandcastle): Hold back issues whose blockers haven't landed"),
      "hold-back-issues-whose-blockers-havent-landed",
    );
  });

  it("drops prefixes without a scope or with a breaking-change mark", () => {
    assert.equal(slugFor("fix: Stop the crash"), "stop-the-crash");
    assert.equal(slugFor("refactor(Domain)!: Rename Result"), "rename-result");
  });

  it("drops curly apostrophes too", () => {
    assert.equal(slugFor("Don’t reuse the cache"), "dont-reuse-the-cache");
  });

  it("joins every run of other characters into one hyphen and trims the ends", () => {
    assert.equal(slugFor("  Add  C# / .NET 10 support!  "), "add-c-net-10-support");
  });

  it("cuts a long title to at most 50 characters at a hyphen", () => {
    const slug = slugFor("feat(sandcastle): The host names branches and skips issues that already have a PR");

    assert.equal(slug, "the-host-names-branches-and-skips-issues-that");
    assert.ok(slug.length <= 50);
  });

  it("keeps a title of exactly 50 characters whole", () => {
    const title = "a".repeat(24) + " " + "b".repeat(25);

    assert.equal(slugFor(title), "a".repeat(24) + "-" + "b".repeat(25));
  });

  it("cuts a single word longer than 50 characters at 50", () => {
    assert.equal(slugFor("x".repeat(60)), "x".repeat(50));
  });

  it("falls back to 'issue' when the title has no ASCII letters or digits", () => {
    assert.equal(slugFor("feat: ✨"), "issue");
  });
});

describe("branchFor", () => {
  it("names an issue without the bug label feature/{n}-{slug}", () => {
    const branch = branchFor(issue(28, "feat(sandcastle): Hold back issues whose blockers haven't landed"), []);

    assert.equal(branch, "feature/28-hold-back-issues-whose-blockers-havent-landed");
  });

  it("names an issue with the bug label hotfix/{n}-{slug}", () => {
    const branch = branchFor(issue(7, "fix(ci): Merge PRs again", ["Sandcastle", "bug"]), []);

    assert.equal(branch, "hotfix/7-merge-prs-again");
  });

  it("reuses the issue's existing remote branch, even under another slug", () => {
    const branch = branchFor(issue(28, "Hold back issues"), ["feature/2-other", "feature/28-other-slug", "hotfix/280-x"]);

    assert.equal(branch, "feature/28-other-slug");
  });

  it("reuses an existing hotfix branch even when the issue has lost its bug label", () => {
    assert.equal(branchFor(issue(9, "Fix it"), ["hotfix/9-fix-the-thing"]), "hotfix/9-fix-the-thing");
  });

  it("ignores remote branches for other issues whose numbers share a prefix", () => {
    assert.equal(branchFor(issue(2, "Add a thing"), ["feature/28-other", "feature/2x-odd"]), "feature/2-add-a-thing");
  });

  it("generates names the pre-push hook accepts", () => {
    const titles = [
      "feat(sandcastle): Hold back issues whose blockers haven't landed",
      "fix: Don’t crash on an empty body!",
      "  Add  C# / .NET 10 support  ",
      "x".repeat(80),
      "feat: ✨",
      "docs(adr)!: Record ADR 0002 — hosted runner, PAT without Workflows",
    ];
    for (const title of titles) {
      for (const labels of [[], ["bug"]]) {
        const branch = branchFor(issue(42, title, labels), []);
        assert.match(branch, prePushBranch, `${JSON.stringify(title)} gave ${branch}`);
      }
    }
  });
});

describe("parseHeads", () => {
  it("reads branch names from git ls-remote --heads output", () => {
    const output = "abc123\trefs/heads/feature/66-split-main\ndef456\trefs/heads/hotfix/9-fix-it\n";

    assert.deepEqual(parseHeads(output), ["feature/66-split-main", "hotfix/9-fix-it"]);
  });

  it("returns nothing for empty output", () => {
    assert.deepEqual(parseHeads(""), []);
  });
});

describe("prepareBranches", () => {
  it("names every issue's branch and fetches only the ones that exist on origin", () => {
    const fetched: string[] = [];
    const git = { issueBranches: () => ["feature/7-old-title"], fetch: (branch: string) => void fetched.push(branch) };

    const work = prepareBranches([issue(7, "feat: New title"), issue(8, "fix: Something", ["bug"])], git);

    assert.deepEqual(work.map((w) => w.branch), ["feature/7-old-title", "hotfix/8-something"]);
    assert.deepEqual(fetched, ["feature/7-old-title"]);
  });
});
