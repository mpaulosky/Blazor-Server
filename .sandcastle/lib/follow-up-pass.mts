// ---------------------------------------------------------------------------
// Follow-up pass
//
// The sweep (lib/follow-up.mts) decides which PRs need a pass; this module is
// the pass itself. One pass resets the PR's worktree to its head, merges main
// in when the PR needs it, runs the follow-up role to resolve the merge and
// the PR's bot and owner review threads, gates and pushes the result, then
// replies to and resolves the role's verdicts and posts a pass-summary
// comment. See docs/plans/sandcastle-workflow.md, "Phase 1: Follow-up sweep",
// and this issue's design note (.sandcastle/work/78/design.md) for the
// step-by-step this module follows.
// ---------------------------------------------------------------------------

import { setTimeout as sleep } from "node:timers/promises";
import * as sandcastle from "@ai-hero/sandcastle";
import { z } from "zod";
import { runRoleInSandbox } from "./agents.mts";
import { originGit, originRefs } from "./branches.mts";
import {
  BROKEN_COMMENT_OPEN,
  createCheckedSandbox,
  cutAtCharacter,
  isWorkflowPushRejection,
  publicErrorText,
  retryOnServerError,
} from "./build.mts";
import { claimBuildingLabel, releaseBuildingLabel } from "./building.mts";
import { runCheckpoint, runGate, tail } from "./checkpoint.mts";
import {
  BUILDING_LABEL,
  FOLLOW_UP_MARKER,
  FOLLOW_UP_PASS_CAP,
  FOLLOW_UP_REPLY_MARKER,
  GATE_COMMENT_LINES,
  GATE_FIXER_ATTEMPTS,
} from "./config.mts";
import { UncountedStopError } from "./errors.mts";
import type { PassTarget } from "./follow-up.mts";
import {
  commentOnPullRequest,
  handBack,
  markerComments,
  pushAccess,
  replyToReviewThread,
  resolveReviewThread,
  reviewThreadsOf,
  signedInHostLogin,
  type ReviewThread,
  type SandcastleIssue,
} from "./github.mts";
import { repoGitDir, worktreeLinkProblems } from "./host-safety.mts";
import { plainText, withoutReferences } from "./intake.mts";
import { runLimits, type RunLimits } from "./limits.mts";
import { followUpPromptArgs, gateFixerPromptArgs } from "./prompts.mts";
import { ownerCheck, type IsOwner } from "./queue.mts";
import { humanThreadReport, type HumanThreadEntry } from "./report.mts";
import { containsSandboxSecret } from "./sandbox-env.mts";
import { publishedText } from "./scan.mts";
import { git } from "./shell.mts";

// Where the follow-up role writes its verdicts, relative to the worktree.
// Gitignored (.sandcastle/.gitignore), so the gate's clean-worktree check
// doesn't trip on it.
const VERDICTS_FILE = ".sandcastle/follow-up.json";

// GitHub refuses a comment over 65,536 characters; this leaves room to spare.
const COMMENT_LIMIT = 65_000;

// One review thread given to the follow-up role, trimmed to only what it
// needs (see threadsForRole): never a stranger's comment, and never more
// than a bot's or the repository owner's. Also the shape of each entry in
// lib/prompts.mts#followUpPromptArgs's THREADS_JSON.
export type PromptThread = {
  threadId: string;
  from: "bot" | "owner";
  path: string | null;
  line: number | null;
  outdated: boolean;
  comments: { author: string | null; body: string }[];
};

// Sorts a PR's open review threads for the follow-up role (runPass's step
// 2). A resolved thread is dropped outright. A thread whose first comment's
// author is a bot goes to the role as "bot". A thread the repository owner
// opened goes to the role as "owner", unless the last comment by the owner or
// `hostLogin` is the host's own reply (by `hostLogin`, opening with
// FOLLOW_UP_REPLY_MARKER, lib/config.mts): that means the host already
// answered it and is waiting on the owner, so it's dropped from every list
// rather than handed to the role again. Comments by anyone else don't count
// either way, so a stranger can neither hide an owner thread by quoting the
// marker nor reopen one by replying after the host. Any other thread,
// including one with no author at all, goes to `leftForHuman`
// (lib/report.mts#recordHumanThread records each one). A thread whose first
// author `isOwner` can't answer for goes to `unknown`, so a pass never
// decides from partial information: runPass skips the round when `unknown`
// isn't empty. Inside a kept thread, a comment by neither a bot nor the
// owner is dropped before the thread reaches the role.
export function threadsForRole(
  threads: readonly ReviewThread[],
  isOwner: IsOwner,
  hostLogin: string,
): { forRole: PromptThread[]; leftForHuman: ReviewThread[]; unknown: ReviewThread[] } {
  const forRole: PromptThread[] = [];
  const leftForHuman: ReviewThread[] = [];
  const unknown: ReviewThread[] = [];
  for (const thread of threads) {
    if (thread.resolved) continue;
    const first = thread.comments[0];
    let from: PromptThread["from"];
    if (first?.byBot === true) {
      from = "bot";
    } else {
      const owner = first === undefined ? false : isOwner(first.author);
      if (owner === undefined) {
        unknown.push(thread);
        continue;
      }
      if (!owner) {
        leftForHuman.push(thread);
        continue;
      }
      const last = thread.comments.findLast((comment) => comment.author === hostLogin || isOwner(comment.author) === true);
      if (last?.author === hostLogin && last.body.startsWith(FOLLOW_UP_REPLY_MARKER)) continue;
      from = "owner";
    }
    forRole.push({
      threadId: thread.id,
      from,
      path: thread.path,
      line: thread.line,
      outdated: thread.outdated,
      // A comment whose author's ownership can't be confirmed is dropped too:
      // only what's known to be a bot's or the owner's reaches the role.
      comments: thread.comments
        .filter((comment) => comment.byBot || isOwner(comment.author) === true)
        .map((comment) => ({ author: comment.author, body: comment.body })),
    });
  }
  return { forRole, leftForHuman, unknown };
}

// One entry of the follow-up role's .sandcastle/follow-up.json, one per
// thread it was given (see parseVerdicts). `commit` names the fix when
// `verdict` is "fixed". `invalid` (meaningful only when `verdict` is
// "declined") marks a factually wrong bot suggestion, so the host resolves
// the thread INVALID rather than WONT_FIX.
export type ThreadVerdict = {
  threadId: string;
  verdict: "fixed" | "declined" | "outdated";
  reason: string;
  commit?: string;
  invalid?: boolean;
};

// One entry of follow-up.json as parseVerdicts accepts it. A commit must look
// like a commit id, since replyBody names it on GitHub.
const verdictSchema = z.object({
  threadId: z.string().min(1),
  verdict: z.enum(["fixed", "declined", "outdated"]),
  reason: z.string().min(1),
  commit: z
    .string()
    .regex(/^[0-9a-f]{7,64}$/)
    .optional(),
  invalid: z.boolean().optional(),
});

// Parses the follow-up role's .sandcastle/follow-up.json (runPass's step 8),
// read from inside the sandbox, never from the host. Throws unless the whole
// file is a JSON array: that's the follow-up run having failed outright, not
// a single bad verdict. Each entry is checked against ThreadVerdict's shape
// on its own; one that doesn't fit goes in `rejected` rather than failing
// every other entry in the file.
export function parseVerdicts(text: string): { verdicts: ThreadVerdict[]; rejected: unknown[] } {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error(`${VERDICTS_FILE} isn't a JSON array`);
  const verdicts: ThreadVerdict[] = [];
  const rejected: unknown[] = [];
  for (const entry of parsed) {
    const result = verdictSchema.safeParse(entry);
    if (result.success) verdicts.push(result.data);
    else rejected.push(entry);
  }
  return { verdicts, rejected };
}

// How the host resolves a bot thread on GitHub (lib/github.mts#resolveReviewThread
// takes no resolution of its own, so this only ever reaches a reply and the
// pass summary): ADDRESSED for a fix or an outdated concern, WONT_FIX or
// INVALID for one declined.
export type Resolution = "ADDRESSED" | "WONT_FIX" | "INVALID";

// One verdict matched to the thread it answers (see threadActions), and how
// the host resolves it on GitHub: undefined for an owner thread, which the
// host replies to but never resolves.
export type ThreadAction = { thread: PromptThread; verdict: ThreadVerdict; resolve: Resolution | undefined };

// Matches each of `verdicts` to the thread in `given` (the threads the
// follow-up role was actually given) it answers. A verdict naming a thread
// not in `given` — an unknown id, a stranger's thread, or one already
// resolved — goes in `ignored` by its threadId rather than acted on, and so
// does a second verdict for a thread that already has one (runPass's step
// 12 relies on `actions` holding at most one entry per thread). `resolve` is
// ADDRESSED for "fixed" or "outdated", WONT_FIX for "declined" (INVALID
// instead when the verdict's `invalid` is set), and always undefined for an
// owner thread.
export function threadActions(
  verdicts: readonly ThreadVerdict[],
  given: readonly PromptThread[],
): { actions: ThreadAction[]; ignored: string[] } {
  const byId = new Map(given.map((thread) => [thread.threadId, thread]));
  const answered = new Set<string>();
  const actions: ThreadAction[] = [];
  const ignored: string[] = [];
  for (const verdict of verdicts) {
    const thread = byId.get(verdict.threadId);
    if (thread === undefined || answered.has(verdict.threadId)) {
      ignored.push(verdict.threadId);
      continue;
    }
    answered.add(verdict.threadId);
    actions.push({ thread, verdict, resolve: thread.from === "owner" ? undefined : resolutionOf(verdict) });
  }
  return { actions, ignored };
}

// How a verdict on a bot thread resolves it (see threadActions).
function resolutionOf(verdict: ThreadVerdict): Resolution {
  if (verdict.verdict !== "declined") return "ADDRESSED";
  return verdict.invalid === true ? "INVALID" : "WONT_FIX";
}

// How each verdict and resolution reads in a reply.
const VERDICT_WORDS: Record<ThreadVerdict["verdict"], string> = { fixed: "Fixed", declined: "Declined", outdated: "Outdated" };
const RESOLUTION_WORDS: Record<Resolution, string> = { ADDRESSED: "addressed", WONT_FIX: "won't fix", INVALID: "invalid" };

// Model text the host posts with its <!-- broken, so a reason quoting a host
// marker can't pass for the host's own comment (as lib/build.mts's
// designComment does, #228).
function withoutCommentOpeners(text: string): string {
  return text.replaceAll("<!--", BROKEN_COMMENT_OPEN);
}

// `text` cut to fit COMMENT_LIMIT (see lib/build.mts#cutAtCharacter).
function cutToLimit(text: string): string {
  return text.length <= COMMENT_LIMIT ? text : cutAtCharacter(text, COMMENT_LIMIT);
}

// The reply the host posts on a thread for `action` (runPass's step 12):
// FOLLOW_UP_REPLY_MARKER, a first line naming the verdict (and, for a bot
// thread, the resolution, such as "Resolved as won't fix."), then the reason
// — through `publicError`, which hides a secret, with its <!-- and every
// @mention or #123 reference outside code broken — and "Fixed in <commit>"
// when the verdict names one. Cut to fit GitHub's comment limit.
export function replyBody(action: ThreadAction, publicError: (text: string) => string): string {
  const { verdict, resolve } = action;
  const lead =
    resolve === undefined
      ? `**${VERDICT_WORDS[verdict.verdict]}.** Left open for the repository owner.`
      : `**${VERDICT_WORDS[verdict.verdict]}.** Resolved as ${RESOLUTION_WORDS[resolve]}.`;
  const reason = withoutReferences(withoutCommentOpeners(publicError(verdict.reason)));
  const commit = verdict.commit === undefined ? [] : [`Fixed in ${verdict.commit}.`];
  return cutToLimit([`${FOLLOW_UP_REPLY_MARKER}\n${lead}`, reason, ...commit].join("\n\n"));
}

// One pass's outcome, for passSummaryComment: which attempt this was, what
// commit was pushed (undefined when nothing needed pushing), whether main
// needed merging in and how that went, every thread action taken, the
// ignored verdicts, the "fixed" verdicts left unanswered because their commit
// didn't check out (see fixesInPush), any GitHub write that failed, and how
// many threads were left for a person.
export type PassReport = {
  pass: number;
  pushed: string | undefined;
  merged: "none" | "clean" | "conflicts";
  actions: ThreadAction[];
  ignored: string[];
  unverified: string[];
  failedWrites: string[];
  leftForHuman: number;
};

// How the pass summary says main was merged in, if it was.
const MERGE_SENTENCES: Record<PassReport["merged"], string[]> = {
  none: [],
  clean: ["Merged `main` into the branch."],
  conflicts: ["Merged `main` into the branch and resolved its conflicts."],
};

// The PR comment a pass posts once it's done (runPass's step 13):
// FOLLOW_UP_MARKER, "Follow-up pass n of FOLLOW_UP_PASS_CAP", what was
// pushed, and one line per thread action naming its verdict and resolution,
// or "left open for the owner" for one that was only replied to. The role's
// text in it goes through `publicError` first, as replyBody's does.
export function passSummaryComment(report: PassReport, publicError: (text: string) => string): string {
  const lines = [`${FOLLOW_UP_MARKER}\nSandcastle's follow-up pass ${report.pass} of ${FOLLOW_UP_PASS_CAP} on this PR.`];
  const pushed =
    report.pushed === undefined ? "Nothing needed pushing." : `Pushed \`${report.pushed}\`, which passed \`scripts/gate.sh\`.`;
  lines.push([...MERGE_SENTENCES[report.merged], pushed].join(" "));
  if (report.actions.length > 0) {
    lines.push(["Review threads:", ...report.actions.map((action) => summaryLine(action, publicError))].join("\n"));
  }
  if (report.ignored.length > 0) {
    lines.push(`Ignored verdicts for threads the follow-up role wasn't given, or already answered: ${idList(report.ignored, publicError)}.`);
  }
  if (report.unverified.length > 0) {
    lines.push(
      `Left open, since their "fixed" verdict names no commit this pass added to the branch: ${idList(report.unverified, publicError)}.`,
    );
  }
  if (report.failedWrites.length > 0) {
    lines.push(`These GitHub writes failed: ${report.failedWrites.join("; ")}.`);
  }
  if (report.leftForHuman > 0) {
    lines.push(
      `${report.leftForHuman} review thread(s) opened by someone other than the repository owner or a bot were left for a person.`,
    );
  }
  return cutToLimit(lines.join("\n\n"));
}

// Model text for the pass summary: through `publicError`, which hides a
// secret, before it's cut (a secret cut in half no longer matches), then cut
// to `limit` without splitting a character, which GitHub would refuse, and
// kept to plain text.
function summaryText(text: string, limit: number, publicError: (text: string) => string): string {
  return plainText(cutAtCharacter(publicError(text), limit));
}

// Thread ids the role wrote, for a line of the pass summary.
function idList(ids: readonly string[], publicError: (text: string) => string): string {
  return ids.map((id) => summaryText(id, 100, publicError)).join(", ");
}

// One thread action's line in the pass summary. The reason is model text, so
// it's cut short; the reply on the thread has it all.
function summaryLine(action: ThreadAction, publicError: (text: string) => string): string {
  const { thread, verdict, resolve } = action;
  const where = thread.path === null ? "" : ` on ${plainText(thread.path)}${thread.line === null ? "" : `:${thread.line}`}`;
  const outcome = resolve === undefined ? "left open for the owner" : `resolved ${resolve}`;
  return `- ${thread.from} thread${where}: ${verdict.verdict}, ${outcome}. ${summaryText(verdict.reason, 300, publicError)}`;
}

// The PR hand-back comment for a pass that gave up (runPass's step 4, 9, 10,
// 11): why, then the tail of the last gate output or the role's error (when
// given) in a fence longer than any backtick run in it, and how to re-queue
// the PR (remove sandcastle:needs-human).
export function giveUpComment(reason: string, output: string | undefined): string {
  const parts = [
    `Sandcastle stopped its follow-up passes on this PR: ${reason}. It's labelled \`sandcastle:needs-human\` until a person ` +
      "has looked at it.",
  ];
  if (output !== undefined && output.trim() !== "") {
    const quoted = tail(output, GATE_COMMENT_LINES);
    const longestRun = Math.max(0, ...[...quoted.matchAll(/`+/g)].map((match) => match[0].length));
    const fence = "`".repeat(Math.max(3, longestRun + 1));
    parts.push(`The last ${GATE_COMMENT_LINES} lines of the output:\n\n${fence}text\n${quoted}\n${fence}`);
  }
  parts.push(
    "To have Sandcastle pick the PR up again, remove `sandcastle:needs-human`. That also starts its count of follow-up " +
      "passes again.",
  );
  return cutToLimit(parts.join("\n\n"));
}

// What one call to runPass decided or did:
// - "skipped": nothing counted against FOLLOW_UP_PASS_CAP (the head moved
//   since the sweep read it, there's nothing a pass handles yet, or
//   markBuilding said another run already has the issue);
// - "passed": the pass ran to completion; `pushed` is the commit pushed, or
//   undefined when nothing needed pushing;
// - "push-failed": the gated commit failed to push because someone pushed to
//   the PR meanwhile (its head on GitHub moved, or couldn't be read); not
//   counted and not a give-up, so the next sweep tries again with the PR's
//   new head. A push that failed with the head unmoved gives up instead, and
//   one that reported an error but landed counts as pushed;
// - "gave-up": the PR was handed back with sandcastle:needs-human.
export type PassOutcome =
  | { kind: "skipped"; reason: string }
  | { kind: "passed"; pushed: string | undefined }
  | { kind: "push-failed"; error: string }
  | { kind: "gave-up"; reason: string };

// What runPass needs from outside the pass itself; tests pass a stub. The
// live wiring sits at the bottom of this module.
export type PassHost = {
  // branches.mts's originGit.fetch, so the sandbox's createSandbox(branch)
  // checks the PR's head out from its remote-tracking ref.
  fetchBranch(branch: string): void;
  // lib/github.mts#reviewThreadsOf.
  reviewThreads(pr: number): { headRefOid: string; threads: ReviewThread[] };
  // lib/queue.mts#ownerCheck(signedInHostLogin, pushAccess).
  isOwner: IsOwner;
  // lib/github.mts#signedInHostLogin: who the host's replies are posted as.
  hostLogin(): string;
  // FOLLOW_UP_MARKER comments posted since sandcastle:needs-human was last
  // removed (lib/github.mts#markerComments), counted against
  // FOLLOW_UP_PASS_CAP.
  passCount(pr: number): number;
  // git merge-base --is-ancestor, in the main checkout.
  contains(commit: string, ancestor: string): boolean;
  // lib/building.mts#claimBuildingLabel.
  markBuilding(issue: number): boolean;
  // lib/building.mts#releaseBuildingLabel.
  unmarkBuilding(issue: number): void;
  createSandbox(branch: string): Promise<sandcastle.Sandbox>;
  // lib/host-safety.mts's worktree-tamper check, as lib/build.mts#BuildHost
  // already exposes it.
  worktreeProblems(path: string): string[];
  // lib/scan.mts#publishedText, checked with lib/sandbox-env.mts#containsSandboxSecret.
  leaksSecret(base: string, commit: string): boolean;
  // A plain push of the gated commit to the PR's branch, retried on a
  // GitHub server error the way lib/build.mts#publish's push is.
  push(branch: string, commit: string): Promise<void>;
  // branches.mts's originRefs.remoteHead: the branch's head on GitHub now.
  remoteHead(branch: string): string | undefined;
  // lib/github.mts#replyToReviewThread.
  replyToThread(threadId: string, body: string): void;
  // lib/github.mts#resolveReviewThread.
  resolveThread(threadId: string): void;
  // lib/github.mts#commentOnPullRequest.
  commentOnPullRequest(pr: number, body: string): void;
  // lib/github.mts#handBack({ kind: "pr", number: pr }, "sandcastle:needs-human", reason, body).
  handBack(pr: number, reason: string, body: string): void;
  // lib/report.mts#humanThreadReport.record.
  recordHumanThread(entry: HumanThreadEntry): void;
  // lib/build.mts#publicErrorText, checked against the sandbox's secrets.
  publicError(text: unknown): string;
  // The run's limits (lib/limits.mts#runLimits): runPass runs the follow-up
  // role and the gate-fixer through runRoleInSandbox(..., host.limits).
  limits: RunLimits;
  log(line: string): void;
};

// The live PassHost.
export const livePassHost: PassHost = {
  fetchBranch: (branch) => originGit.fetch(branch),
  reviewThreads: (pr) => reviewThreadsOf(pr),
  isOwner: ownerCheck(
    () => signedInHostLogin(),
    (login) => pushAccess(login),
  ),
  hostLogin: () => signedInHostLogin(),
  passCount: (pr) => markerComments(pr, "sandcastle:needs-human", FOLLOW_UP_MARKER).length,
  contains: (commit, ancestor) => originRefs.contains(commit, ancestor),
  markBuilding: (issue) => claimBuildingLabel(issue),
  unmarkBuilding: (issue) => releaseBuildingLabel(issue),
  createSandbox: (branch) => createCheckedSandbox(branch),
  worktreeProblems: (path) => worktreeLinkProblems(path, repoGitDir()),
  leaksSecret: (base, commit) => containsSandboxSecret(publishedText(base, commit)),
  push: (branch, commit) =>
    retryOnServerError(
      () => void git("push", "--quiet", "origin", `${commit}:refs/heads/${branch}`),
      (ms) => sleep(ms),
    ),
  remoteHead: (branch) => originRefs.remoteHead(branch),
  replyToThread: (threadId, body) => replyToReviewThread(threadId, body),
  resolveThread: (threadId) => resolveReviewThread(threadId),
  commentOnPullRequest: (pr, body) => commentOnPullRequest(pr, body),
  handBack: (pr, reason, body) => handBack({ kind: "pr", number: pr }, "sandcastle:needs-human", reason, body),
  // A thread left for a person is found again every round a pass looks at
  // its PR, so the run's report lists it once.
  recordHumanThread: (entry) => {
    if (!humanThreadReport.items().some((item) => item.url === entry.url)) humanThreadReport.record(entry);
  },
  publicError: (text) => publicErrorText(String(text instanceof Error ? text.message : text), containsSandboxSecret),
  limits: runLimits,
  log: (line) => console.log(line),
};

// `value` as one single-quoted shell word. Every value runPass puts in a
// sandbox command comes from GitHub or the host's git, never the role, but
// it's quoted anyway rather than trusted to hold no shell syntax.
function shellWord(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

// Whether `ancestor` is in `commit`'s history, asked in the sandbox's
// worktree, where the role's commits are.
async function sandboxContains(sandbox: Pick<sandcastle.Sandbox, "exec">, commit: string, ancestor: string): Promise<boolean> {
  const result = await sandbox.exec(`git merge-base --is-ancestor ${shellWord(ancestor)} ${shellWord(commit)}`);
  return result.exitCode === 0;
}

// Runs the follow-up role and reads its verdicts from VERDICTS_FILE. Returns
// them, or the outcome from `stop` when the role failed, ended unfinished or
// wrote no usable file. An UncountedStopError is rethrown.
async function followUpVerdicts(
  sandbox: sandcastle.Sandbox,
  issue: SandcastleIssue,
  target: PassTarget,
  forRole: PromptThread[],
  mergeNote: string,
  host: PassHost,
  stop: (reason: string, output?: string) => PassOutcome,
): Promise<ThreadVerdict[] | PassOutcome> {
  let run: sandcastle.SandboxRunResult;
  try {
    run = await runRoleInSandbox(
      sandbox,
      "follow-up",
      {
        promptFile: "./.sandcastle/roles/follow-up.md",
        promptArgs: followUpPromptArgs(issue, target.headRefName, target.number, forRole, mergeNote),
      },
      host.limits,
    );
  } catch (error) {
    if (error instanceof UncountedStopError) throw error;
    return stop("the follow-up run failed", String(error));
  }
  if (run.completionSignal === undefined) return stop("the follow-up run ended unfinished");

  // Read inside the sandbox, never from the host: the role wrote it, and
  // it could be a symlink to a host file.
  const file = await sandbox.exec(`cat ${VERDICTS_FILE} 2>/dev/null`);
  if (file.exitCode !== 0) {
    return forRole.length > 0 ? stop(`the follow-up run wrote no \`${VERDICTS_FILE}\` for the threads it was given`) : [];
  }
  try {
    const parsed = parseVerdicts(file.stdout);
    if (parsed.rejected.length > 0) host.log(`  PR #${target.number} ignored ${parsed.rejected.length} malformed verdict(s) in ${VERDICTS_FILE}`);
    return parsed.verdicts;
  } catch (error) {
    return stop(`the follow-up run's \`${VERDICTS_FILE}\` isn't a JSON array of verdicts`, String(error));
  }
}

// Splits `verdicts` into those the host acts on and the ids of "fixed" ones
// it doesn't. A "fixed" verdict is kept only when its commit is one this pass
// added: it resolves in the sandbox, `gated` contains it and `head` (the PR's
// head before the pass) doesn't. Otherwise the reply would say "Fixed in" a
// commit the PR doesn't hold, or resolve a bot thread nothing changed for, and
// nobody would look at it again. An unverified verdict's thread is left open,
// so the next pass sees it again.
async function fixesInPush(
  sandbox: Pick<sandcastle.Sandbox, "exec">,
  verdicts: readonly ThreadVerdict[],
  gated: string,
  head: string,
): Promise<{ kept: ThreadVerdict[]; unverified: string[] }> {
  const kept: ThreadVerdict[] = [];
  const unverified: string[] = [];
  for (const verdict of verdicts) {
    if (verdict.verdict !== "fixed") {
      kept.push(verdict);
      continue;
    }
    const resolved =
      verdict.commit === undefined
        ? undefined
        : (await sandbox.exec(`git rev-parse --verify --quiet ${shellWord(`${verdict.commit}^{commit}`)}`)).stdout.trim();
    const added =
      resolved !== undefined &&
      /^[0-9a-f]{40,64}$/.test(resolved) &&
      (await sandboxContains(sandbox, gated, resolved)) &&
      !(await sandboxContains(sandbox, head, resolved));
    if (added) kept.push(verdict);
    else unverified.push(verdict.threadId);
  }
  return { kept, unverified };
}

// Runs one follow-up pass on `target`, a PR the sweep (lib/follow-up.mts)
// marked as needing one, for its issue. See this module's header and the
// design note at .sandcastle/work/78/design.md for the step-by-step: reset
// the PR's worktree to its head, merge main in when the PR needs it, run the
// follow-up role, gate and push, then reply to and resolve the role's
// verdicts and post the pass summary. `base` is the commit fetchMain()
// resolved origin/main to this round.
export async function runPass(
  target: PassTarget,
  issue: SandcastleIssue,
  base: string,
  host: PassHost = livePassHost,
): Promise<PassOutcome> {
  const log = (line: string) => host.log(`  PR #${target.number} ${line}`);
  const skip = (reason: string): PassOutcome => {
    log(`isn't given a follow-up pass this round: ${reason}.`);
    return { kind: "skipped", reason };
  };

  // Read before the claim, so a PR with nothing to do doesn't have its issue
  // labelled every round, and read again once the claim is held: another run
  // may have passed on the PR in between, so what it decides from must be
  // read while no other run can change it.
  const before = planPass(target, base, host, skip);
  if (!("forRole" in before)) return before;

  // Claimed as a build claims it, so two runs never pass on one PR or share
  // its worktree, and a build of the same issue stands aside meanwhile.
  if (!host.markBuilding(issue.number)) return skip(`another run marked #${issue.number} ${BUILDING_LABEL}`);
  try {
    const plan = planPass(target, base, host, skip);
    if (!("forRole" in plan)) return plan;
    return await passOnMarkedIssue(target, issue, base, host, plan);
  } finally {
    try {
      host.unmarkBuilding(issue.number);
    } catch (error) {
      console.error(`  ⚠ #${issue.number}: removing ${BUILDING_LABEL} failed, so it's tried again when this run exits: ${error}`);
    }
  }
}

// What runPass decides from: the PR's head and threads, and its pass count,
// read from GitHub. Returns the plan for a pass, or the outcome when there's
// to be none: skipped (the head moved since the sweep read it, an author's
// ownership is unknown, or there's nothing a pass handles) or handed back
// (the PR has had FOLLOW_UP_PASS_CAP passes). Records each thread left for a
// person.
function planPass(
  target: PassTarget,
  base: string,
  host: PassHost,
  skip: (reason: string) => PassOutcome,
): PassPlan | PassOutcome {
  const { headRefOid, threads } = host.reviewThreads(target.number);
  if (headRefOid !== target.headRefOid) return skip("its head moved since the sweep read it");
  const sorted = threadsForRole(threads, host.isOwner, host.hostLogin());
  if (sorted.unknown.length > 0) return skip("couldn't check whether a review thread's author is the repository owner");
  for (const thread of sorted.leftForHuman) {
    const first = thread.comments[0];
    host.recordHumanThread({ pr: target.number, author: first?.author ?? null, url: first?.url ?? "" });
  }
  // Only a needed merge or a bot thread starts a pass. A PR that's only red
  // on CI waits for #79, and one with only owner threads keeps the sweep's
  // rule that human threads alone don't start a pass, so an owner thread is
  // answered only alongside one of the two.
  const needsMerge = !host.contains(target.headRefOid, base);
  if (!needsMerge && !sorted.forRole.some((thread) => thread.from === "bot")) {
    return skip("there's nothing a follow-up pass handles yet");
  }

  const passCount = host.passCount(target.number);
  if (passCount >= FOLLOW_UP_PASS_CAP) {
    return giveUp(
      target,
      host,
      `it has had ${FOLLOW_UP_PASS_CAP} follow-up passes already and still needs another (${target.reasons.join("; ")})`,
      undefined,
    );
  }
  return { forRole: sorted.forRole, leftForHuman: sorted.leftForHuman.length, needsMerge, passCount };
}

// Hands the PR back with sandcastle:needs-human (see giveUpComment), quoting
// `output` once it's safe to post. A hand-back that fails is logged: the next
// round's sweep finds the PR again.
function giveUp(target: PassTarget, host: PassHost, reason: string, output: string | undefined): PassOutcome {
  host.log(`  ✋ PR #${target.number}: ${reason}, so it's handed back.`);
  try {
    host.handBack(target.number, reason, giveUpComment(reason, output === undefined ? undefined : host.publicError(output)));
  } catch (error) {
    console.error(`  ⚠ PR #${target.number}: handing it back failed, so the next round tries again: ${error}`);
  }
  return { kind: "gave-up", reason };
}

// What planPass decided, read again once the issue was marked: the threads
// for the role, how many were left for a person, whether main needs merging
// in, and how many passes the PR has already had.
type PassPlan = { forRole: PromptThread[]; leftForHuman: number; needsMerge: boolean; passCount: number };

// runPass's work once the issue is marked: everything from creating the
// sandbox to closing it.
async function passOnMarkedIssue(
  target: PassTarget,
  issue: SandcastleIssue,
  base: string,
  host: PassHost,
  { forRole, leftForHuman, needsMerge, passCount }: PassPlan,
): Promise<PassOutcome> {
  const branch = target.headRefName;
  const log = (line: string) => host.log(`  PR #${target.number} ${line}`);
  const stop = (reason: string, output?: string) => giveUp(target, host, reason, output);
  const sandbox = await host.createSandbox(branch);
  try {
    // GitHub's head is the PR's state: a reused worktree can hold a stopped
    // pass's unpushed commits, a half-done merge or an earlier verdicts file.
    const reset = await sandbox.exec(`git reset --hard ${shellWord(target.headRefOid)} && git clean -fd`);
    if (reset.exitCode !== 0) return stop("resetting the worktree to the PR's head failed", `${reset.stdout}\n${reset.stderr}`);
    await sandbox.exec(`rm -f ${VERDICTS_FILE}`);
    const head = await sandbox.exec("git rev-parse HEAD");
    if (head.stdout.trim() !== target.headRefOid) return stop("the worktree isn't at the PR's head after resetting it to it");

    // Merged, never rebased: the push that follows is a plain one, so the
    // PR's history stays as reviewers saw it.
    let merged: PassReport["merged"] = "none";
    let mergeNote = "The branch already contains main, so there's no merge to finish.";
    if (needsMerge) {
      const merge = await sandbox.exec(`git merge --no-edit -m ${shellWord(`Merge main into ${branch}`)} ${shellWord(base)}`);
      if (merge.exitCode === 0) {
        merged = "clean";
        mergeNote = "The host merged main into the branch cleanly, so there's no merge to finish.";
      } else {
        const conflicted = await sandbox.exec("git diff --name-only --diff-filter=U");
        const files = conflicted.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
        // No conflicted file means the merge failed for some other reason.
        if (conflicted.exitCode !== 0 || files.length === 0) return stop("merging main into the branch failed", `${merge.stdout}\n${merge.stderr}`);
        merged = "conflicts";
        mergeNote =
          `The host's merge of main into the branch conflicted in: ${files.join(", ")}. Resolve every conflict, then ` +
          "finish the merge with `git commit --no-edit`.";
      }
    }

    // With no conflict to resolve and no thread to answer, the role has
    // nothing to do, and a run of it would only cost usage or make changes
    // nobody asked for.
    let verdicts: ThreadVerdict[] = [];
    if (merged === "conflicts" || forRole.length > 0) {
      const role = await followUpVerdicts(sandbox, issue, target, forRole, mergeNote, host, stop);
      if (!Array.isArray(role)) return role;
      verdicts = role;
      log("follow-up finished");
    }

    const gate = await runCheckpoint(
      2,
      {
        gate: () => runGate(sandbox),
        fix: (at, gateOutput) =>
          runRoleInSandbox(
            sandbox,
            "gate-fixer",
            { promptFile: "./.sandcastle/roles/gate-fixer.md", promptArgs: gateFixerPromptArgs(issue, branch, at, gateOutput) },
            host.limits,
          ),
        uncounted: (error) => error instanceof UncountedStopError,
      },
      log,
    );
    // An unresolved conflict ends here too: it leaves the worktree dirty.
    // lib/checkpoint.mts#runGate reports a dirty worktree, or a HEAD that
    // moved or can't be read, as a gate that didn't pass, so the reason names
    // each and the quoted output says which.
    if (!gate.passed || gate.head === undefined) {
      return stop(
        `\`scripts/gate.sh\` didn't pass on a known, clean commit after ${GATE_FIXER_ATTEMPTS} gate-fixer attempts: it's ` +
          "red, the worktree isn't clean, or HEAD moved while it ran",
        gate.output,
      );
    }
    const gated = gate.head;
    if (!(await sandboxContains(sandbox, gated, target.headRefOid))) {
      return stop("the gated commit doesn't contain the PR's head, so the PR's history was rewritten");
    }
    if (needsMerge && !(await sandboxContains(sandbox, gated, base))) {
      return stop("the gated commit doesn't contain main, so the merge with main was abandoned");
    }

    let pushed: string | undefined;
    if (gated !== target.headRefOid) {
      // The push is public, and the sandbox holds the Claude token or API
      // key. The comment doesn't say where the secret is: the PR is public too.
      if (host.leaksSecret(base, gated)) {
        return stop(
          "a commit holds one of the sandbox's secrets, or something shaped like a Claude or GitHub token, so nothing " +
            "was pushed. Find it before anything pushes the branch, and rotate the secret if it has left the machine",
        );
      }
      try {
        await host.push(branch, gated);
        pushed = gated;
      } catch (error) {
        // Sandcastle's token can't push a .github/workflows/** change, such
        // as one main's merge brought in, so a retry would only fail again.
        if (isWorkflowPushRejection(error)) {
          return stop(
            "GitHub refused the push because it changes a workflow file, which Sandcastle's token can't push. A person " +
              "has to bring main's workflow change into the branch",
            String(error),
          );
        }
        // Only a race is worth another round: the next sweep reads the new
        // head and tries again, uncounted. With the head unmoved the same push
        // fails again (branch protection, a token without push rights), and
        // with no summary posted the cap would never stop the PR being passed
        // on every round, so it's handed back.
        let remote: string | undefined;
        try {
          remote = host.remoteHead(branch);
        } catch {
          remote = undefined;
        }
        // A retried push can land and still end in a server error.
        if (remote === gated) {
          log(`pushed ${gated}, although the push reported an error: ${error}`);
        } else if (remote === target.headRefOid) {
          return stop("GitHub refused the push, and the PR's head hasn't moved, so pushing again would fail the same way", String(error));
        } else {
          log(`couldn't push ${gated}, since the PR's head moved, so no reply or summary is posted and the next round tries again: ${error}`);
          return { kind: "push-failed", error: host.publicError(error) };
        }
        pushed = gated;
      }
    }

    const { kept, unverified } = await fixesInPush(sandbox, verdicts, gated, target.headRefOid);
    if (unverified.length > 0) log(`left ${unverified.length} "fixed" verdict(s) unanswered: their commit isn't one this pass added`);
    const { actions, ignored } = threadActions(kept, forRole);
    const failedWrites = answerThreads(actions, host, log);
    try {
      host.commentOnPullRequest(
        target.number,
        passSummaryComment(
          { pass: passCount + 1, pushed, merged, actions, ignored, unverified, failedWrites, leftForHuman },
          (text) => host.publicError(text),
        ),
      );
    } catch (error) {
      log(`posting the pass summary failed, so this pass isn't counted: ${error}`);
    }
    log(`had follow-up pass ${passCount + 1} of ${FOLLOW_UP_PASS_CAP}${pushed === undefined ? ", with nothing to push" : `, pushing ${pushed}`}.`);
    return { kind: "passed", pushed };
  } finally {
    // Sandcastle's close() runs git in the worktree; leave one that no longer
    // points at this repository, with its sandbox, for a person to look at.
    const problems = host.worktreeProblems(sandbox.worktreePath);
    if (problems.length > 0) {
      console.error(`  ✗ PR #${target.number}: left ${sandbox.worktreePath} and its sandbox in place: ${problems.join("; ")}`);
      try {
        host.commentOnPullRequest(
          target.number,
          `Sandcastle stopped: the worktree for \`${branch}\` no longer points at this repository, so it was left for a ` +
            "person to look at. Don't run git in it.",
        );
      } catch (error) {
        console.error(`  ⚠ PR #${target.number}: commenting on the tampered worktree failed: ${error}`);
      }
    } else {
      await sandbox.close();
    }
  }
}

// Replies to each of `actions`' threads and resolves the bot threads among
// them, carrying on past a write that fails. Returns the writes that failed,
// for the pass summary.
function answerThreads(actions: readonly ThreadAction[], host: PassHost, log: (line: string) => void): string[] {
  const failedWrites: string[] = [];
  for (const action of actions) {
    const id = action.thread.threadId;
    try {
      host.replyToThread(id, replyBody(action, (text) => host.publicError(text)));
    } catch (error) {
      log(`replying on thread ${id} failed: ${error}`);
      failedWrites.push(`the reply on thread ${id}`);
      // A thread isn't resolved without the reply that says why.
      continue;
    }
    if (action.resolve === undefined) continue;
    try {
      host.resolveThread(id);
    } catch (error) {
      log(`resolving thread ${id} failed: ${error}`);
      failedWrites.push(`resolving thread ${id}`);
    }
  }
  return failedWrites;
}

// main.mts's pass phase: fetches every target's branch serially first (a
// failed fetch skips that PR for the round, as prepareBranches'
// lib/branches.mts#fetchMain-style fetches do), then runs runPass for each
// PR whose issue is in `issues` with Promise.allSettled, logging each
// outcome. A rejection is logged and the PR is swept again next round. Once
// every pass has settled, the first UncountedStopError among them (a usage
// or time-budget stop from the follow-up role or the gate-fixer) is
// rethrown, so main.mts's catch ends the run cleanly rather than the round
// carrying on as if nothing had stopped it. Returns one outcome per target,
// in order; a PR that wasn't passed on is "skipped".
export async function followUpPassPhase(
  targets: readonly PassTarget[],
  issues: readonly SandcastleIssue[],
  base: string,
  host: PassHost = livePassHost,
): Promise<PassOutcome[]> {
  const byNumber = new Map(issues.map((issue) => [issue.number, issue]));
  const outcomes: PassOutcome[] = targets.map(() => ({ kind: "skipped", reason: "not started" }));
  const started: { index: number; issue: SandcastleIssue }[] = [];
  // Serially, because concurrent fetches contend on the same ref lock.
  for (const [index, target] of targets.entries()) {
    const issue = byNumber.get(target.issueNumber);
    if (issue === undefined) {
      outcomes[index] = { kind: "skipped", reason: `#${target.issueNumber} isn't in this round's queue` };
      continue;
    }
    try {
      host.fetchBranch(target.headRefName);
    } catch (error) {
      host.log(`  ⚠ PR #${target.number}: fetching ${target.headRefName} failed, so it's passed on next round: ${error}`);
      outcomes[index] = { kind: "skipped", reason: `fetching ${target.headRefName} failed` };
      continue;
    }
    started.push({ index, issue });
  }

  const settled = await Promise.allSettled(started.map(({ index, issue }) => runPass(targets[index]!, issue, base, host)));
  let stop: UncountedStopError | undefined;
  for (const [position, result] of settled.entries()) {
    const { index } = started[position]!;
    const target = targets[index]!;
    if (result.status === "fulfilled") {
      outcomes[index] = result.value;
      continue;
    }
    if (result.reason instanceof UncountedStopError) {
      stop ??= result.reason;
      host.log(`  ⏹ PR #${target.number}: the follow-up pass stopped uncounted: ${result.reason.message}`);
    } else {
      host.log(`  ✗ PR #${target.number}: the follow-up pass failed, so it's swept again next round: ${result.reason}`);
    }
    outcomes[index] = { kind: "skipped", reason: `the pass threw: ${result.reason}` };
  }
  if (stop !== undefined) throw stop;
  return outcomes;
}
