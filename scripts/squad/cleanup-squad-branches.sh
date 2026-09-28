#!/usr/bin/env bash
# Cleanup stale squad/sprint/hotfix/chore branches and their linked worktrees.
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'

REPO=""
APPLY=false
DELETE_REMOTE=false
ORPHAN_DAYS=14
FORCE_LOCAL=false
FORCE_WORKTREE=false

usage() {
	cat <<'USAGE'
Usage: cleanup-squad-branches.sh --repo <owner/repo> [options]

Options:
  --repo <owner/repo>   Repository to query for PR/merge state (required)
  --apply               Actually delete branches/worktrees (default: dry-run)
  --delete-remote       Also delete eligible remote branches (requires --apply)
  --orphan-days <n>     Minimum age in days before an unmerged, PR-less branch
                        is treated as orphaned (default: 14)
  --force-local         Use 'git branch -D' for orphaned branches too (squash-merged
                        branches verified against their merged PR always use -D)
  --force-worktree      Use 'git worktree remove --force'
  -h, --help            Show this help text
USAGE
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--repo)
		REPO="$2"
		shift 2
		;;
	--apply)
		APPLY=true
		shift
		;;
	--delete-remote)
		DELETE_REMOTE=true
		shift
		;;
	--orphan-days)
		ORPHAN_DAYS="$2"
		shift 2
		;;
	--force-local)
		FORCE_LOCAL=true
		shift
		;;
	--force-worktree)
		FORCE_WORKTREE=true
		shift
		;;
	-h | --help)
		usage
		exit 0
		;;
	*)
		echo "Unknown argument: $1" >&2
		usage
		exit 1
		;;
	esac
done

if [[ -z "$REPO" ]]; then
	echo -e "${RED}❌ --repo <owner/repo> is required.${RESET}" >&2
	exit 1
fi

if ! [[ "$ORPHAN_DAYS" =~ ^[0-9]+$ ]]; then
	echo -e "${RED}❌ --orphan-days must be a non-negative integer (got '$ORPHAN_DAYS').${RESET}" >&2
	exit 1
fi
# Bound it before any arithmetic: a huge value would overflow "* 86400" and
# could turn negative, making every PR-less branch old enough to delete.
MAX_ORPHAN_DAYS=36500
DIGITS="${ORPHAN_DAYS#"${ORPHAN_DAYS%%[!0]*}"}"
if ((${#DIGITS} > ${#MAX_ORPHAN_DAYS})) || ((10#${DIGITS:-0} > MAX_ORPHAN_DAYS)); then
	echo -e "${RED}❌ --orphan-days must be at most ${MAX_ORPHAN_DAYS} (got '$ORPHAN_DAYS').${RESET}" >&2
	exit 1
fi
# Force base 10: bash arithmetic would read a leading zero (e.g. 08) as octal.
ORPHAN_DAYS=$((10#${DIGITS:-0}))

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

MODE_LABEL="DRY-RUN"
[[ "$APPLY" == "true" ]] && MODE_LABEL="APPLY"

echo -e "${CYAN}━━━ Squad Branch/Worktree Cleanup (${MODE_LABEL}) ━━━━━━━━━━━━━━━━━━${RESET}"
echo "Repo: $REPO | orphan-days: $ORPHAN_DAYS | delete-remote: $DELETE_REMOTE | force-local: $FORCE_LOCAL | force-worktree: $FORCE_WORKTREE"

CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo "")"
BRANCH_PATTERN='^(squad|sprint)/[0-9]+-[a-z0-9-]+$|^hotfix/[a-z0-9-]+$|^chore/[a-z0-9]+(-[a-z0-9]+)*$'

# Classifying against stale refs could delete a branch that has moved on, so
# an apply run stops here; a dry run carries on with a warning.
if ! git fetch origin --prune >/dev/null 2>&1; then
	if [[ "$APPLY" == "true" ]]; then
		echo -e "${RED}❌ git fetch origin failed; refusing to apply cleanup against stale refs.${RESET}" >&2
		exit 1
	fi
	echo -e "${YELLOW}⚠️  git fetch origin failed; dry-run results may be stale.${RESET}"
fi

MAIN_REF="origin/main"
if ! git rev-parse --verify "$MAIN_REF" >/dev/null 2>&1; then
	MAIN_REF="main"
fi

NOW_EPOCH="$(date +%s)"
ORPHAN_SECONDS=$((ORPHAN_DAYS * 86400))

declare -a MERGED_BRANCHES=()
declare -a ORPHAN_BRANCHES=()
declare -a SKIPPED_BRANCHES=()
# Merged branches, verified against their merged PR. Squash merges leave
# them unmerged in git terms, so 'git branch -d' refuses; they use -D.
declare -A PR_VERIFIED=()

# Prints how many PRs with head $1 are in state $2. Fails if GitHub can't be
# queried, so callers skip the branch instead of guessing "no PR".
pr_count() {
	local count
	count="$(gh pr list --repo "$REPO" --head "$1" --state "$2" --json number --jq 'length' 2>/dev/null)" || return 1
	[[ "$count" =~ ^[0-9]+$ ]] || return 1
	echo "$count"
}

# Succeeds when commit $2 is the head of one of branch $1's merged PRs, or an
# ancestor of one (the PR received more commits than this copy has). Fails if
# the copy has commits that never reached a merged PR, or GitHub can't answer.
tip_in_merged_pr() {
	local branch="$1" tip="$2" heads head status
	heads="$(gh pr list --repo "$REPO" --head "$branch" --state merged --json headRefOid --jq '.[].headRefOid' 2>/dev/null)" || return 1
	while IFS= read -r head; do
		[[ -z "$head" ]] && continue
		[[ "$head" == "$tip" ]] && return 0
		status="$(gh api "repos/$REPO/compare/${tip}...${head}" --jq '.status' 2>/dev/null || echo "")"
		[[ "$status" == "ahead" || "$status" == "identical" ]] && return 0
	done <<<"$heads"
	return 1
}

# Every candidate name, from local branches and from origin. A fresh CI
# checkout has only main locally, so origin's refs are what it cleans up.
# Both maps hold each branch's tip as first seen. Deletion is conditional on
# that tip, so a branch that gets new commits while this runs is left alone.
declare -A HAS_LOCAL=() HAS_REMOTE=()
while IFS=' ' read -r ref oid; do
	case "$ref" in
	refs/heads/*) HAS_LOCAL["${ref#refs/heads/}"]="$oid" ;;
	refs/remotes/origin/HEAD) ;;
	refs/remotes/origin/*) HAS_REMOTE["${ref#refs/remotes/origin/}"]="$oid" ;;
	esac
done < <(git for-each-ref --format='%(refname) %(objectname)' refs/heads/ refs/remotes/origin/)

while IFS= read -r branch; do
	[[ -z "$branch" ]] && continue
	if ! [[ "$branch" =~ $BRANCH_PATTERN ]]; then
		continue
	fi
	if [[ "$branch" == "$CURRENT_BRANCH" ]]; then
		SKIPPED_BRANCHES+=("$branch (currently checked out)")
		continue
	fi

	# The tips this run could delete: the local branch and/or origin's copy.
	TIPS=()
	[[ -n "${HAS_LOCAL[$branch]:-}" ]] && TIPS+=("${HAS_LOCAL[$branch]}")
	[[ -n "${HAS_REMOTE[$branch]:-}" ]] && TIPS+=("${HAS_REMOTE[$branch]}")

	if ! OPEN_PR_COUNT="$(pr_count "$branch" open)" ||
		! MERGED_PR_COUNT="$(pr_count "$branch" merged)" ||
		! CLOSED_PR_COUNT="$(pr_count "$branch" closed)"; then
		SKIPPED_BRANCHES+=("$branch (could not query PRs; skipped to be safe)")
		continue
	fi

	if [[ "$OPEN_PR_COUNT" != "0" ]]; then
		SKIPPED_BRANCHES+=("$branch (open PR)")
		continue
	fi

	# Merged means a merged PR whose head contains every tip we'd delete. Squash
	# and rebase merges never land as literal ancestors of main, so ancestry
	# alone proves nothing either way.
	if [[ "$MERGED_PR_COUNT" != "0" ]]; then
		ALL_IN_PR=true
		for tip in "${TIPS[@]}"; do
			tip_in_merged_pr "$branch" "$tip" || ALL_IN_PR=false
		done
		if [[ "$ALL_IN_PR" == "true" ]]; then
			MERGED_BRANCHES+=("$branch")
			PR_VERIFIED["$branch"]=1
		else
			SKIPPED_BRANCHES+=("$branch (PR merged, but the branch has commits not in it; review, then delete by hand)")
		fi
		continue
	fi

	# A closed-but-unmerged PR is a deliberate abandonment signal, so it
	# doesn't need to wait out the age fallback below.
	if [[ "$CLOSED_PR_COUNT" != "0" ]]; then
		ORPHAN_BRANCHES+=("$branch")
		continue
	fi

	# No PR at all. A branch with nothing beyond main is new work that hasn't
	# started, and main's own commit dates say nothing about its age.
	OWN_COMMITS=false
	for tip in "${TIPS[@]}"; do
		git merge-base --is-ancestor "$tip" "$MAIN_REF" 2>/dev/null || OWN_COMMITS=true
	done
	if [[ "$OWN_COMMITS" != "true" ]]; then
		SKIPPED_BRANCHES+=("$branch (no commits of its own and no PR)")
		continue
	fi

	# Orphan once the newest tip is old enough.
	LAST_COMMIT_EPOCH=0
	for tip in "${TIPS[@]}"; do
		epoch="$(git log -1 --format=%ct "$tip" 2>/dev/null || echo "$NOW_EPOCH")"
		((epoch > LAST_COMMIT_EPOCH)) && LAST_COMMIT_EPOCH=$epoch
	done
	AGE_SECONDS=$((NOW_EPOCH - LAST_COMMIT_EPOCH))
	if ((AGE_SECONDS >= ORPHAN_SECONDS)); then
		ORPHAN_BRANCHES+=("$branch")
	else
		SKIPPED_BRANCHES+=("$branch (unmerged, younger than ${ORPHAN_DAYS}d)")
	fi
done < <(printf '%s\n' "${!HAS_LOCAL[@]}" "${!HAS_REMOTE[@]}" | sort -u)

echo ""
echo "Merged branches eligible for cleanup (${#MERGED_BRANCHES[@]}):"
for b in "${MERGED_BRANCHES[@]}"; do echo "  - $b"; done

echo ""
echo "Orphaned branches eligible for cleanup (unmerged, no open PR, older than ${ORPHAN_DAYS}d) (${#ORPHAN_BRANCHES[@]}):"
for b in "${ORPHAN_BRANCHES[@]}"; do echo "  - $b"; done

echo ""
echo "Skipped (${#SKIPPED_BRANCHES[@]}):"
for b in "${SKIPPED_BRANCHES[@]}"; do echo "  - $b"; done

ELIGIBLE=("${MERGED_BRANCHES[@]}" "${ORPHAN_BRANCHES[@]}")

echo ""
echo "Worktrees:"
wt_path=""
while IFS= read -r line; do
	case "$line" in
	"worktree "*) wt_path="${line#worktree }" ;;
	"branch refs/heads/"*) wt_branch="${line#branch refs/heads/}" ;;
	esac
	[[ "$line" == "branch refs/heads/"* ]] || continue
	[[ "$wt_path" == "$ROOT" ]] && continue
	for eligible in "${ELIGIBLE[@]}"; do
		if [[ "$wt_branch" == "$eligible" ]]; then
			echo "  - $wt_path [$wt_branch]"
			if [[ "$APPLY" == "true" ]]; then
				REMOVE_ARGS=(worktree remove)
				[[ "$FORCE_WORKTREE" == "true" ]] && REMOVE_ARGS+=(--force)
				REMOVE_ARGS+=("$wt_path")
				echo -e "    ${YELLOW}removing worktree...${RESET}"
				git "${REMOVE_ARGS[@]}" || echo -e "    ${RED}failed to remove worktree $wt_path${RESET}"
			fi
		fi
	done
done < <(git worktree list --porcelain)

if [[ "$APPLY" != "true" ]]; then
	echo ""
	echo -e "${YELLOW}Dry-run complete — no branches or worktrees were deleted. Re-run with --apply to act.${RESET}"
	exit 0
fi

echo ""
echo "Deleting local branches..."
for branch in "${ELIGIBLE[@]}"; do
	expected="${HAS_LOCAL[$branch]:-}"
	[[ -n "$expected" ]] || continue
	if [[ "$(git rev-parse -q --verify "refs/heads/$branch")" != "$expected" ]]; then
		echo -e "  ${RED}kept local $branch: it changed since it was checked${RESET}"
		continue
	fi
	# update-ref below bypasses git's own worktree check, so refuse while any
	# worktree (e.g. one whose removal failed above) still has it checked out.
	if git worktree list --porcelain | grep -qxF "branch refs/heads/$branch"; then
		echo -e "  ${RED}kept local $branch: still checked out in a worktree${RESET}"
		continue
	fi
	# Test the delete in the `if` itself: under set -e, a refused delete
	# (e.g. `git branch -d` on an unmerged orphan) must be reported, not
	# abort the run before the remote deletions.
	if [[ "$FORCE_LOCAL" == "true" || -n "${PR_VERIFIED[$branch]:-}" ]]; then
		# update-ref with an old value only deletes if the tip is still the one checked.
		DELETE_LOCAL=(git update-ref -d "refs/heads/$branch" "$expected")
	else
		DELETE_LOCAL=(git branch -d "$branch")
	fi
	if "${DELETE_LOCAL[@]}" >/dev/null 2>&1; then
		echo -e "  ${GREEN}deleted local $branch${RESET}"
	else
		echo -e "  ${RED}failed to delete local $branch (use --force-local for unmerged branches)${RESET}"
	fi
done

if [[ "$DELETE_REMOTE" == "true" ]]; then
	echo ""
	echo "Deleting remote branches..."
	for branch in "${ELIGIBLE[@]}"; do
		expected="${HAS_REMOTE[$branch]:-}"
		[[ -n "$expected" ]] || continue
		if git push --force-with-lease="refs/heads/$branch:$expected" origin --delete "$branch" 2>/dev/null; then
			echo -e "  ${GREEN}deleted remote $branch${RESET}"
		else
			echo -e "  ${RED}kept remote $branch: it changed since it was checked, or the delete failed${RESET}"
		fi
	done
fi

echo ""
echo -e "${GREEN}✅ Cleanup complete.${RESET}"
