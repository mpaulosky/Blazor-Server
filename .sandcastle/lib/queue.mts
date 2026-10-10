// ---------------------------------------------------------------------------
// Queue scope
//
// Only work the repository owner queued and approved reaches an agent (see
// docs/plans/sandcastle-workflow.md, "Labels" and "The round"). Every phase
// reads the open Sandcastle issues through loadQueue, not through
// listSandcastleIssues directly: loadQueue keeps only the issues in this
// run's queue scope (lib/config.mts#QueueScope) whose most recent queueing
// was the repository owner's, with no untrusted edit since, and fixes any
// trust-sensitive label whose most recent add or removal wasn't the
// owner's (#146).
// ---------------------------------------------------------------------------

import type { QueueScope } from "./config.mts";
import type { ContentEdit, IssueEvent, SandcastleIssue } from "./github.mts";

let activeScope: QueueScope | undefined;

// Sets the scope every phase reads the queue through for the rest of the
// run. Called once, by main.mts, right after it resolves a scope from the
// environment (lib/config.mts#queueScopeFrom).
export function useQueueScope(scope: QueueScope): void {
  activeScope = scope;
}

// The scope useQueueScope set. Throws when nothing has set one yet, so a
// caller that forgets fails closed instead of silently reading every issue.
export function activeQueueScope(): QueueScope {
  if (activeScope === undefined) {
    throw new Error("No queue scope is active: call useQueueScope before loading the queue.");
  }
  return activeScope;
}

// Tri-state owner check (see lib/github.mts#pushAccess): true when the login
// can push to the repository, false when it definitely can't (including a
// null, deleted actor), undefined when the lookup failed. undefined never
// drives a write: the caller holds the issue back and checks again next
// round.
export type IsOwner = (login: string | null) => boolean | undefined;

export type Approval = { approved: true } | { approved: false; reason: string };

// Whether the issue's most recent `labeled` event adding `queueLabel` was
// the repository owner's, and nobody but the owner has renamed the issue or
// edited its body since (see docs/plans/sandcastle-workflow.md, "Labels"):
// only the owner's own queueing, undisturbed by anyone else, reaches an
// agent. Not approved when there's no such event, when its actor isn't
// (definitely) the owner, or when any renamed event or ContentEdit at or
// after that time has a definite non-owner editor. An unknown actor
// anywhere is also not approved, so the issue is held back rather than let
// through on a failed lookup.
export function approval(
  queueLabel: string,
  events: readonly IssueEvent[],
  edits: readonly ContentEdit[],
  isOwner: IsOwner,
): Approval {
  throw new Error("Not implemented");
}

export type LabelFix = { action: "remove" | "restore"; label: string; reason: string };

// Which of the issue's trust-sensitive labels need fixing, because their
// most recent add or removal wasn't the repository owner's (see
// docs/plans/sandcastle-workflow.md, "Labels"): a label in `rules.trustAdds`
// the issue carries, added by someone other than the owner (or with no
// `labeled` event at all), is fixed by removing it; a label in
// `rules.trustRemovals` the issue doesn't carry, most recently removed by
// someone other than the owner, is fixed by restoring it. An unknown actor
// anywhere leaves that label out of `fixes` and names it in `unknown`
// instead, so the caller holds the issue back rather than fix or trust a
// label on a guess.
export function labelOriginFixes(
  labels: readonly string[],
  events: readonly IssueEvent[],
  isOwner: IsOwner,
  rules: { trustAdds: readonly string[]; trustRemovals: readonly string[] },
): { fixes: LabelFix[]; unknown: string[] } {
  throw new Error("Not implemented");
}

// The labels loadQueue trusts only from the repository owner: sandcastle:ready
// is trusted only when the owner's own add is its most recent (otherwise
// removed, so intake judges the issue again); sandcastle:needs-info and
// sandcastle:needs-human's removal is trusted as a re-queue only when the
// owner made it (otherwise restored).
export const ISSUE_LABEL_RULES = {
  trustAdds: ["sandcastle:ready"],
  trustRemovals: ["sandcastle:needs-info", "sandcastle:needs-human"],
} as const;

// The GitHub reads and writes loadQueue needs; tests pass a stub. Each
// lookup throws when GitHub can't answer.
export type QueueGitHub = {
  issuesInScope(scope: QueueScope): SandcastleIssue[];
  events(number: number): IssueEvent[];
  bodyEdits(number: number): ContentEdit[];
  isOwner: IsOwner;
  removeLabel(number: number, label: string): void;
  addLabel(number: number, label: string): void;
};

// Skip reasons already logged this run, shared by every loadQueue call
// (the gate, the follow-up sweep and intake each load the queue every
// round), so one skip prints once, not three times.
const skipsLogged = new Set<string>();

export function liveQueueGitHub(): QueueGitHub {
  throw new Error("Not implemented");
}

// Lists `scope`, then keeps only the issues the repository owner queued and
// approved (see approval), fixing any untrusted label origin first (see
// labelOriginFixes and ISSUE_LABEL_RULES). An issue outside the scope, not
// approved, or with an unknown label actor is skipped: logged once per run,
// with no comment and no write. Every phase (the gate, the follow-up sweep,
// intake) calls this instead of reading the queue directly, so each one
// filters the same way (#146).
export function loadQueue(
  scope: QueueScope = activeQueueScope(),
  github: QueueGitHub = liveQueueGitHub(),
  log: (line: string) => void = console.log,
  logged: Set<string> = skipsLogged,
): SandcastleIssue[] {
  throw new Error("Not implemented");
}
