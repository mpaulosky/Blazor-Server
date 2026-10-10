#!/usr/bin/env bash
# Repo-specific checks for the local gate, called by scripts/gate.sh after its
# lints and before it builds, so they run in pre-push, in the Sandcastle
# sandbox, and by hand.
#
#   gate-checks.sh <merge-base>
#
# <merge-base> is where this branch left origin/main, or empty when there is
# no origin/main; then every check runs. Exit non-zero to fail the gate.
#
# scripts/gate.sh is Owned by the repo-ci-baseline Template and is overwritten
# on every Apply; this file is Seed, so it belongs to the repo.
set -euo pipefail

base="${1-}"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RESET='\033[0m'

# changed <pathspec>...: true when any matching path changed since <base>.
# Deletions count: deleting a module, or the generated review file, is a
# change these checks must see.
changed() {
  [[ -z "$base" ]] && return 0
  ! git diff --quiet --no-renames "$base" HEAD -- "$@"
}

# Hooks run with GIT_DIR and friends set, which confuse git calls made by
# pnpm tooling in a worktree.
run_clean() {
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_PREFIX "$@"
}

# .github/copilot-instructions.md is generated from the code-review skill, so
# GitHub's Copilot review and Claude Code review against the same rules.
if changed .claude/skills/code-review/SKILL.md .github/copilot-instructions.md scripts/sync-copilot-review.sh; then
  echo -e "${CYAN}🔁 Copilot review instructions sync...${RESET}"
  scripts/sync-copilot-review.sh --check
else
  echo -e "${GREEN}✅ No Copilot review sync changes to check.${RESET}"
fi

# branches.test.mts checks Sandcastle's branch names against the branch
# standard, and code-review-skill.test.mts checks the code-review skill, so a
# change to either reruns them.
if changed .sandcastle package.json ':(glob)pnpm-*.yaml' scripts/check-branch-name.sh .claude/skills/code-review; then
  echo -e "${CYAN}🏰 Sandcastle TypeScript check...${RESET}"
  run_clean pnpm run check:sandcastle
else
  echo -e "${GREEN}✅ No Sandcastle or package changes to check.${RESET}"
fi
