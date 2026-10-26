# Blazor-Server coding standards

Every Sandcastle role follows these standards, and the reviewer checks the branch against them. They live in the repo's own documents, so this file points to them rather than
repeating them.

## Where the rules are

- `docs/CODING_STANDARDS.md` is the code and test standard: naming, layout, nullability, error handling, logging, and where each kind of test goes. `CLAUDE.md` imports it.
- `.claude/rules/` adds guidance by path: `dotnet.md`, `blazor.md`, `markdown.md`, `blog.md`, `baseline.md` and `sandcastle.md`.
- `.github/instructions/` holds the rules the Baseline Template owns: commit messages, Markdown and blog posts.
- `docs/PROCESS.md` says how a change reaches `main`: branches, commits, PR titles and descriptions, checks and review.
- `CLAUDE.md` says how the repo is built and laid out.

## Sandcastle's TypeScript

`.claude/rules/sandcastle.md` holds the rules for `.sandcastle/`: `pnpm run check:sandcastle` type-checks it and runs every `*.test.mts`. `main.mts` and every `lib/` module
but `lib/repo-config.mts`, with the Template's tests for them, are owned by the Baseline Template: don't change them here (`main.test.mts` and the tests listed in
`NOT_OWNED_BASELINE_PATHS` are this repo's own). The repo's own values (role models, hooks, the CI jobs the gate
reproduces) go in `lib/repo-config.mts`.
