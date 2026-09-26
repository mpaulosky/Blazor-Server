#!/usr/bin/env bash
# The single definition of "ready to push", shared by the pre-push hook, the
# Sandcastle sandbox and people. Stops at the first failing step:
#   1. yamllint on changed YAML files
#   2. markdownlint-cli2 on changed Markdown files
#   3. the Sandcastle TypeScript check when .sandcastle/ or package*.json changed
#   4. a Release build of the solution
#   5. each test project under tests/, in Release
# "Changed" means added or modified since the branch left origin/main, so a
# branch with no upstream is linted in full, not just its last commit.
# Usage: scripts/gate.sh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'

# Hooks run with GIT_DIR and friends set, which confuse git calls made by the
# .NET SDK and npm tooling in a worktree.
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
# Deletions count here: removing a module can break the code that imports it.
mapfile -d '' -t CHANGED_SANDCASTLE < <(
  git diff -z --name-only --no-renames "$BASE" HEAD -- .sandcastle ':(glob)package*.json'
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
  npx --no-install markdownlint-cli2 "${CHANGED_MD[@]}"
  echo -e "${GREEN}✅ Markdown lint OK.${RESET}"
else
  echo -e "\n${GREEN}✅ No changed Markdown files to lint.${RESET}"
fi

if [[ ${#CHANGED_SANDCASTLE[@]} -gt 0 ]]; then
  echo -e "\n${CYAN}🏰 Sandcastle TypeScript check...${RESET}"
  run_clean npm run check:sandcastle
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
