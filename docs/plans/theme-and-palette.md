# Theme and Palette

This is the spec for the **Theme** control and cookie and the **Palette** menu: a visitor picks Light, Dark or System, and one of 17 accent hues, from the Generated App's
nav, and the choice survives every page and reload.

It was charted on the map [Map: Theme toggle and cookie, and the Palette picker](https://github.com/mpaulosky/Blazor-Server/issues/353). Each section links the ticket that holds
the reasoning; this document says *what* to build, and the tickets say *why*. The work is split into the `Sandcastle` issues in [Implementation issues](#implementation-issues).
It builds on the tokens the restyle added ([UI Restyle](ui-restyle.md#tokens)): the `dark` variant that follows `data-theme`, and the `--color-accent-*` token.

## Principles

- **No JavaScript.** Each control is a plain form that posts, sets a cookie and redirects. `data-enhance` makes it a fetch with no full page load when JavaScript runs, and it
  degrades to a normal post and load when it doesn't.
- **The server renders the choice.** `App.razor` reads both cookies on every request and renders `data-theme` and `data-palette` on `<html>`, so the first paint is already
  right. Enhanced navigation re-syncs `<html>`'s attributes from each response.
- **A cookie, the same for Visitors and Users.** No browser storage and no Auth0 profile: the choice belongs to the browser.
- **Two slices,** `Features/Themes/` and `Features/Palettes/`, each with its own value type, command, validator, handler, endpoint, control and `Add<Feature>Feature()`. No
  umbrella term or slice covers both.
- **The domain terms.** **Theme** is Light, Dark or System, and **Palette** is the accent hue, as `CONTEXT.md` defines them. Never "mode" or "color scheme".
- **Accessible.** Every hue meets WCAG AA in both Themes, every button has a visible `focus-visible` ring and an accessible name, and `aria-pressed` marks the current choice.

Out of scope: syncing either choice to the User's Auth0 profile, screenshot or visual-regression tests, and an umbrella term or slice over the two.

## Slice names

The folders and namespaces are plural, `UI.Components.Features.Themes` and `UI.Components.Features.Palettes`, so the value types keep the glossary's singular names, `Theme`
and `Palette`. A type named the same as its own namespace doesn't compile from a sibling namespace: in `UI.Tests.Unit.Components.Features.Theme`, `Theme` resolves to the
namespace (CS0118). The tests mirror the plural folders.

## Value types

Decided in [Decide: How the Theme and Palette controls reach the server, and how App.razor reads the cookies](https://github.com/mpaulosky/Blazor-Server/issues/356).

### Theme

`Features/Themes/Theme.cs`: `public enum Theme { System, Light, Dark }`. `System` is the default and means "follow the OS".

`Features/Themes/ThemeExtensions.cs` holds a C# 14 `extension(Theme)` block:

- `static Theme FromCookie(string? value)`: `"light"` is Light, `"dark"` is Dark, and anything else, `null` included, is System. Ordinal and case-sensitive: the endpoint
  only ever writes lowercase.
- `string? ToDataTheme()`: `"light"`, `"dark"`, or `null` for System, so `App.razor` renders no attribute and the OS decides.

### Palette

`Features/Palettes/Palette.cs`: `public enum Palette`, with the 17 Tailwind hues in Tailwind's order, which is also the menu's order: `Red, Orange, Amber, Yellow, Lime, Green,
Emerald, Teal, Cyan, Sky, Blue, Indigo, Violet, Purple, Fuchsia, Pink, Rose`. The gray-family scales aren't offered. **Blue** is the default, because the restyle's `@theme`
block maps the accent to blue.

`Features/Palettes/PaletteExtensions.cs` holds an `extension(Palette)` block:

- `static Palette Default`: Blue.
- `static Palette FromCookie(string? value)`: the hue whose lowercase name equals `value`, ordinal; anything else, `null` included, is Blue.
- `string ToCookieValue()`: the lowercase name (`"rose"`).
- `string? ToDataPalette()`: the lowercase name, or `null` for Blue, the CSS default.
- `string SwatchClass()`: a `switch` returning the literal `bg-<hue>-500` class for each hue (`"bg-rose-500"`), spelled out so the Tailwind scan finds all 17.

## The cookies

Names from `ApplicationConstants.ThemeCookie` (`theme`) and `ApplicationConstants.PaletteCookie` (`palette`). Values are the lowercase names above.

- **Attributes:** `Max-Age` one year, `SameSite=Lax`, `Secure`, `HttpOnly`, `Path=/`, `IsEssential = true` (a display preference, so no consent banner). Each choice
  re-issues the cookie, so the year runs from the visitor's last choice.
- **System deletes the theme cookie,** with the same `Path`, so no cookie means System.
- **Blue writes `blue`,** so an explicit choice survives a Generated App changing its default hue.
- **An unknown or tampered value read at render is ignored:** `FromCookie` falls back to System or Blue, and no attribute is rendered.

Each slice builds its own `CookieOptions` in its endpoint class. The two copies are the same today but belong to different features, so they aren't shared.

## Reading: `App.razor`

`App.razor` takes `[CascadingParameter] private HttpContext? HttpContext { get; set; }` and renders:

```razor
<html lang="en" class="scheme-light dark:scheme-dark" data-theme="@DataTheme" data-palette="@DataPalette">
```

with `DataTheme` from `Theme.FromCookie(HttpContext?.Request.Cookies[ApplicationConstants.ThemeCookie]).ToDataTheme()` and `DataPalette` the same way through `Palette`.
A `null` value omits the attribute. `App.razor` sits outside every slice, so it may use both.

## Writing: the endpoints

Decided in [Decide: How the Theme and Palette controls reach the server, and how App.razor reads the cookies](https://github.com/mpaulosky/Blazor-Server/issues/356) and
[Research: Does an enhanced form post with a redirect re-sync the html attributes?](https://github.com/mpaulosky/Blazor-Server/issues/354).

`Features/Themes/ThemeEndpoints.cs` and `Features/Palettes/PaletteEndpoints.cs`, each a static class with the path constant and a `Map<Feature>Endpoints()` extension, mapped
in `Program.cs` after `MapAuthenticationEndpoints()`. Each copies the Log out pattern in `AuthenticationEndpoints`:

| | Theme | Palette |
| --- | --- | --- |
| Path | `ThemeEndpoints.Path = "/theme"` | `PaletteEndpoints.Path = "/palette"` |
| Form fields | `theme`, `returnUrl` | `palette`, `returnUrl` |

1. **POST only.** `MapMethods(Path, [GET, HEAD])` answers `405` with `Allow: POST`, for the same reason as Log out: `MapStaticAssets`' GET fallback would otherwise 404.
2. **The endpoint binds no form,** so minimal APIs don't validate antiforgery and paint a 400 over the page. It calls `IAntiforgery.IsRequestValidAsync(context)` itself, then
   reads `context.Request.ReadFormAsync`.
3. **A failed token** (most often a stale tab) redirects to `LocalReturnUrl.OrRoot(returnUrl)` and changes nothing.
4. **The handler** gets `new SetThemeCommand(form["theme"])`, a `Result<Theme>` comes back.
5. **A failure** answers `400 ProblemDetails`: `TypedResults.Problem(detail: result.Error, statusCode: 400, extensions: { ["code"] = "Theme.Unknown" })`. Only a crafted post
   can send an unknown value, so it gets no friendly page.
6. **Success** sets the cookie (or, for System, deletes it) and answers `TypedResults.LocalRedirect(LocalReturnUrl.OrRoot(returnUrl))`: a 302, never a 307, so the browser
   follows it with a GET to a Razor page, which an enhanced post needs.

The return type is `Results<RedirectHttpResult, ProblemHttpResult>`.

## The handlers and validators

- **Commands:** `public sealed record SetThemeCommand(string? Value);` and `public sealed record SetPaletteCommand(string? Value);`, the raw posted text.
- **Validators:** `SetThemeCommandValidator : AbstractValidator<SetThemeCommand>` accepts exactly `light`, `dark` and `system`, with `.WithErrorCode("Theme.Unknown")` and the
  message "The Theme must be light, dark or system." `SetPaletteCommandValidator` accepts exactly the 17 lowercase hue names, with `Palette.Unknown` and "The Palette must be
  one of the Tailwind hues." Neither message echoes the posted value.
- **Handlers:** `SetThemeHandler` takes `IValidator<SetThemeCommand>` by constructor and has `Result<Theme> Handle(SetThemeCommand command)`. It validates, and on failure
  returns `Result.Fail<Theme>(error.ErrorMessage, ResultErrorCode.Validation, error.ErrorCode)`, so `Details` carries the code; on success, `Result.Ok(Theme.FromCookie(value))`
  (`system` maps to System). `SetPaletteHandler` is the same for `Palette`. Both are pure and synchronous: the endpoint, an HTTP concern, writes the cookie.
- **Registration:** `ThemeFeature.AddThemeFeature()` and `PaletteFeature.AddPaletteFeature()` register the validator as `IValidator<T>` and the handler, both singletons
  (they hold no state), and `Program.cs` calls them beside `AddAuthenticationFeature`.
- **Package:** `UI.csproj` references `FluentValidation` (already versioned in `Directory.Packages.props`). The handlers resolve the validators by constructor, so the
  `DependencyInjectionExtensions` package isn't needed.

## `LocalReturnUrl` moves to `UI.Security`

`LocalReturnUrl` moves from the Authentication slice to `src/UI/Security/LocalReturnUrl.cs`, namespace `UI.Security`, unchanged, with its tests moving to
`tests/UI.Tests.Unit/Security/`. Three slices now need the same rule, and one slice can't use another's internals. See
[ADR 0007](../adr/0007-cross-cutting-code-outside-the-slices.md). `tests/Architecture.Tests/UiTests.cs` gains a test that no type in `UI.Security` depends on a
`UI.Components.Features.*` namespace.

## The controls

Decided in [Prototype: The Theme and Palette controls in light and dark, on desktop and mobile](https://github.com/mpaulosky/Blazor-Server/issues/357): the prototype's variant B
for the Theme and variant C for the Palette, on the throwaway branch `chore/prototype-theme-palette`.

Both are statically rendered components in their slice, with a `[Parameter] public bool Mobile { get; set; }` for the `<details>` menu, the cascading `HttpContext` to read
the current choice, and an injected `NavigationManager` for the return URL. Each form is:

```razor
<form method="post" action="@(ThemeEndpoints.Path[1..])" data-enhance>
	<AntiforgeryToken/>
	<input type="hidden" name="returnUrl" value="@ReturnUrl"/>
	...
</form>
```

The action is base-relative like the nav links, and `ReturnUrl` is `new Uri(Navigation.Uri).PathAndQuery`, which keeps the base path, as `LoginDisplay` does.

### ThemeControl

`Features/Themes/ThemeControl.razor`: one form holding a segmented group of three submit buttons, `name="theme"`, values `light`, `dark` and `system`, in that order.

- **Form:** `role="group" aria-label="Theme"`, with `flex rounded-full border border-slate-200 p-0.5 dark:border-slate-700` on desktop and
  `grid grid-cols-3 rounded-full border border-slate-200 p-0.5 dark:border-slate-700` when `Mobile`.
- **Button:** a sun, moon or monitor SVG (`size-4`, `aria-hidden="true"`), then the name ("Light", "Dark", "System") in a `<span>` that is `sr-only` on desktop and visible when
  `Mobile`. Desktop buttons also carry `title` with the name. Classes:

  ```text
  flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500
  ```

  plus, for the current Theme, `bg-accent-600 text-white`, and otherwise `text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`.
- **Current choice:** `aria-pressed="true"` on the current Theme's button, `"false"` on the others.

### PaletteMenu

`Features/Palettes/PaletteMenu.razor`: one form of 17 submit buttons, `name="palette"`, one per hue in enum order, laid out as `grid grid-cols-4 gap-1`.

- **Tile:** a swatch, then the hue's name ("Rose"), which is the button's accessible name:

  ```text
  flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-xs focus-visible:outline-2 focus-visible:outline-accent-500
  ```

  plus `bg-slate-100 font-semibold dark:bg-slate-800` for the current hue, otherwise `hover:bg-slate-100 dark:hover:bg-slate-800`.
- **Swatch:** `<span aria-hidden="true">` with `size-6 rounded-full` and the hue's `SwatchClass()`; the current hue's swatch adds
  `ring-2 ring-slate-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-slate-900`. The swatch shows the hue's own 500, not the accent token, so every tile
  shows its colour whatever the current Palette.
- **Current choice:** `aria-pressed="true"` on the current hue's tile.
- **Desktop:** a `<details class="relative">` wraps the form. Its `<summary>` holds the current hue's swatch (`size-4 rounded-full` and its `SwatchClass()`) and a `▾`
  (`aria-hidden`), with `aria-label="Palette: Rose"` and the same `title`, and the classes:

  ```text
  flex cursor-pointer list-none items-center gap-1 rounded-full border border-slate-200 px-2.5 py-2 text-slate-600 hover:border-accent-300 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 dark:border-slate-700 dark:text-slate-300 dark:hover:border-accent-500/50 dark:hover:text-accent-300
  ```

  The panel is `absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900`.
- **Mobile:** no nested dropdown. A `<section aria-labelledby>` with an `<h2>` "Palette"
  (`mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400`) and the form below it.

### In the nav

`Components/Layout/NavMenu.razor`:

- **Desktop:** after `LoginDisplay`, in place of the comment that marks the Theme toggle's place: `<ThemeControl/>`, then `<PaletteMenu/>`.
- **Mobile menu:** after `LoginDisplay`, a `<div class="flex flex-col gap-3 border-t border-slate-200 px-3 pt-3 dark:border-slate-800">` holding
  `<ThemeControl Mobile="true"/>` and `<PaletteMenu Mobile="true"/>`.

### After a choice

The redirect's page is merged into the live document, and the merge drops any attribute the server didn't render, so an open `<details>` closes: the Palette menu on desktop,
and the whole Menu on mobile. The focused button goes with it, so keyboard focus returns to the document. That's accepted for now, to keep the controls free of JavaScript.
The Theme buttons stay in place on desktop, so focus usually stays on the pressed one.

## The Palette rules

Decided in [Research: Which Tailwind hues meet WCAG AA as an accent in both Themes?](https://github.com/mpaulosky/Blazor-Server/issues/355).

`src/UI/Styles/app.tailwind.css` gains one rule per hue except Blue, in `@layer base` after the `@theme` block, each setting all 11 stops:

```css
@layer base {
	:root[data-palette="rose"] {
		--color-accent-50: var(--color-rose-50);
		/* … every stop from 50 to 950 … */
		--color-accent-950: var(--color-rose-950);
	}
}
```

Red, indigo, violet, purple, fuchsia, pink and rose map every stop to the same stop. The bright hues shift three stops darker, so white button text and the light-mode focus
ring keep AA; every other stop maps 1:1. The shift is per hue: indigo, violet and purple would fail the dark-mode focus ring with it.

| Hue | `accent-500` | `accent-600` | `accent-700` |
| --- | --- | --- | --- |
| orange, emerald, teal, cyan, sky | hue-600 | hue-700 | hue-800 |
| amber, yellow, lime, green | hue-700 | hue-700 | hue-800 |

The prototype branch's `app.tailwind.css` has all 16 rules written out.

## Testing

Test-first, as `CODING_STANDARDS.md` asks. No screenshot or visual-regression baselines.

- **Unit, value types** (`tests/UI.Tests.Unit/Components/Features/Themes/` and `Palettes/`): `FromCookie` for each known value, `null`, an unknown value and a wrong-case
  value; `ToDataTheme`, `ToDataPalette` and `ToCookieValue` for each value.
- **Unit, validators and handlers:** each accepted value succeeds with the right enum, and an unknown, empty or missing value fails with `ResultErrorCode.Validation` and
  `Details` equal to `Theme.Unknown` or `Palette.Unknown`.
- **bUnit, per control:** the buttons, their values and names, `role="group"` and `aria-label`, the antiforgery and `returnUrl` fields, the base-relative action,
  `aria-pressed` following a supplied cookie, `sr-only` names on desktop and visible ones when `Mobile`, the Palette summary's label, and the mobile section's heading. The
  tests assert the classes that matter (`bg-accent-600` on the current Theme), not whole class strings.
- **bUnit, nav:** both controls render in the desktop nav and in the `<details>` menu. The existing `NavMenuTests` that select `details` scope their selectors to the menu
  (`header > div > details`), since the Palette menu adds a nested one.
- **Styles:** `AppTailwindCssTests` checks that each hue but Blue has a `:root[data-palette="<hue>"]` rule setting all 11 stops, and that the shifted hues map their
  `accent-500`, `accent-600` and `accent-700` as the table says.
- **Integration** (`WebApplicationFactory<Program>`): a `theme` or `palette` cookie renders the matching attribute on `<html>`; System, Blue, an unknown value and no cookie
  render none. A post with a valid token sets the cookie with the attributes above and answers 302 to the return URL; System deletes the cookie; an unknown value answers 400
  `application/problem+json` with the code; a failed token redirects without setting a cookie; a non-local `returnUrl` redirects to `/`; GET answers 405 with `Allow: POST`.
- **Architecture:** no type in `UI.Security` depends on a slice; the slice rule still finds Themes and Palettes with no cross-slice dependencies.
- **E2E** (Playwright through the AppHost): picking Dark sets `data-theme="dark"` on `<html>` and it survives a reload; picking System removes it. Picking Rose from the Palette
  menu sets `data-palette="rose"` and it survives a reload.

## Implementation issues

Filed with native "blocked by" links, so Sandcastle's blocker gate builds them in order. After the Themes slice, the Theme control and the Palettes slice can build in
parallel: they touch different files.

| Issue | Blocked by |
| --- | --- |
| [Move LocalReturnUrl to a cross-cutting UI.Security](https://github.com/mpaulosky/Blazor-Server/issues/362) | this spec |
| [Add the Themes slice, its cookie and data-theme](https://github.com/mpaulosky/Blazor-Server/issues/363) | #362 |
| [Add the Theme control to the nav](https://github.com/mpaulosky/Blazor-Server/issues/364) | #363 |
| [Add the Palettes slice, its cookie, data-palette and the hue rules](https://github.com/mpaulosky/Blazor-Server/issues/365) | #363 |
| [Add the Palette menu to the nav](https://github.com/mpaulosky/Blazor-Server/issues/366) | #364, #365 |
