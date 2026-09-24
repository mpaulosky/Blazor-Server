---
post_title: "fix(sandcastle): Publish work already on an issue branch"
author1: mpaulosky
post_slug: "v0.0.25-pr-12"
microsoft_alias: n/a
featured_image: ""
categories:
  - engineering
tags:
  - release:v0.0.25
  - automation
ai_note: "Backfilled for issue #21 from the PR title/body in the release automation format"
summary: "Release notes seed for v0.0.25 from PR #12."
post_date: "2026-09-24"
---
## fix(sandcastle): Publish work already on an issue branch

- **Release tag:** `v0.0.25`
- **Source PR:** [#12](https://github.com/mpaulosky/Blazor-Server/pull/12)

### PR description

## Summary

This fixes the Sandcastle loop that stranded issue #5's finished work, and cleans up two `.gitignore` entries.

**`.sandcastle/main.mts`**

- **Publish existing work.** Review and publish used to run only when the implementer made commits *in the current run*. Re-running a finished issue made none, so its earlier commits were never reviewed or pushed, no PR was opened, and the planner picked the issue again every iteration. Now the branch is reviewed and published whenever it's ahead of `origin/main`.
- **Survive a reviewer failure.** If the reviewer throws, as it did with the `` !` `` prompt bug fixed in #9, the branch is still pushed and the PR opened, with a note in the PR body that the agent review failed.
- **Stop an idle loop.** When a round opens no PR, the loop stops instead of re-planning the same issues for up to 10 rounds.

**`.gitignore`**

- Ignores `.tmp-test-results/`, where the pre-push hook writes its test results.
- Drops `.squad/`, which was left over from the squad workflows removed in #7.

## Testing

- `tsc --strict` on `main.mts`: no new errors. The implicit-`any` errors it shows also appear in the original file, because Sandcastle's types don't resolve outside its own setup.
- `.tmp-test-results/` is ignored after a push; `git status` is clean.
- The pre-push gate passed: 4 architecture and 29 unit tests, run directly with no fallback.
- I haven't done a real Sandcastle run with this change. The next issue run, ideally one that resumes an existing branch, is the real test.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

