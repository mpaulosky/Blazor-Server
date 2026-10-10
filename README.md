# Blazor Server Template

[![Build and Test Suite](https://github.com/mpaulosky/Blazor-Server/actions/workflows/ci.yml/badge.svg)](https://github.com/mpaulosky/Blazor-Server/actions/workflows/ci.yml)
[![CodeQL](https://github.com/mpaulosky/Blazor-Server/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/mpaulosky/Blazor-Server/actions/workflows/codeql-analysis.yml)
[![.NET code metrics](https://github.com/mpaulosky/Blazor-Server/actions/workflows/code-metrics.yml/badge.svg)](https://github.com/mpaulosky/Blazor-Server/actions/workflows/code-metrics.yml)
[![Lint Markdown](https://github.com/mpaulosky/Blazor-Server/actions/workflows/lint-markdown.yml/badge.svg)](https://github.com/mpaulosky/Blazor-Server/actions/workflows/lint-markdown.yml)
[![Lint YAML](https://github.com/mpaulosky/Blazor-Server/actions/workflows/lint-yaml.yml/badge.svg)](https://github.com/mpaulosky/Blazor-Server/actions/workflows/lint-yaml.yml)

[![Codecov](https://img.shields.io/codecov/c/github/mpaulosky/Blazor-Server?logo=codecov)](https://codecov.io/gh/mpaulosky/Blazor-Server)
[![Latest release](https://img.shields.io/github/v/release/mpaulosky/Blazor-Server)](https://github.com/mpaulosky/Blazor-Server/releases/latest)
[![License](https://img.shields.io/github/license/mpaulosky/Blazor-Server)](https://github.com/mpaulosky/Blazor-Server/blob/main/LICENSE)
[![.NET 10](https://img.shields.io/badge/.NET-10-512BD4?logo=dotnet)](https://dotnet.microsoft.com/download/dotnet/10.0)

[![Open issues](https://img.shields.io/github/issues/mpaulosky/Blazor-Server)](https://github.com/mpaulosky/Blazor-Server/issues)
[![Closed issues](https://img.shields.io/github/issues-closed/mpaulosky/Blazor-Server)](https://github.com/mpaulosky/Blazor-Server/issues?q=is%3Aissue+is%3Aclosed)
[![Open PRs](https://img.shields.io/github/issues-pr/mpaulosky/Blazor-Server)](https://github.com/mpaulosky/Blazor-Server/pulls)
[![Closed PRs](https://img.shields.io/github/issues-pr-closed/mpaulosky/Blazor-Server)](https://github.com/mpaulosky/Blazor-Server/pulls?q=is%3Apr+is%3Aclosed)
[![Stars](https://img.shields.io/github/stars/mpaulosky/Blazor-Server)](https://github.com/mpaulosky/Blazor-Server/stargazers)

## About

This repository is the **Template**: a GitHub template repository. Selecting **Use this template** creates a new
repository seeded with its contents, and the Blazor Web App that repository becomes is a **Generated App**. This README
describes the Template; a Generated App is expected to replace it.

The Template is intended to give every Generated App:

- A server-rendered Blazor Web App on .NET 10.
- Tailwind CSS styling with a light/dark **Theme** and a selectable accent-color **Palette**, both persisted in cookies.
- Auth0 authentication and authorization, distinguishing a **Visitor** (unauthenticated), a **User** (authenticated)
  and an **Admin** (a User with the Admin role).

See [CONTEXT.md](https://github.com/mpaulosky/Blazor-Server/blob/main/CONTEXT.md) for the exact meaning of these terms.

**Status:** early stage. The Template currently contains the **Shared Kernel** (`src/Domain`), the Blazor Web App
scaffold (`src/UI`: a Home page, a nav menu, a NotFound page and the Tailwind CSS v4 build) and their tests.

## Releases

<!-- RELEASES_START -->

| Version | Date | Title | Blog post |
| ------- | ---- | ----- | --------- |
| [v0.0.119](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.119) | 2026-10-10 | chore: Re-apply the repo-ci-baseline Template | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-10-pr-257-chore-re-apply-the-repo-ci-baseline-template.md) |
| [v0.0.118](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.118) | 2026-10-10 | chore: Re-apply the repo-ci-baseline Template | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-10-pr-255-chore-re-apply-the-repo-ci-baseline-template.md) |
| [v0.0.117](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.117) | 2026-10-10 | chore: Re-apply the repo-ci-baseline Template | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-10-pr-253-chore-re-apply-the-repo-ci-baseline-template.md) |
| [v0.0.116](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.116) | 2026-10-10 | chore: Re-apply the repo-ci-baseline Template | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-10-pr-251-chore-re-apply-the-repo-ci-baseline-template.md) |
| [v0.0.115](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.115) | 2026-10-10 | feat(sandcastle): Follow-up passes resolve review threads and merge conflicts | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-10-pr-243-feat-sandcastle-follow-up-passes-resolve-review-threads-and-merge-conflicts.md) |
| [v0.0.114](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.114) | 2026-10-10 | chore(sandcastle): Install Chromium's system libraries in the sandbox image | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-10-pr-248-chore-sandcastle-install-chromium-s-system-libraries-in-the-sandbox-image.md) |
| [v0.0.113](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.113) | 2026-10-10 | feat(sandcastle): Stop unattended runs cleanly when there's no work, time or usage left | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-10-pr-241-feat-sandcastle-stop-unattended-runs-cleanly-when-there-s-no-work-time-or-usage-left.md) |
| [v0.0.112](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.112) | 2026-10-10 | feat(sandcastle): Scope the queue to work the repository owner approved | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-10-pr-239-feat-sandcastle-scope-the-queue-to-work-the-repository-owner-approved.md) |
| [v0.0.111](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.111) | 2026-10-10 | feat(sandcastle): Sweep open Sandcastle PRs each round and keep them current | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-10-pr-237-feat-sandcastle-sweep-open-sandcastle-prs-each-round-and-keep-them-current.md) |
| [v0.0.110](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.110) | 2026-10-10 | feat(sandcastle): Intake splits oversized issues into blocked child issues | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-10-pr-234-feat-sandcastle-intake-splits-oversized-issues-into-blocked-child-issues.md) |

<!-- RELEASES_END -->

[All releases →](https://github.com/mpaulosky/Blazor-Server/releases)

## Getting started

1. Select **Use this template** on the [repository page](https://github.com/mpaulosky/Blazor-Server) to create your
   own repository, then clone it:

   ```bash
   git clone https://github.com/<your-account>/<your-repo>.git
   cd <your-repo>
   ```

2. Install the prerequisites:

   - The .NET SDK `10.0.401`, as pinned in [global.json](https://github.com/mpaulosky/Blazor-Server/blob/main/global.json) (later 10.0 feature bands are accepted).
   - Node.js and pnpm (`corepack enable`), used by the Tailwind CSS build, the git hooks and the lint tools. The repo refuses `npm install`.
   - [yamllint](https://yamllint.readthedocs.io/), which the pre-push hook runs on changed YAML files.

3. Install the pnpm packages, then build and test each test project:

   ```bash
   pnpm install
   dotnet build Blazor-Server.slnx
   (for project in tests/*/*.csproj; do dotnet test --project "$project" || exit 1; done)
   ```

   Run the test projects one at a time, as `scripts/gate.sh` and CI do. Under Microsoft Testing Platform,
   `dotnet test --solution` can report zero tests even when the projects pass.

   `pnpm install` must come first: `dotnet build` runs the Tailwind CLI to write `src/UI/wwwroot/css/app.css`, and fails
   with an error naming `pnpm install` when the packages are missing. Run the app with:

   ```bash
   dotnet run --project src/UI
   ```

   While editing markup, `pnpm --dir src/UI run watch:css` rebuilds the CSS as you save.

4. Optionally enable the git hooks in `.github/hooks` (markdownlint on commit, and `scripts/gate.sh` on push):

   ```bash
   git config core.hooksPath .github/hooks
   ```

   `scripts/gate.sh` lints the files changed since the branch left `origin/main`, then builds and tests the solution in Release. Run it by hand to
   check a branch before pushing.

## After generating your app

- Replace this README with one that describes your Generated App.
- Repoint the badges at your own repository, or remove them.
- Decide whether to keep the release automation: [release.yml](https://github.com/mpaulosky/Blazor-Server/blob/main/.github/workflows/release.yml) tags a release and
  opens a release-notes PR for every merged PR, which also copies `README.md` to `docs/README.md`. Delete it if you don't want it.
- The release-notes PR adds a blog post written by [release_post.py](https://github.com/mpaulosky/Blazor-Server/blob/main/.github/scripts/release_post.py).
  Add an `ANTHROPIC_API_KEY` repository secret to open each post with a short AI summary; without it, posts skip the summary.
  Run [backfill-blog-posts.yml](https://github.com/mpaulosky/Blazor-Server/blob/main/.github/workflows/backfill-blog-posts.yml) by hand to write posts for
  past releases that lack one, or set `regenerate` to rewrite them all. It opens one PR and never creates tags or Releases.
- [docs/index.html](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/index.html) is the GitHub Pages home page. Repoint its header links at your
  repository, or delete it and `docs/.nojekyll` if you don't publish Pages.

## Project layout

```text
src/Domain/                      -- Shared Kernel: Result, Result<T>, ApplicationConstants
src/UI/                          -- Blazor Web App (server-rendered)
src/UI/Components/Features/      -- One folder per feature slice (e.g. Home)
src/UI/Styles/                   -- Tailwind CSS v4 source
tests/Architecture.Tests/        -- Architecture rules (Domain's dependencies, UI's references, slice boundaries)
tests/Domain.Tests.Unit/         -- Shared Kernel unit tests
tests/UI.Tests.Unit/             -- UI component tests (bUnit)
tests/UI.Tests.Integration/      -- UI integration tests (WebApplicationFactory)
docs/adr/                        -- Architecture decision records
CONTEXT.md                       -- Domain language
.sandcastle/                     -- Sandcastle agent setup
docs/CODING_STANDARDS.md         -- Coding standards
CLAUDE.md, .claude/              -- Claude Code instructions, rules and skills
.github/workflows/               -- CI, code analysis, linting and release workflows
.github/scripts/                 -- Release blog post generator, backfill and pytest tests
.github/copilot-instructions.md  -- Copilot PR review checklist, generated from the code-review skill
```

## Roadmap

All of the following are *planned* and don't exist yet:

- *Planned:* the light/dark **Theme**, defaulting to the OS preference.
- *Planned:* the accent-color **Palette**, chosen from the Generated App's menu.
- *Planned:* Auth0 authentication, with a Profile page for a **User** and an Admin page for an **Admin**.

## Contributing

- Name branches `feature/{issue}-{slug}` for issue work, `fix/{issue}-{slug}` for bug fixes, `hotfix/{issue}-{slug}` for
  urgent fixes, or `chore/{slug}` for maintenance with no issue, for example `feature/14-add-root-readme`.
- Issues labelled `Sandcastle` are worked by Sandcastle agents, which open a pull request for review.
- Read [CONTRIBUTING.md](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/CONTRIBUTING.md), the [Code of Conduct](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/CODE_OF_CONDUCT.md)
  and the [Security Policy](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/SECURITY.md) before contributing.

## License

Licensed under the [MIT License](https://github.com/mpaulosky/Blazor-Server/blob/main/LICENSE).
