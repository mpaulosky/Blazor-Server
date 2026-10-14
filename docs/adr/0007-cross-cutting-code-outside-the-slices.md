# Cross-cutting code lives outside the slices

This amends [ADR 0005](0005-feature-slices-live-in-the-ui-project.md). Code in `src/UI` that more than one slice needs, isn't a component and carries no feature logic lives
in a top-level folder of `src/UI` named for its concern, with a namespace to match. The first is `src/UI/Security/` (`UI.Security`), and its first type is `LocalReturnUrl`,
the rule that keeps a visitor-supplied `returnUrl` local. It moves there from the Authentication slice when the Theme and Palette slices start redirecting to a return URL
too ([Theme and Palette](../plans/theme-and-palette.md#localreturnurl-moves-to-uisecurity)).

Slices can't use each other's types, so a rule that three slices need can't stay in one of them. `tests/Architecture.Tests/UiTests.cs` enforces the other direction: no type
in `UI.Security` depends on a `UI.Components.Features.*` namespace, so the folder can't grow feature logic without the build failing.

## Considered Options

- **`Components/Shared/`**: `CODING_STANDARDS.md` once named `Shared/` as the home for cross-cutting concerns, but the restyle made `Components/Shared/` the folder for UI
  building blocks (Card, Badge, Button). A redirect rule isn't a component, and mixing the two would blur what the folder's architecture test protects.
- **`src/Domain`**: the Shared Kernel holds what every Generated App needs whatever it does ([ADR 0001](0001-shared-kernel-in-domain-project.md)), and references no package.
  Return-URL safety is an HTTP concern of this web app, not a building block of the domain.
- **A copy in each slice**: duplication between slices is allowed when the code is only similar, but this is one security rule. Three copies could drift, and a fix to one
  (it already has a subtle dot-segment case) would have to reach all three.

## Consequences

- A new cross-cutting concern gets its own folder (`src/UI/<Concern>/`) and an architecture test that it depends on no slice, rather than joining `Security/` because it's
  there.
- `LocalReturnUrl`'s tests move with it, to `tests/UI.Tests.Unit/Security/`, mirroring the namespace.
