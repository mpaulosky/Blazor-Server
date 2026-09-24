# Copilot Instructions

This repository is a GitHub template for a server-rendered Blazor Web App on .NET 10 and C# 14, with Tailwind CSS v4 theming and Auth0 authentication. See `CONTEXT.md` for the domain language (Template, Generated App, Theme, Palette, Visitor, User, Admin).

## Sources of truth

- **Coding standards:** [`.sandcastle/CODING_STANDARDS.md`](../.sandcastle/CODING_STANDARDS.md) covers style, .NET and Blazor rules, Auth0, error handling with `Result`, FluentValidation, Vertical Slice Architecture, Central Package Management, and testing. It wins when any other instruction file disagrees with it.
- **Formatting and naming:** `.editorconfig`.
- **Build settings and package versions:** `Directory.Build.props` and `Directory.Packages.props`.
- **Path-specific guidance:** the files in [`.github/instructions/`](instructions/):
  - `dotnet-project.instructions.md` (all files)
  - `blazor.instructions.md` (Razor components)
  - `markdown.instructions.md` (Markdown)
  - `git-commit-instructions.md` (commit messages)

## Project layout

- `src/UI/`: the Blazor Web App.
- `src/Core/`: feature slices and shared types such as `Result`.
- `tests/`: test projects named `<Project>.Tests.<Kind>`, for example `UI.Tests.Unit`, `UI.Tests.E2E`, and `Architecture.Tests`.
