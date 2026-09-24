---
post_title: "chore(hooks): Fix pre-push test command, npm package name, and review prompt"
author1: mpaulosky
post_slug: "v0.0.19-pr-9"
microsoft_alias: n/a
featured_image: ""
categories:
  - engineering
tags:
  - release:v0.0.19
  - automation
ai_note: "Backfilled for issue #21 from the PR title/body in the release automation format"
summary: "Release notes seed for v0.0.19 from PR #9."
post_date: "2026-09-24"
---
## chore(hooks): Fix pre-push test command, npm package name, and review prompt

- **Release tag:** `v0.0.19`
- **Source PR:** [#9](https://github.com/mpaulosky/Blazor-Server/pull/9)

### PR description

## Summary

Three fixes found during the first Sandcastle run on #5.

- **`.github/hooks/pre-push`:** under Microsoft.Testing.Platform, `dotnet test` rejects the VSTest-only `--nologo` flag with exit code 5. Every project's first test run failed, and the hook quietly fell back to running the built test assembly. This drops `--nologo` and passes the project with `--project`.
- **`package.json`:** adds `"name": "blazor-server"` and `"private": true`. Without a name, npm takes it from the directory, so Sandcastle's `npm install`, which runs in a container where the repo is mounted at `/home/agent/workspace`, rewrote `package-lock.json` to `"name": "workspace"` on every run.
- **`.sandcastle/review-prompt.md`:** Sandcastle treats `` !` `` in a prompt file as the start of a shell command. The phrase `` `null!` `` (added in #8) sent the rest of the prompt through `sh`, which crashed every reviewer run before the branch could be pushed or a PR opened. The prompt now describes null-forgiving operators in words.

## Testing

- Bisected the flags against a throwaway xUnit v3 project: only `--nologo` gives exit code 5. The hook's updated test loop then passed (1 test) with no fallback.
- `npm install --package-lock-only` updated the lockfile's name to `blazor-server`.
- The only `` !` `` sequences left in the prompts are the intended shell expansions. markdownlint passes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

