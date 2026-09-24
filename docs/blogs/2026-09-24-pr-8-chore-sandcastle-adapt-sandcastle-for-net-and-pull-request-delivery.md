---
post_title: "chore(sandcastle): Adapt Sandcastle for .NET and pull-request delivery"
author1: mpaulosky
post_slug: "v0.0.17-pr-8"
microsoft_alias: n/a
featured_image: ""
categories:
  - engineering
tags:
  - release:v0.0.17
  - automation
ai_note: "Backfilled for issue #21 from the PR title/body in the release automation format"
summary: "Release notes seed for v0.0.17 from PR #8."
post_date: "2026-09-24"
---
## chore(sandcastle): Adapt Sandcastle for .NET and pull-request delivery

- **Release tag:** `v0.0.17`
- **Source PR:** [#8](https://github.com/mpaulosky/Blazor-Server/pull/8)

### PR description

## Summary

Sandcastle was still the stock JavaScript template. For a .NET repo that meant the agent had no SDK, ran `npm run test` (no such script), committed with a `RALPH:` prefix, and ended each run by merging into the host's checked-out branch and closing the issue with no PR. This PR makes it usable for issue #5 and later ones.

**Sandbox image (`.sandcastle/Dockerfile`)**

- Installs the .NET 10 SDK. `global.json` pins `10.0.401` with `latestMinor`.
- Puts `dotnet` on `PATH` in both login and non-login shells.

**Prompts**

- `implement-prompt.md`:
  - Works test-first and gates each commit on `dotnet build Blazor-Server.slnx` and `dotnet test --solution Blazor-Server.slnx`.
  - Points the agent at `CONTEXT.md`, `docs/adr/`, `CODING_STANDARDS.md` and the `dotnet-*` skills.
  - Uses `<type>(<scope>): <Summary>` commits with `Refs #<id>`.
  - Tells the agent not to push, open a PR or close the issue.
- `review-prompt.md`: uses the `dotnet` build and test commands and `refactor(...)` commits, and checks the red → green history and `null!` suppressions instead of TypeScript `any` types.
- `plan-prompt.md`: skips issues whose branch already has an open PR, so the loop doesn't redo finished work.
- `merge-prompt.md`: removed.

**Orchestration (`.sandcastle/main.mts`)**

- The local merge phase is replaced. After the review step, each branch is pushed from its own worktree and gets a PR that says `Closes #<id>`. If the branch already has an open PR, that PR is reused.
- The push happens from the worktree because the pre-push hook checks the branch that's checked out, not the one being pushed. From the main checkout it would reject the push as "direct push to main". From the worktree it checks the issue branch name and runs lint and tests against that branch's code.

**Skills (`.claude/skills/dotnet-*`)**

- Copies six skills into the repo: `dotnet-tdd`, `dotnet-add-testing`, `dotnet-xunit`, `dotnet-testing-strategy`, `dotnet-project-analysis` and `dotnet-inspect`. The agent in the sandbox can't see the host's `~/.claude/skills`.

## Testing

- Rebuilt `sandcastle:blazor-server`. `dotnet --list-sdks` reports `10.0.401` in both `bash -c` and `bash -lc`, and `claude` and `gh` are present.
- Type-checked `main.mts` with `tsc --strict`. The only errors are implicit-`any` ones that the original file also produces (Sandcastle's types don't resolve outside its own setup); nothing new.
- markdownlint passes on the prompts and skills. The pre-push gate passed.
- I haven't done a full Sandcastle run yet. The first real run will be issue #5, after this merges.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

