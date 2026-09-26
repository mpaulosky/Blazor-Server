// Prompt arguments built from GitHub content. Roles can't reach GitHub, so this
// is everything they learn about an issue. The issues passed in have already
// lost every comment but the owner's (see ownerApproved).

import type { SandcastleIssue } from "./github.mts";

export function issuePromptArgs(issue: SandcastleIssue, branch: string) {
  return {
    TASK_ID: String(issue.number),
    ISSUE_TITLE: issue.title,
    ISSUE_BODY: issue.body,
    ISSUE_COMMENTS: issue.comments.length > 0 ? issue.comments.join("\n\n---\n\n") : "(no comments)",
    BRANCH: branch,
  };
}

// The host names branches and has already dropped issues with an open PR, so
// the planner needs only the ready issues.
export function plannerPromptArgs(ready: SandcastleIssue[]) {
  return { ISSUES_JSON: JSON.stringify(ready) };
}

// An open Sandcastle issue whose PR is waiting for review, with the files that
// PR changes.
export type InFlightPrompt = { issue: SandcastleIssue; pr: number; branch: string; files: string[] };

// The round's picks, the in-flight issues and the ready issues the planner left
// out. The critique compares the picks with each other and with the rest.
export function critiquePromptArgs(picks: SandcastleIssue[], inFlight: InFlightPrompt[], unpicked: SandcastleIssue[]) {
  return {
    PICKED_JSON: JSON.stringify(picks),
    IN_FLIGHT_JSON: JSON.stringify(
      inFlight.map(({ issue, pr, branch, files }) => ({ number: issue.number, title: issue.title, body: issue.body, pr, branch, files })),
    ),
    UNPICKED_JSON: JSON.stringify(unpicked),
  };
}

export type CritiquePromptArgs = ReturnType<typeof critiquePromptArgs>;
