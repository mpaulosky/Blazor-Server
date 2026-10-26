---
paths:
  - ".github/**"
  - ".sandcastle/**"
  - ".claude/skills/pre-push-review/**"
  - ".claude/agents/pre-push-reviewer.md"
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

- `.github/ci/gate-checks.sh`: checks only this repository needs, run by `scripts/gate.sh`. A new local check goes here;
  the Sandcastle check is configured in `.sandcastle/check.sh`, which it calls.
- `.sandcastle/lib/repo-config.mts` (this repository's Sandcastle values), `.sandcastle/check.sh`,
  `.sandcastle/CODING_STANDARDS.md`, `.sandcastle/Dockerfile`, `.sandcastle/plan-prompt.md`, `.sandcastle/review-prompt.md`,
  `.sandcastle/roles/*.md`, `package.json` and `pnpm-workspace.yaml`.
- `.sandcastle/main.test.mts` and the tests listed in `NOT_OWNED_BASELINE_PATHS` (`lib/repo-config.test.mts`,
  `lib/role-prompts.test.mts`, `lib/dockerfile.test.mts`, `lib/code-review-skill.test.mts`) are this repository's own too.
- `.github/ci/prepare.sh`: per-repository CI setup, run by `ci.yml`.
- `.github/ci/coverage-threshold`, `.github/dependabot.yml`, `.github/ISSUE_TEMPLATE/*`, `LICENSE`, and
  `docs/CONTRIBUTING.md`, `docs/CODE_OF_CONDUCT.md`, `docs/REFERENCES.md`, `docs/SECURITY.md`.

## Not from the Template: this repository's own

- `.github/workflows/sandcastle.yml` comes with Sandcastle, not the Template, so no Apply touches it. Change it here, and
  make the same change in the other copies (dotfiles' own, and auth0-management-app's) when it applies to them too.

## Owned files: changed in the Template

Every other file the Template supplies is Owned. Under the paths this rule covers, that is:

- `.github/workflows/*.yml` except `sandcastle.yml`, `.github/hooks/**`, `.github/scripts/**`, `.github/instructions/*.md` and
  `.github/pull_request_template.md`;
- `scripts/gate.sh`, `scripts/check-branch-name.sh`, `scripts/check-git-hooks.sh`, `scripts/check-pr-title.sh`,
  `scripts/review.sh` and `scripts/tests/**`;
- `.sandcastle/main.mts`, every `.sandcastle/lib/*.mts` but `repo-config.mts` and this repository's own tests (listed in
  `NOT_OWNED_BASELINE_PATHS`), `.sandcastle/critique-prompt.md` and `intake-prompt.md`, `.sandcastle/tsconfig.json`,
  `.sandcastle/.env.example`, `.sandcastle/.gitignore`, `.sandcastle/.markdownlint-cli2.jsonc`, `.claude/skills/pre-push-review/**` and
  `.claude/agents/pre-push-reviewer.md`;
- `docs/PROCESS.md`, `.editorconfig`, `.gitignore`, `.markdownlint-cli2.jsonc`, `.yamllint.yml`, `codecov.yml`,
  `GitVersion.yml` and `global.json`.

When a task needs an Owned file changed, keep the change out of this repository: the owner makes it in the Template and
re-Applies it. Write the exact change needed (file, before and after, and why) in your final message and the PR
description under **Baseline change needed**, and deliver the rest of the task. When the need is only this
repository's, a Seed file usually holds it instead: a gate check in `gate-checks.sh`, CI setup in `prepare.sh`.

Files under these paths that the Template doesn't supply are the repository's own: for example
`.github/copilot-instructions.md`, which `scripts/sync-copilot-review.sh` generates from the code-review skill.
