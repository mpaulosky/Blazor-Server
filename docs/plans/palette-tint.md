# Palette Tint

This is the spec for tinting the Generated App's surfaces with the **Palette**: the page, cards, nav, footer, borders and hover fills take the visitor's hue in both
Themes, and a few more places carry the accent. Text stays neutral.

It was charted on the map [Map: Tint the Generated App's surfaces with the Palette](https://github.com/mpaulosky/Blazor-Server/issues/382). Each section links the ticket
that holds the reasoning; this document says *what* to build, and the tickets say *why*. It changes the colour classes that [UI Restyle](ui-restyle.md) and
[Theme and Palette](theme-and-palette.md) set, and [ADR 0008](../adr/0008-the-palette-tints-the-surfaces.md) records why. The work is split into the issues in
[Implementation issues](#implementation-issues).

## Principles

- **The Palette's own scale.** Surfaces use `accent-*` stops directly. There's no mix with slate and no new token: the `:root[data-palette]` rules already rebind every stop,
  so every surface follows the hue with no new CSS.
- **Text stays neutral.** Body and secondary text keep `slate-*`, so reading doesn't change colour with the hue.
- **Every pair meets WCAG AA for all 17 hues, in both Themes**, checked with the research script from
  [Research: Which Palette tints keep WCAG AA for neutral text and the accent, in both Themes?](https://github.com/mpaulosky/Blazor-Server/issues/383).
- **One exception:** the Palette menu's panel and tiles stay slate, so each swatch reads true.
- **The domain terms.** **Palette** is the hue that tints the accent and the surfaces; **Theme** is Light, Dark or System. `CONTEXT.md` is updated to match.

Out of scope: a Neutral or Slate Palette that tints nothing, and screenshot or visual-regression tests.

## The surfaces

Decided in [Prototype: How strong the Palette tint is on surfaces and borders, in Light and Dark](https://github.com/mpaulosky/Blazor-Server/issues/384) (variant I, on the
throwaway branch `chore/prototype-palette-tint`) and [Decide: How the surface tint reaches the markup](https://github.com/mpaulosky/Blazor-Server/issues/386).

Every `slate-*` class on a background, border, divider, ring or gradient stop changes as this table says, in every `.razor` file under `src/UI` except `PaletteMenu.razor`'s
panel and tiles. Opacity suffixes stay as they are (`dark:bg-slate-900/70` becomes `dark:bg-accent-900/70`).

| Today | Becomes | Where |
| --- | --- | --- |
| `bg-slate-50`, `via-slate-50`, `to-slate-50` | `bg-accent-100`, `via-accent-100`, `to-accent-100` | The page: `App.razor`'s `<body>` and `MainLayout` |
| `bg-slate-100` (hover) | `bg-accent-200` | Nav links, the outline Button, the Theme control |
| `border-slate-200`, `divide-slate-200` | `border-accent-200`, `divide-accent-200` | Every border |
| `border-slate-300` | `border-accent-300` | The Secondary Button |
| `bg-slate-900` | `bg-accent-900` | The nav's letter tile |
| `dark:bg-slate-950`, `dark:via-slate-950`, `dark:to-slate-950` | `dark:bg-accent-950`, … | The page |
| `dark:bg-slate-900/*` | `dark:bg-accent-900/*` | Cards, nav, footer, the mobile menu, the reconnect modal |
| `dark:bg-slate-800` (hover and the letter tile) | `dark:bg-accent-800` | Hover fills |
| `dark:border-slate-800`, `dark:divide-slate-800` | `dark:border-accent-800`, `dark:divide-accent-800` | Every Dark border |
| `dark:border-slate-700` | `dark:border-accent-700` | Outlined controls: Buttons, the Theme control, the Palette and Menu summaries, Log in |
| `backdrop:bg-slate-950/50` | `backdrop:bg-accent-950/50` | The reconnect modal's backdrop |

The Profile rows become `even:bg-accent-50 dark:even:bg-accent-950/30`. StatTile and the Profile table header get their own classes, in
[The accent touches](#the-accent-touches). Cards, the nav and the footer keep `bg-white/80` (or `/70`) in Light, so they stand out from the tinted page. Shadows keep
`shadow-slate-900/5` and `dark:shadow-black/30`.

The Neutral Badge's border follows the table (`border-accent-200 dark:border-accent-700`). Its text stays slate. The other badge tones and the amber error banner keep their
hue: their colour means something.

### The exception: the Palette menu

`PaletteMenu.razor`'s `<summary>` is nav chrome and follows the table. Its panel (`border-slate-200 bg-white … dark:border-slate-800 dark:bg-slate-900`), its tiles
(`bg-slate-100 dark:bg-slate-800` for the current hue, `hover:bg-slate-100 dark:hover:bg-slate-800`) and the current swatch's ring (`ring-slate-900 … ring-offset-white
dark:ring-white dark:ring-offset-slate-900`) stay slate. A comment above the panel says why: each tile's swatch shows its own hue, and a tinted panel would distort it.

## The text

Decided in the spec task, [Task: Write the Palette tint spec and file the implementation issues](https://github.com/mpaulosky/Blazor-Server/issues/387), from the contrast
check of the chosen surfaces.

- **Light secondary text moves from `slate-500` to `slate-600`** everywhere. On `accent-100` `slate-500` fails AA for every hue (3.87:1 on Indigo); `slate-600` passes with at least 5.07:1
  (Indigo, on an `accent-200` hover).
- **Dark secondary text moves from `slate-400` to `slate-300`** everywhere. On `accent-900` `slate-400` fails for every hue (3.31:1 on Yellow); `slate-300` passes with at
  least 4.63:1 (Yellow, on an `accent-800` hover).
- Everything else stays: `text-slate-900` and `dark:text-slate-100` for body text, `text-slate-600 dark:text-slate-300` for leads and lists, `accent-700`/`accent-300`
  links.

## The focus ring

Every `focus-visible:outline-accent-500` gains `dark:focus-visible:outline-accent-300` beside it, in each component, not in a global rule. On `accent-900` the `accent-500`
ring misses 3:1 for Amber, Yellow, Lime and Green; `accent-300` passes for every hue with at least 5.01:1. The Light ring stays `accent-500` (at least 3.04:1 on
`accent-100`).

## The accent touches

Decided in [Prototype: Where else the accent should show across the UI](https://github.com/mpaulosky/Blazor-Server/issues/385). They live in the shared components, so every
page gets them, except the table header, which lives in the Profile slice.

- **PageHeader's `<h1>`** gains a gradient text fill:
  `bg-linear-to-r from-accent-800 to-accent-500 bg-clip-text text-transparent dark:from-accent-100 dark:to-accent-400`. The title is large text, so it needs 3:1; the
  weakest end stop is 3.37:1 (Rose's `accent-400` on `accent-900`).
- **PageHeader's eyebrow pill** moves from `bg-accent-100 text-accent-700` to `bg-accent-200 text-accent-800` in Light (Dark keeps
  `dark:bg-accent-500/15 dark:text-accent-300`). On a page whose header sits straight on the `accent-100` page, as Profile's and Admin's do, the old pill vanished;
  the new one passes with at least 5.42:1.
- **StatTile:** the tile is `rounded-2xl border border-accent-200 border-l-4 border-l-accent-500 bg-accent-50 p-4 dark:border-accent-800 dark:border-l-accent-500
  dark:bg-accent-900/60`. The label (`dt`) is `text-slate-600 dark:text-slate-300`, and the value (`dd`) adds `text-accent-700 dark:text-accent-300` (at least 5.01:1).
- **The Profile table header** is `bg-accent-200 text-accent-800 dark:bg-accent-800 dark:text-accent-200`, keeping its `text-xs uppercase tracking-wider`. The prototype's
  `accent-700` on `accent-200` and `accent-300` on `accent-800` failed for the red and pink hues; these pass with at least 5.42:1.
- **Browser chrome:** `app.tailwind.css` gains, in `@layer base` after the Palette rules:

  ```css
  :root {
  	accent-color: var(--color-accent-600);
  	scrollbar-color: var(--color-accent-500) var(--color-accent-100);

  	@variant dark {
  		scrollbar-color: var(--color-accent-400) var(--color-accent-950);
  	}
  }
  ```

Rejected in the prototype: card headings and the bold list terms in the hue, an accent strip across each card's top, and an accent line under the nav and footer.

## The rule and its guard

Decided in [Decide: How the surface tint reaches the markup](https://github.com/mpaulosky/Blazor-Server/issues/386).

`docs/CODING_STANDARDS.md` (Blazor) and `.claude/rules/blazor.md` gain the rule, in this spec's PR:

> Surfaces, borders, dividers and hover fills use `accent-*`, so the Palette tints them. Text stays `slate-*`: secondary text is `slate-600` in Light and `slate-300` in
> Dark. Pair every `focus-visible:outline-accent-500` with `dark:focus-visible:outline-accent-300`. The exceptions are the Palette menu's panel and tiles, and the
> fixed-meaning colours.

`tests/Architecture.Tests/UiRestyleTests.cs` widens from four layout files to every `.razor` file under `src/UI`, and gains these checks:

- No `bg-slate-`, `border-slate-`, `divide-slate-`, `ring-slate-`, `from-slate-`, `via-slate-` or `to-slate-` class, with or without a variant prefix (`dark:`,
  `hover:`, `even:`, `backdrop:`). `PaletteMenu.razor` is the only file exempt, for its panel, tiles and swatch ring; a bUnit test (below) holds its `<summary>`
  to the table.
- No `text-slate-500` and no `dark:text-slate-400`, in any file.
- Every class string (a `class` attribute's value, or a C# string constant holding a class list) that contains `focus-visible:outline-accent-500` also contains
  `dark:focus-visible:outline-accent-300`. The check is per string, not per file, so one focusable element can't hide behind another's Dark ring.

Its existing `gray-` and `blue-` checks widen to every file too.

## Testing

Test-first, as `CODING_STANDARDS.md` asks. No screenshot or visual-regression baselines.

- **Architecture:** the guard above. Write it first; it fails on today's markup and passes once the classes change.
- **Existing tests that name a slate class** change with the markup. Today that's `AppTests` (the `<body>` class and the compiled `dark:bg-slate-950` rule),
  `HomePageTests` (the badge border), `ReconnectModalTests` (its border, background and backdrop) and any bUnit test that asserts a hover or border class. `BadgeTests` keeps
  `text-slate-600`.
- **bUnit:** PageHeader's `<h1>` has the gradient classes and its eyebrow `bg-accent-200`; StatTile has `border-l-accent-500` and its value `text-accent-700`; the Profile `thead` has `bg-accent-200` and
  `text-accent-800`; `PaletteMenu`'s panel still has `bg-white` and `dark:bg-slate-900`, and its `<summary>` has `border-accent-200` and
  `dark:border-accent-700` and no `slate-` background or border class.
- **Styles:** `AppTailwindCssTests` checks that the compiled CSS sets `accent-color` and `scrollbar-color` on `:root` from the accent token.
- **E2E** (Playwright through the AppHost): the existing Palette test also checks that the `<body>`'s computed `background-color` changes when the visitor picks Rose, so
  the tint follows the Palette in a real browser.

## Implementation issues

Filed with native "blocked by" links. They don't carry `Sandcastle` yet: the owner adds it once this spec's PR merges, since adding it starts a run.

| Issue | Blocked by |
| --- | --- |
| [Tint the surfaces with the Palette, and guard them](https://github.com/mpaulosky/Blazor-Server/issues/388) | this spec |
| [Add the accent touches: the title gradient, StatTile, the Profile table header and the browser chrome](https://github.com/mpaulosky/Blazor-Server/issues/389) | #388 |
