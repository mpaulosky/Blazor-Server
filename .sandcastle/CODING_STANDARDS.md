# Coding Standards

<!-- Customize this file with your project's coding standards.
     The reviewer agent loads it during code review via @.sandcastle/CODING_STANDARDS.md
     so these standards are enforced during review without costing tokens during implementation. -->

## Style

`.editorconfig` at the repo root is the source of truth. This section summarizes the rules from it that matter in review. If the two disagree, `.editorconfig` wins.

### Formatting

- UTF-8, LF line endings, a final newline, and no trailing whitespace (Markdown may keep trailing whitespace).
- C#, `.csproj`, Razor, HTML, CSS, JS/TS, JSON, and XML: indent with tabs at a display width of 2.
- Markdown and YAML: indent with 2 spaces.
- Allman braces: every opening brace goes on its own line, and `else`, `catch`, and `finally` start a new line.
- Always use braces, even for single-statement blocks.
- Put `using` directives outside the namespace, with `System.*` first and a blank line between groups.

### C# language preferences

- Don't use `var`. Write the explicit type.
- Don't qualify members with `this.`.
- Use keyword types (`int`, `string`) rather than BCL names (`Int32`, `String`).
- Declare accessibility modifiers on every non-interface member, in this order: `public private protected internal file static extern new virtual abstract sealed override readonly unsafe required volatile async`.
- Add parentheses to arithmetic, relational, and other binary expressions when they make precedence clearer.
- Mark fields `readonly` when they're never reassigned, and mark local functions `static` when they don't capture state. The build enforces both, so a reviewer doesn't need to look for them.
- Use expression bodies for properties, accessors, indexers, and lambdas. Use block bodies for methods, constructors, operators, and local functions.
- Prefer modern expressions: pattern matching (`is null`, `is not`, `is T x`), switch expressions, `?.`, `??`, compound assignment, throw expressions, object and collection initializers, index and range operators, deconstruction, and `using` declarations instead of `using` blocks.
- Use `_` to discard unused values.

### Naming

| Symbol | Style | Example |
| --- | --- | --- |
| Namespaces, classes, structs, enums | PascalCase | `OrderService` |
| Interfaces | `I` + PascalCase | `IOrderRepository` |
| Type parameters | `T` + PascalCase | `TResult` |
| Methods, properties, events, local functions | PascalCase | `GetOrders` |
| Public and internal fields | PascalCase | `MaxRetries` |
| Constants and `static readonly` fields, any accessibility | PascalCase | `DefaultTimeout` |
| Private and protected instance fields | `_` + camelCase | `_orderRepository` |
| Private and protected `static` fields that aren't `readonly` | `s_` + camelCase | `s_instanceCount` |
| Locals, local constants, parameters | camelCase | `orderId` |

### Documentation and comments

- Every public type and member outside test projects needs an XML doc comment (`/// <summary>`). The build enforces this (CS1591). Review the comments for accuracy, not presence.
- Comments explain *why*, not *what*. Flag comments that just restate the code.

## .NET and C#

- Target .NET 10 and C# 14. `global.json` pins the SDK. When documentation and repository configuration disagree, the configuration wins.
- Use current language features where they make code clearer: primary constructors, collection expressions (`[]`), records for immutable data, file-scoped namespaces, and `required` members.
- Keep nullable reference types enabled. Don't silence them with `!` unless a comment explains why the value can't be null.
- Use `async`/`await` all the way down. Never call `.Result`, `.Wait()`, or `GetAwaiter().GetResult()` on a task, and never write `async void` except for event handlers. Async methods end in `Async` and accept a `CancellationToken` when the work can be cancelled.
- Never use `Thread.Sleep` in production code.
- Get dependencies through constructor injection (or `[Inject]` in components). Don't `new` up services or use a service locator.
- Never hardcode secrets, connection strings, or Auth0 credentials. Read them from `IConfiguration`, environment variables, or user secrets.
- No empty `catch` blocks. At minimum, log the exception and rethrow. Catch specific exception types rather than `Exception` unless you're at a top-level boundary.
- Validate requests with FluentValidation: one `AbstractValidator<T>` per request, kept in the feature's folder and registered in DI. Handlers validate again on the server and return validation failures as a failed `Result`. Don't mix in DataAnnotations for request validation.
- Validate and sanitize all user input. Flag any place where user input reaches output, queries, or redirects unchecked.
- Log through `ILogger<T>` with structured message templates (`"Loaded {Count} items"`), not string interpolation.
- Keep NuGet additions minimal, and justify each new package in the PR description.

### Central Package Management

The repo uses [Central Package Management](https://learn.microsoft.com/nuget/consume-packages/central-package-management) (CPM).

- `Directory.Packages.props` at the repo root sets `ManagePackageVersionsCentrally` to `true` and holds every package version as a `<PackageVersion Include="..." Version="..." />`.
- In `.csproj` files, `<PackageReference>` elements have no `Version` attribute. Restore fails with NU1008 if one does.
- Don't use `VersionOverride`. If a project needs a different version, change the central version, or explain the exception in the PR.
- Add a new package in two places: its version in `Directory.Packages.props`, and a version-less reference in the project that uses it. Keep entries alphabetical.
- Put shared build settings (`TargetFramework`, `Nullable`, `ImplicitUsings`, `TreatWarningsAsErrors`, analyzer settings) in `Directory.Build.props`, not in individual project files.

### Blazor

- Use the component lifecycle methods (`OnInitializedAsync`, `OnParametersSetAsync`) instead of doing work in constructors.
- Keep markup in `.razor` files. Move non-trivial logic into a code-behind (`.razor.cs`) or an injected service.
- Use `EventCallback` for child-to-parent communication. Call `StateHasChanged()` only when Blazor can't detect the change itself.
- Style UI with Tailwind CSS v4 utility classes. Avoid inline `style` attributes and one-off CSS.
- Call JavaScript interop only from `OnAfterRenderAsync`, never while the component is prerendering. Guard one-time setup with `if (firstRender)`.
- When a component subscribes to events, starts timers, or holds a `CancellationTokenSource`, implement `IDisposable` or `IAsyncDisposable` and release them.
- Wrap UI updates that come from outside Blazor's event handlers, such as timers, events, and background tasks, in `await InvokeAsync(StateHasChanged)`.
- Scoped services live for the user's whole connection (circuit), not for one request. Don't keep per-request data in them, and never keep per-user state in singletons.
- Don't use `HttpContext` in interactive components. Read the signed-in user through `AuthenticationStateProvider` or a cascading `Task<AuthenticationState>`.
- Declare render modes explicitly where the component defines them (`@rendermode InteractiveServer`). Keep pages that don't need interactivity statically rendered.
- Use the domain terms from `CONTEXT.md` in code and UI. For example, **Theme** means light/dark mode and **Palette** means accent color. Don't use either word for the other, or swap in synonyms like "color scheme".

### Authentication and authorization (Auth0)

- Sign-in uses `Auth0.AspNetCore.Authentication` with cookie sessions. Access and refresh tokens stay on the server. Never send them to the browser, write them to logs, or store them in `localStorage`.
- Bind `Auth0:Domain`, `Auth0:ClientId`, and `Auth0:ClientSecret` from configuration (`Auth0__Domain` and so on in environment variables). Never commit them.
- Map the Auth0 role claim to `ClaimTypes.Role` in one place at startup, so `[Authorize(Roles = "Admin")]` and `<AuthorizeView Roles="Admin">` work everywhere.
- Protect pages with `[Authorize]` or named policies. Use `<AuthorizeView>` only to show or hide UI. It isn't a security boundary, so the page or handler must still enforce access.
- Login and logout endpoints must redirect only to local URLs. Validate any `returnUrl` with `Url.IsLocalUrl`, or use `LocalRedirect`.

### Error handling and configuration

- Handlers return a `Result` or `Result<T>` (defined once in the Core library) for expected failures such as validation errors, not-found, and forbidden. Don't use exceptions for control flow.
- Throw exceptions only for truly unexpected failures, such as bugs, infrastructure outages, and violated invariants. Let them reach the global error handler or an `<ErrorBoundary>` rather than catching them to return a failed `Result`.
- Callers must check a `Result` before using its value. Components show `Result` errors to the user, and endpoints map them to `ProblemDetails` with the matching status code.
- Carry a stable error code (for example `"Palette.Unknown"`) and a human-readable message on each error, so tests can assert on the code.
- Bind settings with the options pattern: `services.AddOptions<TOptions>().BindConfiguration("Section").ValidateDataAnnotations().ValidateOnStart()`. Inject `IOptions<T>` (or `IOptionsMonitor<T>`), not `IConfiguration`, into feature code.

## Testing

### Frameworks

- **xUnit v3** (`xunit.v3.mtp-v2`) on Microsoft.Testing.Platform, as configured in `global.json`. Collect coverage with `Microsoft.Testing.Extensions.CodeCoverage`, not coverlet.
- **FluentAssertions** for every assertion. Don't use xUnit's `Assert.*`.
- **NSubstitute** for test doubles. Only substitute interfaces, never concrete classes.
- **bUnit** for Blazor component tests.
- **`Microsoft.AspNetCore.Mvc.Testing`** (`WebApplicationFactory<Program>`) for integration tests of endpoints, middleware, authorization policies, and DI wiring.
- **Playwright** for end-to-end tests. Keep Playwright tests in `*.Tests.E2E` projects. CI builds any project that references `Microsoft.Playwright` and installs its browsers, and supplies Auth0 settings and a test user for each role through environment variables. E2E tests start the app through the Aspire AppHost. Read credentials from configuration, and never hardcode them.

### Conventions

- Put test projects under `tests/`, named `<Project>.Tests.<Kind>` (`Web.Tests.Unit`, `Web.Tests.Integration`, `Web.Tests.E2E`) or `Architecture.Tests`, as in `docs/CONTRIBUTING.md`. `Directory.Build.props` applies test-only settings to any project whose name contains `.Tests`. Mirror the namespaces and folder layout of the production code they cover.
- Name test methods `MethodUnderTest_Scenario_ExpectedResult`. `.editorconfig` suppresses CA1707 in tests to allow the underscores.
- Structure every test as Arrange/Act/Assert, marked with `// Arrange`, `// Act`, and `// Assert` comments. All three comments are required, even when a section is empty.
- Test one behavior per test. Use `[Theory]` with `[InlineData]` or `[MemberData]` instead of copy-pasting near-identical `[Fact]`s.
- Pass `TestContext.Current.CancellationToken` to async calls under test.
- Use `IAsyncLifetime` (which returns `ValueTask` in v3) for async setup and teardown, and class or collection fixtures for expensive shared setup.
- Write tests first (TDD) for new features and bug fixes. Every behavior a change adds or modifies needs a test.
- Tests must be deterministic: no `Thread.Sleep`, no dependency on the wall clock (inject `TimeProvider`), and no dependency on test order.
- Test behavior through public APIs. Don't assert on private state or reach in with reflection.
- In integration tests, replace external services (Auth0, HTTP APIs) through `WebApplicationFactory.WithWebHostBuilder` and `ConfigureTestServices`. Use a test authentication handler instead of calling Auth0.
- Test both paths of every `Result`-returning handler: the success value and each expected error code.
- CI reports coverage and warns below 80%, but doesn't fail the build. Treat untested new behavior as a review finding, rather than the coverage percentage.

### Example

```csharp
public class ThemeServiceTests
{
	private readonly ICookieStore _cookieStore = Substitute.For<ICookieStore>();
	private readonly ThemeService _sut;

	public ThemeServiceTests()
	{
		_sut = new ThemeService(_cookieStore);
	}

	[Fact]
	public async Task GetThemeAsync_NoCookieSet_ReturnsSystemDefault()
	{
		// Arrange
		_cookieStore.GetAsync("theme", Arg.Any<CancellationToken>()).Returns((string?)null);

		// Act
		Theme result = await _sut.GetThemeAsync(TestContext.Current.CancellationToken);

		// Assert
		result.Should().Be(Theme.System);
	}

	[Theory]
	[InlineData("light", Theme.Light)]
	[InlineData("dark", Theme.Dark)]
	public async Task GetThemeAsync_CookieSet_ReturnsStoredTheme(string cookieValue, Theme expected)
	{
		// Arrange
		_cookieStore.GetAsync("theme", Arg.Any<CancellationToken>()).Returns(cookieValue);

		// Act
		Theme result = await _sut.GetThemeAsync(TestContext.Current.CancellationToken);

		// Assert
		result.Should().Be(expected);
		await _cookieStore.Received(1).GetAsync("theme", Arg.Any<CancellationToken>());
	}
}
```

## Architecture

### Vertical Slice Architecture

Code is organized by feature, not by technical layer. Each slice holds everything one use case needs, from the UI down to data access.

- Each feature lives in its own folder under `Features/`, for example `Features/Theme/` or `Features/Profile/`. Its folder holds the feature's components, request and response types, handler, validator, and endpoints.
- Don't add top-level `Services/`, `Repositories/`, `Models/`, or `Controllers/` folders that collect code from many features.
- Slices don't reference each other's internals. When two slices need the same logic, move it to `Shared/`, but only once a second slice actually needs it.
- Keep `Shared/` small: cross-cutting concerns only, such as auth, layout, and theming infrastructure. Feature logic never goes there.
- Model requests and responses as `record`s, and name them after the use case (`GetProfileQuery`, `SetPaletteCommand`), not after the entity.
- Handlers are ordinary classes registered in DI, with one handler per use case. Don't add a mediator library without an ADR.
- Register each slice's services in an extension method inside the slice, such as `services.AddThemeFeature()`, so `Program.cs` stays a list of feature registrations.
- Test projects mirror the `Features/` layout, so each slice's tests sit together.
- Duplicating code between slices is acceptable. Only extract shared code when the duplicated logic really is the same concept, not just similar-looking code.

### General

- Keep each class focused on one responsibility. Prefer composition over inheritance.
- Depend on interfaces at boundaries such as cookies, Auth0, HTTP, and the clock, so tests can substitute them. Don't add an interface for a class that has only one implementation and doesn't sit at a boundary.
- Protect pages with authorization attributes and policies (`[Authorize]`, `[Authorize(Roles = ...)]`) rather than checking claims by hand in markup.
