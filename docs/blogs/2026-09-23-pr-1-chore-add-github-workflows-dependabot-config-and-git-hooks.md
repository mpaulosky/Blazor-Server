---
post_title: "chore: add GitHub workflows, Dependabot config, and git hooks"
author1: mpaulosky
post_slug: "v0.0.5-pr-1"
microsoft_alias: n/a
featured_image: ""
categories:
  - engineering
tags:
  - release:v0.0.5
  - automation
ai_note: "Backfilled for issue #21 from the PR title/body in the release automation format"
summary: "Release notes seed for v0.0.5 from PR #1."
post_date: "2026-09-23"
---
## chore: add GitHub workflows, Dependabot config, and git hooks

- **Release tag:** `v0.0.5`
- **Source PR:** [#1](https://github.com/mpaulosky/Blazor-Server/pull/1)

### PR description

## Summary

Sets up CI and automation for the repo before any projects exist. The Blazor Server app and its test projects will be added later. This PR also fixes workflow bugs found in review, so that none of them fail or silently do nothing on an empty repo.

### Fixes to the imported workflows
- **ci.yml / pre-push hook:** skip the test step with a warning while `tests/` has no projects, instead of failing every PR and push. Playwright diagnostics now upload from each test project's own folder, and they upload when tests fail as well.
- **release.yml:** `git add` failed on the missing `docs/index.html`, and `continue-on-error` hid it, so the release-notes PR was never opened. The step now stages only files that exist and detects untracked new files.
- **sync-readme.yml:** skips when there is no root `README.md`, and detects a newly created `docs/README.md`. `git diff` ignores untracked files, so the first sync used to do nothing.
- **dependabot-auto-merge.yml:** now requires base `main`. It required `dev`, so it never ran.
- **dependabot.yml:** nuget and dotnet-sdk now scan the repo root. The old path `/nuget/helpers/lib/NuGetUpdater` was copied from dependabot-core. Also dropped the deprecated `reviewers` key, and each ecosystem now has its own group.
- **code-metrics.yml:** fixed an `if:` that was always true, and switched to `paths-ignore`. A paths filter made only of negations is invalid.

### Removed
`promote.yml`, `branch-worktree-cleanup.yml` and `add-issues-to-project.yml`. They depend on `dev`/`preview` branches, `package.json`, `CHANGELOG.md`, a cleanup script and another repo's project board, and this repo has none of these.

### Known follow-ups (not changed here)
- **pr-automerge.yml:** only tries to enable auto-merge when `mergeStateStatus == CLEAN`, and GitHub usually rejects that ("Pull request is in clean status"). This PR's own run should confirm it either way.
- **release.yml:** GitVersion in Mainline mode already returns the next version, and the workflow then bumps it again. This may skip a version on every release.
- **pr-auto-label.yml:** hard-codes `squad:boromir`. **ci.yml:** sets secrets for an `Author` test user that CONTEXT.md does not define.

## Validation
- YAML lint (`.yamllint.yml`) on all of `.github/`: clean
- `markdownlint-cli2` on `.github/agents/beast.agent.md`: 0 issues
- `dotnet build Blazor-Server.slnx`: 0 warnings, 0 errors (the solution is empty)
- `pre-push` hook passed: YAML lint, Markdown lint, and the test step skipped with a warning because there are no test projects

🤖 Generated with [Claude Code](https://claude.com/claude-code)

