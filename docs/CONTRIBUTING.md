# Contributing to This Project

Thank you for taking the time to consider contributing to our project.

The following is a set of guidelines for contributing to the project.
These are mostly guidelines, not rules, and can be changed in the future.
Please submit your suggestions with a pull-request to this document.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [What should I know before I get started](#what-should-i-know-before-i-get-started)
  - [Project Folder Structure](#project-folder-structure)
  - [Design Decisions](#design-decisions)
  - [How can I contribute](#how-can-i-contribute)
    - [Create an Issue](#create-an-issue)
    - [Respond to an Issue](#respond-to-an-issue)
    - [Write code](#write-code)
    - [Write documentation](#write-documentation)

## Welcome

Thank you for your interest in contributing! We value all contributions and strive to make this project a welcoming, inclusive space for everyone.

Below are guidelines to help you get started. If you have suggestions, please submit a pull request to this document.

## Code of Conduct

We have adopted a code of conduct from the Contributor Covenant.
Contributors to this project are expected to adhere to this code.
Please report unwanted behavior to [Project Maintainer](mailto:matthew.paulosky@outlook.com)

## Quick Start

1. Fork the repository and clone your fork.
2. Create a branch from `develop` (use a descriptive name, e.g. `feature/123-add-search`).
3. Make your changes, following the code style and guidelines below.
4. Add or update tests as needed.
5. Commit with clear messages (see below).
6. Push your branch and open a Pull Request to `develop`.
7. Ensure all checks pass and respond to review feedback.

## What should I know before I get started

This project is a GitHub template for a server-rendered Blazor Web App built with .NET 10, C# 14, Tailwind CSS v4, and Auth0 authentication. See [CONTEXT.md](../CONTEXT.md) for the domain language.

### Code Style & Commit Messages

- Follow the coding standards in [.sandcastle/CODING_STANDARDS.md](../.sandcastle/CODING_STANDARDS.md) and the formatting rules in `.editorconfig`.
- Write commit messages in the `<type>(<scope>): <Summary>` format described in [git-commit-instructions.md](../.github/instructions/git-commit-instructions.md), and reference issues (e.g.,
  `Fixes #123`).
- Add comments to explain *why* for complex logic.

### Project Folder Structure

This project is designed to be built and run primarily with [your preferred IDEs/editors].
The folders are configured so that they will support editing and working in other editors and on other operating systems.
We encourage you to develop with these other environments, because we would like to be able to support developers who use those tools as well.
The folders are configured as follows:

```text
docs/                                   -- Documentation and guides

src/                                    -- Source code
  AppHost/                              -- Aspire AppHost (local orchestration, E2E host)
  Core/                                 -- Class library: feature slices and shared types
    Features/                           -- One folder per feature (Vertical Slice Architecture)
      <Feature>/                        -- Requests, handlers, validators for one use case
    Shared/                             -- Cross-cutting infrastructure (e.g. auth, theming)
  Domain/                               -- Shared Kernel: Result, Result<T>, ApplicationConstants
    Abstractions/                       -- Operation outcomes (Result, Result<T>, ResultErrorCode)
    Constants/                          -- Names the Template relies on (policy, role, cookies)
  ServiceDefaults/                      -- Aspire service defaults (telemetry, health checks)
  UI/                                   -- Blazor Web App (server-rendered)
    Components/                         -- App-wide components
      Layout/                           -- Layout components
      _Imports.razor                    -- Razor imports
      App.razor                         -- App root component
      Routes.razor                      -- Route definitions
    Features/                           -- Feature pages and components, one folder per feature
    Styles/                             -- Tailwind CSS v4 sources
    Properties/                         -- UI project properties
    wwwroot/                            -- Static web assets (CSS, JS, etc.)
    appsettings.json                    -- UI configuration
    appsettings.Development.json        -- UI development config

tests/                                  -- Test projects (<Project>.Tests.<Kind>)
  Architecture.Tests/                   -- Architecture and slice-boundary rules
  Core.Tests.Unit/                      -- Core handler and validator unit tests
  Domain.Tests.Unit/                    -- Shared Kernel unit tests
  UI.Tests.Unit/                        -- UI component tests (bUnit)
  UI.Tests.Integration/                 -- UI integration tests (WebApplicationFactory)
  UI.Tests.E2E/                         -- End-to-end tests (Playwright)

[SolutionName].slnx                     -- Solution file
.editorconfig                           -- Formatting, style, and naming rules
CONTEXT.md                              -- Domain language
Directory.Build.props                   -- Shared build settings
Directory.Packages.props                -- Central NuGet package management
global.json                             -- Global SDK version
LICENSE                                 -- License
README.md                               -- Project overview
```

See the main [README.md](../README.md) for more details.

All official versions of the project are built and delivered with [your CI/CD system, e.g., GitHub Actions] and linked in the main README.md and [releases tab in your repository].

### Design Decisions

Design for this project is ultimately decided by the project team lead ([maintainer name or role]). The following project tenets are adhered to when making decisions:

1. Use server-rendered Blazor with Tailwind CSS v4 for the UI.
1. Use Auth0 for authentication and role-based authorization.
1. Organize code with Vertical Slice Architecture: one folder per feature, not per technical layer.
1. Return `Result`/`Result<T>` for expected failures, and validate requests with FluentValidation.
1. Use .NET Aspire for local orchestration and end-to-end test hosting.
1. Manage NuGet versions centrally in `Directory.Packages.props`.

If you have suggestions, please open an issue or discuss in your pull request.

### How can I contribute

We are always looking for help on this project. There are several ways that you can help:
This means one of several types of contributions:

1. [Create an Issue](#create-an-issue)
1. [Respond to an Issue](#respond-to-an-issue)
1. [Write code](#write-code)
1. [Write documentation](#write-documentation)

## Contribution Types

- **Report a Bug:** Please add the `Bug` label so we can triage and track it.
- **Suggest an Enhancement:** Add the `Enhancement` label for new features or improvements.
- **Write Code:** All code should be linked to an issue. Include or update tests for new features and bug fixes.
- **Write Documentation:** Help us improve `/docs` and keep the main [README.md](../README.md) up to date.

### Create an Issue

Create a [New Issue Here]( [your repository issues URL] ).

1. If you are reporting a `Bug` that you have found. Be sure to add the `Bug` label so that we can triage and track it.
1. If you are reporting an `Enhancement` that you think would improve the project. Be sure to add the `Enhancement`
   label so we can track it.

Please provide as much detail as possible, including steps to reproduce, expected behavior, and screenshots if helpful.

### Respond to an Issue

[Fork the Repository to your account]( [your repository fork URL] ).

1. Create a new Branch from the develop branch with a reference to the existing Issue number.
1. Work on the issue.
1. Create Unit, Integration tests for any code that require them. We use xUnit v3, FluentAssertions, NSubstitute, bUnit, and Playwright to test our code and components.
1. When you are done Create a Pull Request from your branch to the develop branch.
1. Submit the Pull Request.

**Note:** Pull requests without unit tests will be delayed until tests are added. All new features and bug fixes must
include appropriate tests.

#### Running the E2E tests locally

`tests/UI.Tests.E2E` uses Playwright to drive a real browser against `UI`, hosted on a real Kestrel port. Before
running it locally (or after a fresh `dotnet build`), install the Playwright browser binaries once:

```bash
pwsh tests/UI.Tests.E2E/bin/Release/net10.0/playwright.ps1 install chromium
```

(On a machine without PowerShell, install it first, or run the equivalent `playwright install chromium` via the
Playwright CLI.) CI installs browsers automatically as part of the pipeline.

Any code that is written to support a component or new functionality are required to be accompanied with unit tests at the time the pull request is submitted.
Pull requests without unit tests will be delayed and asked for unit tests to prove their functionality.

### Review Process

1. All PRs are reviewed by maintainers and may require changes before merging.
2. Automated checks (build, tests, lint) must pass before review.
3. Be responsive to feedback and update your PR as needed.
4. Once approved, your PR will be merged into `develop`.

### Write code

All code should have an assigned issue that matches it. This way we can prevent contributors from working on the same
feature at the same time.

Code for components' features should also include some definition in the `/docs` folder so that our users can
identify and understand which feature is supported.

See [docs/](../docs) for feature documentation guidelines.

### Write documentation

The documentation for the project is always needed. We are always looking for help to add content to the `/docs`
section of the repository with proper links back through to the main `/README.md`.

---

Thank you for helping us make this project better!
