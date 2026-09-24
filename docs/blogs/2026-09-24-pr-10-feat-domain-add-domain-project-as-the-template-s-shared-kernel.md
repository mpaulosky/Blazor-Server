---
post_title: "feat(Domain): Add Domain project as the Template's Shared Kernel"
author1: mpaulosky
post_slug: "v0.0.21-pr-10"
microsoft_alias: n/a
featured_image: ""
categories:
  - engineering
tags:
  - release:v0.0.21
  - automation
ai_note: "Backfilled for issue #21 from the PR title/body in the release automation format"
summary: "Release notes seed for v0.0.21 from PR #10."
post_date: "2026-09-24"
---
## feat(Domain): Add Domain project as the Template's Shared Kernel

- **Release tag:** `v0.0.21`
- **Source PR:** [#10](https://github.com/mpaulosky/Blazor-Server/pull/10)

### PR description

Closes #5

## Summary

Adds `src/Domain`, the Template's **Shared Kernel** (see `CONTEXT.md` and `docs/adr/0001-shared-kernel-in-domain-project.md`). It holds operation outcomes and the names the Template relies on, with no business concepts and no persistence dependency.

**`src/Domain`** (no package references)

- `Abstractions/Result.cs`: Articles' `Result`, `Result<T>` and `ResultErrorCode`, ported with the same public surface and four targeted fixes, each added test-first in its own commit:
  - `Result<T> r = (string?)null;` is now a **failure**, not a success with a null `Value`. The implicit conversion goes through `FromValue`.
  - The implicit `Result<T>` → `T?` conversion is **removed**, so a failed result can no longer silently become `null`. Callers use `Value` / `ToValue()` after checking `Success`.
  - There's now **one** null-failure message; the two `FromValue` overloads used to differ.
  - Null failures carry `ResultErrorCode.Validation` instead of `None`.
- `Constants/ApplicationConstants.cs`: `AdminPolicy = "AdminOnly"`, `AdminRole = "Admin"`, `ThemeCookie = "theme"`, `PaletteCookie = "palette"`, `Website = "WebApp"`. Articles' persistence and cache names are deliberately left out.
- `AssemblyMarker.cs` (namespace `Domain`, `CLSCompliant`). `InternalsVisibleTo` is limited to the two test projects.

**Tests**

- `tests/Domain.Tests.Unit` (xUnit v3 on MTP + FluentAssertions): 29 tests covering the success value, every `Fail` overload's `Error`/`ErrorCode`/`Details`, the four fixes, and the constants.
- `tests/Architecture.Tests` (NetArchTest.Rules 1.3.2, matching Articles): `Domain` must not depend on `Core`, `UI`, `Microsoft.AspNetCore` or `MongoDB`. The implementer confirmed the rule fails by temporarily adding a violating type.

**Docs, aligned with ADR-0001:** `CONTEXT.md` (Shared Kernel term), ADR-0001, `docs/CONTRIBUTING.md` folder tree, `.github/copilot-instructions.md`, `CODING_STANDARDS.md` ("`Result` … defined once in the Domain project"), and a new `src/Domain/README.md`.

## Testing

- `dotnet build Blazor-Server.slnx`: 0 warnings, 0 errors (`TreatWarningsAsErrors`, `AnalysisMode=All`).
- `dotnet test --solution Blazor-Server.slnx`: 33 passed (29 unit + 4 architecture).
- The pre-push gate ran both test projects directly, with no fallback, after the fix in #9.

## Notes

- **How it was built:** the code was written test-first by Sandcastle's implementer. Every commit had to build and pass tests, so each test is in the same commit as the code that makes it pass. The history doesn't contain separate failing-test commits.
- **Review:** Sandcastle's reviewer step didn't run because of a pipeline bug, which will be fixed separately. This PR was opened by hand and still needs a human review.
- **Lockfile:** one commit had picked up Sandcastle's `package-lock.json` name change. That was dropped during the rebase, so this PR doesn't touch `package.json` or `package-lock.json`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

