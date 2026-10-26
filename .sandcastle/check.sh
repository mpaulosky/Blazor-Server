#!/usr/bin/env bash
# Sandcastle's check for the local gate, called by .github/ci/gate-checks.sh:
# type-check .sandcastle/ and run its tests when it, package.json, the pnpm
# files, or the local review's script, skill and agent and Claude Review's workflow
# (which its tests read), or the files this repo's own tests read (listed below), changed
# since <merge-base> (always, when <merge-base> is empty).
#
#   .sandcastle/check.sh <merge-base>
set -euo pipefail
base="${1-}"
# branches.test.mts checks Sandcastle's branch names against scripts/check-branch-name.sh, code-review-skill.test.mts checks the
# code-review skill, dockerfile.test.mts checks the sandbox image's linters against the versions scripts/gate.sh pins, and
# main.test.mts reads CLAUDE.md. repo-config.test.mts reads the workflows (the CI job names), the test projects under tests/ and the
# files lib/repo-config.mts's CHECK_PATHS names.
if [[ -n "$base" ]] && git diff --quiet --no-renames "$base" HEAD -- .sandcastle package.json ':(glob)pnpm-*.yaml' \
  scripts/review.sh .claude/skills/pre-push-review .claude/agents/pre-push-reviewer.md .github/workflows/claude-review.yml \
  scripts/check-branch-name.sh .claude/skills/code-review scripts/gate.sh CLAUDE.md \
  .github/workflows ':(glob)tests/**/*.csproj' .github/ci .github/scripts .github/hooks Directory.Build.props Directory.Packages.props \
  .editorconfig global.json .markdownlint-cli2.jsonc .yamllint.yml Blazor-Server.slnx; then
  exit 0
fi
echo "── Sandcastle check"
pnpm run check:sandcastle
