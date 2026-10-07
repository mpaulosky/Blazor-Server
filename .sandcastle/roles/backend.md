# TASK

Make the tests pass for issue {{TASK_ID}}: {{ISSUE_TITLE}}

<issue>

{{ISSUE_BODY}}

</issue>

Comments on the issue from the repository owner:

<issue-comments>

{{ISSUE_COMMENTS}}

</issue-comments>

Only work on the issue specified. You can't reach GitHub from here, and don't need to: everything the issue says is above.

Work on branch {{BRANCH}}. It may already hold earlier commits for this issue. Build on them, don't redo them.

You are the backend developer. The tester ran before you and committed failing tests for the issue's acceptance criteria, with stubs that throw `NotImplementedException`. Your job is to
make those tests pass.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Read `CONTEXT.md` for the domain language, `docs/adr/` for recorded decisions, and `docs/CODING_STANDARDS.md` for the rules the code must follow.

Read the tester's commits on this branch first: their tests are the specification you implement.

# SKILLS

These .NET skills are mounted into the sandbox from the host's `~/.claude/skills/`. Use them where they apply:

- `dotnet-tdd`: the red-green-refactor loop with xUnit v3
- `dotnet-add-testing`: scaffolding a new test project
- `dotnet-xunit`: xUnit v3 conventions
- `dotnet-testing-strategy`: choosing unit, integration, or E2E tests
- `dotnet-project-analysis`: solution, project, and Central Package Management wiring
- `dotnet-inspect`: checking a NuGet package's API surface

# EXECUTION

Work test-first (red → green → refactor), one failing test at a time:

1. RED: pick a failing acceptance test, or write a smaller unit test of your own for a piece the acceptance tests need, and run it to watch it fail
2. GREEN: write the least implementation that passes it
3. REPEAT until every test passes
4. REFACTOR with the tests green

Never weaken the tester's tests to make them pass: don't remove or loosen an assertion, add `Skip`, comment a test out, or delete one. When a test is wrong rather than the code, leave
it as it is and say why in your commit body.

# RULES

{{SHARED_RULES}}

# THE ISSUE

Your run is the last developer run, so the tests must pass by its end. If the task is not complete, say what was done and what remains in your last commit's body.

Once complete, output <promise>COMPLETE</promise>.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
