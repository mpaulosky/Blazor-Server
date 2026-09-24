---
name: code-review
description: >-
  Code review for pull requests in this Blazor Server template. Use when reviewing a pull request or diff for
  correctness, repository standards, domain language, architecture boundaries, tests, docs, and workflows.
---

# Code review

Review the pull request against this repository's own sources of truth. The rules below point at them and add what
they don't say. Every finding cites the file and rule it rests on.

## Sources of truth

Read the sections that govern the changed code before commenting on it:

- `.sandcastle/CODING_STANDARDS.md`: style, .NET and Blazor, Auth0, error handling with `Result`, FluentValidation,
  Vertical Slice Architecture, Central Package Management, and testing. It wins when another instruction file
  disagrees.
- `CONTEXT.md`: the domain language (Template, Generated App, Theme, Palette, Visitor, User, Admin, Shared Kernel).
- `docs/adr/`: recorded decisions. A change that contradicts an ADR needs a new ADR that supersedes it.
- `.github/instructions/git-commit-instructions.md`: commit message format.

## What to check

**Domain language.** Code, UI text and docs use the `CONTEXT.md` terms with their defined meanings. Flag a synonym
(for example "color scheme" for Palette) or a term used for its neighbour (Theme for Palette).

**Shared Kernel boundary.** `src/Domain` holds only operation outcomes (`Result`, `Result<T>`, `ResultErrorCode`) and
the names the Template relies on (`ApplicationConstants`), and it references no other project and no package. Flag
entities, feature logic, validators, persistence types, or a new reference there; feature code belongs in
`Core/Features/<Feature>/`.

**Tests.** Every new or changed behaviour has a test, following the Testing section of `CODING_STANDARDS.md`. For a
`Result`-returning handler, that means its success value and each error code it can return.

**Markdown.** Lines stay within 200 characters. CI's markdownlint enforces this and the other rules in
`.markdownlint-cli2.jsonc`, except in the paths it ignores, such as the generated posts in `docs/blogs/`.

**Workflows and hooks.** Steps that publish anything (open a PR, push, tag, release) run only for `main`: a
`github.ref == 'refs/heads/main'` check, or a merged-into-`main` condition as in `release.yml`. `workflow_dispatch`
runs on any branch, and pull request runs check out a detached merge commit. Branch names in hooks, prompts and
docs follow `feature/{issue}-{slug}`, `hotfix/{issue}-{slug}` or `chore/{slug}`.

**Sandcastle prompts.** In `.sandcastle/*-prompt.md`, an exclamation mark followed by a backtick runs the text up to
the next backtick as a shell command before the agent sees the prompt. Flag that sequence anywhere it isn't an
intended command expansion, for example in inline code about the null-forgiving operator.

## Out of scope

Leave compiler and analyzer findings to the build: `TreatWarningsAsErrors` and `AnalysisMode=All` already fail CI on
them, and Central Package Management rejects a `Version` on a `PackageReference`. Spend comments on behaviour,
boundaries, tests and intent.
