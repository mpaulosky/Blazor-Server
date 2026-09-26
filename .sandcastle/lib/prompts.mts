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

export function plannerPromptArgs(ready: SandcastleIssue[], openPrBranches: string[]) {
  return {
    ISSUES_JSON: JSON.stringify(ready),
    OPEN_PR_BRANCHES: openPrBranches.length > 0 ? openPrBranches.join("\n") : "(none)",
  };
}
