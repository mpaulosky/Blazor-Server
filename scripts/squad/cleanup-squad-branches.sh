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

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

MODE_LABEL="DRY-RUN"
[[ "$APPLY" == "true" ]] && MODE_LABEL="APPLY"

echo -e "${CYAN}━━━ Squad Branch/Worktree Cleanup (${MODE_LABEL}) ━━━━━━━━━━━━━━━━━━${RESET}"
echo "Repo: $REPO | orphan-days: $ORPHAN_DAYS | delete-remote: $DELETE_REMOTE | force-local: $FORCE_LOCAL | force-worktree: $FORCE_WORKTREE"

CURRENT_BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo "")"
BRANCH_PATTERN='^(squad|sprint)/[0-9]+-[a-z0-9-]+$|^hotfix/[a-z0-9-]+$|^chore/[a-z0-9]+(-[a-z0-9]+)*$'

git fetch origin --prune >/dev/null 2>&1 || true

MAIN_REF="origin/main"
if ! git rev-parse --verify "$MAIN_REF" >/dev/null 2>&1; then
	MAIN_REF="main"
fi

NOW_EPOCH="$(date +%s)"
ORPHAN_SECONDS=$((ORPHAN_DAYS * 86400))

declare -a MERGED_BRANCHES=()
declare -a ORPHAN_BRANCHES=()
declare -a SKIPPED_BRANCHES=()
# Squash-merged branches whose local tip is fully contained in a merged PR.
# 'git branch -d' always refuses these, so they are deleted with -D.
declare -A SQUASH_VERIFIED=()

# Succeeds when the branch's local tip is the head of one of its merged PRs, or
# an ancestor of one (the PR received more commits than the local copy has).
# Fails if the local branch has commits that never reached a merged PR.
local_tip_in_merged_pr() {
	local branch="$1" tip head status
	tip="$(git rev-parse "$branch")"
	while IFS= read -r head; do
		[[ -z "$head" ]] && continue
		[[ "$head" == "$tip" ]] && return 0
		status="$(gh api "repos/$REPO/compare/${tip}...${head}" --jq '.status' 2>/dev/null || echo "")"
		[[ "$status" == "ahead" || "$status" == "identical" ]] && return 0
	done < <(gh pr list --repo "$REPO" --head "$branch" --state merged --json headRefOid --jq '.[].headRefOid' 2>/dev/null || true)
	return 1
}

while IFS= read -r branch; do
	[[ -z "$branch" ]] && continue
	if [[ "$branch" == "$CURRENT_BRANCH" ]]; then
		SKIPPED_BRANCHES+=("$branch (currently checked out)")
		continue
	fi
	if ! [[ "$branch" =~ $BRANCH_PATTERN ]]; then
		continue
	fi

	if git merge-base --is-ancestor "$branch" "$MAIN_REF" 2>/dev/null; then
		MERGED_BRANCHES+=("$branch")
		continue
	fi

	# Squash/rebase merges never land as literal ancestors of main, so a
	# branch whose PR shows as merged is just as eligible as a fast-forward.
	MERGED_PR_COUNT="$(gh pr list --repo "$REPO" --head "$branch" --state merged --json number --jq 'length' 2>/dev/null || echo "0")"
	if [[ "${MERGED_PR_COUNT:-0}" != "0" ]]; then
		if local_tip_in_merged_pr "$branch"; then
			MERGED_BRANCHES+=("$branch")
			SQUASH_VERIFIED["$branch"]=1
		else
			SKIPPED_BRANCHES+=("$branch (PR merged, but the local branch has commits not in it; review, then 'git branch -D')")
		fi
		continue
	fi

	# Not merged: only eligible if orphaned (no open PR) and old enough.
	OPEN_PR_COUNT="$(gh pr list --repo "$REPO" --head "$branch" --state open --json number --jq 'length' 2>/dev/null || echo "0")"
	if [[ "${OPEN_PR_COUNT:-0}" != "0" ]]; then
		SKIPPED_BRANCHES+=("$branch (open PR)")
		continue
	fi

	# A closed-but-unmerged PR is a deliberate abandonment signal, so it
	# doesn't need to wait out the age fallback below.
	CLOSED_PR_COUNT="$(gh pr list --repo "$REPO" --head "$branch" --state closed --json number --jq 'length' 2>/dev/null || echo "0")"
	if [[ "${CLOSED_PR_COUNT:-0}" != "0" ]]; then
		ORPHAN_BRANCHES+=("$branch")
		continue
	fi

	LAST_COMMIT_EPOCH="$(git log -1 --format=%ct "$branch" 2>/dev/null || echo "$NOW_EPOCH")"
	AGE_SECONDS=$((NOW_EPOCH - LAST_COMMIT_EPOCH))
	if ((AGE_SECONDS >= ORPHAN_SECONDS)); then
		ORPHAN_BRANCHES+=("$branch")
	else
		SKIPPED_BRANCHES+=("$branch (unmerged, younger than ${ORPHAN_DAYS}d)")
	fi
done < <(git for-each-ref --format='%(refname:short)' refs/heads/)

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
while IFS= read -r line; do
	wt_path="$(awk '{print $1}' <<<"$line")"
	wt_branch="$(sed -n 's/.*\[\(.*\)\]/\1/p' <<<"$line")"
	[[ -z "$wt_branch" ]] && continue
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
done < <(git worktree list)

if [[ "$APPLY" != "true" ]]; then
	echo ""
	echo -e "${YELLOW}Dry-run complete — no branches or worktrees were deleted. Re-run with --apply to act.${RESET}"
	exit 0
fi

echo ""
echo "Deleting local branches..."
for branch in "${ELIGIBLE[@]}"; do
	DELETE_FLAG="-d"
	[[ "$FORCE_LOCAL" == "true" || -n "${SQUASH_VERIFIED[$branch]:-}" ]] && DELETE_FLAG="-D"
	if git branch "$DELETE_FLAG" "$branch" >/dev/null 2>&1; then
		echo -e "  ${GREEN}deleted local $branch${RESET}"
	else
		echo -e "  ${RED}failed to delete local $branch (use --force-local for unmerged branches)${RESET}"
	fi
done

if [[ "$DELETE_REMOTE" == "true" ]]; then
	echo ""
	echo "Deleting remote branches..."
	for branch in "${ELIGIBLE[@]}"; do
		if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
			if git push origin --delete "$branch" 2>/dev/null; then
				echo -e "  ${GREEN}deleted remote $branch${RESET}"
			else
				echo -e "  ${RED}failed to delete remote $branch${RESET}"
			fi
		fi
	done
fi

echo ""
echo -e "${GREEN}✅ Cleanup complete.${RESET}"
