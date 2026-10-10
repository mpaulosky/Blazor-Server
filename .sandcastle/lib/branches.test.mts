import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { branchFor, discardClosedWork, isIssueBranch, parseHeads, prepareBranches, slugFor, type BranchRefs } from "./branches.mts";

// The branch standard, from the script the pre-push hook and CI's Branch name check share.
const checkBranchName = fileURLToPath(new URL("../../scripts/check-branch-name.sh", import.meta.url));
const passesBranchStandard = (branch: string) => {
  try {
    execFileSync("bash", [checkBranchName, branch], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

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

describe("isIssueBranch", () => {
  it("matches the issue's feature, fix and hotfix branches, not another issue's", () => {
    assert.ok(isIssueBranch("feature/4-add-search", 4));
    assert.ok(isIssueBranch("fix/4-stop-the-crash", 4));
    assert.ok(isIssueBranch("hotfix/4-stop-the-crash", 4));
    assert.ok(!isIssueBranch("feature/42-add-search", 4));
    assert.ok(!isIssueBranch("fix/42-stop-the-crash", 4));
    assert.ok(!isIssueBranch("chore/4-add-search", 4));
  });

  it("matches only a name the branch standard allows, since the name reaches a shell in the sandbox", () => {
    for (const branch of [
      "feature/4-",
      "feature/4-Add-Search",
      "feature/4-add--search",
      "feature/4-add-search-",
      "feature/4-add_search",
      "feature/4-$(touch-x)",
      "feature/4-add;rm",
      "feature/4-add`id`",
      "feature/4-add search",
      "feature/4-add-search/more",
      "xfeature/4-add-search",
    ]) {
      assert.ok(!isIssueBranch(branch, 4), branch);
      assert.ok(!passesBranchStandard(branch), branch);
    }
  });
});

describe("branchFor", () => {
  it("names an issue without the bug label feature/{n}-{slug}", () => {
    const branch = branchFor(issue(28, "feat(sandcastle): Hold back issues whose blockers haven't landed"), []);

    assert.equal(branch, "feature/28-hold-back-issues-whose-blockers-havent-landed");
  });

  it("names an issue with the bug label fix/{n}-{slug}", () => {
    const branch = branchFor(issue(7, "fix(ci): Merge PRs again", ["Sandcastle", "bug"]), []);

    assert.equal(branch, "fix/7-merge-prs-again");
  });

  it("reuses the issue's existing remote branch, even under another slug", () => {
    const branch = branchFor(issue(28, "Hold back issues"), ["feature/2-other", "feature/28-other-slug", "fix/280-x", "hotfix/280-y"]);

    assert.equal(branch, "feature/28-other-slug");
  });

  it("reuses an existing fix branch even when the issue has lost its bug label", () => {
    assert.equal(branchFor(issue(9, "Fix it"), ["fix/9-fix-the-thing"]), "fix/9-fix-the-thing");
  });

  it("reuses an existing hotfix branch rather than starting a fix branch", () => {
    assert.equal(branchFor(issue(9, "Fix it", ["bug"]), ["hotfix/9-fix-the-thing"]), "hotfix/9-fix-the-thing");
  });

  it("doesn't reuse a remote branch whose name the branch standard refuses", () => {
    const branch = branchFor(issue(4, "Add search"), ["feature/4-$(touch-x)", "fix/4-Add-Search"]);

    assert.equal(branch, "feature/4-add-search");
  });

  it("ignores remote branches for other issues whose numbers share a prefix", () => {
    assert.equal(branchFor(issue(2, "Add a thing"), ["feature/28-other", "feature/2x-odd"]), "feature/2-add-a-thing");
  });

  it("generates names scripts/check-branch-name.sh accepts", () => {
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
        assert.ok(passesBranchStandard(branch), `${JSON.stringify(title)} gave ${branch}, which fails the branch standard`);
      }
    }
  });
});

describe("parseHeads", () => {
  it("reads branch names from git ls-remote --heads output", () => {
    const output = "abc123\trefs/heads/feature/66-split-main\ndef456\trefs/heads/fix/9-fix-it\n";

    assert.deepEqual(parseHeads(output), ["feature/66-split-main", "fix/9-fix-it"]);
  });

  it("returns nothing for empty output", () => {
    assert.deepEqual(parseHeads(""), []);
  });
});

// A BranchRefs stub for discardClosedWork (#77). Each ref's current commit
// (local, tracking, and origin's real branch) and whether it contains
// closedHead are configurable independently, and every call is recorded in
// `calls` so a test can check the order of operations.
function stubRefs(
  branch: string,
  closedHead: string,
  base: string,
  {
    baseContainsClosedHead = false,
    localCommit = "1".repeat(40),
    trackingCommit = "2".repeat(40),
    remoteCommit = "3".repeat(40),
    localExists = true,
    trackingExists = true,
    remoteExists = true,
    localContainsClosedHead = true,
    trackingContainsClosedHead = true,
    remoteContainsClosedHead = true,
    failDeleteLocalBranch,
  }: {
    baseContainsClosedHead?: boolean;
    localCommit?: string;
    trackingCommit?: string;
    remoteCommit?: string;
    localExists?: boolean;
    trackingExists?: boolean;
    remoteExists?: boolean;
    localContainsClosedHead?: boolean;
    trackingContainsClosedHead?: boolean;
    remoteContainsClosedHead?: boolean;
    failDeleteLocalBranch?: Error;
  } = {},
) {
  const localRef = `refs/heads/${branch}`;
  const trackingRef = `refs/remotes/origin/${branch}`;
  const calls: string[] = [];
  const refs: BranchRefs = {
    remoteHead: (b) => {
      calls.push(`remoteHead ${b}`);
      return remoteExists ? remoteCommit : undefined;
    },
    localHead: (ref) => {
      calls.push(`localHead ${ref}`);
      if (ref === localRef) return localExists ? localCommit : undefined;
      if (ref === trackingRef) return trackingExists ? trackingCommit : undefined;
      return undefined;
    },
    contains: (commit, ancestor) => {
      calls.push(`contains ${commit} ${ancestor}`);
      if (ancestor !== closedHead) return false;
      if (commit === base) return baseContainsClosedHead;
      if (commit === localCommit) return localContainsClosedHead;
      if (commit === trackingCommit) return trackingContainsClosedHead;
      if (commit === remoteCommit) return remoteContainsClosedHead;
      return false;
    },
    deleteLocalBranch: (b) => {
      calls.push(`deleteLocalBranch ${b}`);
      if (failDeleteLocalBranch) throw failDeleteLocalBranch;
    },
    deleteRef: (ref) => void calls.push(`deleteRef ${ref}`),
    deleteRemote: (b, sha) => void calls.push(`deleteRemote ${b} ${sha}`),
  };
  return { refs, calls };
}

describe("discardClosedWork", () => {
  const branch = "feature/42-add-search";
  const closedHead = "c".repeat(40);
  const base = "m".repeat(40);

  it("deletes the local branch, the tracking ref and origin's branch (with the lease SHA), in that order, when each contains the closed head", () => {
    const { refs, calls } = stubRefs(branch, closedHead, base);

    const deleted = discardClosedWork(branch, closedHead, base, refs);

    assert.deepEqual(calls.filter((call) => call.startsWith("delete")), [
      `deleteLocalBranch ${branch}`,
      `deleteRef refs/remotes/origin/${branch}`,
      `deleteRemote ${branch} ${"3".repeat(40)}`,
    ]);
    assert.deepEqual(deleted, [`refs/heads/${branch}`, `refs/remotes/origin/${branch}`, `origin/${branch}`]);
  });

  it("keeps a local branch that doesn't contain the closed head, because a fresh attempt's commits start from main", () => {
    const { refs, calls } = stubRefs(branch, closedHead, base, { localContainsClosedHead: false });

    const deleted = discardClosedWork(branch, closedHead, base, refs);

    assert.ok(!calls.some((call) => call.startsWith("deleteLocalBranch")));
    assert.ok(!deleted.includes(`refs/heads/${branch}`));
  });

  it("does nothing when base already contains the closed head", () => {
    const { refs, calls } = stubRefs(branch, closedHead, base, { baseContainsClosedHead: true });

    const deleted = discardClosedWork(branch, closedHead, base, refs);

    assert.deepEqual(deleted, []);
    assert.ok(!calls.some((call) => call.startsWith("delete")));
  });

  it("rethrows when deleteLocalBranch fails, without deleting origin's branch", () => {
    const failure = new Error("git branch -D failed: worktree in use");
    const { refs, calls } = stubRefs(branch, closedHead, base, { failDeleteLocalBranch: failure });

    assert.throws(() => discardClosedWork(branch, closedHead, base, refs), /worktree in use/);
    assert.ok(!calls.some((call) => call.startsWith("deleteRemote")));
  });
});

describe("prepareBranches", () => {
  it("names every issue's branch and fetches only the ones that exist on origin", () => {
    const fetched: string[] = [];
    const git = { issueBranches: () => ["feature/7-old-title"], fetch: (branch: string) => void fetched.push(branch) };

    const work = prepareBranches([issue(7, "feat: New title"), issue(8, "fix: Something", ["bug"])], git);

    assert.deepEqual(work.map((w) => w.branch), ["feature/7-old-title", "fix/8-something"]);
    assert.deepEqual(fetched, ["feature/7-old-title"]);
  });
});
