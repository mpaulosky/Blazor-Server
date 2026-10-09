// What a push of an issue branch would publish, for the secret scan: every
// commit message, and every line the commits add. Removed lines and context
// aren't scanned: each was added by an earlier commit, already on main or in
// this range, so scanning them would only stop branches for tokens main holds
// on purpose (a test's fake token).

import { git } from "./shell.mts";

// The added lines of `git log -p --cc -U0` output. A commit with one parent
// marks an added line with "+"; a merge's dense combined diff has a column per
// parent, and marks a line in its result that no parent had with "+" in at
// least one column ("++", "+ ", " +"). File headers ("+++ b/path") are left out.
export function addedLines(patch: string): string[] {
  return patch
    .split("\n")
    .filter((line) => !line.startsWith("+++ ") && /^(\+|[ +]\+)/.test(line))
    .map((line) => line.replace(/^[ +]{1,2}/, ""));
}

// The commit messages and added lines from `base` to `commit`, read in the
// main checkout. --cc reads merge commits too, so content written while
// resolving a merge, or amended into one, is scanned; without it git log shows
// merges with no diff.
export function publishedText(base: string, commit: string): string {
  const range = `${base}..${commit}`;
  const messages = git("log", "--format=%B", range);
  const patch = git("log", "--format=", "-p", "--cc", "-U0", "--no-ext-diff", "--no-textconv", "--text", range);
  return [messages, ...addedLines(patch)].join("\n");
}
