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

**Status:** early stage. The Template currently contains only the **Shared Kernel** (`src/Domain`) and its tests.

## Releases

<!-- RELEASES_START -->

| Version | Date | Title | Blog post |
|---------|------|-------|-----------|
| [v0.0.46](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.46) | 2026-09-26 | feat(sandcastle): The host names branches and skips issues that already have a PR | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-26-pr-88-feat-sandcastle-the-host-names-branches-and-skips-issues-that-already-have-a-pr.md) |
| [v0.0.45](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.45) | 2026-09-26 | refactor(sandcastle): Split main.mts into modules and configure every role from one ROLE_AGENTS map | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-26-pr-86-refactor-sandcastle-split-main-mts-into-modules-and-configure-every-role-from-one-role-agents-map.md) |
| [v0.0.44](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.44) | 2026-09-26 | docs(sandcastle): Spec the enhanced Sandcastle workflow | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-26-pr-65-docs-sandcastle-spec-the-enhanced-sandcastle-workflow.md) |
| [v0.0.43](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.43) | 2026-09-25 | fix(ci): Merge same-repo PRs after Copilot review instead of never | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-25-pr-50-fix-ci-merge-same-repo-prs-after-copilot-review-instead-of-never.md) |
| [v0.0.42](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.42) | 2026-09-25 | ci(release): Flag when release PRs fall back to GITHUB_TOKEN | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-25-pr-48-ci-release-flag-when-release-prs-fall-back-to-github-token.md) |
| [v0.0.41](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.41) | 2026-09-25 | fix(release): Remove the workflow dispatch loop that always fails with HTTP 403 | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-25-pr-46-fix-release-remove-the-workflow-dispatch-loop-that-always-fails-with-http-403.md) |
| [v0.0.40](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.40) | 2026-09-25 | feat(release): Backfill blog posts for past releases | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-25-pr-43-feat-release-backfill-blog-posts-for-past-releases.md) |
| [v0.0.39](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.39) | 2026-09-25 | feat(release): Richer per-PR blog posts and a Pages index.html | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-25-pr-33-feat-release-richer-per-pr-blog-posts-and-a-pages-index-html.md) |
| [v0.0.38](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.38) | 2026-09-25 | fix(lint): Markdown lint CI checks nothing because .markdownlint.json disables every rule | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-25-pr-32-fix-lint-markdown-lint-ci-checks-nothing-because-markdownlint-json-disables-every-rule.md) |
| [v0.0.37](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.37) | 2026-09-25 | Created CODE_METRICS.md file, analyzed metrics for 3 projects. | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-25-pr-39-created-code-metrics-md-file-analyzed-metrics-for-3-projects.md) |

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
   - Node.js and npm, used by the git hooks and the lint tools.
   - [yamllint](https://yamllint.readthedocs.io/), which the pre-push hook runs on changed YAML files.

3. Install the npm packages, then build and test:

   ```bash
   npm install
   dotnet build Blazor-Server.slnx
   dotnet test --solution Blazor-Server.slnx
   ```

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
  opens a release-notes PR for every merged PR, and [sync-readme.yml](https://github.com/mpaulosky/Blazor-Server/blob/main/.github/workflows/sync-readme.yml) copies
  `README.md` to `docs/README.md`. Delete both workflows if you don't want them.
- The release-notes PR adds a blog post written by [release_post.py](https://github.com/mpaulosky/Blazor-Server/blob/main/.github/scripts/release_post.py).
  Add an `ANTHROPIC_API_KEY` repository secret to open each post with a short AI summary; without it, posts skip the summary.
  Run [backfill-blog-posts.yml](https://github.com/mpaulosky/Blazor-Server/blob/main/.github/workflows/backfill-blog-posts.yml) by hand to write posts for
  past releases that lack one, or set `regenerate` to rewrite them all. It opens one PR and never creates tags or Releases.
- [docs/index.html](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/index.html) is the GitHub Pages home page. Repoint its header links at your
  repository, or delete it and `docs/.nojekyll` if you don't publish Pages.

## Project layout

```text
src/Domain/                  -- Shared Kernel: Result, Result<T>, ApplicationConstants
tests/Architecture.Tests/    -- Architecture rules (keeps Domain free of forbidden dependencies)
tests/Domain.Tests.Unit/     -- Shared Kernel unit tests
docs/adr/                    -- Architecture decision records
CONTEXT.md                   -- Domain language
.sandcastle/                 -- Sandcastle agent setup and coding standards
.github/workflows/           -- CI, code analysis, linting and release workflows
.github/scripts/             -- Release blog post generator, backfill and pytest tests
```

## Roadmap

All of the following are *planned* and don't exist yet:

- *Planned:* the Blazor Web App (server-rendered).
- *Planned:* the light/dark **Theme**, defaulting to the OS preference.
- *Planned:* the accent-color **Palette**, chosen from the Generated App's menu.
- *Planned:* Auth0 authentication, with a Profile page for a **User** and an Admin page for an **Admin**.

## Contributing

- Name branches `feature/{issue}-{slug}` for issue work, `hotfix/{issue}-{slug}` for bug fixes, or `chore/{slug}`
  for maintenance with no issue, for example `feature/14-add-root-readme`.
- Issues labelled `Sandcastle` are worked by Sandcastle agents, which open a pull request for review.
- Read [CONTRIBUTING.md](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/CONTRIBUTING.md), the [Code of Conduct](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/CODE_OF_CONDUCT.md)
  and the [Security Policy](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/SECURITY.md) before contributing.

## License

Licensed under the [MIT License](https://github.com/mpaulosky/Blazor-Server/blob/main/LICENSE).
