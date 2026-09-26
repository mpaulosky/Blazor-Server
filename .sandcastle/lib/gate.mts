// ---------------------------------------------------------------------------
// Blocker gate
//
// An issue is blocked while any issue it depends on is unfinished. Blockers
// come from two places: GitHub's native "blocked by" relationships and lines
// in the issue body that start with "Blocked by #N" or "Depends on #N". A
// blocker is finished only when it closed as completed (for an issue) or was
// merged (for a PR). An open blocker, one closed as not planned or duplicate,
// or a PR closed without merging keeps the dependent issue blocked, since the
// code it needs never reached main.
// ---------------------------------------------------------------------------

import { isIssueBranch } from "./branches.mts";
import { listSandcastleIssues, openPullRequests, repoName, type OpenPullRequest, type SandcastleIssue } from "./github.mts";
import { sh } from "./shell.mts";

export type Blocker = {
  number: number;
  state: string;
  state_reason: string | null;
  merged_at: string | null;
  is_pr: boolean;
};

const blockerFields =
  "{number, state, state_reason, merged_at: (.pull_request.merged_at // null), is_pr: (.pull_request != null)}";

// Undefined when the lookup fails (a mistyped number 404s, the network drops).
// Callers treat that as still blocking, so one bad reference holds back only
// its own issue instead of aborting the whole run.
function fetchBlocker(number: number, cache: Map<number, Blocker>): Blocker | undefined {
  let blocker = cache.get(number);
  if (!blocker) {
    try {
      blocker = JSON.parse(
        sh(process.cwd(), "gh", "api", `repos/${repoName()}/issues/${number}`, "--jq", blockerFields),
      ) as Blocker;
    } catch {
      return undefined;
    }
    cache.set(number, blocker);
  }
  return blocker;
}

// Issue numbers named on "Blocked by #N" / "Depends on #N" lines in the body.
// Only line starts count, so prose such as "reuses the generator from #22"
// doesn't create a dependency.
export function bodyBlockers(body: string): number[] {
  const numbers: number[] = [];
  for (const line of body.split("\n")) {
    const match = /^\s*(?:[-*]\s+)?\**(?:blocked by|depends on)\**:?\s*(.*)$/i.exec(line);
    if (!match) continue;
    for (const ref of match[1]!.matchAll(/(?<![\w/])#(\d+)\b/g)) numbers.push(Number(ref[1]));
  }
  return numbers;
}

// Why a blocker still blocks, or undefined when it has landed.
export function unfinishedReason(blocker: Blocker): string | undefined {
  const ref = `#${blocker.number}`;
  if (blocker.state === "open") return `${ref} is still open`;
  if (blocker.is_pr) return blocker.merged_at ? undefined : `${ref} was closed without merging`;
  if (blocker.state_reason === "completed") return undefined;
  return `${ref} was closed as ${blocker.state_reason ?? "unknown"}, so its work never landed`;
}

// Why an issue waits for review rather than an agent, or undefined when no open
// PR's head is its feature/{n}-* or hotfix/{n}-* branch.
export function openPrReason(issueNumber: number, openPrs: OpenPullRequest[]): string | undefined {
  const pr = openPrs.find((candidate) => isIssueBranch(candidate.headRefName, issueNumber));
  return pr ? `PR #${pr.number} (${pr.headRefName}) is already open for it` : undefined;
}

// Split the open Sandcastle issues into those ready to plan and those waiting
// on an unfinished blocker or an open PR, with the reasons for each held-back
// issue. Blockers are resolved afresh on every call: an issue whose blocker's
// PR merged during the previous round becomes ready now.
export function gateIssues(): { ready: SandcastleIssue[]; blocked: { issue: SandcastleIssue; reasons: string[] }[] } {
  const issues = listSandcastleIssues();
  const openPrs = openPullRequests();
  const cache = new Map<number, Blocker>();

  const ready: SandcastleIssue[] = [];
  const blocked: { issue: SandcastleIssue; reasons: string[] }[] = [];

  for (const issue of issues) {
    // Its work is waiting for review, not for an agent. Checked first, so its
    // blockers aren't looked up for nothing.
    const prReason = openPrReason(issue.number, openPrs);
    if (prReason) {
      blocked.push({ issue, reasons: [prReason] });
      continue;
    }

    let native: Blocker[];
    try {
      native = sh(
        process.cwd(), "gh", "api", "--paginate", `repos/${repoName()}/issues/${issue.number}/dependencies/blocked_by`,
        "--jq", `.[] | ${blockerFields}`,
      )
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Blocker);
    } catch {
      // Without its native links the issue's blockers are unknown, so hold it back.
      blocked.push({ issue, reasons: ["its GitHub \"blocked by\" links couldn't be read"] });
      continue;
    }
    for (const blocker of native) cache.set(blocker.number, blocker);

    const numbers = new Set([...native.map((b) => b.number), ...bodyBlockers(issue.body)]);
    numbers.delete(issue.number);

    const reasons = [...numbers]
      .map((number) => {
        const blocker = fetchBlocker(number, cache);
        return blocker ? unfinishedReason(blocker) : `#${number} couldn't be fetched`;
      })
      .filter((reason): reason is string => reason !== undefined);

    if (reasons.length > 0) blocked.push({ issue, reasons });
    else ready.push(issue);
  }

  return { ready, blocked };
}
