# Domain

The Template's **Shared Kernel** (see [CONTEXT.md](../../CONTEXT.md)): the building blocks every Generated App
needs, no matter what it does or where it stores data. The `Core` and `UI` projects, once they exist, reference it.

## Contents

- `Abstractions/Result.cs`: operation outcomes. `Result` and `Result<T>` report success or failure, and a failure
  carries a message, a `ResultErrorCode` category (`NotFound`, `Validation`, `Conflict`, ...) and optional details.
  Handlers return them for expected failures instead of throwing.
- `Constants/ApplicationConstants.cs`: the names the Template itself relies on, such as the Admin policy and role, the Theme and Palette cookie names, and the Aspire resource name of the UI project.

## Rules

- No business concepts. Entities, feature logic and validators belong in `Core/Features/<Feature>/`.
- No persistence. `Domain` references no other project and no package, so a Generated App can choose any data store. `tests/Architecture.Tests` enforces this.
- Add a folder only when something needs it.

The decision to host the Shared Kernel here rather than in `Core/Shared/` is recorded in [ADR-0001](../../docs/adr/0001-shared-kernel-in-domain-project.md).
