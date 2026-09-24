---
description: 'Blazor component and application patterns'
applyTo: '**/*.razor, **/*.razor.cs, **/*.razor.css'
---

# Blazor Instructions

This is a server-rendered Blazor Web App on .NET 10 and C# 14. `.sandcastle/CODING_STANDARDS.md` is the full standard. If this file and that one disagree, `CODING_STANDARDS.md` wins.

## Structure

- Organize components by feature (Vertical Slice Architecture): a component lives in its feature's `Features/<Feature>/` folder, next to that feature's handler, validator, and request and response types.
- Keep markup in `.razor` files. Move non-trivial logic into a code-behind (`.razor.cs`) or an injected service.
- Get services through `[Inject]` or `@inject`. Never `new` them up.
- Use the domain terms from `CONTEXT.md`, such as Theme, Palette, Visitor, User, and Admin.

## Lifecycle and rendering

- Load data in `OnInitializedAsync` or `OnParametersSetAsync`, not in constructors.
- Call JavaScript interop only from `OnAfterRenderAsync`, never while the component is prerendering. Guard one-time setup with `if (firstRender)`.
- Declare render modes explicitly (`@rendermode InteractiveServer`) only where interactivity is needed. Keep other pages statically rendered.
- Wrap UI updates that come from timers, events, or background tasks in `await InvokeAsync(StateHasChanged)`. Otherwise, call `StateHasChanged()` only when Blazor can't detect the change.
- Use `ShouldRender()` and `@key` to avoid unnecessary re-renders in large or frequently updated lists.
- Implement `IDisposable` or `IAsyncDisposable` to release event subscriptions, timers, and `CancellationTokenSource`s.

## State

- Pass state with parameters, `EventCallback`, and cascading values.
- For state shared across components, use a scoped service. Scoped services live for the user's whole connection (circuit). Never keep per-user state in a singleton.
- Persist the Theme and Palette in cookies, as `CONTEXT.md` describes. Don't use browser storage.
- Cache data that is expensive to fetch and changes rarely with `IMemoryCache`.

## Forms and validation

- Validate forms and requests with FluentValidation. Each feature defines its own `AbstractValidator<T>` next to the request it validates.
- Use `EditForm` with a FluentValidation integration, and show messages with `<ValidationMessage>` or `<ValidationSummary>`.
- Validate again on the server in the handler. Never trust UI validation alone.

## Error handling

- Handlers return a `Result` or `Result<T>` for expected failures. Components check it and show the error to the user.
- Wrap feature areas in `<ErrorBoundary>` for unexpected exceptions, and log them through `ILogger<T>`.
- Call external HTTP APIs through `IHttpClientFactory` or typed clients. Don't create `HttpClient` directly.

## Security

- Authentication uses Auth0 through `Auth0.AspNetCore.Authentication` with cookie sessions. Tokens stay on the server.
- Protect pages with `[Authorize]` or `[Authorize(Roles = "Admin")]`. `<AuthorizeView>` only shows or hides UI and isn't a security boundary.
- Read the signed-in user from `AuthenticationStateProvider` or a cascading `Task<AuthenticationState>`, never from `HttpContext` in interactive components.

## Styling

- Style with Tailwind CSS v4 utility classes. Avoid inline `style` attributes and one-off CSS. Use `.razor.css` isolation only when utilities can't express the style.

## Testing

- Test components with bUnit, handlers, validators, and services with xUnit v3, and use NSubstitute for test doubles. Assert with FluentAssertions.
- Follow the conventions in `.sandcastle/CODING_STANDARDS.md`: `MethodUnderTest_Scenario_ExpectedResult` names and `// Arrange`, `// Act`, `// Assert` comments.
