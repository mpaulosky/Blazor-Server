#!/usr/bin/env bash
# Repo-specific CI setup, called by ci.yml after it restores and before it builds.
#
#   prepare.sh build              in the "Build Solution" job
#   prepare.sh test <test-name>   in each "Tests: <test-name>" matrix job
#
# ci.yml is Owned by the repo-ci-baseline Template and is overwritten on every
# Apply; this file is Seed, so it belongs to the repo. Put what only this repo
# needs here: tools the build runs (for example `corepack enable` for pnpm),
# images to pull or projects to publish before a test project runs. To pass
# environment variables to the later steps, append NAME=value lines to
# "$GITHUB_ENV".
#
# The test name comes from a file name in the PR, so treat it as data: quote
# it and never eval it.
set -euo pipefail

job="${1:?usage: prepare.sh build|test [test-name]}"
test_name="${2:-}"

# Every job builds UI, whose build runs the Tailwind CLI from src/UI's pnpm
# packages, so every job installs them first.
setup_pnpm() {
  corepack enable pnpm
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  if [[ -n "${GITHUB_ENV:-}" ]]; then
    echo "COREPACK_ENABLE_DOWNLOAD_PROMPT=0" >> "$GITHUB_ENV"
  fi
  pnpm install --frozen-lockfile
}

case "$job" in
  build) setup_pnpm ;;
  test) : "$test_name"; setup_pnpm ;;
  *) echo "prepare.sh: unknown job '$job'" >&2; exit 2 ;;
esac
