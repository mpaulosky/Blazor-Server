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
| [v0.0.37](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.37) | 2026-09-25 | Created CODE_METRICS.md file, analyzed metrics for 3 projects. | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-25-pr-39-created-code-metrics-md-file-analyzed-metrics-for-3-projects.md) |
| [v0.0.36](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.36) | 2026-09-25 | ci(code-metrics): Grant write access and open the metrics PR with the PAT | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-25-pr-37-ci-code-metrics-grant-write-access-and-open-the-metrics-pr-with-the-pat.md) |
| [v0.0.35](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.35) | 2026-09-24 | ci: Fail Test Report Summary when the test matrix fails | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-24-pr-35-ci-fail-test-report-summary-when-the-test-matrix-fails.md) |
| [v0.0.34](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.34) | 2026-09-24 | fix(hooks): Pre-push gate checks the checked-out branch instead of the pushed refs | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-24-pr-31-fix-hooks-pre-push-gate-checks-the-checked-out-branch-instead-of-the-pushed-refs.md) |
| [v0.0.33](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.33) | 2026-09-24 | docs(blogs): Backfill missing release blog posts and link them from the README | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-24-pr-26-docs-blogs-backfill-missing-release-blog-posts-and-link-them-from-the-readme.md) |
| [v0.0.32](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.32) | 2026-09-24 | feat(sandcastle): Hold back issues whose blockers haven't landed | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-24-pr-28-feat-sandcastle-hold-back-issues-whose-blockers-haven-t-landed.md) |
| [v0.0.31](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.31) | 2026-09-24 | fix(release): Bump the release version once instead of twice | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-24-pr-25-fix-release-bump-the-release-version-once-instead-of-twice.md) |
| [v0.0.30](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.30) | 2026-09-24 | docs(readme): Add root README with badges and auto-maintained Releases table | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-24-pr-16-docs-readme-add-root-readme-with-badges-and-auto-maintained-releases-table.md) |
| [v0.0.27](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.27) | 2026-09-24 | fix(release): Release-notes PR is never created, and the failure is hidden | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-24-pr-15-fix-release-release-notes-pr-is-never-created-and-the-failure-is-hidden.md) |
| [v0.0.25](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.25) | 2026-09-24 | fix(sandcastle): Publish work already on an issue branch | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-24-pr-12-fix-sandcastle-publish-work-already-on-an-issue-branch.md) |

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

3. Install the npm packages, then build and test:

   ```bash
   npm install
   dotnet build Blazor-Server.slnx
   dotnet test --solution Blazor-Server.slnx
   ```

4. Optionally enable the git hooks in `.github/hooks` (markdownlint on commit, build and tests on push):

   ```bash
   git config core.hooksPath .github/hooks
   ```

## After generating your app

- Replace this README with one that describes your Generated App.
- Repoint the badges at your own repository, or remove them.
- Decide whether to keep the release automation: [release.yml](https://github.com/mpaulosky/Blazor-Server/blob/main/.github/workflows/release.yml) tags a release and
  opens a release-notes PR for every merged PR, and [sync-readme.yml](https://github.com/mpaulosky/Blazor-Server/blob/main/.github/workflows/sync-readme.yml) copies
  `README.md` to `docs/README.md`. Delete both workflows if you don't want them.

## Project layout

```text
src/Domain/                  -- Shared Kernel: Result, Result<T>, ApplicationConstants
tests/Architecture.Tests/    -- Architecture rules (keeps Domain free of forbidden dependencies)
tests/Domain.Tests.Unit/     -- Shared Kernel unit tests
docs/adr/                    -- Architecture decision records
CONTEXT.md                   -- Domain language
.sandcastle/                 -- Sandcastle agent setup and coding standards
.github/workflows/           -- CI, code analysis, linting and release workflows
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
- Read [CONTRIBUTING.md](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/CONTRIBUTING.md), the [Code of Conduct](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/CODE_OF_CONDUCT.md) and the
  [Security Policy](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/SECURITY.md) before contributing.

## License

Licensed under the [MIT License](https://github.com/mpaulosky/Blazor-Server/blob/main/LICENSE).
