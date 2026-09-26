#!/usr/bin/env bash
# Tests for .github/hooks/pre-push.
# Each case runs the hook in a throwaway repo, holding a copy of
# scripts/gate.sh, with the refs git would pass on stdin. Stub `dotnet`, `npm`,
# `npx` and `yamllint` binaries log each call, and fail when the call matches
# the FAIL glob, so no real build or network access is needed.
# Usage: .github/hooks/tests/pre-push.test.sh
set -uo pipefail

HOOK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/pre-push"
GATE="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)/scripts/gate.sh"
ZERO="0000000000000000000000000000000000000000"
SHA="1111111111111111111111111111111111111111"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

REPO="$WORK/repo"
STUBS="$WORK/bin"
LOG="$WORK/gates.log"

mkdir -p "$STUBS"
for tool in dotnet npm npx yamllint; do
  cat > "$STUBS/$tool" <<EOF
#!/usr/bin/env bash
call="$tool \$*"
echo "\$call" >> "$LOG"
[[ -z "\${FAIL:-}" || "\$call" != \$FAIL ]]
EOF
  chmod +x "$STUBS/$tool"
done

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com

git init -q -b main "$REPO"
mkdir -p "$REPO/tests/Fake.Tests" "$REPO/scripts"
echo '<Project />' > "$REPO/tests/Fake.Tests/Fake.Tests.csproj"
cp "$GATE" "$REPO/scripts/gate.sh"
git -C "$REPO" add .
git -C "$REPO" commit -q -m init
git -C "$REPO" update-ref refs/remotes/origin/main main

PASSED=0
FAILED=0
OUTPUT=""
STATUS=0

# switch_to <branch>: check out the branch, creating it from origin/main if new.
# Existing branches keep their commits.
switch_to() {
  git -C "$REPO" switch -q "$1" 2>/dev/null || git -C "$REPO" switch -q -c "$1" origin/main
}

# run_hook <checked-out branch> <stdin>
run_hook() {
  switch_to "$1"
  : > "$LOG"
  OUTPUT="$(cd "$REPO" && PATH="$STUBS:$PATH" bash "$HOOK" <<< "$2" 2>&1)"
  STATUS=$?
}

# run_hook_without_stdin <checked-out branch>
run_hook_without_stdin() {
  switch_to "$1"
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

# expect <name> <allowed|refused> <tests-ran|tests-skipped|any> [message]
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
  if [[ "$tests" == "tests-ran" ]] && ! grep -q '^dotnet test ' "$LOG"; then
    fail "$name" "expected the tests to run"
    return
  fi
  if [[ "$tests" == "tests-skipped" && -s "$LOG" ]]; then
    fail "$name" "expected the lint and test gates to be skipped, but ran: $(tr '\n' ' ' < "$LOG")"
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
expect "a tag-only push skips the gates" allowed tests-skipped "No branch updates"

run_hook main "refs/tags/v1.0.0 $SHA refs/tags/v1.0.0 $ZERO
refs/heads/feature/1-x $SHA refs/heads/feature/1-x $ZERO"
expect "a mixed tag and branch push gates the branch" allowed tests-ran

run_hook feature/1-x "refs/tags/v1.0.0 $SHA refs/tags/v1.0.0 $ZERO
refs/heads/feature/1-x $SHA refs/heads/bad-name $ZERO"
expect "a mixed tag and badly named branch push is refused" refused tests-skipped "Branch name 'bad-name' does not match"

run_hook feature/1-x "refs/tags/v1.0.0 $SHA refs/heads/main $ZERO"
expect "pushing a tag to main is refused" refused tests-skipped "Direct pushes to 'main' are not allowed."

run_hook main "refs/tags/v1.0.0 $SHA refs/heads/feature/1-x $ZERO"
expect "pushing a tag to a feature branch runs the gates" allowed tests-ran

run_hook main "(delete) $ZERO refs/tags/v1.0.0 $SHA"
expect "deleting a tag skips the gates" allowed tests-skipped

run_hook_without_stdin main
expect "without stdin, a main checkout is refused" refused tests-skipped "Direct pushes to 'main' are not allowed."

run_hook_without_stdin feature/1-x
expect "without stdin, a feature checkout runs the gates" allowed tests-ran

git -C "$REPO" switch -q -c feature/2-two-commits origin/main
echo '# First' > "$REPO/first.md"
git -C "$REPO" add first.md
git -C "$REPO" commit -q -m first
echo 'second' > "$REPO/second.txt"
git -C "$REPO" add second.txt
git -C "$REPO" commit -q -m second
FAIL='npx*first.md*' run_hook feature/2-two-commits \
  "refs/heads/feature/2-two-commits $SHA refs/heads/feature/2-two-commits $ZERO"
expect "a lint error in the first of two unpushed commits refuses the push" refused any

FAIL='dotnet build*' run_hook feature/1-x "refs/heads/feature/1-x $SHA refs/heads/feature/1-x $ZERO"
expect "a failing build refuses the push" refused any

FEATURE_ONE_SHA="$(git -C "$REPO" rev-parse feature/1-x)"
FEATURE_TWO_SHA="$(git -C "$REPO" rev-parse feature/2-two-commits)"
git -C "$REPO" config --local sandcastle.gatedHead "$FEATURE_ONE_SHA"
run_hook feature/1-x "refs/heads/feature/1-x $FEATURE_ONE_SHA refs/heads/feature/1-x $ZERO"
expect "a Sandcastle-gated HEAD skips the pre-push gate" allowed tests-skipped "Sandcastle already gated all pushed branch HEADs"

run_hook feature/1-x "refs/heads/feature/1-x $FEATURE_ONE_SHA refs/heads/feature/1-x $ZERO
refs/heads/feature/2-two-commits $FEATURE_TWO_SHA refs/heads/feature/2-two-commits $ZERO"
expect "mixed branch SHAs run the gate when any pushed branch head is ungated" allowed tests-ran

echo
echo "$PASSED passed, $FAILED failed"
[[ $FAILED -eq 0 ]]
