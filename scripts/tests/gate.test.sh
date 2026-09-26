#!/usr/bin/env bash
# Tests for scripts/gate.sh.
# Each case runs the gate in a throwaway repo whose origin/main is a local ref.
# Stub `dotnet`, `npm`, `npx`, `yamllint` and `docker` binaries log each call,
# and fail when the call matches the FAIL glob, so no real build is needed.
# Usage: scripts/tests/gate.test.sh
set -uo pipefail

GATE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/gate.sh"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

REPO="$WORK/repo"
STUBS="$WORK/bin"
NO_YAMLLINT="$WORK/bin-no-yamllint"
LOG="$WORK/gate.log"

mkdir -p "$STUBS" "$NO_YAMLLINT"
for tool in dotnet npm npx yamllint docker; do
  cat > "$STUBS/$tool" <<EOF
#!/usr/bin/env bash
call="$tool \$*"
echo "\$call" >> "$LOG"
[[ -z "\${FAIL:-}" || "\$call" != \$FAIL ]]
EOF
  chmod +x "$STUBS/$tool"
done

# A PATH with every command on the real PATH except yamllint, plus the stubs.
IFS=: read -ra path_dirs <<< "$PATH"
for tool_path in "$STUBS"/*; do
  [[ "$(basename "$tool_path")" == yamllint ]] || ln -s "$tool_path" "$NO_YAMLLINT/"
done
for dir in "${path_dirs[@]}"; do
  for tool_path in "$dir"/*; do
    tool="$(basename "$tool_path")"
    [[ -x "$tool_path" && ! -d "$tool_path" && "$tool" != yamllint && ! -e "$NO_YAMLLINT/$tool" ]] || continue
    ln -s "$tool_path" "$NO_YAMLLINT/$tool"
  done
done

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com

git init -q -b main "$REPO"
mkdir -p "$REPO/tests/Fake.Tests" "$REPO/docs" "$REPO/.sandcastle"
echo '<Project />' > "$REPO/tests/Fake.Tests/Fake.Tests.csproj"
echo '# Old' > "$REPO/docs/old.md"
echo 'export {};' > "$REPO/.sandcastle/old.mts"
git -C "$REPO" add .
git -C "$REPO" commit -q -m init
git -C "$REPO" update-ref refs/remotes/origin/main main

PASSED=0
FAILED=0
OUTPUT=""
STATUS=0

# new_branch <name>: a fresh branch from origin/main with no upstream.
new_branch() {
  git -C "$REPO" switch -q -C "$1" origin/main
}

# commit_file <path> [content]
commit_file() {
  mkdir -p "$REPO/$(dirname "$1")"
  echo "${2:-x: 1}" > "$REPO/$1"
  git -C "$REPO" add "$1"
  git -C "$REPO" commit -q -m "add $1"
}

# run_gate [PATH]
run_gate() {
  : > "$LOG"
  OUTPUT="$(cd "$REPO" && PATH="${1:-$STUBS:$PATH}" bash "$GATE" 2>&1)"
  STATUS=$?
}

pass() {
  PASSED=$((PASSED + 1))
  echo "ok   - $1"
}

fail() {
  FAILED=$((FAILED + 1))
  echo "FAIL - $1: $2"
  while IFS= read -r line; do echo "       | $line"; done <<< "$OUTPUT"
  while IFS= read -r line; do echo "       > $line"; done < "$LOG"
}

# expect <name> <passed|failed> <expected calls, one per line> [message]
expect() {
  local name="$1" verdict="$2" calls="$3" message="${4:-}"

  if [[ "$verdict" == "passed" && $STATUS -ne 0 ]]; then
    fail "$name" "expected the gate to pass, exit $STATUS"
    return
  fi
  if [[ "$verdict" == "failed" && $STATUS -eq 0 ]]; then
    fail "$name" "expected the gate to fail"
    return
  fi
  # shellcheck disable=SC2053 # $calls is a glob, so the test command's trailing flags can match *.
  if [[ "$(cat "$LOG")" != $calls ]]; then
    fail "$name" "expected calls:
$calls"
    return
  fi
  if [[ -n "$message" ]] && ! grep -qF -- "$message" <<< "$OUTPUT"; then
    fail "$name" "expected output to contain '$message'"
    return
  fi
  pass "$name"
}

BUILD="dotnet build Blazor-Server.slnx -c Release"
TEST="dotnet test --project $REPO/tests/Fake.Tests/Fake.Tests.csproj --configuration Release"

new_branch feature/1-none
run_gate
expect "with no changed files, only the build and tests run" passed "$BUILD
$TEST*"

new_branch feature/2-all
commit_file .github/workflows/a.yml
commit_file config/b.yaml
commit_file docs/a.md '# A'
commit_file .sandcastle/lib/a.mts 'export {};'
run_gate
expect "every step runs in order" passed "yamllint -c .yamllint.yml .github/workflows/a.yml config/b.yaml
npx --no-install markdownlint-cli2 docs/a.md
npm run check:sandcastle
$BUILD
$TEST*"

FAIL='yamllint*' run_gate
expect "a YAML lint failure stops the gate" failed "yamllint -c .yamllint.yml .github/workflows/a.yml config/b.yaml"

FAIL='npx*' run_gate
expect "a Markdown lint failure stops the gate" failed "yamllint -c .yamllint.yml .github/workflows/a.yml config/b.yaml
npx --no-install markdownlint-cli2 docs/a.md"

FAIL='npm*' run_gate
expect "a Sandcastle check failure stops the gate" failed "yamllint -c .yamllint.yml .github/workflows/a.yml config/b.yaml
npx --no-install markdownlint-cli2 docs/a.md
npm run check:sandcastle"

FAIL='dotnet build*' run_gate
expect "a build failure stops the gate" failed "yamllint -c .yamllint.yml .github/workflows/a.yml config/b.yaml
npx --no-install markdownlint-cli2 docs/a.md
npm run check:sandcastle
$BUILD"

FAIL='dotnet test*' run_gate
expect "a test failure fails the gate" failed "yamllint -c .yamllint.yml .github/workflows/a.yml config/b.yaml
npx --no-install markdownlint-cli2 docs/a.md
npm run check:sandcastle
$BUILD
$TEST*"

new_branch feature/3-two-commits
commit_file docs/first.md '# First'
commit_file src/second.txt
FAIL='npx*docs/first.md*' run_gate
expect "a Markdown error in the first of two commits with no upstream fails the gate" failed \
  "npx --no-install markdownlint-cli2 docs/first.md"

new_branch feature/4-no-yamllint
commit_file a.yml
run_gate "$NO_YAMLLINT"
expect "a changed YAML file without yamllint fails without Docker" failed "" "install yamllint"

new_branch feature/5-no-yaml
commit_file docs/a.md '# A'
run_gate "$NO_YAMLLINT"
expect "without yamllint, a branch with no YAML changes passes" passed \
  "npx --no-install markdownlint-cli2 docs/a.md
$BUILD
$TEST*"

new_branch feature/6-deleted
git -C "$REPO" rm -q docs/old.md
git -C "$REPO" commit -q -m "remove docs/old.md"
run_gate
expect "deleted files are not linted" passed "$BUILD
$TEST*"

new_branch feature/7-sandcastle-deleted
git -C "$REPO" rm -q .sandcastle/old.mts
git -C "$REPO" commit -q -m "remove .sandcastle/old.mts"
run_gate
expect "deleting a Sandcastle file still runs the Sandcastle check" passed "npm run check:sandcastle
$BUILD
$TEST*"

new_branch feature/8-package
commit_file package-lock.json '{}'
run_gate
expect "a package*.json change runs the Sandcastle check" passed "npm run check:sandcastle
$BUILD
$TEST*"

new_branch feature/9-main-moved
commit_file src/branch.txt
git -C "$REPO" switch -q main
commit_file docs/main-only.md '# Main'
git -C "$REPO" update-ref refs/remotes/origin/main main
git -C "$REPO" switch -q feature/9-main-moved
run_gate
expect "files changed only on main since the branch point are not linted" passed "$BUILD
$TEST*"

git -C "$REPO" update-ref -d refs/remotes/origin/main
run_gate
expect "a missing origin/main fails the gate" failed "" "git fetch origin"

echo
echo "$PASSED passed, $FAILED failed"
[[ $FAILED -eq 0 ]]
