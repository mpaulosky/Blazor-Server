# Shared role rules

## Build and tests

- Every commit must pass `dotnet build Blazor-Server.slnx` with no warnings (`TreatWarningsAsErrors` is on).
- Tests must pass by the end of the last developer run, not on every commit.

## The gate

`scripts/gate.sh` is the one definition of "ready to push". It lints the changed YAML and Markdown files, runs the Sandcastle check when `.sandcastle/` or `package*.json` changed,
builds the solution in Release and runs every test project, stopping at the first failure. Run it rather than the individual lint, build and test commands.

- If you committed anything, run `scripts/gate.sh` once as your last step, before `<promise>COMPLETE</promise>`, and fix what it reports.
- The tester is exempt, because its tests are red on purpose. It still builds and lints the files it changed.
- The architect is exempt too. It commits at most one ADR, and lints that file with `npx --no-install markdownlint-cli2 <file>`.
- After you finish, the host runs the gate itself. Its exit code decides whether the branch is published, not what you report.
- Leave the worktree clean: commit or discard every change before you finish. Only commits are pushed, so the host fails the gate when anything is left uncommitted.

## Commits

Commit in small steps. Each message follows `.github/instructions/git-commit-instructions.md`:

- Subject: `<type>(<scope>): <Summary>`, for example `test(Domain): Add Result null-conversion test` or `feat(Domain): Port Result with targeted fixes`
- Body: what changed and why, key decisions, and any blockers for the next run
- Footer: `Refs #<issue number>`

## GitHub

Never push, never run `gh`, and never write to GitHub. The sandbox has no GitHub token. The host publishes the branch and does every GitHub write.
