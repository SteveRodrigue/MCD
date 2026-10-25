# Modal style tokens

A style is one `ModalStyle` object in
[`modal-styles.ts`](../../../src/ui/theme/modal-styles.ts), registered in `MODAL_STYLES`.
No component changes are needed to add one; the gallery, lab navigation and the whole test matrix pick it up.

## Token groups

| Group | Tokens | Used by |
|---|---|---|
| Identity | `id`, `label`, `tagline`, `traits`, `bestFor` | gallery, lab bar |
| Shell | `overlay`, `frame`, `texture` + `textureClass`, `header`, `body`, `footer` | `ModalScaffold` |
| Header | `headerLayout` (`bar`, `caption`, `burst`, `masthead`, `tab`), `flavor`, `verbs[verb]` (`banner`, `iconBox`, `kicker`, `title`, `rule`, `word`) | `ModalScaffold` |
| Text | `text`, `muted`, `emphasis` | all templates |
| Surfaces | `panel`, `panelHead`, `inset`, `chip`, `badge`, `buttonShape` (shape without colours, for badges and buttons whose colour carries a game meaning) | all templates, the board and the setup screens |
| Choices | `option`, `optionTitleHover`, `tile`, `tileSelected` | Decision, Select |
| Sequence | `slot`, `slotFinal`, `slotOver`, `step`, `stepFinal`, `btnMove` | Sequence |
| Actions | `btnGo` | Sequence, Select |
| Comic flavour | `fx` (burst words, shape, classes), `caption`, `bubble`, `finisher` | `ActionBurst`, `ComicSpeech`, Sequence, the damage splash |
| Cards | `accent` (how a card's colour edge is drawn) | `CardRef`, `AccentStripe` |
| Fonts | `fonts` (`ThemeFonts`: Headlines, Body, Newspaper pair, Numbers & codes, text size changes) | `themeFontVars`, `newspaperFontVars`; see [FONT_RECORD.md](./FONT_RECORD.md) |
| Gallery | `previewPage` | `StyleGallery` |

Beyond the style, each theme has a `ThemeExtras` entry in [`theme-extras.ts`](../../../src/ui/theme/theme-extras.ts): the `table` (background, text, texture, read by `GameThemeRoot`), the `danger` button, the form `field` and the `newspaper` tokens (read by the Newspaper kit). The `Record` type keeps a theme from shipping without one.

## Rules for writing tokens

- Tailwind only sees **complete literal class strings** in the source. Never build a class with string interpolation
  from a variable (`text-${hue}-300`); write every class out.
- Use `border-[3px]`, not `border-3`: the project's Tailwind config has no `border-3` utility, so it silently renders no border.
- Keep verb colours meaningful: the `verbs` map must define all five of yellow, red, blue, purple, green.
- Star-shaped bursts get their outline from a black layer behind them; do not put `border-*` or shadows in a star `fx.className`.

## Add a style

1. Add `const myStyle: ModalStyle = { ... }` in `modal-styles.ts`, extend the `ModalStyleId` union, add it to `MODAL_STYLES`.
2. Open `/templates/my-style/sequence`. Run `npx vitest run tests/ui/modal-templates.test.tsx`.

## Use a style in a modal

```tsx
<ModalStyleProvider style={style}>
  <ModalScaffold title="..." kicker="..." verb="red" trigger={{ code: '01094', name: 'Rhino' }}>
    ...
  </ModalScaffold>
</ModalStyleProvider>
```

Inside the game one provider at the root (`ThemeProvider`) gives every component the active style; use `useModalStyle()` and `useThemeExtras()` instead of writing a palette by hand. A screen that follows the theme writes no literal comic look (`comic-panel`, `bg-white`, `border-comic-black`, `shadow-comic*`) and no fixed surface text colour; `tests/ui/theme-guards.test.ts` lists the files it covers and fails when one comes back.
