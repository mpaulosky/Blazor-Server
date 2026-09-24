# ISSUES

Here are the open issues in the repo:

<issues-json>

!`gh issue list --state open --label Sandcastle --limit 100 --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`

</issues-json>

The list above has already been filtered to issues ready for work.

# TASK

Analyze the open issues and build a dependency graph. For each issue, determine whether it **blocks** or **is blocked by** any other open issue.

An issue B is **blocked by** issue A if:

- B requires code or infrastructure that A introduces
- B and A modify overlapping files or modules, making concurrent work likely to produce merge conflicts
- B's requirements depend on a decision or API shape that A will establish

An issue is **unblocked** if it has zero blocking dependencies on other open issues.

For each unblocked issue, assign a branch name that follows the repository convention, which the pre-push hook enforces:

- `hotfix/{id}-{slug}` when the issue has the `bug` label
- `feature/{id}-{slug}` for every other issue

`{slug}` is the issue title in kebab-case: lowercase, ASCII letters and digits only, words joined by single hyphens, with any leading conventional-commit prefix such as `feat(Domain):` dropped, and cut to at most five words.

The branch name must be deterministic so that re-planning the same issue always produces the same branch and accumulated progress is preserved. Before deriving a new name, check the existing branches below. If one already starts with `feature/{id}-` or `hotfix/{id}-`, reuse that exact name, even if the title has changed since.

!`git branch -a --format='%(refname:short)' --list 'feature/*' 'hotfix/*' 'origin/feature/*' 'origin/hotfix/*' | sed 's|^origin/||' | sort -u`

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags:

<plan>
{"issues": [{"id": "42", "title": "Fix auth bug", "branch": "hotfix/42-fix-auth-bug"}]}
</plan>

Include only unblocked issues. If every issue is blocked, include the single highest-priority candidate (the one with the fewest or weakest dependencies).

Always emit the `<plan>` tags, even when there is nothing to do. If there are no issues to work on at all, output `<plan>{"issues": []}</plan>` so the run can exit cleanly.
