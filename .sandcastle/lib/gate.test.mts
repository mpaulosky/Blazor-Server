import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bodyBlockers, openPrReason, unfinishedReason, type Blocker } from "./gate.mts";

describe("bodyBlockers", () => {
  it("reads issue numbers from lines that start with Blocked by or Depends on", () => {
    const body = "## Summary\n\nBlocked by #65\nDepends on #12, #13\n";

    assert.deepEqual(bodyBlockers(body), [65, 12, 13]);
  });

  it("accepts list markers, bold and a colon before the numbers", () => {
    const body = "- **Blocked by:** #7\n  * depends on #8";

    assert.deepEqual(bodyBlockers(body), [7, 8]);
  });

  it("ignores issue numbers mentioned in prose", () => {
    const body = "This reuses the generator from #22, which is blocked by #30 upstream.";

    assert.deepEqual(bodyBlockers(body), []);
  });

  it("ignores references to other repositories", () => {
    const body = "Blocked by other/repo#4";

    assert.deepEqual(bodyBlockers(body), []);
  });
});

describe("unfinishedReason", () => {
  const blocker = (fields: Partial<Blocker>): Blocker => ({
    number: 5,
    state: "closed",
    state_reason: null,
    merged_at: null,
    is_pr: false,
    ...fields,
  });

  it("blocks while the blocker is open", () => {
    assert.equal(unfinishedReason(blocker({ state: "open" })), "#5 is still open");
  });

  it("clears a merged pull request", () => {
    assert.equal(unfinishedReason(blocker({ is_pr: true, merged_at: "2026-09-25T00:00:00Z" })), undefined);
  });

  it("blocks on a pull request closed without merging", () => {
    assert.equal(unfinishedReason(blocker({ is_pr: true })), "#5 was closed without merging");
  });

  it("clears an issue closed as completed", () => {
    assert.equal(unfinishedReason(blocker({ state_reason: "completed" })), undefined);
  });

  it("blocks on an issue closed as not planned", () => {
    assert.equal(
      unfinishedReason(blocker({ state_reason: "not_planned" })),
      "#5 was closed as not_planned, so its work never landed",
    );
  });
});

describe("openPrReason", () => {
  const prs = [
    { number: 90, headRefName: "feature/28-other-slug" },
    { number: 91, headRefName: "hotfix/7-fix-it" },
    { number: 92, headRefName: "chore/28-tidy" },
    { number: 93, headRefName: "feature/280-bigger" },
  ];

  it("names the open PR whose head is the issue's feature branch", () => {
    assert.equal(openPrReason(28, prs), "PR #90 (feature/28-other-slug) is already open for it");
  });

  it("names the open PR whose head is the issue's hotfix branch", () => {
    assert.equal(openPrReason(7, prs), "PR #91 (hotfix/7-fix-it) is already open for it");
  });

  it("ignores PRs from other branch kinds and issues whose numbers share a prefix", () => {
    assert.equal(openPrReason(2, prs), undefined);
    assert.equal(openPrReason(8, [{ number: 92, headRefName: "chore/8-tidy" }]), undefined);
  });
});
