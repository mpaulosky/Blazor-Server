---
name: dotnet-tdd
description: Test-driven development for C#/.NET with xUnit v3. Use when the user wants to build features or fix bugs test-first in a .NET codebase, mentions "red-green-refactor", or wants xUnit tests written test-first.
---

# .NET Test-Driven Development

TDD is the red → green loop. This skill is the reference that makes that loop produce xUnit v3 tests worth keeping: what a good test is, where tests go, the anti-patterns, and the mechanics of running the loop fast in a .NET project. Every section applies on every cycle: consult them before and during the loop, not after.

When exploring the codebase, read `CONTEXT.md` (if it exists) so test names and interface vocabulary match the project's domain language, and respect ADRs in the area you're touching.

**Cross-references:** for depth beyond the loop itself, use [skill:dotnet-xunit] (Fact/Theory, fixtures, `IAsyncLifetime`, parallelism, analyzers) and [skill:dotnet-testing-strategy] (unit vs integration vs E2E, test doubles, project layout). This skill only restates what those cover to the extent the loop needs it; it does not duplicate them.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification: `SubmitOrder_WhenInventoryInsufficient_ReturnsOutOfStockError` tells you exactly what capability exists, and it survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for C#/xUnit examples and [mocking.md](mocking.md) for mocking guidelines.

## Seams: where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. In C#, that's the public members of a class or the contract of an injected interface — never a `private`/`internal` method reached via reflection, and never `InternalsVisibleTo` used to peek at internals for the sake of a test.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and confirm them with the user. No test is written at an unconfirmed seam. You can't test everything, so agreeing the seams up front is how testing effort lands on the critical paths and complex logic instead of every edge case.

Ask: "What's the public interface, and which seams should we test?"

When the shape of that interface is itself in question (how deep the module is, where the seam belongs, what the interface should expose), call the Skill tool with "codebase-design" for the vocabulary. It is the shared source of the module, interface, depth, seam, adapter, leverage and locality terms, and it is a reference to consult, not a session to run.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests `private`/`internal` methods (via reflection or `InternalsVisibleTo`), or verifies through a side channel (querying the database directly instead of going through the repository interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological**: the assertion recomputes the expected value the way the code does (`CalculateTotal(items).Should().Be(items.Sum(i => i.Price))`), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing**: writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.
- **Over-mocked boundary**: standing up `Substitute.For<T>()` for a type you own instead of using the real thing or a fake. See [mocking.md](mocking.md) for what's actually a system boundary in .NET.

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Refactoring is not part of the loop.** It belongs to the review stage (see the `code-review` skill), not the red → green implementation cycle.

## Running the loop in xUnit v3

The loop only works if red and green are each fast and unambiguous. In a .NET solution, that means running exactly the one test you're cycling on — not the whole suite — at every step.

**Red — confirm the test fails for the right reason:**

```bash
dotnet test --filter "FullyQualifiedName~OrderServiceTests.CalculateTotal_EmptyCart_ReturnsZero"
```

Read the failure. A compile error, a `NullReferenceException`, and a genuine assertion mismatch are different signals — only the last one means "the test is correctly describing behavior that doesn't exist yet." A test that fails to compile isn't red yet; make it compile with a stub (e.g. `throw new NotImplementedException()`) before treating it as your red baseline.

**Green — implement the minimum, then re-run the same filter:**

```bash
dotnet test --filter "FullyQualifiedName~OrderServiceTests.CalculateTotal_EmptyCart_ReturnsZero"
```

Don't run the full suite to confirm green on a single slice — that's the next cycle's job (see below). Keep iteration inside one `dotnet test --filter` invocation until the target test passes.

**Between slices — confirm no regression:**

```bash
dotnet test
```

Run the full project (or `dotnet watch test` left running in a terminal for continuous feedback) once the target test is green, before starting the next red. This is what catches a slice that passed its own test but broke another seam.

**Fast-iteration tips specific to xUnit v3:**

- `dotnet watch test --filter "FullyQualifiedName~ClassName"` re-runs on save and keeps the loop inside one class while it's under active development.
- Prefer `[Theory]`/`[InlineData]` to extend an existing red→green cycle with more cases of the *same* behavior; a genuinely new behavior gets a new `[Fact]`, not another `[InlineData]` row bolted onto an unrelated theory.
- If a slice needs an `IClassFixture`/`ICollectionFixture` to become fast or isolated, that's a refactor — do it in the refactor stage, not mid-loop. Write the slice against a plain instance first.
- A red step that fails with a build error across the whole test project (not just the target test) means the production stub is missing a member the test compiles against — add the minimal signature (throwing `NotImplementedException`) so red comes from `Assert`, not `csc`.
