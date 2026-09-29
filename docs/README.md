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
| [v0.0.59](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.59) | 2026-09-29 | build: write a single-document pnpm lockfile | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-29-pr-115-build-write-a-single-document-pnpm-lockfile.md) |
| [v0.0.58](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.58) | 2026-09-29 | fix(release): Start release posts with an H1 title | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-29-pr-112-fix-release-start-release-posts-with-an-h1-title.md) |
| [v0.0.57](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.57) | 2026-09-29 | build: switch the repo tooling from npm to pnpm | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-29-pr-113-build-switch-the-repo-tooling-from-npm-to-pnpm.md) |
| [v0.0.56](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.56) | 2026-09-28 | ci: Lint workflows and shell scripts before push and in CI | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-28-pr-110-ci-lint-workflows-and-shell-scripts-before-push-and-in-ci.md) |
| [v0.0.55](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.55) | 2026-09-28 | ci: Run the test suite on Dependabot PRs | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-28-pr-106-ci-run-the-test-suite-on-dependabot-prs.md) |
| [v0.0.54](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.54) | 2026-09-28 | chore(deps): Fix Dependabot config | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-28-pr-105-chore-deps-fix-dependabot-config.md) |
| [v0.0.53](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.53) | 2026-09-28 | fix(scripts): Keep squad cleanup going when a local delete is refused | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-28-pr-103-fix-scripts-keep-squad-cleanup-going-when-a-local-delete-is-refused.md) |
| [v0.0.52](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.52) | 2026-09-28 | fix(scripts): Update squad branch cleanup to the fail-safe version | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-28-pr-101-fix-scripts-update-squad-branch-cleanup-to-the-fail-safe-version.md) |
| [v0.0.51](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.51) | 2026-09-28 | ci: Add nightly squad branch and worktree cleanup | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-28-pr-99-ci-add-nightly-squad-branch-and-worktree-cleanup.md) |
| [v0.0.50](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.50) | 2026-09-26 | ci(sandcastle): Keep pr-automerge.yml from merging PRs handed back to a human | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-09-26-pr-94-ci-sandcastle-keep-pr-automerge-yml-from-merging-prs-handed-back-to-a-human.md) |

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
   - Node.js and pnpm (`corepack enable`), used by the git hooks and the lint tools. The repo refuses `npm install`.
   - [yamllint](https://yamllint.readthedocs.io/), which the pre-push hook runs on changed YAML files.

3. Install the pnpm packages, then build and test:

   ```bash
   pnpm install
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
