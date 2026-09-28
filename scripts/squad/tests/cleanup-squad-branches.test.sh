#!/usr/bin/env bash
# Tests for scripts/squad/cleanup-squad-branches.sh.
# Each case runs the script in a throwaway clone whose origin is a local bare
# repo. A stub `gh` answers PR queries from fixture files instead of GitHub:
#   $GH_FIXTURES/<state>/<branch with / as __>  one merged/open/closed PR head SHA per line
#   $GH_FIXTURES/FAIL                           present => every gh call fails
#   $GH_FIXTURES/ON_QUERY                       run (then removed) on the first gh call,
#                                               e.g. to push to origin mid-run
# Usage: scripts/squad/tests/cleanup-squad-branches.test.sh
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/cleanup-squad-branches.sh"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

STUBS="$WORK/bin"
mkdir -p "$STUBS"
cat >"$STUBS/gh" <<'EOF'
#!/usr/bin/env bash
[[ -e "$GH_FIXTURES/FAIL" ]] && { echo "gh: simulated failure" >&2; exit 1; }
if [[ -e "$GH_FIXTURES/ON_QUERY" ]]; then
	hook="$GH_FIXTURES/ON_QUERY.running"
	mv "$GH_FIXTURES/ON_QUERY" "$hook" && bash "$hook" >/dev/null 2>&1
fi
if [[ "$1" == "api" ]]; then
	# repos/<owner>/<repo>/compare/<base>...<head>: "ahead" when head contains base.
	range="${2##*/compare/}"
	base="${range%%...*}" head="${range##*...}"
	if [[ "$base" == "$head" ]]; then echo identical
	elif git merge-base --is-ancestor "$base" "$head" 2>/dev/null; then echo ahead
	else echo diverged; fi
	exit 0
fi
# pr list --repo R --head B --state S --json F --jq Q
while [[ $# -gt 0 ]]; do
	case "$1" in
	--head) branch="$2"; shift 2 ;;
	--state) state="$2"; shift 2 ;;
	--json) field="$2"; shift 2 ;;
	*) shift ;;
	esac
done
file="$GH_FIXTURES/$state/${branch//\//__}"
heads=()
[[ -f "$file" ]] && mapfile -t heads <"$file"
if [[ "$field" == "number" ]]; then echo "${#heads[@]}"; else printf '%s\n' "${heads[@]}"; fi
EOF
chmod +x "$STUBS/gh"

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX
# Keep the machine's git config out: a global init.templateDir would install
# real hooks (e.g. a pre-push gate) into the throwaway repos.
mkdir -p "$WORK/templates"
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_TEMPLATE_DIR="$WORK/templates"
export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.com
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.com
export PATH="$STUBS:$PATH"

PASSED=0
FAILED=0
OUTPUT=""
STATUS=0
CASE_DIR=""
CLONE=""
ORIGIN=""

# Fresh bare origin + clone on main, with one commit on main.
setup() {
	CASE_DIR="$(mktemp -d "$WORK/case-XXXX")"
	ORIGIN="$CASE_DIR/origin.git"
	CLONE="$CASE_DIR/clone"
	export GH_FIXTURES="$CASE_DIR/gh"
	mkdir -p "$GH_FIXTURES"/{merged,open,closed}
	git init -q --bare -b main "$ORIGIN"
	git clone -q "$ORIGIN" "$CLONE" 2>/dev/null
	git -C "$CLONE" commit -q --allow-empty -m init
	git -C "$CLONE" push -q origin main
}

# Pushes a branch with one commit of its own off main, dated $2 days ago (default 0).
push_branch() {
	local branch="$1" days="${2:-0}" date
	date="$(date -d "-${days} days" --iso-8601=seconds)"
	git -C "$CLONE" checkout -q -b "$branch" main
	GIT_COMMITTER_DATE="$date" GIT_AUTHOR_DATE="$date" \
		git -C "$CLONE" commit -q --allow-empty -m "work on $branch"
	git -C "$CLONE" push -q origin "$branch"
	git -C "$CLONE" checkout -q main
}

# Records a PR in state $2 whose head is the branch's current origin tip.
pr() {
	local branch="$1" state="$2"
	git -C "$CLONE" rev-parse "origin/$branch" >>"$GH_FIXTURES/$state/${branch//\//__}"
}

# Deletes the local branch, leaving only origin/<branch> (like a fresh CI checkout).
remote_only() {
	git -C "$CLONE" branch -q -D "$1"
}

run() {
	OUTPUT="$(cd "$CLONE" && bash "$SCRIPT" --repo owner/repo "$@" 2>&1)"
	STATUS=$?
}

remote_has() { git -C "$ORIGIN" rev-parse --verify -q "refs/heads/$1" >/dev/null; }
remote_lacks() { ! remote_has "$1"; }
local_has() { git -C "$CLONE" rev-parse --verify -q "refs/heads/$1" >/dev/null; }
local_lacks() { ! local_has "$1"; }
output_has() { [[ "$OUTPUT" == *"$1"* ]]; }
failed_with() { [[ $STATUS -ne 0 ]] && output_has "$1"; }

check() {
	local name="$1"
	shift
	if "$@"; then
		PASSED=$((PASSED + 1))
		echo "ok   - $name"
	else
		FAILED=$((FAILED + 1))
		echo "FAIL - $name"
		while IFS= read -r line; do echo "       $line"; done <<<"$OUTPUT"
	fi
}

# --- input validation --------------------------------------------------------

setup
run --orphan-days -1
check "rejects a negative --orphan-days" failed_with "--orphan-days must be a non-negative integer"

setup
run --orphan-days abc
check "rejects a non-numeric --orphan-days" failed_with "--orphan-days must be a non-negative integer"

setup
run --orphan-days 9223372036854775807
check "rejects an --orphan-days too large to be meaningful" failed_with "--orphan-days must be at most 36500"

# --- remote branches (fresh CI checkout) -------------------------------------

setup
push_branch chore/merged-remote
pr chore/merged-remote merged
remote_only chore/merged-remote
run --apply --delete-remote
check "finds a merged branch that exists only on origin" output_has $'Merged branches eligible for cleanup (1):\n  - chore/merged-remote'
check "deletes that remote branch" remote_lacks chore/merged-remote

setup
push_branch chore/merged-local-too
pr chore/merged-local-too merged
run --apply --delete-remote
check "deletes a merged branch locally" local_lacks chore/merged-local-too
check "deletes a merged branch on origin" remote_lacks chore/merged-local-too

setup
push_branch chore/pushed-after-merge
pr chore/pushed-after-merge merged
git -C "$CLONE" checkout -q chore/pushed-after-merge
git -C "$CLONE" commit -q --allow-empty -m "more work after the merge"
git -C "$CLONE" push -q origin chore/pushed-after-merge
git -C "$CLONE" checkout -q main
remote_only chore/pushed-after-merge
run --apply --delete-remote
check "keeps a remote branch with commits that never reached the merged PR" remote_has chore/pushed-after-merge

# --- merged means a merged PR ------------------------------------------------

setup
git -C "$CLONE" branch chore/no-commits-no-pr main
git -C "$CLONE" push -q origin chore/no-commits-no-pr
run --apply --delete-remote --orphan-days 0
check "keeps a branch with no commits of its own and no PR" remote_has chore/no-commits-no-pr
check "reports it as skipped" output_has "chore/no-commits-no-pr (no commits of its own and no PR)"

setup
push_branch chore/reopened
pr chore/reopened merged
pr chore/reopened open
run --apply --delete-remote
check "keeps a branch that still has an open PR, even with a merged one" remote_has chore/reopened

# --- orphans ------------------------------------------------------------------

setup
push_branch chore/old-orphan 30
remote_only chore/old-orphan
run --apply --delete-remote
check "deletes an old unmerged branch with no PR" remote_lacks chore/old-orphan

setup
push_branch chore/young-orphan 3
remote_only chore/young-orphan
run --apply --delete-remote
check "keeps a young unmerged branch with no PR" remote_has chore/young-orphan

setup
push_branch chore/old-orphan 10
remote_only chore/old-orphan
run --apply --delete-remote --orphan-days 08
check "accepts --orphan-days with a leading zero" test "$STATUS" -eq 0
check "treats it as decimal" remote_lacks chore/old-orphan

# --- fail closed --------------------------------------------------------------

setup
push_branch chore/old-orphan 30
remote_only chore/old-orphan
touch "$GH_FIXTURES/FAIL"
run --apply --delete-remote
check "keeps a branch when GitHub PR queries fail" remote_has chore/old-orphan
check "reports the query failure" output_has "chore/old-orphan (could not query PRs"

setup
push_branch chore/merged-remote
pr chore/merged-remote merged
git -C "$CLONE" remote set-url origin "$CASE_DIR/missing.git"
run --apply --delete-remote
check "refuses to apply when git fetch fails" failed_with "git fetch origin failed"

setup
push_branch chore/merged-remote
pr chore/merged-remote merged
remote_only chore/merged-remote
# Someone pushes to the branch after the script has fetched and classified it.
cat >"$GH_FIXTURES/ON_QUERY" <<EOF
other="\$(mktemp -d)"
git clone -q "$ORIGIN" "\$other/c"
git -C "\$other/c" checkout -q chore/merged-remote
git -C "\$other/c" commit -q --allow-empty -m "pushed mid-run"
git -C "\$other/c" push -q origin chore/merged-remote
EOF
run --apply --delete-remote
check "keeps a remote branch that moved after it was checked" remote_has chore/merged-remote

setup
push_branch chore/merged-local
pr chore/merged-local merged
# The local branch gets a new commit after the script has classified it.
cat >"$GH_FIXTURES/ON_QUERY" <<EOF
tree="\$(git -C "$CLONE" rev-parse chore/merged-local^{tree})"
new="\$(git -C "$CLONE" commit-tree -p chore/merged-local -m "local work mid-run" "\$tree")"
git -C "$CLONE" update-ref refs/heads/chore/merged-local "\$new"
EOF
run --apply
check "keeps a local branch that moved after it was checked" local_has chore/merged-local

# --- worktrees ----------------------------------------------------------------

setup
push_branch chore/in-worktree
pr chore/in-worktree merged
git -C "$CLONE" worktree add -q "$CASE_DIR/wt with space" chore/in-worktree
run --apply --delete-remote
check "removes the worktree of a merged branch when its path has spaces" test ! -e "$CASE_DIR/wt with space"

setup
push_branch chore/dirty-worktree
pr chore/dirty-worktree merged
git -C "$CLONE" worktree add -q "$CASE_DIR/dirty" chore/dirty-worktree
echo "unsaved" >"$CASE_DIR/dirty/notes.txt"
run --apply
check "keeps the worktree of a merged branch when it has uncommitted files" test -e "$CASE_DIR/dirty/notes.txt"
check "keeps that branch while its worktree remains" local_has chore/dirty-worktree

echo ""
echo "$PASSED passed, $FAILED failed"
[[ $FAILED -eq 0 ]]
