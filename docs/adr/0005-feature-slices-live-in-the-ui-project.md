# Feature slices live in the UI project

Every feature slice lives in the Blazor Web App project, `src/UI`, in its own folder under `Components/Features/<Feature>/`: its components, request and response records,
handler, validator and `Add<Feature>Feature()` registration. The `src/Core` class library the Template planned for slices, with `UI` referencing it, won't be created.
`src/Domain` stays the Shared Kernel ([ADR 0001](0001-shared-kernel-in-domain-project.md)), and anything a project other than `UI` needs goes there, not into a slice.

A slice's markup and its handler change together, so one folder per use case keeps everything a change touches in one place, and a Generated App has one project to understand
instead of two. The cost is that no project boundary keeps slices apart, so `tests/Architecture.Tests` enforces it instead: it fails when a type in one
`UI.Components.Features.<Feature>` namespace depends on another slice's namespace, and when `UI` references a project other than `Domain`.

App-wide components that belong to no feature stay in the Blazor defaults: the layout (MainLayout, NavMenu, ReconnectModal) in `Components/Layout/`, and the Error and
NotFound pages in `Components/Pages/`.

## Considered Options

- **A `Core` class library for slices** (the old plan): the compiler would stop `Core` from depending on Blazor, and handlers could be reused by a second host. Rejected because
  each slice would be split across two projects (components in `UI`, everything else in `Core`), and the Template has no second host to share them with. A Generated App that
  grows one can still extract a project then.
- **`Components/Shared/Layout/` for the layout**: groups the cross-cutting components under `Shared/`, as `CODING_STANDARDS.md` describes for cross-cutting code. Rejected to
  keep the folder `dotnet new blazor` creates, so the Blazor documentation and samples still match the project.

## Consequences

- The slice rule is only as strong as the architecture test. A dependency it can't see, such as a slice reaching another's types through reflection or a string route, isn't
  caught.
- Handlers and validators live in an executable project, so `UI` turns off CA1515 (make types internal) in `src/UI/.editorconfig`: internal component types would need
  `InternalsVisibleTo` for the tests and still break public component parameters (CS0053).
