#!/usr/bin/env bash
# The single definition of "ready to push", shared by the pre-push hook, the
# Sandcastle sandbox and people. Stops at the first failing step:
#   1. yamllint on changed YAML files
#   2. markdownlint-cli2 on changed Markdown files
#   3. scripts/sync-copilot-review.sh --check when the code-review skill or
#      .github/copilot-instructions.md changed
#   4. actionlint and zizmor when workflows or dependabot.yml changed
#   5. shellcheck on changed shell scripts and git hooks
#   6. the Sandcastle TypeScript check when .sandcastle/, package.json or the
#      pnpm lockfile/workspace changed
#   7. a Release build of the solution
#   8. each test project under tests/, in Release
# "Changed" means added or modified since the branch left origin/main, so a
# branch with no upstream is linted in full, not just its last commit.
# Usage: scripts/gate.sh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'

# Hooks run with GIT_DIR and friends set, which confuse git calls made by the
# .NET SDK and pnpm tooling in a worktree.
run_clean() {
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u GIT_PREFIX "$@"
}

if ! BASE="$(git merge-base origin/main HEAD 2>/dev/null)"; then
  echo -e "${RED}❌ Can't find where this branch left origin/main. Run 'git fetch origin main' and try again.${RESET}"
  exit 1
fi

# changed_files <pathspec>...: files added or modified between BASE and HEAD.
# --no-renames reports a rename as a delete plus an add, so the new path is linted.
changed_files() {
  git diff -z --name-only --no-renames --diff-filter=d "$BASE" HEAD -- "$@"
}

mapfile -d '' -t CHANGED_YAML < <(changed_files '*.yml' '*.yaml')
mapfile -d '' -t CHANGED_MD < <(changed_files '*.md')
# Either side of the Copilot review sync, or the script that does it.
mapfile -d '' -t CHANGED_REVIEW < <(
  changed_files .claude/skills/code-review/SKILL.md .github/copilot-instructions.md scripts/sync-copilot-review.sh
)
mapfile -d '' -t CHANGED_WORKFLOWS < <(
  changed_files '.github/workflows/*.yml' '.github/workflows/*.yaml' '.github/dependabot.yml'
)
# Shell scripts, plus extensionless scripts and git hooks. Keep in step with
# the shellcheck job in .github/workflows/lint-actions.yml.
mapfile -t CHANGED_SHELL < <(
  changed_files | tr '\0' '\n' \
    | grep -E '\.sh$|^scripts/[^/.]+$|^\.github/hooks/((pre|post)-[a-z-]+|(prepare-)?commit-msg)$' || true
)
# Deletions count here: removing a module can break the code that imports it.
mapfile -d '' -t CHANGED_SANDCASTLE < <(
  git diff -z --name-only --no-renames "$BASE" HEAD -- .sandcastle package.json ':(glob)pnpm-*.yaml'
)

if [[ ${#CHANGED_YAML[@]} -gt 0 ]]; then
  echo -e "\n${CYAN}🧩 YAML lint on changed files...${RESET}"
  if ! command -v yamllint >/dev/null 2>&1; then
    echo -e "${RED}❌ yamllint is not installed. Please install yamllint (for example 'pipx install yamllint' or 'apt install yamllint') and try again.${RESET}"
    exit 1
  fi
  yamllint -c .yamllint.yml "${CHANGED_YAML[@]}"
  echo -e "${GREEN}✅ YAML lint OK.${RESET}"
else
  echo -e "\n${GREEN}✅ No changed YAML files to lint.${RESET}"
fi

if [[ ${#CHANGED_MD[@]} -gt 0 ]]; then
  echo -e "\n${CYAN}📝 Markdown lint on changed files...${RESET}"
  pnpm exec markdownlint-cli2 "${CHANGED_MD[@]}"
  echo -e "${GREEN}✅ Markdown lint OK.${RESET}"
else
  echo -e "\n${GREEN}✅ No changed Markdown files to lint.${RESET}"
fi

if [[ ${#CHANGED_REVIEW[@]} -gt 0 ]]; then
  echo -e "\n${CYAN}🔁 Copilot review instructions sync...${RESET}"
  "$ROOT/scripts/sync-copilot-review.sh" --check
fi

# The workflow and shell linters, at the versions .github/workflows/lint-actions.yml
# pins. An installed tool is preferred; otherwise docker or uvx runs the pinned
# version; with neither, the check is skipped here (CI still runs it).
ACTIONLINT_VERSION="1.7.12"
ZIZMOR_VERSION="1.30.1"
SHELLCHECK_VERSION="v0.11.0"
have_docker() { docker info &>/dev/null; }
have_uvx() { command -v uvx &>/dev/null; }

# run_tool <name> <install hint> <probe> <fallback command...> -- <args...>
run_tool() {
  local name="$1" hint="$2" probe="$3"; shift 3
  local fallback=()
  while [[ $# -gt 0 && "$1" != "--" ]]; do fallback+=("$1"); shift; done
  shift
  if command -v "$name" &>/dev/null; then
    "$name" "$@"
  elif "$probe"; then
    "${fallback[@]}" "$@"
  else
    echo -e "${YELLOW}⚠️  ${name} not found — skipping. CI's Lint Actions workflow still runs it.${RESET}"
    echo -e "   To enable: ${CYAN}${hint}${RESET}"
  fi
}

if [[ ${#CHANGED_WORKFLOWS[@]} -gt 0 ]]; then
  echo -e "\n${CYAN}⚙️  Workflow lint (actionlint, zizmor)...${RESET}"
  # No file arguments: actionlint finds every workflow, and zizmor audits the
  # whole repo, as CI does. --offline: no GitHub token needed locally.
  run_tool actionlint "install actionlint (github.com/rhysd/actionlint), or Docker" have_docker \
    docker run --rm -v "$ROOT:/repo" -w /repo "rhysd/actionlint:${ACTIONLINT_VERSION}" --
  run_tool zizmor "pipx install zizmor, or install uv" have_uvx \
    uvx "zizmor@${ZIZMOR_VERSION}" -- --offline --min-severity medium .
  echo -e "${GREEN}✅ Workflow lint OK.${RESET}"
else
  echo -e "\n${GREEN}✅ No changed workflows to lint.${RESET}"
fi

if [[ ${#CHANGED_SHELL[@]} -gt 0 ]]; then
  echo -e "\n${CYAN}🐚 Shell lint on changed scripts...${RESET}"
  run_tool shellcheck "install shellcheck, or Docker" have_docker \
    docker run --rm -v "$ROOT:/mnt" -w /mnt "koalaman/shellcheck:${SHELLCHECK_VERSION}" \
    -- "${CHANGED_SHELL[@]}"
  echo -e "${GREEN}✅ Shell lint OK.${RESET}"
else
  echo -e "\n${GREEN}✅ No changed shell scripts to lint.${RESET}"
fi

if [[ ${#CHANGED_SANDCASTLE[@]} -gt 0 ]]; then
  echo -e "\n${CYAN}🏰 Sandcastle TypeScript check...${RESET}"
  run_clean pnpm run check:sandcastle
  echo -e "${GREEN}✅ Sandcastle check OK.${RESET}"
else
  echo -e "\n${GREEN}✅ No Sandcastle or package changes to check.${RESET}"
fi

echo -e "\n${CYAN}🔨 Building the solution...${RESET}"
run_clean dotnet build Blazor-Server.slnx -c Release
echo -e "${GREEN}✅ Build OK.${RESET}"

echo -e "\n${CYAN}🧪 Running test suite...${RESET}"
# Discover each test project explicitly. The repo uses Microsoft Testing Platform
# for .NET 10, and running the solution file directly can report "Zero tests ran"
# even while the project-level test runs pass. Under MTP, `dotnet test` takes the
# project through --project and rejects VSTest-only flags such as --nologo.
TEST_PROJECTS=()
if [[ -d "$ROOT/tests" ]]; then
  mapfile -d '' -t TEST_PROJECTS < <(find "$ROOT/tests" -type f -name '*.csproj' -print0 | sort -z)
fi

if [[ ${#TEST_PROJECTS[@]} -eq 0 ]]; then
  # Expected while the repo is being bootstrapped; CI skips tests the same way.
  echo -e "${YELLOW}⚠️  No test projects found under tests/ — skipping tests.${RESET}"
fi

for project_file in "${TEST_PROJECTS[@]}"; do
  project_name="$(basename "${project_file%.*}")"
  assembly_path="$(dirname "$project_file")/bin/Release/net10.0/${project_name}.dll"
  echo -e "${CYAN}▶ Testing ${project_file#"$ROOT"/}...${RESET}"

  if run_clean dotnet test --project "$project_file" --configuration Release --verbosity minimal \
    --results-directory "$ROOT/.tmp-test-results" --report-xunit-trx \
    --report-xunit-trx-filename "${project_name}.trx"; then
    continue
  fi

  if [[ -f "$assembly_path" ]]; then
    echo -e "${YELLOW}⚠️ dotnet test reported a runner issue for ${project_name}; falling back to the built test assembly.${RESET}"
    if ! run_clean dotnet "$assembly_path"; then
      echo -e "${RED}❌ Tests failed for '${project_file#"$ROOT"/}' using the direct runner fallback.${RESET}"
      exit 1
    fi
    continue
  fi

  echo -e "${RED}❌ Tests failed for '${project_file#"$ROOT"/}'.${RESET}"
  exit 1
done
echo -e "${GREEN}✅ Test suite OK.${RESET}"

echo -e "\n${GREEN}━━━ Gate passed ✅ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
