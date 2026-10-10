---
paths:
  - ".github/**"
  - "scripts/**"
  - "docs/PROCESS.md"
  - ".editorconfig"
  - ".gitignore"
  - ".markdownlint-cli2.jsonc"
  - ".yamllint.yml"
  - "codecov.yml"
  - "GitVersion.yml"
  - "global.json"
---

# Baseline Rules

The CI, release and git-hook setup comes from the repo-ci-baseline **Template**, which keeps it the same across the
owner's repositories. Each file it supplies is one of two kinds:

- **Owned**: overwritten on every Apply, so a change made here is lost at the next one.
- **Seed**: written once, then the repository's own. Edit it freely.

## Seed files: this repository's own

- `.github/ci/gate-checks.sh`: checks only this repository needs, run by `scripts/gate.sh`. A new local or Sandcastle
  check goes here.
- `.github/ci/prepare.sh`: per-repository CI setup, run by `ci.yml`.
- `.github/ci/coverage-threshold`, `.github/dependabot.yml`, `.github/ISSUE_TEMPLATE/*`, `LICENSE`, and
  `docs/CONTRIBUTING.md`, `docs/CODE_OF_CONDUCT.md`, `docs/REFERENCES.md`, `docs/SECURITY.md`.

## Owned files: changed in the Template

Every other file the Template supplies is Owned. Under the paths this rule covers, that is:

- `.github/workflows/*.yml`, `.github/hooks/**`, `.github/scripts/**`, `.github/instructions/*.md` and
  `.github/pull_request_template.md`;
- `scripts/gate.sh`, `scripts/check-branch-name.sh`, `scripts/check-pr-title.sh` and `scripts/tests/**`;
- `docs/PROCESS.md`, `.editorconfig`, `.gitignore`, `.markdownlint-cli2.jsonc`, `.yamllint.yml`, `codecov.yml`,
  `GitVersion.yml` and `global.json`.

When a task needs an Owned file changed, keep the change out of this repository: the owner makes it in the Template and
re-Applies it. Write the exact change needed (file, before and after, and why) in your final message and the PR
description under **Baseline change needed**, and deliver the rest of the task. When the need is only this
repository's, a Seed file usually holds it instead: a gate check in `gate-checks.sh`, CI setup in `prepare.sh`.

Files under these paths that the Template doesn't supply are the repository's own: for example
`.github/copilot-instructions.md`, which `scripts/sync-copilot-review.sh` generates from the code-review skill.
