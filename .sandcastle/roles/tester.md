# TASK

Write the failing tests for issue {{TASK_ID}}: {{ISSUE_TITLE}}

<issue>

{{ISSUE_BODY}}

</issue>

Comments on the issue from the repository owner:

<issue-comments>

{{ISSUE_COMMENTS}}

</issue-comments>

Only work on the issue specified. You can't reach GitHub from here, and don't need to: everything the issue says is above.

Work on branch {{BRANCH}}. It may already hold earlier commits for this issue. Build on them, don't redo them.

You are the tester. The backend developer runs after you and makes your tests pass, so you write tests, not the implementation.

# CONTEXT

Here are the last 10 commits:

<recent-commits>

!`git log -n 10 --format="%H%n%ad%n%B---" --date=short`

</recent-commits>

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

Read `CONTEXT.md` for the domain language, `docs/adr/` for recorded decisions, and the standards for the stack the issue touches: `docs/CODING_STANDARDS.md`, including its
Testing section, for .NET, and `.claude/rules/sandcastle.md` for Sandcastle's TypeScript in `.sandcastle/`.

Pay extra attention to existing test files near the code the issue touches, and follow their layout and naming.

# SKILLS

For .NET work, these skills are mounted into the sandbox from the host's `~/.claude/skills/`. Use them where they apply:

- `dotnet-tdd`: the red-green-refactor loop with xUnit v3
- `dotnet-add-testing`: scaffolding a new test project
- `dotnet-xunit`: xUnit v3 conventions
- `dotnet-testing-strategy`: choosing unit, integration, or E2E tests
- `dotnet-project-analysis`: solution, project, and Central Package Management wiring
- `dotnet-inspect`: checking a NuGet package's API surface

# EXECUTION

1. List the issue's acceptance criteria. Each one needs at least one test, and the name of each test should make it clear which criterion it checks.
2. Write the tests through the public API the issue describes: for .NET, in the test project that mirrors the code under test; for Sandcastle, in `<module>.test.mts` beside
   the module.
3. Add the smallest stubs that let the tests compile: the types and members they call, with bodies that throw. For .NET, `throw new NotImplementedException()`; for
   TypeScript, `throw new Error("Not implemented")`. Write no real behaviour.
4. Build with the stack's build command from the rules below, and fix every error and warning.
5. Run the tests you wrote with the stack's test command, and confirm each one fails for the reason you expect: the stub throwing or an assertion failing, not a compile or type
   error or a broken setup.
6. Lint the files you changed: `pnpm exec markdownlint-cli2 <file>` for Markdown and `yamllint -c .yamllint.yml <file>` for YAML.
7. Commit the tests and stubs red, with `test(<scope>): <Summary>`. Say in the body which test covers which criterion.

When a criterion can't be tested automatically (for example, it's about docs or a manual step), don't write a test that doesn't check it. Name the criterion and why it can't be
tested in the commit body, or in your final message when you have nothing to commit.

On a re-run, the branch may already hold tests for some criteria. Keep them, and write tests only for the criteria nothing covers yet.

Don't run `scripts/gate.sh`: your tests are red on purpose, so it would fail.

# RULES

{{SHARED_RULES}}

Once every criterion that can be tested automatically has a committed test, output <promise>COMPLETE</promise>. That includes the case where you commit nothing, because earlier
commits already cover every criterion or none can be tested automatically.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
