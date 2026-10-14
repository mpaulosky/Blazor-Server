# UI Restyle

This is the visual spec for restyling the Generated App after the look of the Articles repo (`mpaulosky/Articles`): a floating rounded nav with a letter tile, slate cards,
a hero with an eyebrow pill and stat tiles, and coloured pill badges, in light and dark.

It was charted on the map [Map: Restyle the Generated App after the Articles look](https://github.com/mpaulosky/Blazor-Server/issues/303). Each section links the ticket that holds
the reasoning; this document says *what* to build, and the tickets say *why*. The work is split into the `Sandcastle` issues in [Implementation issues](#implementation-issues).

## Principles

- **Port the Articles look closely**, adapted only where this repo's rules force it. Each component holds its own Tailwind v4 utilities. Articles' `@apply` classes, `--app-*`
  variables and `body` CSS aren't ported.
- **Light and dark, always.** Every surface is styled for both with `dark:` variants. The `dark` variant follows the OS today, and the **Theme** overrides it later.
- **Accent through one token.** Accent colour is written as `accent-*`, never as a raw hue, so the **Palette** can swap it later. Default: Tailwind's blue.
- **Fixed meanings keep fixed colours.** Slate carries the surfaces and text. The badge tones (sky, violet, emerald, amber) and the amber error bar don't follow the Palette.
- **Pages compose shared components.** Reusable building blocks live in `Components/Shared/`. The nav and footer live in `Components/Layout/`.
- **No JavaScript for layout.** The mobile menu is a `<details>` element.
- **System fonts.** No web fonts.
- **Accessible.** WCAG AA contrast in light and dark, a visible `focus-visible` ring on every interactive element, and hover motion only under `motion-safe:`.
  The class lists below were checked in headless Chromium in both modes. A change to a colour keeps AA.

Out of scope: the Theme toggle and cookie, the Palette picker (both on the README roadmap and built on top of this), a component library shared with Articles, and screenshot or
visual-regression tests.

## Tokens

Decided in [How Tailwind v4's dark variant can follow the OS now and the Theme cookie later](https://github.com/mpaulosky/Blazor-Server/issues/304) and
[How to define an accent token in Tailwind v4 that the Palette can swap at runtime](https://github.com/mpaulosky/Blazor-Server/issues/305).

### The dark variant

`src/UI/Styles/app.tailwind.css` replaces Tailwind's built-in `dark` (a bare `prefers-color-scheme` query, which nothing can override) with a combined variant: an explicit
`data-theme` attribute wins, and otherwise the OS decides.

```css
@custom-variant dark {
	&:where([data-theme=dark], [data-theme=dark] *) {
		@slot;
	}
	@media (prefers-color-scheme: dark) {
		&:where(:not([data-theme=light], [data-theme=light] *)) {
			@slot;
		}
	}
}
```

`App.razor` renders `<html lang="en" class="scheme-light dark:scheme-dark">`, so native controls and scrollbars match, and gives `<body>` the page's base colours
(`bg-slate-50 dark:bg-slate-950`) so overscroll never shows white in dark mode. No `data-theme` is rendered today.

When the Theme is built, `App.razor` renders `data-theme="light"` or `"dark"` from its cookie during prerender, and nothing for "system". It must be server-rendered:
enhanced navigation re-syncs `<html>`'s attributes from each response and strips any attribute only a script set.

### The accent token

Plain `@theme`, not `@theme inline`, so `bg-accent-600` compiles to `var(--color-accent-600)` and stays swappable at runtime:

```css
@theme {
	--color-accent-50: var(--color-blue-50);
	--color-accent-100: var(--color-blue-100);
	--color-accent-200: var(--color-blue-200);
	--color-accent-300: var(--color-blue-300);
	--color-accent-400: var(--color-blue-400);
	--color-accent-500: var(--color-blue-500);
	--color-accent-600: var(--color-blue-600);
	--color-accent-700: var(--color-blue-700);
	--color-accent-800: var(--color-blue-800);
	--color-accent-900: var(--color-blue-900);
	--color-accent-950: var(--color-blue-950);
}
```

Opacity modifiers (`bg-accent-500/20`) compile to `color-mix()` and follow a swap. The Palette later adds one rule per hue in `@layer base`, setting all 11 stops, for example
`:root[data-palette="rose"] { --color-accent-600: var(--color-rose-600); … }`, and renders `data-palette` on `<html>` from its cookie. The restyle adds no such rule.

### The brand

`ApplicationConstants.AppName` in `src/Domain/Constants/ApplicationConstants.cs` holds the app's name, `"Blazor Server"`. It's the one value a Generated App changes to rebrand.
The nav and footer show it, Home's h1 is it, and the letter tile shows its first character. Nothing else hardcodes the name.

## Shared components

Decided in [Where the shared UI components live and how they're named and tested](https://github.com/mpaulosky/Blazor-Server/issues/306), with the classes from
[The shared components and page shell in light and dark](https://github.com/mpaulosky/Blazor-Server/issues/307) (variant A, on the never-merged branch `chore/prototype-ui-restyle`).

### Conventions

- **Folder:** `src/UI/Components/Shared/`, namespace `UI.Components.Shared`, added to `Components/_Imports.razor`. It holds UI building blocks only, with no domain or feature
  logic. It isn't the **Shared Kernel**, which is `src/Domain`.
- **Names:** plain (`Card`, `Badge`), no prefix.
- **Variants:** a typed enum parameter carries the look. Each enum sits beside its component in its own file.
- **`Class`:** a `string?` parameter appended **after** the component's own classes, for layout tweaks only (margin, grid placement, column templates). It never restyles the
  component, because there's no class-merging library to resolve a conflict.
- **Other attributes** pass through to the root element with `[Parameter(CaptureUnmatchedValues = true)]`.
- **Slots:** `ChildContent` for the body, named `RenderFragment`s for fixed regions, and plain `string` parameters for text that is always plain.
- **Dependencies:** slices and the layout use Shared, never the reverse. An architecture test enforces it.

### Card

`CardSize Size` (default `Section`), `RenderFragment? Title`, `RenderFragment? Actions`, `ChildContent`, `Class`, extra attributes. Renders a `<section>`.

| Size | Classes |
| --- | --- |
| `Hero` | `grid gap-8 rounded-[2rem] border border-slate-200 bg-white/80 p-8 shadow-xl shadow-slate-900/5 lg:p-10 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-black/30` |
| `Section` | `rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70` |

When `Title` or `Actions` is set, a title row `flex items-center justify-between gap-4` comes first, holding `<h2 class="text-xl font-bold">` with the `Title` and then the
`Actions`. The body follows in `mt-4` when there's a title row. Without either, no title row renders.

The prototype's Hero card also had `lg:grid-cols-[1.4fr_1fr] lg:items-center`. That's a two-column layout only Home needs, so Home passes it through `Class`, and a one-column
hero (the error pages) doesn't get an empty column.

### PageHeader

`RenderFragment? Eyebrow`, `required string Title`, `string? Lead`, `ChildContent`, `Class`, extra attributes. Renders a `<header>`:

- **Eyebrow pill**, when set: `inline-flex rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-accent-700 dark:bg-accent-500/15 dark:text-accent-300`.
- **h1:** `text-4xl font-black tracking-tight text-balance sm:text-5xl`, plus `mt-4` after an eyebrow. It's the page's only h1, so `FocusOnNavigate` still finds it.
- **Lead**, when set: `<p>` with `mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-300`.
- **ChildContent**, when set: `mt-6 flex flex-wrap gap-3`, for buttons.

### StatTile

`required string Label`, `required string Value`, `Class`, extra attributes. Renders a `<div>` holding a `<dt>` and a `<dd>`, so the page wraps tiles in a `<dl>`:

- **Tile:** `rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40`.
- **Label (`dt`):** `text-[0.65rem] font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400`.
- **Value (`dd`):** `mt-2 text-xl font-bold`.
- **The page's grid:** `<dl class="grid grid-cols-1 gap-3 sm:grid-cols-3">`. The tiles stack below `sm`, because three columns clipped "Tailwind" at 390 px.

### Badge

`BadgeTone Tone` (default `Neutral`), `ChildContent`, `Class`, extra attributes. Renders a `<span>`.

| Tone | Classes |
| --- | --- |
| `Neutral` | `rounded-full border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300` |
| `Accent`, `Sky`, `Violet`, `Emerald`, `Amber` | `rounded-full border px-2.5 py-1 text-xs font-medium` plus `border-<c>-200 bg-<c>-100 text-<c>-700 dark:border-<c>-500/30 dark:bg-<c>-500/15 dark:text-<c>-300` |

`<c>` is `accent`, `sky`, `violet`, `emerald` or `amber`. Each tone's classes are written out in full in the component (a `switch` expression), never assembled from parts,
because Tailwind only generates classes it finds whole in the source.

### Button

`ButtonKind Kind` (default `Primary`), `string? Href`, `string Type` (default `"button"`), `ChildContent`, `Class`, extra attributes. It renders `<a href="@Href">` when `Href` is
set and `<button type="@Type">` otherwise, so a link and a form's submit button look the same. Extra attributes such as `data-enhance-nav="false"` or `id` pass through.

| Kind | Classes |
| --- | --- |
| `Primary` | `rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 motion-safe:transition` |
| `Secondary` | `rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 dark:border-slate-700 dark:hover:bg-slate-800 motion-safe:transition` |

### Patterns that aren't components

Written inline where they're used, with these classes:

- **Table**, inside a Section card:
  - **Wrapper:** `overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800`.
  - **Table:** `min-w-full text-left text-sm`.
  - **thead:** `bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950/50 dark:text-slate-400`, with cells `px-4 py-3 font-medium`.
  - **tbody:** `divide-y divide-slate-200 dark:divide-slate-800`.
  - **Rows:** `even:bg-slate-50/60 dark:even:bg-slate-950/30`, with cells `px-4 py-2.5`.
- **List:** `list-disc space-y-2 pl-5 text-slate-600 marker:text-accent-500 dark:text-slate-300`, with each lead term in `<strong class="text-slate-900 dark:text-white">`.

## Layout

From [The shared components and page shell in light and dark](https://github.com/mpaulosky/Blazor-Server/issues/307).

### Page shell

`MainLayout.razor`:

- **Wrapper:**

  ```text
  min-h-screen bg-slate-50 bg-radial-[at_50%_0%] from-accent-500/15 via-slate-50 to-slate-50 text-slate-900 selection:bg-accent-500/20 dark:bg-slate-950 dark:from-accent-500/20 dark:via-slate-950 dark:to-slate-950 dark:text-slate-100
  ```

- **Content column**, inside it: `mx-auto flex w-[min(90%,80rem)] flex-col gap-8 py-6`, holding the nav, `<main class="flex flex-col gap-8">` with the `@Body`, and the footer.

### Nav

`NavMenu.razor` renders a floating `<header>`:
`sticky top-4 z-40 rounded-3xl border border-slate-200 bg-white/80 px-5 py-3 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-black/30`,
with one row `flex items-center gap-4`:

- **Brand link** (`href=""`, so it stays base-relative):
  - **Link:** `flex items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-500`.
  - **Letter tile:** `<span aria-hidden="true">`, the first character of `ApplicationConstants.AppName`, with
    `grid size-9 place-items-center rounded-xl bg-slate-900 text-lg font-bold text-accent-300 dark:bg-slate-800`.
  - **Name:** `ApplicationConstants.AppName`, with `text-sm font-semibold uppercase tracking-[0.3em] text-accent-700 dark:text-accent-300`.
  - The favicon image leaves the nav; `favicon.png` stays the browser tab's icon.
- **Desktop nav**, from `md` up: `<nav class="ml-auto hidden items-center gap-1 md:flex">` holding the links, then `LoginDisplay`.
  - **Link:**

    ```text
    rounded-full px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white
    ```

  - **Active link** (`ActiveClass`): `bg-accent-50 font-medium text-accent-700 dark:bg-accent-500/15 dark:text-accent-300`.
  - A comment marks where the Theme toggle goes, after `LoginDisplay`. Nothing renders there: the toggle, with an SVG icon, is the Theme's roadmap item.
- **Mobile menu**, below `md`: `<details class="group ml-auto md:hidden">`.
  - **Summary:** `Menu`, with `cursor-pointer list-none rounded-xl border border-slate-200 px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-accent-500 dark:border-slate-700`.
  - **Panel:** `absolute inset-x-4 mt-3 flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900`,
    holding the same links (`rounded-xl px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800`, with the same active classes) and `LoginDisplay`.
- Both lists keep today's rules: Home always, Profile inside `<AuthorizeView>`, Admin inside `<AuthorizeView Policy="@ApplicationConstants.AdminPolicy">`, all base-relative.
  The link list is written once (a private `RenderFragment` or a loop over the items) and rendered in both places, so the two can't drift.

`LoginDisplay.razor` (Authentication slice) keeps its behaviour and markup structure, restyled:

- **Greeting:** `max-w-48 truncate text-sm text-slate-500 dark:text-slate-400`, keeping the `title` and `<bdi>`.
- **Log in link and Log out button:** a bordered pill:

  ```text
  rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium hover:border-accent-300 hover:text-accent-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 dark:border-slate-700 dark:hover:border-accent-500/50 dark:hover:text-accent-300
  ```

- Its root gets `flex items-center gap-3`, so it lays out in the desktop row and the mobile panel alike.

### Footer

A new `Footer.razor` in `Components/Layout/`, rendered after `<main>`. A floating `<footer>`:
`flex flex-col gap-2 rounded-3xl border border-slate-200 bg-white/70 px-6 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400`.

- On the left, `ApplicationConstants.AppName` with the nav's brand-name classes.
- On the right, `© {year} · Built with .NET, Blazor and Tailwind CSS`. The year comes from an injected `TimeProvider` (`GetUtcNow().Year`), registered as
  `TimeProvider.System` in `Program.cs`, so tests can fix it. No version or build metadata.

### Error bar

From [How each page, the Home showcase copy, the reconnect modal and the error bar use the restyle](https://github.com/mpaulosky/Blazor-Server/issues/309).
`#blazor-error-ui` in `MainLayout.razor` becomes a floating amber bar:
`fixed inset-x-4 bottom-4 z-50 flex items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 shadow-lg dark:border-amber-500/30 dark:bg-amber-950/80 dark:text-amber-200`.

- It keeps `hidden`, `data-nosnippet`, and the `reload` and `dismiss` classes Blazor looks for.
- **Reload:** a link styled like a Secondary button, in amber::

  ```text
  ml-auto rounded-xl border border-amber-300 px-3 py-1 font-semibold hover:bg-amber-100 dark:border-amber-500/40 dark:hover:bg-amber-900/40
  ```

- **Dismiss:** the 🗙 becomes `<button type="button" class="dismiss …" aria-label="Dismiss">` holding an inline SVG ×, with an amber `focus-visible` ring.
- It doesn't use the accent: a warning stays amber whatever the Palette.

### Reconnect modal

From the same ticket. `ReconnectModal.razor` is fully restyled:

- **Dialog:** a Section-size card (the Card's Section classes on the `<dialog>` itself, since `<dialog>` must stay the root Blazor looks up by id), plus
  `backdrop:bg-slate-950/50` and a centred `max-w-sm` width, in light and dark.
- **Buttons:** Retry and Resume use `Button` with `Kind="ButtonKind.Primary"`, keeping their ids (`components-reconnect-button`, `components-resume-button`) and their
  `components-*-visible` classes.
- **Spinner:** the rejoining animation's rings use `border-accent-500`, and the animation runs only under `motion-safe:`.
- `ReconnectModal.razor.css` shrinks to what utilities can't express: the visibility rules keyed to the `components-reconnect-*` classes Blazor sets at runtime, and the
  keyframes. It holds no colour, font, spacing or border value.
- `ReconnectModal.razor.js` is unchanged.

## Pages

From [How each page, the Home showcase copy, the reconnect modal and the error bar use the restyle](https://github.com/mpaulosky/Blazor-Server/issues/309). Every page composes the
shared components. None needs a new one.

### Home

A **Template** showcase that a Generated App replaces. The copy stays inline in `HomePage.razor`.

- **Hero:** `<Card Size="CardSize.Hero" Class="lg:grid-cols-[1.4fr_1fr] lg:items-center">`.
  - **Left:** a `PageHeader` with eyebrow `Template`, title `ApplicationConstants.AppName`, and lead
    *"A server-rendered Blazor Web App with Tailwind CSS theming and Auth0 sign-in, ready to become your app."*
  - **Primary button**, in `<AuthorizeView>`: a Visitor sees **Log in** and a User sees **Your profile**. Both link to `profile`, with `data-enhance-nav="false"`.
    Profile is `[Authorize]`, so a Visitor goes through the cookie challenge to Auth0 and lands on their Profile. Home doesn't reference the Authentication slice.
  - **Secondary button:** **View on GitHub**, linking to `https://github.com/mpaulosky/Blazor-Server`.
  - **Right:** the stat-tile grid with Stack `.NET 10`, UI `Tailwind` and Auth `Auth0`.
- **Below**, in `grid gap-8 lg:grid-cols-[1.6fr_0.9fr]`:
  - **"What's inside"**, a Section card with a Neutral `Template` badge as its `Actions`, holding the list:
    - **Domain:** the Shared Kernel
    - **UI:** feature slices with pages, handlers and validators
    - **AppHost:** Aspire runs it locally with a dashboard
    - **ServiceDefaults:** OpenTelemetry and health checks
    - **Tests:** unit, bUnit, integration and Playwright E2E
  - **"Highlights"**, a Section card holding `flex flex-wrap gap-2` badges: Aspire (Sky), Blazor (Violet), Tailwind CSS v4 (Emerald), Auth0 (Amber), xUnit v3 (Sky),
    Playwright (Violet).
- `<PageTitle>` stays `Home`.

### Profile

- **PageHeader:** eyebrow `User`, title `Profile`, lead "The claims Auth0 sent for your sign-in."
- **"Your claims"**, a Section card holding the table pattern, headed Claim type and Value. Claim types use `font-mono text-xs break-all` and values use `break-words`, so
  the table doesn't scroll sideways on a phone. The wrapper keeps `overflow-x-auto` as a fallback.

### Admin

- **PageHeader:** eyebrow `Admin`, title `Admin`, lead "Only an Admin can see this page."
- **"How this page is protected"**, a Section card holding the stat-tile grid: Policy `ApplicationConstants.AdminPolicy`, Role `ApplicationConstants.AdminRole`, and Source
  `Auth0 role claim`.
- Below the tiles, **"Your roles"**: the signed-in User's `ClaimTypes.Role` claims as Accent badges, read from the cascading `Task<AuthenticationState>`. No new handler.
- The names come from `ApplicationConstants`, never literals.

### Access Denied, Not Found and Error

One composed pattern, not an `ErrorPanel` component: a Hero-size `Card` holding a `PageHeader` whose eyebrow is the status code, with one Primary **Back to home** button
(`Href=""`). `LoginDisplay` already offers signing in as someone else, so the pages don't repeat it.

| Page | Eyebrow | Title | Lead |
| --- | --- | --- | --- |
| Access Denied | `403` | Access denied | You don't have permission to access this page. |
| Not Found | `404` | Page not found | Sorry, the content you are looking for does not exist. |
| Error | `500` | Something went wrong | Something went wrong on our side. |

The pages keep their routes, `<PageTitle>`s, and today's status-code and `[AllowAnonymous]` handling.

The Error page also shows:

- **In every environment:** the request id, when there is one, as a Neutral badge with `font-mono` (`Class`), so a support request can quote it.
- **In Development only** (`IHostEnvironment.IsDevelopment()`): a Section card titled "Development Mode" below the panel, holding today's guidance text. Production no longer
  shows it.

## Testing

- **bUnit, per shared component**, in `tests/UI.Tests.Unit/Components/Shared/<Component>Tests.cs`: each slot renders, each variant applies its classes, `Class` is appended
  after the component's own classes, and extra attributes reach the root element. Tests assert that the classes that matter are present (for example `bg-accent-600` for
  Primary), not the whole class string, so a visual tweak doesn't break them.
- **bUnit, per changed surface**, beside the existing tests: the nav, footer, error bar, reconnect modal and each page render the structure and text this spec names.
- **Architecture:** `tests/Architecture.Tests/UiTests.cs` gains a test that no type in `UI.Components.Shared` depends on a `UI.Components.Features.*` namespace.
- **Integration and E2E:** the existing tests keep passing, updated only where the restyle changes text they assert on (Home's heading is now the app name, not
  "Hello, world!"). When a page shows a link twice, such as **Log in** in the nav and Home's hero, a test scopes its locator to the region it means.
- No screenshot or visual-regression baselines.

## Implementation issues

Filed with native "blocked by" links, so Sandcastle's blocker gate builds them in order. Every issue after the shared components needs only them, so they can build in parallel.
The coding-standard lines this restyle needs landed with this spec.

| Issue | Blocked by |
| --- | --- |
| [Add the dark variant, the accent token and the app name constant](https://github.com/mpaulosky/Blazor-Server/issues/311) | this spec ([#310](https://github.com/mpaulosky/Blazor-Server/pull/310)) |
| [Add the shared Card, PageHeader, StatTile, Badge and Button components](https://github.com/mpaulosky/Blazor-Server/issues/312) | #311 |
| [Restyle the page shell, nav, footer and error bar](https://github.com/mpaulosky/Blazor-Server/issues/313) | #312 |
| [Restyle the reconnect modal](https://github.com/mpaulosky/Blazor-Server/issues/314) | #312 |
| [Turn Home into the Template showcase](https://github.com/mpaulosky/Blazor-Server/issues/315) | #312 |
| [Restyle the Profile and Admin pages](https://github.com/mpaulosky/Blazor-Server/issues/316) | #312 |
| [Restyle the Access Denied, Not Found and Error pages](https://github.com/mpaulosky/Blazor-Server/issues/317) | #312 |
