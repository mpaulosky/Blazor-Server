#!/usr/bin/env bash
# Tests for .github/hooks/pre-push.
# Each case runs the hook in a throwaway repo with the refs git would pass on
# stdin. Stub `dotnet`, `npx` and `yamllint` binaries record whether the lint
# and test gates ran, so no real build or network access is needed.
# Usage: .github/hooks/tests/pre-push.test.sh
set -uo pipefail

HOOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/pre-push"
ZERO="0000000000000000000000000000000000000000"
SHA="1111111111111111111111111111111111111111"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

REPO="$WORK/repo"
STUBS="$WORK/bin"
LOG="$WORK/gates.log"

mkdir -p "$STUBS"
for tool in dotnet npx yamllint; do
  printf '#!/usr/bin/env bash\necho %s >> "%s"\n' "$tool" "$LOG" > "$STUBS/$tool"
  chmod +x "$STUBS/$tool"
done

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX
git init -q -b main "$REPO"
mkdir -p "$REPO/tests/Fake.Tests"
echo '<Project />' > "$REPO/tests/Fake.Tests/Fake.Tests.csproj"
git -C "$REPO" add .
git -C "$REPO" -c user.name=test -c user.email=test@example.com commit -q -m init

PASSED=0
FAILED=0
OUTPUT=""
STATUS=0

# run_hook <checked-out branch> <stdin>
run_hook() {
  git -C "$REPO" switch -q -C "$1"
  : > "$LOG"
  OUTPUT="$(cd "$REPO" && PATH="$STUBS:$PATH" bash "$HOOK" <<< "$2" 2>&1)"
  STATUS=$?
}

# run_hook_without_stdin <checked-out branch>
run_hook_without_stdin() {
  git -C "$REPO" switch -q -C "$1"
  : > "$LOG"
  OUTPUT="$(cd "$REPO" && PATH="$STUBS:$PATH" bash "$HOOK" < /dev/null 2>&1)"
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
}

# expect <name> <allowed|refused> <tests-ran|tests-skipped> [message]
expect() {
  local name="$1" verdict="$2" tests="$3" message="${4:-}"

  if [[ "$verdict" == "allowed" && $STATUS -ne 0 ]]; then
    fail "$name" "expected the push to be allowed, exit $STATUS"
    return
  fi
  if [[ "$verdict" == "refused" && $STATUS -eq 0 ]]; then
    fail "$name" "expected the push to be refused"
    return
  fi
  if [[ "$tests" == "tests-ran" ]] && ! grep -qx dotnet "$LOG"; then
    fail "$name" "expected the tests to run"
    return
  fi
  if [[ "$tests" == "tests-skipped" ]] && grep -qx dotnet "$LOG"; then
    fail "$name" "expected the tests to be skipped"
    return
  fi
  if [[ -n "$message" ]] && ! grep -qF -- "$message" <<< "$OUTPUT"; then
    fail "$name" "expected output to contain '$message'"
    return
  fi
  pass "$name"
}

run_hook main "(delete) $ZERO refs/heads/feature/1-x $SHA"
expect "deleting a feature branch from main skips the gates" allowed tests-skipped

run_hook main "(delete) $ZERO refs/heads/main $SHA"
expect "deleting main is refused" refused tests-skipped "Deleting 'main' is not allowed."

run_hook feature/1-x "(delete) $ZERO refs/heads/preview $SHA"
expect "deleting preview is refused" refused tests-skipped "Deleting 'preview' is not allowed."

run_hook main "refs/heads/main $SHA refs/heads/main $ZERO"
expect "pushing main is refused" refused tests-skipped "Direct pushes to 'main' are not allowed."

run_hook feature/1-x "refs/heads/feature/1-x $SHA refs/heads/feature/1-x $ZERO"
expect "pushing a feature branch runs the gates" allowed tests-ran

run_hook main "refs/heads/feature/1-x $SHA refs/heads/feature/1-x $ZERO"
expect "pushing a feature branch from main runs the gates" allowed tests-ran

run_hook feature/1-x "HEAD $SHA refs/heads/bad-name $ZERO"
expect "pushing to a badly named branch is refused" refused tests-skipped "Branch name 'bad-name' does not match"

run_hook feature/1-x "refs/heads/main $SHA refs/heads/dev $ZERO"
expect "pushing to dev from a feature branch is refused" refused tests-skipped "Direct pushes to 'dev' are not allowed."

run_hook feature/1-x "refs/tags/v1.0.0 $SHA refs/tags/v1.0.0 $ZERO"
expect "a tag-only push skips the gates" allowed tests-skipped "Tag push"

run_hook main "refs/tags/v1.0.0 $SHA refs/tags/v1.0.0 $ZERO
refs/heads/feature/1-x $SHA refs/heads/feature/1-x $ZERO"
expect "a mixed tag and branch push gates the branch" allowed tests-ran

run_hook feature/1-x "refs/tags/v1.0.0 $SHA refs/tags/v1.0.0 $ZERO
refs/heads/feature/1-x $SHA refs/heads/bad-name $ZERO"
expect "a mixed tag and badly named branch push is refused" refused tests-skipped "Branch name 'bad-name' does not match"

run_hook main "(delete) $ZERO refs/tags/v1.0.0 $SHA"
expect "deleting a tag skips the gates" allowed tests-skipped

run_hook_without_stdin main
expect "without stdin, a main checkout is refused" refused tests-skipped "Direct pushes to 'main' are not allowed."

run_hook_without_stdin feature/1-x
expect "without stdin, a feature checkout runs the gates" allowed tests-ran

echo
echo "$PASSED passed, $FAILED failed"
[[ $FAILED -eq 0 ]]
