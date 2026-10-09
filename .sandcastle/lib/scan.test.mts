import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { addedLines, publishedText } from "./scan.mts";
import { hostGitInvocation, runHostGit } from "./shell.mts";

describe("addedLines", () => {
  it("keeps the lines a commit adds, without file headers or removed lines", () => {
    const patch = ["diff --git a/x b/x", "--- a/x", "+++ b/x", "@@ -1 +1 @@", "-old", "+new"].join("\n");

    assert.deepEqual(addedLines(patch), ["new"]);
  });

  it("keeps the lines a merge's combined diff adds in either column", () => {
    const patch = ["diff --cc x", "--- a/x", "+++ b/x", "@@@ -1,1 -1,1 +1,1 @@@", "++both", "+ first", " +second", "- gone"].join("\n");

    assert.deepEqual(addedLines(patch), ["both", "first", "second"]);
  });

  it("keeps an added line whose content looks like a file header", () => {
    const patch = ["diff --git a/x.patch b/x.patch", "--- /dev/null", "+++ b/x.patch", "@@ -0,0 +1,2 @@", "+++ token", "+--- a/y"].join("\n");

    assert.deepEqual(addedLines(patch), ["++ token", "--- a/y"]);
  });

  it("keeps a merge's added line whose content starts with \"+ \"", () => {
    const patch = ["diff --cc x", "+++ b/x", "@@@ -1,1 -1,1 +1,1 @@@", "+++ token"].join("\n");

    assert.deepEqual(addedLines(patch), ["+ token"]);
  });

  it("reads each file's hunks, and ignores what's between them", () => {
    const patch = [
      "diff --git a/x b/x", "index 1..2 100644", "--- a/x", "+++ b/x", "@@ -1 +1 @@", "-a", "+b",
      "\\ No newline at end of file",
      "diff --git a/y b/y", "new file mode 100644", "--- /dev/null", "+++ b/y", "@@ -0,0 +1 @@", "+c",
    ].join("\n");

    assert.deepEqual(addedLines(patch), ["b", "c"]);
  });
});

describe("publishedText", () => {
  // A repository with a commit `base`, and `leak` on top of it adding a file
  // whose path, content, message and author each hold a marker.
  const setup = () => {
    const repo = realpathSync(mkdtempSync(join(tmpdir(), "sandcastle-scan-")));
    const raw = (...args: string[]) =>
      execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
        cwd: repo,
        encoding: "utf8",
        stdio: "pipe",
        env: { ...process.env, GIT_AUTHOR_NAME: "author-marker", GIT_AUTHOR_EMAIL: "a@x", GIT_COMMITTER_NAME: "c", GIT_COMMITTER_EMAIL: "c@x" },
      }).trim();
    raw("init", "--quiet");
    raw("commit", "--quiet", "--allow-empty", "-m", "base");
    const base = raw("rev-parse", "HEAD");
    writeFileSync(join(repo, "path-marker.txt"), "content-marker\n");
    raw("add", ".");
    raw("commit", "--quiet", "-m", "message-marker");
    const leak = raw("rev-parse", "HEAD");
    const hostGit = (...args: string[]) => runHostGit(repo, hostGitInvocation(repo, join(repo, ".git"), args));
    return { repo, raw, base, leak, hostGit };
  };

  it("reads each commit's message, author, paths and added lines", () => {
    const { repo, base, leak, hostGit } = setup();
    try {
      const text = publishedText(base, leak, hostGit);
      for (const marker of ["message-marker", "author-marker", "path-marker.txt", "content-marker"]) {
        assert.ok(text.includes(marker), marker);
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("reads the commit git push sends, whatever a planted replace ref says", () => {
    const { repo, raw, base, leak, hostGit } = setup();
    try {
      // What an agent could plant: show a clean commit in place of the leak.
      raw("replace", leak, raw("commit-tree", `${base}^{tree}`, "-p", base, "-m", "clean"));
      // The control: git log follows the replacement by default.
      assert.ok(!raw("log", "--format=%B", "-1", leak).includes("message-marker"));

      assert.ok(publishedText(base, leak, hostGit).includes("content-marker"));
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it("reads the commit's real parents, whatever a planted grafts file says", () => {
    const { repo, raw, base, leak, hostGit } = setup();
    try {
      // What an agent could plant: make the leak look like an ancestor of base,
      // which empties base..leak.
      writeFileSync(join(repo, ".git", "info", "grafts"), `${base} ${leak}\n`);
      // The control: git log honours the grafts file by default.
      assert.equal(raw("log", "--format=%H", `${base}..${leak}`), "");

      assert.ok(publishedText(base, leak, hostGit).includes("content-marker"));
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
