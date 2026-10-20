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
- Tailwind CSS styling with a light/dark **Theme** and a selectable **Palette** that tints the accent color and the
  surfaces, both persisted in cookies.
- Auth0 authentication and authorization, distinguishing a **Visitor** (unauthenticated), a **User** (authenticated)
  and an **Admin** (a User with the Admin role).

See [CONTEXT.md](https://github.com/mpaulosky/Blazor-Server/blob/main/CONTEXT.md) for the exact meaning of these terms.

**Status:** early stage. The Template currently contains the **Shared Kernel** (`src/Domain`), the Blazor Web App
scaffold (`src/UI`: a Home page, a nav menu, a NotFound page and the Tailwind CSS v4 build), sign-in and sign-out through
Auth0 with the Admin role mapped, a Profile page listing a **User**'s own claims, an Admin page only an **Admin** can
open, the light/dark **Theme**, the **Palette** that tints the accent and the surfaces, and their tests.

The **Theme** is chosen from a Light, Dark and System group in the nav, on desktop and in the mobile menu. Each button
posts to `/theme`, which stores the choice in a `theme` cookie and returns to the same page, so it works without
JavaScript. The server reads the cookie as it renders and writes `data-theme` on `<html>`, so the first paint already
uses the chosen Theme. System, the default, deletes the cookie and follows the OS preference.

The **Palette** is chosen from a menu of 17 Tailwind hues, from Red to Rose, opened from a swatch button in the nav on desktop and shown
as a Palette section in the mobile menu. Each tile posts to `/palette`, which stores the hue in a `palette` cookie and returns to the
same page, again without JavaScript. The server writes `data-palette` on `<html>`, and a CSS rule for each hue swaps the accent scale.
The Palette tints the accent (buttons, links and highlights) and the surfaces (the page, cards, nav, footer, borders, dividers and hover
fills), in both Themes. Text stays neutral, and the Palette menu's own panel stays slate so each swatch shows its true hue.
Blue, the default, renders no attribute.

## Releases

<!-- RELEASES_START -->

| Version | Date | Title | Blog post |
| ------- | ---- | ----- | --------- |
| [v0.0.179](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.179) | 2026-10-20 | chore: Re-apply the repo-ci-baseline Template | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-20-pr-432-chore-re-apply-the-repo-ci-baseline-template.md) |
| [v0.0.178](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.178) | 2026-10-19 | fix(sandcastle): Let the critique see overlap-held issues, and don't fail the run on a comments read | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-19-pr-429-fix-sandcastle-let-the-critique-see-overlap-held-issues-and-don-t-fail-the-run-on-a-comments-read.md) |
| [v0.0.177](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.177) | 2026-10-19 | fix(sandcastle): Fix the same-file overlap check's review findings | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-19-pr-426-fix-sandcastle-fix-the-same-file-overlap-check-s-review-findings.md) |
| [v0.0.176](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.176) | 2026-10-19 | feat(sandcastle): Don't build two issues at once that change the same file | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-19-pr-423-feat-sandcastle-don-t-build-two-issues-at-once-that-change-the-same-file.md) |
| [v0.0.175](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.175) | 2026-10-19 | fix(sandcastle): Give the sandbox the host's git identity before the follow-up pass merges main | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-19-pr-420-fix-sandcastle-give-the-sandbox-the-host-s-git-identity-before-the-follow-up-pass-merges-main.md) |
| [v0.0.174](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.174) | 2026-10-18 | chore: Re-apply the repo-ci-baseline Template | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-18-pr-417-chore-re-apply-the-repo-ci-baseline-template.md) |
| [v0.0.173](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.173) | 2026-10-18 | chore(deps): Have Dependabot ignore claude-code-action | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-18-pr-414-chore-deps-have-dependabot-ignore-claude-code-action.md) |
| [v0.0.172](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.172) | 2026-10-18 | fix(sandcastle): Use Claude Sonnet 5.5, not Sonnet 5 | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-18-pr-412-fix-sandcastle-use-claude-sonnet-5-5-not-sonnet-5.md) |
| [v0.0.171](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.171) | 2026-10-18 | fix(UI): Install the pnpm packages on a local build when the Tailwind CLI is missing (#409) | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-18-pr-410-fix-ui-install-the-pnpm-packages-on-a-local-build-when-the-tailwind-cli-is-missing-409.md) |
| [v0.0.170](https://github.com/mpaulosky/Blazor-Server/releases/tag/v0.0.170) | 2026-10-18 | chore: Re-apply the repo-ci-baseline Template | [Post](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/blogs/2026-10-18-pr-405-chore-re-apply-the-repo-ci-baseline-template.md) |

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

   Or run it through the Aspire AppHost, which starts the UI as `WebApp` and opens the Aspire dashboard with its logs,
   traces and metrics. `aspire run` needs the [Aspire CLI](https://aspire.dev/get-started/install-cli/); `dotnet run`
   works without it. The AppHost's `https` profile, which `aspire run` uses, serves both the dashboard and `WebApp`
   over HTTPS (`https://localhost:7161`), and the `http` profile needs no developer certificate:

   ```bash
   aspire run
   dotnet run --project src/AppHost --launch-profile https
   dotnet run --project src/AppHost --launch-profile http
   ```

   The `https` profile needs a trusted developer certificate. Trust it once with `dotnet dev-certs https --trust`. On
   Linux, .NET also reads the trusted copy only when `$HOME/.aspnet/dev-certs/trust` is in `SSL_CERT_DIR`, for example
   `export SSL_CERT_DIR="$HOME/.aspnet/dev-certs/trust:/etc/ssl/certs"` (see <https://aka.ms/dev-certs-trust>).

   In Development, the UI reports its health at `/health` and `/alive`.

   While editing markup, `pnpm --dir src/UI run watch:css` rebuilds the CSS as you save.

4. Optionally enable the git hooks in `.github/hooks` (markdownlint on commit, and `scripts/gate.sh` on push):

   ```bash
   git config core.hooksPath .github/hooks
   ```

   `scripts/gate.sh` lints the files changed since the branch left `origin/main`, then builds and tests the solution in Release. Run it by hand to
   check a branch before pushing.

## Auth0 setup

The app won't start without an Auth0 tenant's settings: it validates `Auth0:Domain`, `Auth0:ClientId` and
`Auth0:ClientSecret` on startup and names any that's missing.

1. In the [Auth0 dashboard](https://manage.auth0.com/), create an application of type **Regular Web Application**.
   Sign-in uses the authorization-code flow, so leave the **Authorization Code** grant on (it is by default). The app
   sends the client secret only to Auth0's token endpoint, from the server.
2. In the application's settings, add:
   - **Allowed Callback URLs:** `http://localhost:5112/callback, https://localhost:7161/callback`
   - **Allowed Logout URLs:** `http://localhost:5112/, https://localhost:7161/`

   Sign-in works on the `http` profile only on `localhost`, because the browser keeps Auth0's `Secure` sign-in cookies
   for `http://localhost` alone. The `https` profile is the safer choice anywhere else.
3. Under **User Management → Roles**, create a role named `Admin` and assign it to the users who should be an **Admin**.
4. Under **Actions → Library**, create a **Post Login** Action that adds the user's roles to the ID token, and add it to
   the Login flow:

   ```javascript
   exports.onExecutePostLogin = async (event, api) => {
     api.idToken.setCustomClaim('https://blazor-server-template/roles', event.authorization?.roles ?? []);
   };
   ```

5. Store the application's settings as user secrets. `Auth0:Domain` is the tenant's host only, with no `https://`
   (for example `my-tenant.us.auth0.com`):

   ```bash
   dotnet user-secrets set "Auth0:Domain" "<your-tenant>.auth0.com" --project src/UI
   dotnet user-secrets set "Auth0:ClientId" "<client-id>" --project src/UI
   dotnet user-secrets set "Auth0:ClientSecret" "<client-secret>" --project src/UI
   ```

   The AppHost shares the UI's user secrets, so `aspire run` reads the same values and passes them to `WebApp` as
   `Auth0__Domain`, `Auth0__ClientId` and `Auth0__ClientSecret`. When one is missing, the Aspire dashboard asks for it.
   Outside Development, set those environment variables instead.

`Auth0:RoleClaimType` names the claim the roles arrive in. It defaults to `https://blazor-server-template/roles`, the
claim the Action above sets; change both together. The app maps each role in that claim to a .NET role, so an `Admin`
there satisfies the Admin policy.

## After generating your app

- Replace this README with one that describes your Generated App.
- Give your app its own user secrets: replace the `UserSecretsId` in both `src/UI/UI.csproj` and
  `src/AppHost/AppHost.csproj` with one new GUID (for example from `uuidgen`). Otherwise every app made from this
  template reads and writes the same `Auth0:*` secrets on your machine.
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
src/AppHost/                     -- Aspire AppHost: runs the UI as the WebApp resource
src/Domain/                      -- Shared Kernel: Result, Result<T>, ApplicationConstants
src/ServiceDefaults/             -- Aspire service defaults: OpenTelemetry and health checks
src/UI/                          -- Blazor Web App (server-rendered)
src/UI/Components/Features/      -- One folder per feature slice (e.g. Home)
src/UI/Styles/                   -- Tailwind CSS v4 source
tests/AppHost.Tests.Integration/ -- AppHost integration tests (Aspire.Hosting.Testing)
tests/Architecture.Tests/        -- Architecture rules (Domain's dependencies, UI's references, slice boundaries)
tests/Domain.Tests.Unit/         -- Shared Kernel unit tests
tests/UI.Tests.Unit/             -- UI component tests (bUnit)
tests/UI.Tests.Integration/      -- UI integration tests (WebApplicationFactory)
tests/UI.Tests.E2E/              -- End-to-end tests (Playwright, through the AppHost)
docs/adr/                        -- Architecture decision records
aspire.config.json               -- Aspire CLI settings, pointing at src/AppHost
CONTEXT.md                       -- Domain language
.sandcastle/                     -- Sandcastle agent setup
docs/CODING_STANDARDS.md         -- Coding standards
CLAUDE.md, .claude/              -- Claude Code instructions, rules and skills
.github/workflows/               -- CI, code analysis, linting and release workflows
.github/scripts/                 -- Release blog post generator, backfill and pytest tests
.github/copilot-instructions.md  -- Copilot PR review checklist, generated from the code-review skill
```

## Contributing

- Name branches `feature/{issue}-{slug}` for issue work, `fix/{issue}-{slug}` for bug fixes, `hotfix/{issue}-{slug}` for
  urgent fixes, or `chore/{slug}` for maintenance with no issue, for example `feature/14-add-root-readme`.
- Issues labelled `Sandcastle` are worked by Sandcastle agents, which open a pull request for review.
- Read [CONTRIBUTING.md](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/CONTRIBUTING.md), the [Code of Conduct](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/CODE_OF_CONDUCT.md)
  and the [Security Policy](https://github.com/mpaulosky/Blazor-Server/blob/main/docs/SECURITY.md) before contributing.

## License

Licensed under the [MIT License](https://github.com/mpaulosky/Blazor-Server/blob/main/LICENSE).
