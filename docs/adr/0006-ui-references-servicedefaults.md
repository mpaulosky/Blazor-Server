# UI also references ServiceDefaults

This amends [ADR 0005](0005-feature-slices-live-in-the-ui-project.md). Issue #246 adds `src/ServiceDefaults/`, the OpenTelemetry and health-check wiring that
`AddServiceDefaults()` and `MapDefaultEndpoints()` give the UI, and `src/UI` takes a project reference on it so it can call them. ADR 0005 said UI references only
`Domain`; that stays true for feature slice code, but the allowed set of project references is now `Domain` and `ServiceDefaults`.

`ServiceDefaults` carries no feature logic and no slice depends on it directly: `Program.cs` calls `AddServiceDefaults()` and `MapDefaultEndpoints()` once, the same
way it calls each slice's `Add<Feature>Feature()`. `tests/Architecture.Tests/UiTests.cs` enforces the widened allowed set, and `ProjectReferenceRuleTests` covers the
rule itself.

## Consequences

- A future project that also needs `ServiceDefaults` (a second host, for example) can reference it the same way UI does; the reference isn't UI-specific.
- `docs/adr/0001-shared-kernel-in-domain-project.md` is unaffected: `ServiceDefaults` still references no project, so it isn't part of the Shared Kernel and carries no
  business concepts.
