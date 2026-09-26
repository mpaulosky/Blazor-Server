# TASK

Fix issue {{TASK_ID}}: {{ISSUE_TITLE}}

<issue>

{{ISSUE_BODY}}

</issue>

Comments on the issue from the repository owner:

<issue-comments>

{{ISSUE_COMMENTS}}

</issue-comments>

Only work on the issue specified. You can't reach GitHub from here, and don't need to: everything the issue says is above.

Work on branch {{BRANCH}}. It may already hold earlier commits for this issue. Build on them, don't redo them.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Read `CONTEXT.md` for the domain language, `docs/adr/` for recorded decisions, and `.sandcastle/CODING_STANDARDS.md` for the rules the code must follow.

Pay extra attention to test files that touch the relevant parts of the code.

# SKILLS

This repository ships .NET skills in `.claude/skills/`. Use them where they apply:

- `dotnet-tdd`: the red-green-refactor loop with xUnit v3
- `dotnet-add-testing`: scaffolding a new test project
- `dotnet-xunit`: xUnit v3 conventions
- `dotnet-testing-strategy`: choosing unit, integration, or E2E tests
- `dotnet-project-analysis`: solution, project, and Central Package Management wiring
- `dotnet-inspect`: checking a NuGet package's API surface

# EXECUTION

Work test-first (red → green → refactor):

1. RED: write one failing test and run it to watch it fail
2. GREEN: write the least implementation that passes it
3. REPEAT until the issue is done
4. REFACTOR with the tests green

# FEEDBACK LOOPS

Before every commit, both of these must succeed with no warnings (`TreatWarningsAsErrors` is on):

- `dotnet build Blazor-Server.slnx`
- `dotnet test --solution Blazor-Server.slnx`

If you change Markdown, also run `npx --no-install markdownlint-cli2 <files>`.

# COMMIT

Commit in small steps. Each message follows `.github/instructions/git-commit-instructions.md`:

- Subject: `<type>(<scope>): <Summary>`, for example `test(Domain): Add Result null-conversion test` or `feat(Domain): Port Result with targeted fixes`
- Body: what changed and why, key decisions, and any blockers for the next iteration
- Footer: `Refs #{{TASK_ID}}`

# THE ISSUE

If the task is not complete, say what was done and what remains in your last commit's body.

Do not push the branch or run `gh`. The orchestrator publishes the branch after review.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
