# The Palette tints the surfaces with its own scale

The **Palette** used to colour only the accent: buttons, links and highlights. Surfaces and borders were slate in both Themes, whatever hue the visitor picked. It now
tints them too. The page, cards, nav, footer, borders and hover fills use the `accent-*` scale directly (`bg-accent-100 dark:bg-accent-950`), so a visitor's hue reaches
the whole page. Text stays slate. The Palette menu's panel is the one surface that stays slate, so its swatches read true. See [Palette Tint](../plans/palette-tint.md).

This reverses "Palette governs accent color only, while grays/background stay governed by Theme" in `CONTEXT.md` and "**Palette** is the accent hue" in
[Theme and Palette](../plans/theme-and-palette.md). Theme still decides light or dark; the Palette decides the hue of both the accent and the surfaces.

## Considered Options

- **Slate mixed with a fraction of the hue** (`color-mix`, 10–30%) in new `@theme` tokens. Research showed 20% passes WCAG AA for every hue, but in the prototype the Light
  tint was barely visible, because slate-50 and every hue's 50 are both near white. The Dark tint was quieter than the visitor wanted.
- **Named surface tokens** (`surface-page`, `surface-hover`, `edge`) as aliases for accent stops. They'd let the page colour change in one place, but they add a second
  colour vocabulary beside `accent-*`. Each token would also need its own `dark` rule, where every other class in the app pairs its Theme with `dark:`.
- **Keep the surfaces slate** and add more accent touches only. The visitor wanted the hue to carry the page, not just its highlights.
- **A Neutral Palette that tints nothing**, for visitors who want the old slate look. That brings back the gray-family scales the glossary excludes.

## Consequences

- Secondary text moves to `slate-600` in Light and `slate-300` in Dark, and the Dark focus ring to `accent-300`, so every pair keeps AA on the tinted surfaces for all
  17 hues.
- A new component writes its surfaces in `accent-*`. `tests/Architecture.Tests/UiRestyleTests.cs` fails on a slate surface class anywhere but the Palette menu, so slate
  can't creep back.
- Undoing this means changing every surface class again, so a later change of mind is a sweep across the components, not one token.
