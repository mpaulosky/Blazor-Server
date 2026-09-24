---
post_title: "chore(build): Add coding standards, CPM, and shared build props"
author1: mpaulosky
post_slug: "v0.0.11-pr-4"
microsoft_alias: n/a
featured_image: ""
categories:
  - engineering
tags:
  - release:v0.0.11
  - automation
ai_note: "Backfilled for issue #21 from the PR title/body in the release automation format"
summary: "Release notes seed for v0.0.11 from PR #4."
post_date: "2026-09-24"
---
## chore(build): Add coding standards, CPM, and shared build props

- **Release tag:** `v0.0.11`
- **Source PR:** [#4](https://github.com/mpaulosky/Blazor-Server/pull/4)

### PR description

## Summary

- **`.sandcastle/CODING_STANDARDS.md`**: fills in the reviewer agent's standards:
  - Style rules summarized from `.editorconfig`, including formatting, C# preferences, and naming.
  - .NET 10 / C# 14 guidance, Central Package Management, and Blazor Server rules (prerendering, disposal, `InvokeAsync(StateHasChanged)`, circuit-scoped state).
  - Auth0 authorization, `Result`-based error handling, the options pattern, FluentValidation, and Vertical Slice Architecture.
  - Testing conventions: xUnit v3 on Microsoft.Testing.Platform, FluentAssertions, NSubstitute, bUnit, `WebApplicationFactory`, Playwright via Aspire, `MethodUnderTest_Scenario_ExpectedResult` names, and Arrange/Act/Assert comments, with an example.
- **`Directory.Build.props`**: net10.0, C# 14, nullable, `AnalysisMode=All`, `EnforceCodeStyleInBuild`, warnings as errors, and XML docs. Projects whose names end in `.Tests` get test-project defaults.
- **`Directory.Packages.props`**: central package versions for Auth0, FluentValidation, xUnit v3 (`xunit.v3.mtp-v2`), FluentAssertions, NSubstitute, bUnit, Playwright, Mvc.Testing, and MTP code coverage.
- **`.github/instructions/blazor.instructions.md`**: rewritten for this template. Removes ASP.NET Identity/JWT, Fluxor, and WebAssembly guidance, and fixes C# 13 → C# 14 and Moq → NSubstitute.
- **`ci.yml`**: removes the unused `Author` E2E test-user variables. Only the Admin and User roles remain.

## Notes

- `src/` and `tests/` are still empty. A `Result`/`Result<T>` type will come with the Core library project.
- FluentAssertions 8+ needs a paid license for commercial use.

## Testing

- A throwaway xUnit v3 project using FluentAssertions and NSubstitute with version-less package references built, and its test passed under the new props. The project was deleted afterwards.
- A stock `dotnet new blazor` app built with only CA5394 errors, all from the template's sample `Random.Shared` code.
- markdownlint and yamllint pass on the changed files.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

