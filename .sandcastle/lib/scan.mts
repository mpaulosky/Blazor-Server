// What a push of an issue branch would publish, for the secret scan: every
// commit's message, author and committer, the paths it touches, and every line
// it adds. Removed lines and context aren't scanned: each was added by an
// earlier commit, already on main or in this range, so scanning them would only
// stop branches for tokens main holds on purpose (a test's fake token).
//
// git runs with replace refs and grafts off (see hostGitInvocation), so the
// scan reads the same commits git push sends, whatever an agent planted.

import { git } from "./shell.mts";

// The added lines of `git log -p --cc -U0` output. A hunk starts at its "@@"
// header, which has one "@" more than the commit has parents being compared:
// "@@" for an ordinary commit, "@@@" for a merge of two. Each hunk line starts
// with one marker column per parent; a line in the result that some parent
// didn't have is marked "+" in that column, and a line marked "-" anywhere
// isn't in the result. A hunk ends at the first line that isn't a hunk line,
// such as the next file's "diff" header. Only hunk lines count, so a file
// header ("+++ b/path") is never taken for content, nor content for a header.
export function addedLines(patch: string): string[] {
  const added: string[] = [];
  let columns = 0;
  for (const line of patch.split("\n")) {
    const hunk = /^(@{2,}) /.exec(line);
    if (hunk) {
      columns = hunk[1]!.length - 1;
      continue;
    }
    if (columns === 0) continue;
    const markers = line.slice(0, columns);
    if (markers.length < columns || /[^ +\-]/.test(markers)) {
      // "\ No newline at end of file" belongs to the hunk; anything else ends it.
      if (!line.startsWith("\\")) columns = 0;
      continue;
    }
    if (markers.includes("+") && !markers.includes("-")) added.push(line.slice(columns));
  }
  return added;
}

// What the commits from `base` to `commit` publish, read in the main checkout.
// --cc reads merge commits too, so content written while resolving a merge, or
// amended into one, is scanned; without it git log shows merges with no diff.
export function publishedText(base: string, commit: string, run: (...args: string[]) => string = git): string {
  const range = `${base}..${commit}`;
  const commits = run("log", "--format=%an <%ae>%n%cn <%ce>%n%B", range);
  const paths = run("log", "--format=", "--name-only", "--cc", "--no-renames", range);
  const patch = run("log", "--format=", "-p", "--cc", "-U0", "--no-ext-diff", "--no-textconv", "--text", range);
  return [commits, paths, ...addedLines(patch)].join("\n");
}
