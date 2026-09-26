// Prompt arguments built from GitHub content. Roles can't reach GitHub, so this
// is everything they learn about an issue. The issues passed in have already
// lost every comment but the owner's (see ownerApproved).

import type { Checkpoint } from "./checkpoint.mts";
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

// The gate-fixer needs the issue, since at checkpoint 1 it may finish the
// implementation, plus the red gate's output and which checkpoint it's at.
export function gateFixerPromptArgs(issue: SandcastleIssue, branch: string, checkpoint: Checkpoint, gateOutput: string) {
  return { ...issuePromptArgs(issue, branch), CHECKPOINT: String(checkpoint), GATE_OUTPUT: gateOutput };
}

// The host names branches and has already dropped issues with an open PR, so
// the planner needs only the ready issues.
export function plannerPromptArgs(ready: SandcastleIssue[]) {
  return { ISSUES_JSON: JSON.stringify(ready) };
}
