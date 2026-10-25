# Plan: Modal Style Lab (`localhost:3000/templates/`)

Status: **built and committed; the lab is now the dev-only design reference for the themes the game uses.** Six styles were planned; a seventh (Hero HUD) and built-in comic flavour (sound-effect bursts, narrator captions, speech bubbles, finisher tags) were added on request. Reference docs: [README](./README.md), [styles.md](./styles.md).

## 0. Scope boundary (agreed)

**No core game code changes for now.** This work is the template browser only. Once the styles
settle, the templates become the reference for retrofitting the game and for future design.

Allowed touch points outside `src/ui/components/templates/`, `tests/ui/modal-templates.test.tsx`
and `docs/templates/`, all already in the working tree:
- `src/ui/App.tsx`: the `/templates` route (lazy-loaded, no effect on game flow).
- `src/ui/components/cards/CardArtThumbnail.tsx`: the `xs` size (additive, no existing caller changes).
- `.claude/launch.json`: dev port 3000 (tooling).

Not touched: engine, data, real modals (`WakandaForeverModal`, `DecisionPromptModal`, ...), ADRs.
Any further outside change needs your say-so first.

## 1. Goal

One coherent look for every modal in the game. You pick a winner (or mix traits) by clicking
through real, interactive modals in several styles, then we migrate the game to it.

## 2. Core idea: style × archetype × verb colour

Three independent axes, so any style can be compared on any modal:

| Axis | What it is | Values |
|---|---|---|
| **Style** | How the modal is drawn (frame, header, texture, buttons) | 6 propositions below |
| **Archetype** | What the modal does | Decision, Sequence (Wakanda Forever), Multi-select |
| **Verb colour** | Gameplay meaning of the header hue | yellow = decide, red = attack/forced, blue = thwart/info, purple = hero special, green = defend/heal |

Verb colours stay the same in every style. That is what keeps the game readable no matter which
style wins.

## 2b. Card Anchoring Rule (mandatory in every style, every archetype)

A card thumbnail must be shown, never only text, whenever a card is:

1. **Named** anywhere (title, prose, option label, recap line, footer, tooltip text).
2. **Its text is shown** (rules text, ability text, effect summary): the source card's thumbnail sits with that text.
3. **Its ability is used** (an option, a step, a payment, a target that uses an ability).
4. **The trigger** that opened the modal.

How it is enforced, so it cannot drift:
- One `CardRef` component (thumbnail + name, `xs`/`sm`) is the only way templates write a card name. No bare card-name strings in JSX.
- Prose with card names goes through `CardRef` pieces, not interpolated text (e.g. the finisher footer shows the Vibranium Suit thumbnail, not "(Vibranium Suit)").
- Every template has a **Trigger/Source slot** in the scaffold (thumbnail + name) so the card that caused the modal is always shown. The scaffold warns in dev if a modal omits it.
- Test: for every style x archetype, each card name rendered in the DOM must have an `img` (thumbnail or `CardView`) for the same card code next to it.

Consequences for the current templates: footer/prose mentions (Wakanda finisher footer, Decision "Rhino's attack" and "Exhaust Spider-Man" descriptions, Select helper text) are rewritten so every card name carries a thumbnail.

## 3. The propositions (6 styles)

| # | Name | Look | Best at | Status |
|---|---|---|---|---|
| A | **Pop-Art Action-Coded** | Lichtenstein: 4px black border, Ben-Day dots, bold colour header bars | Everything (current baseline, closest to your Wakanda revamp) | exists, re-expressed as tokens |
| B | **Storyboard Panels** | Tilted yellow caption sticker, framed white panels, comic gutters | Multi-step prompts | exists, re-expressed as tokens |
| C | **Golden Age Newsprint** | Aged paper, ink-black print, square corners, masthead header ("No. 1 - 10c"), hard ink shadow. Echoes the existing Daily Bugle modal. | Story beats, info, confirmations | new |
| D | **Night Edition** | Dark ink background, neon yellow rule, glowing verb-colour header, cards pop against black | Long sessions, dark-table feel | new |
| E | **Splash Page** | Starburst header (clip-path), tilted title, sound-effect stickers (POW / THWIP), chunky 12px shadow | Combat, big moments | new |
| F | **S.H.I.E.L.D. Dossier** | Manila folder, typewriter mono text, "CLASSIFIED" stamp, tape corners, paper-clip | Decisions, search/select, rules text | new |

## 4. Navigation

- `/templates/` : gallery of the 6 styles. Each card shows swatches and a mini preview; click to enter.
- `/templates/<style>/<archetype>` : live interactive modal, e.g. `/templates/newsprint/sequence`.
- Top bar: style pills + archetype pills + "Back to Game". Browser back/forward works.
- Old routes (`/templates/template-wakanda-forever`, etc.) are replaced, not aliased.
- Dev port: `.claude/launch.json` changes 5173 to 3000 (`vite.config.ts` already uses 3000).

## 5. Simplification & Refactor Check

Today there are **two parallel scaffolds** and **two near-copies of the Wakanda template**
(~630 lines, same logic). Adding more styles that way would triple that. Instead:

| Merged / deleted | Replaced by |
|---|---|
| `ComicModalScaffold.tsx` + `StoryboardModalScaffold.tsx` | one `ModalScaffold.tsx` driven by style tokens |
| `WakandaForeverTemplate.tsx` + `StoryboardWakandaTemplate.tsx` | one `SequenceTemplate` (Wakanda Forever data), takes a style |
| `docs/.../proposition_1_*.md`, `proposition_2_*.md`, pasted code in `archetypes_reference.md` | `styles.md` (token table + how to add a style); docs point at the real components instead of copying code (copied code goes stale) |

Adding a seventh style later = one token object in `modal-styles.ts`, zero new components.

## 6. File changes

New / rewritten under `src/ui/components/templates/`:
- `modal-styles.ts`: `ModalStyle` type + registry of the 6 styles (frame, texture, header layout, verb-colour map, panel, option row, primary and secondary button, chip, footer).
- `ModalScaffold.tsx`: one scaffold; header layout is `bar | caption | burst | masthead | tab` per style.
- `DecisionTemplate.tsx`, `SequenceTemplate.tsx`, `SelectTemplate.tsx`: the three archetypes, style-agnostic.
- `ModalTemplatesScreen.tsx`: gallery + navigation, route parsing in one small helper.
- Delete: `ComicModalScaffold`, `StoryboardModalScaffold`, `StoryboardWakandaTemplate`, `WakandaForeverTemplate`, `DecisionPromptTemplate`, `SelectCardsTemplate` (renamed/merged above).

Other:
- `src/ui/App.tsx`: already routes `/templates`; just keep it (no change expected beyond formatting).
- `.claude/launch.json`: port 3000.
- `src/ui/components/cards/CardArtThumbnail.tsx`: `xs` size already added; stays.
- `docs/templates/modals/`: `README.md` (rules, how to use), `styles.md` (token reference), delete the old proposition docs.

Kept from the current work: real `CardView` for the Wakanda trigger and upgrades, move buttons below each
card, step badges and finisher highlight, drag-and-drop, text recap, the Visual Card Anchoring rule
(every card shown as at least a thumbnail), corrected card codes.

## 7. Tests (`tests/ui/modal-templates.test.tsx`)

- Every style renders the scaffold (kicker, title, icon, body, footer) and every verb colour.
- Sequence: reorder with buttons, execute returns ordered ids, finisher badge on the last step, in every style.
- Decision: forced/voluntary toggle; option click fires callback, in every style.
- Select: counter and max-selection limit, in every style.
- Route helper: `/templates/`, `/templates/<style>/<archetype>`, unknown slug falls back to gallery.

Targeted run only: `vitest run tests/ui/modal-templates.test.tsx`, plus `tsc`, `eslint`, `prettier` on changed files.

## 8. Debt Removed

- Duplicate scaffolds and duplicate Wakanda templates (see section 5).
- Pasted-code docs that drift from the real components.
- Stale "3/4-height" wording (already fixed).
- Wrong sample card codes (already fixed).

## 9. Out of scope (next phase, after you vote)

Migrating the ~20 real modals (`AttackTargetModal`, `DecisionPromptModal`, `SelectCardsModal`,
`WakandaForeverModal`, `ThwartTargetModal`, `CombatBoostModal`, ...) onto the winning style, and
amending ADR-0056 to name it. Fixes #358 when `WakandaForeverModal` is migrated.

## 10. Open decisions (defaults in bold)

1. Keep all 6 styles, or drop some? **Keep all 6.**
2. Wakanda sample for the Sequence archetype in every style? **Yes (your preferred anchor).**
3. Gallery mini-previews drawn from tokens (cheap, always in sync) vs screenshots? **Tokens.**
4. Add a "mix" panel later so you can combine, e.g., Night Edition frame with Splash header? **Not now; ask after the first vote.**

Rough effort: about 1 session for tokens + scaffold + 3 templates + gallery + tests.
