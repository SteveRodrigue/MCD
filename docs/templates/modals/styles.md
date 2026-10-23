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
| Surfaces | `panel`, `panelHead`, `inset`, `chip` | all templates |
| Choices | `option`, `optionTitleHover`, `tile`, `tileSelected` | Decision, Select |
| Sequence | `slot`, `slotFinal`, `slotOver`, `step`, `stepFinal`, `btnMove` | Sequence |
| Actions | `btnGo` | Sequence, Select |
| Comic flavour | `fx` (burst words, shape, classes), `caption`, `bubble`, `finisher` | `ActionBurst`, `ComicSpeech`, Sequence |
| Gallery | `previewPage` | `StyleGallery` |

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

Inside the game there will be one provider at the root once a style is chosen.
