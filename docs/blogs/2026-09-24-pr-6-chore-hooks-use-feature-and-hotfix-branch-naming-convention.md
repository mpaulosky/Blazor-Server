---
post_title: "chore(hooks): Use feature/ and hotfix/ branch naming convention"
author1: mpaulosky
post_slug: "v0.0.13-pr-6"
microsoft_alias: n/a
featured_image: ""
categories:
  - engineering
tags:
  - release:v0.0.13
  - automation
ai_note: "Backfilled for issue #21 from the PR title/body in the release automation format"
summary: "Release notes seed for v0.0.13 from PR #6."
post_date: "2026-09-24"
---
## chore(hooks): Use feature/ and hotfix/ branch naming convention

- **Release tag:** `v0.0.13`
- **Source PR:** [#6](https://github.com/mpaulosky/Blazor-Server/pull/6)

### PR description

## Summary

This repository doesn't use the squad workflow, but the pre-push hook still enforced `squad/` and `sprint/` branch names. Sandcastle's plan prompt generated `sandcastle/issue-{id}`, which the hook also rejected. This PR puts both on the convention already documented in `docs/CONTRIBUTING.md`.

- **`.github/hooks/pre-push`**: allows `feature/{issue}-{slug}`, `hotfix/{issue}-{slug}` and `chore/{slug}`, and rejects `squad/`, `sprint/`, and a `hotfix/` without an issue number.
- **`.sandcastle/plan-prompt.md`**: generates `hotfix/{id}-{slug}` for issues labelled `bug` and `feature/{id}-{slug}` for all others, with the slug built from the issue title. If a branch for that issue already exists, it's reused, so re-planning stays deterministic even when the title changes.

## Testing

- `bash -n` on the hook.
- Checked the branch pattern against sample names: `feature/5-domain-shared-kernel`, `hotfix/12-fix-x` and `chore/branch-naming-convention` are accepted; `squad/5-x`, `sandcastle/issue-5`, `feature/domain` and `hotfix/fix-x` are rejected.
- markdownlint passes on the plan prompt.

## Notes

Merge this before the next Sandcastle run, so the branch it plans for #5 (`feature/5-domain-shared-kernel`) passes the hook.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

