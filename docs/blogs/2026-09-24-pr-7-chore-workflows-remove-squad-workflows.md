---
post_title: "chore(workflows): Remove squad workflows"
author1: mpaulosky
post_slug: "v0.0.15-pr-7"
microsoft_alias: n/a
featured_image: ""
categories:
  - engineering
tags:
  - release:v0.0.15
  - automation
ai_note: "Backfilled for issue #21 from the PR title/body in the release automation format"
summary: "Release notes seed for v0.0.15 from PR #7."
post_date: "2026-09-24"
---
## chore(workflows): Remove squad workflows

- **Release tag:** `v0.0.15`
- **Source PR:** [#7](https://github.com/mpaulosky/Blazor-Server/pull/7)

### PR description

## Summary

This repository doesn't use the squad triage system, and there's no `.squad/team.md` for it to read. Its workflows either did nothing or added unwanted `squad` labels and comments to PRs, as happened on #6.

**Deleted** (they only served the squad system):

- `pr-auto-label.yml`: added the `squad` / `squad:boromir` labels and a triage comment to every PR
- `triage.yml`
- `issue-assign.yml`
- `label-enforce.yml`

**Kept, with squad references removed:**

- `release.yml`: renamed from "Squad Release" to "Release", concurrency group `squad-release-*` → `release-*`, and the release blog `author1` changed from `team-squad` to `mpaulosky`. The versioning logic is unchanged. It still bumps on `release:major` / `release:minor` labels, which aren't squad-specific.
- `sync-readme.yml`: no longer reads `vars.SQUAD_MAIN_BRANCH` and uses the repo's default branch.
- `lint-yaml.yml`, `lint-markdown.yml` and the yamllint config in `.github/hooks/pre-push`: removed the `.squad/` ignores.

After this, `git grep -i squad` finds nothing in `.github/`, `.sandcastle/` or `docs/`. The hook's branch-naming check was already fixed in #6.

## Testing

- `yamllint -c .yamllint.yml .github/workflows/`: clean.
- `bash -n .github/hooks/pre-push`, and the pre-push gate passed on push.

## Follow-up

The `squad` repository label (on #6) is left in place. Deleting it is a separate, irreversible step.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

