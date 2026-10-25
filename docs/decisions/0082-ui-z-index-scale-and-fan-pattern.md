# [ADR-0082] UI Z-Index Scale, Isolated Fan Pattern, and Portaled Overlays

- **Status:** Accepted
- **Date:** 2026-10-14
- **Authors:** MCD Core Team
- **Deciders:** User & Claude Code

---

## Context and Problem Statement

A 2026-10-14 audit of every z-index in `src/ui/` ([Appendix A](#appendix-a-layer-map), [findings](#appendix-b-findings-history)) found ten defects ([Issue #312](https://github.com/SteveRodrigue/MCD/issues/312)). The visible one: the hover-zoomed villain card slid under the stats, HP and side-scheme panels, because its wrapper (`z-[5]`) formed a stacking context below sibling panels (`z-10`). The root causes were shared:

- Z values were ad-hoc literals (`5`, `10` … `70`, `9999`, `10000`, `100000`) with no scale.
- Fan offsets used fixed constants (`30 - index`), so a hand of 32+ cards went negative and disappeared, and attachment stacks collided with their host card.
- 11 overlays rendered inline, inside hover-raised or transformed ancestors that capped or re-anchored them; 15 others were portaled. Equal z values had different real ranks.
- The `sticky` TopBar bound to `overflow-x-hidden` ancestors that never scroll, so it scrolled away.

---

## Decision Drivers

- One readable ordering for the whole UI, with room to insert layers later.
- Fans must stay correct for the largest real fan (a 50-card hand; deck maximum is 50) and beyond.
- An overlay's z value must equal its real global rank.
- Regressions must fail a test, not a playtest.

---

## Considered Options

1. **Option 1:** Fix the individual literals in place.
2. **Option 2:** Named scale + isolated fans + one portal component for overlays + guard test.
3. **Option 3:** Option 2 plus a single portal "zoom layer" that renders every hover zoom at the root.

---

## Decision Outcome

**Chosen Option:** **Option 2.**

1. **Scale** in [z-layers.ts](../../src/ui/styles/z-layers.ts), spaced ×10 (99 free values per gap): `table` 0, `content` 100, `raised` 200, `zoom` 400, `drawer` 600, `modal` 700, `banner` 800, `menu` 900, `critical` 1000. Exposed to Tailwind as `z-<token>` via `theme.extend.zIndex`.
2. **Isolated fans:** every fan container is `isolate` and raises itself with `hover:z-zoom focus-within:z-zoom`. Card values come from [fan-z.ts](../../src/ui/components/cards/fan-z.ts) (`count - index`, hovered `count + 1`), so they never leak and fit any count. `CardAttachmentFan` always wraps its host (local order: underneath `1…m` < attachments `m+1…m+n` < host `m+n+1` < hovered attachment `m+n+2`).
3. **Overlays** render through [ModalLayer](../../src/ui/components/layout/ModalLayer.tsx), a portal to `document.body` with a `layer` prop (`drawer`, `modal`, `banner`, `critical`).
4. **Owner decisions:** a zoomed card never covers the side dock (`zoom` < `drawer`); Game Over (Heroes Win and Villain Wins) sits at `critical`; no zoom portal for now.
5. **Page scroll:** the App and GameBoard roots use `overflow-x-clip`, which hides horizontal overflow without creating a scroll container (it protected the sticky TopBar; the TopBar is gone since #378, the roots keep the rule so the page scrolls with the window).
6. **Guard:** [z-literal-guard.test.ts](../../tests/ui/z-literal-guard.test.ts) fails on numeric/arbitrary z classes or numeric `zIndex` literals in `src/ui/` (allowlist: two `-z-*` back layers in `FacedownEncounterCard.tsx`).

### Rationale ("The Why")

Option 1 would fix today's symptoms but leave the causes (no scale, constant-based fans, mixed overlay mounting) to recreate them. Option 3 solves zoom globally but needs position tracking for every zoomed card; container raising fixes every known case with far less code. It stays open if zoom bugs return.

---

## Evaluation of Options

### Option 1: Fix literals in place

- **Pros:**
  - Smallest diff.
- **Cons:**
  - No shared meaning; values keep creeping upward.
  - Fan overflow and trapped overlays remain possible.

### Option 2: Scale + isolated fans + ModalLayer + guard

- **Pros:**
  - Every layer has a named, documented rank; the guard keeps it that way.
  - Fans are correct for any card count.
  - Overlays cannot be trapped by zone hover or transforms.
- **Cons:**
  - Touches ~40 UI files and ~10 tests at once.

### Option 3: Option 2 + zoom portal

- **Pros:**
  - Zoomed cards escape every context, including multi-hero stations.
- **Cons:**
  - Needs measurement and repositioning of each zoomed card; more code and more test surface.

---

## Consequences

### Positive Consequences

- The Villain Zone zoom, trapped pile viewers, hand overflow and non-sticky TopBar are fixed.
- New layers are placed by role, not by guessing a number.

### Negative Consequences / Risks & Mitigations

- Hover zooms inside a focused multi-hero station stay capped at the station (`content`). Accepted; revisit with Option 3 if it causes a visible bug.
- The scale lives in Tailwind 3 `theme.extend`. [Issue #305](https://github.com/SteveRodrigue/MCD/issues/305) (Tailwind 4) must re-wire `Z` into `@theme`; the TS module stays the single source.

## Appendix A: Layer map

Reference map of every z-index layer in the UI (`src/ui/`), ordered from the sky (∞) down to the
virtual table. Use it to place a new layer, size fan-outs (§5), and check consistency against the
scale (Appendix C).

> State: after [Issue #312](https://github.com/SteveRodrigue/MCD/issues/312) (2026-10-14). Tailwind CSS 3.4. The scale lives in
> [z-layers.ts](../../src/ui/styles/z-layers.ts) and reaches Tailwind through `theme.extend.zIndex` in
> [tailwind.config.js](../../tailwind.config.js). The guard test
> [z-literal-guard.test.ts](../../tests/ui/z-literal-guard.test.ts) rejects raw z literals in `src/ui/`.

### 1. How to read this map

A `z-index` only competes with siblings **inside the same stacking context**. A child with `z-zoom`
inside a parent context at `z-content` can never rise above a sibling at `z-raised`. So each row
shows an **effective path**:

| Notation       | Meaning                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| `root › 700`   | 700 in the document root context (portals to `document.body`).             |
| `… › Sec(200)` | A context that exists **only while hovered/focused** (`hover:z-raised`).   |
| `auto`         | Positioned, no z-index: painted in DOM order above non-positioned content. |
| `local n`      | A value inside an isolated fan (§5); never compared with the global scale. |

What creates a stacking context in this codebase:

1. `position: relative/absolute/fixed/sticky` **with** a z-index (`relative z-content`).
2. A **flex item** with a z-index, even without `position` (for example `VillainPhaseStepper`).
3. `isolation: isolate` (Tailwind `isolate`): used on purpose by every fan (§5).
4. `transform`, `filter`, `opacity < 1`, `backdrop-filter`. `transform` and `filter` also become the
   **containing block of `position: fixed` descendants**. This is why every overlay renders through
   `ModalLayer` (a portal to `document.body`): no ancestor can trap or re-anchor it.

---

### 2. Global ladder: game board (∞ → table)

Higher rows paint on top. Everything inside `App(100)` is below every portaled layer.

| Z (effective path)            | Token      | Layer                                                                                                                                                           | Source                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **∞**                         | —          | Native browser UI: `title=` tooltips, native `<select>` popups, OS scrollbars                                                                                   | many `title=` attributes                                                                                                                                                                                                                                                                                                                                                                                             |
| `root › 1000`                 | `critical` | Game Over (Heroes Win and Villain Wins), Report a Problem, Infinite-loop guard                                                                                  | [GameOverScreen.tsx:21](../../src/ui/components/board/GameOverScreen.tsx#L21), [ReportProblemModal.tsx:121](../../src/ui/components/board/ReportProblemModal.tsx#L121), [App.tsx:285](../../src/ui/App.tsx#L285)                                                                                                                                                                                                     |
| `root › 900`                  | `menu`     | Card context menu, then its confirm dialog (same portal; later in DOM, so on top)                                                                               | [CardContextMenu.tsx:95](../../src/ui/components/cards/CardContextMenu.tsx#L95), [:180](../../src/ui/components/cards/CardContextMenu.tsx#L180)                                                                                                                                                                                                                                                                      |
| `root › 800`                  | `banner`   | Dev step-error banner                                                                                                                                           | [DevStepErrorBanner.tsx:23](../../src/ui/components/board/DevStepErrorBanner.tsx#L23)                                                                                                                                                                                                                                                                                                                                |
| `root › 700`                  | `modal`    | Every other modal (21 sites): action/target/payment/prompt modals, hand and encounter pile viewers, Options, End Turn, Daily Bugle, Combat Boost, facedown peek | `ModalLayer` callers, for example [VillainZone.tsx:456](../../src/ui/components/board/VillainZone.tsx#L456), [PlayerHandTray.tsx:491](../../src/ui/components/board/PlayerHandTray.tsx#L491), [RemovedFromGameBox.tsx:72](../../src/ui/components/board/RemovedFromGameBox.tsx#L72), [FacedownEncounterCard.tsx:143](../../src/ui/components/cards/FacedownEncounterCard.tsx#L143). List: `rg "<ModalLayer" src/ui`. |
| `root › 600`                  | `drawer`   | Side dock: the quick-menu rail above the combat log                                                                                                             | [SideDock.tsx](../../src/ui/components/board/SideDock.tsx)                                                                                                                                                                                                                                                                                                                                                           |
| — `App(100)` context starts — | `content`  | App screen wrapper: everything not portaled lives below this line                                                                                               | [App.tsx:232](../../src/ui/App.tsx#L232)                                                                                                                                                                                                                                                                                                                                                                             |
| `App(100) › 400`              | `zoom`     | Hovered card in solo play: a fan wrapper, the hand fan row, or a bare `CardView` raising itself                                                                 | [CardAttachmentFan.tsx:42](../../src/ui/components/cards/CardAttachmentFan.tsx#L42), [PlayerHandTray.tsx:441](../../src/ui/components/board/PlayerHandTray.tsx#L441), [CardView.tsx:231](../../src/ui/components/cards/CardView.tsx#L231)                                                                                                                                                                            |
| `App(100) › Sec(200) › …`     | `raised`   | Villain & Scenario Zone or Removed-from-game box while hovered/focused (local ladder in §3)                                                                     | [VillainZone.tsx:136](../../src/ui/components/board/VillainZone.tsx#L136), [RemovedFromGameBox.tsx:32](../../src/ui/components/board/RemovedFromGameBox.tsx#L32)                                                                                                                                                                                                                                                     |
| `App(100) › 200`              | `raised`   | Villain Phase stepper (flex item), multi-hero scroll arrows                                                                                                     | [VillainPhaseStepper.tsx:99](../../src/ui/components/board/VillainPhaseStepper.tsx#L99), [GameBoard.tsx:406](../../src/ui/components/board/GameBoard.tsx#L406), [:415](../../src/ui/components/board/GameBoard.tsx#L415)                                                                                                                                                                                             |
| `App(100) › 100`              | `content`  | Focused multi-hero station (its hover zooms are capped here)                                                                                                    | [GameBoard.tsx:440](../../src/ui/components/board/GameBoard.tsx#L440)                                                                                                                                                                                                                                                                                                                                                |
| `App(100) › 0`                | `table`    | Unfocused multi-hero stations (`opacity-60` + `grayscale`)                                                                                                      | [GameBoard.tsx:441](../../src/ui/components/board/GameBoard.tsx#L441)                                                                                                                                                                                                                                                                                                                                                |
| `App(100) › auto`             | —          | Zone panels at rest: Villain Zone, Removed box, Hero Zone, Hand tray; fans at rest (isolated)                                                                   | [HeroZone.tsx:310](../../src/ui/components/board/HeroZone.tsx#L310), [PlayerHandTray.tsx:254](../../src/ui/components/board/PlayerHandTray.tsx#L254)                                                                                                                                                                                                                                                                 |
| `root › 0`                    | `table`    | Halftone dot overlay (fixed, `pointer-events-none`)                                                                                                             | [App.tsx:229](../../src/ui/App.tsx#L229)                                                                                                                                                                                                                                                                                                                                                                             |
| **Virtual table**             | —          | App background `bg-comic-paper`; anything below is invisible                                                                                                    | [App.tsx:227](../../src/ui/App.tsx#L227), [GameBoard.tsx:344](../../src/ui/components/board/GameBoard.tsx#L344)                                                                                                                                                                                                                                                                                                      |

**Consistency rules this ladder satisfies:**

1. A zoomed card never covers the side dock: `zoom` 400 < `drawer` 600.
2. Every overlay is portaled, so its token is its real global rank.
3. Game Over cannot be covered by a prompt.

---

### 3. Local ladder: Villain & Scenario Zone (∞ → zone background)

Everything here is inside `App(100) › Sec(200)` when the zone is hovered, or `App(100) › auto` when
not. Paths are relative to the zone section. The zone's pile viewers are portaled (§2, `modal`).

| Z (path inside section)      | Layer                                                                                    | Source                                                                                                                                                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400`                        | **Hovered villain fan** → host card → zoomed `CardView`                                  | [VillainZone.tsx:300](../../src/ui/components/board/VillainZone.tsx#L300), [CardAttachmentFan.tsx:42](../../src/ui/components/cards/CardAttachmentFan.tsx#L42)                                                                                                |
| `400`                        | Hovered main-scheme card, hovered encounter-discard top card                             | [VillainZone.tsx:383](../../src/ui/components/board/VillainZone.tsx#L383), [:154](../../src/ui/components/board/VillainZone.tsx#L154)                                                                                                                         |
| `SidePanel(400) › 400 › 400` | Hovered side-scheme panel → item → fan                                                   | [VillainZone.tsx:413](../../src/ui/components/board/VillainZone.tsx#L413), [:429](../../src/ui/components/board/VillainZone.tsx#L429), [:432](../../src/ui/components/board/VillainZone.tsx#L432)                                                             |
| `SidePanel › item › 200`     | Side-scheme threat pill (above its fan at rest)                                          | [VillainZone.tsx:438](../../src/ui/components/board/VillainZone.tsx#L438)                                                                                                                                                                                     |
| `100`                        | Villain SCH/ATK column, HP column, side-scheme panel at rest, encounter deck count badge | [VillainZone.tsx:261](../../src/ui/components/board/VillainZone.tsx#L261), [:317](../../src/ui/components/board/VillainZone.tsx#L317), [:413](../../src/ui/components/board/VillainZone.tsx#L413), [:206](../../src/ui/components/board/VillainZone.tsx#L206) |
| `auto` (isolated)            | Villain fan at rest: local order in §5                                                   | [CardAttachmentFan.tsx:42](../../src/ui/components/cards/CardAttachmentFan.tsx#L42)                                                                                                                                                                           |
| `auto`                       | Zone ribbon, villain / main-scheme panels, encounter piles                               | [VillainZone.tsx:138](../../src/ui/components/board/VillainZone.tsx#L138)                                                                                                                                                                                     |
| **Zone background**          | Section `bg-white/95`                                                                    | [VillainZone.tsx:136](../../src/ui/components/board/VillainZone.tsx#L136)                                                                                                                                                                                     |

The zoomed villain card (400) paints over the stats, HP and side-scheme panels (100), and under the
side dock (the whole section is capped at 200 < 600). The Hero Zone uses the same fan for the identity
([HeroZone.tsx:720](../../src/ui/components/board/HeroZone.tsx#L720)), minions
([:442](../../src/ui/components/board/HeroZone.tsx#L442)) and allies
([:1027](../../src/ui/components/board/HeroZone.tsx#L1027)), so every host card behaves alike.

---

### 4. Other screens (relative order preserved)

| Z (effective path)     | Layer                                                         | Source                                                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App(100) › 400`       | Scenario selector: carousel arrows; hovered option / its card | [ScenarioSelector.tsx:188](../../src/ui/components/setup/ScenarioSelector.tsx#L188), [:544](../../src/ui/components/setup/ScenarioSelector.tsx#L544), [:554](../../src/ui/components/setup/ScenarioSelector.tsx#L554)                                                  |
| `App(100) › 200 / 100` | Scenario selector divider / grid                              | [ScenarioSelector.tsx:206](../../src/ui/components/setup/ScenarioSelector.tsx#L206), [:204](../../src/ui/components/setup/ScenarioSelector.tsx#L204)                                                                                                                   |
| `App(100) › … › 100`   | Mulligan badge                                                | [MulliganScreen.tsx:190](../../src/ui/components/setup/MulliganScreen.tsx#L190)                                                                                                                                                                                        |
| `App(100) › 200`       | Editor header, filter toolbar                                 | [SupplementalEditorScreen.tsx:149](../../src/ui/components/editor/SupplementalEditorScreen.tsx#L149), [CardFilterToolbar.tsx:78](../../src/ui/components/editor/CardFilterToolbar.tsx#L78)                                                                             |
| `App(100) › 100 › 400` | Editor body → sidebar toggle, dual card inspector             | [SupplementalEditorScreen.tsx:220](../../src/ui/components/editor/SupplementalEditorScreen.tsx#L220), [:227](../../src/ui/components/editor/SupplementalEditorScreen.tsx#L227), [DualCardInspector.tsx:260](../../src/ui/components/editor/DualCardInspector.tsx#L260) |

The editor uses the App halftone overlay; its own duplicate was removed. Card-internal layers
(`CardView` badges `content`, ACTION badge and damage splash `raised`, facedown back layers `-z-10` /
`-z-20`) stay inside the card's own context.

---

### 5. Dynamic fan-out offsets

Fans overlap cards, so each card gets a z-index computed from its position. These are the only
dynamic z values in the UI. Indexed fans use [fan-z.ts](../../src/ui/components/cards/fan-z.ts):

```ts
getFanZIndex(count, index, hovered); // resting: count - index (always >= 1); hovered: count + 1
```

**Capacity:** a player deck holds at most 50 cards (Rules Reference, Deck Customization appendix) and
hand size is only enforced at the end of the round, so a hand can reach 50 cards. Attachments and
cards underneath have no printed cap. Every fan is **isolated** (`isolate`) and derives its values
from its own card count, so a fan of any size fits and takes a single slot in the global scale.
Tests cover counts up to 99.

| Fan                                                                                                                                | Local order (bottom → top)                                                           | Raises itself on hover                     |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| Attachment fan, `n` attachments, `m` cards underneath [CardAttachmentFan.tsx](../../src/ui/components/cards/CardAttachmentFan.tsx) | underneath `1…m` < attachments `m+1…m+n` < host `m+n+1` < hovered attachment `m+n+2` | `hover:z-zoom focus-within:z-zoom`         |
| Hand tray, `n` cards [PlayerHandTray.tsx:456](../../src/ui/components/board/PlayerHandTray.tsx#L456)                               | `n` (leftmost) … `1`; hovered card `n + 1`                                           | fan row `hover:z-zoom focus-within:z-zoom` |
| Decision prompt revealed cards [DecisionPromptModal.tsx:341](../../src/ui/components/board/DecisionPromptModal.tsx#L341)           | flat: `content`, hovered `zoom` (inside the portaled modal; not indexed)             | —                                          |

To add a fan: isolate its container, compute values with `getFanZIndex`, and let the container raise
itself to `zoom` on hover/focus.

---

## Appendix B: Findings history

All found in the 2026-10-14 audit and fixed in #312.

| ID  | Finding (before)                                                                                 | Fix                                                                  |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| F1  | Zoomed villain card capped at `z-[5]`, slid under the stats, HP and side-scheme panels (`z-10`). | Isolated fan raises itself to `zoom` (400) over panels at `content`. |
| F2  | Villain Zone / Removed-box pile viewers trapped in `hover:z-30` sections, under the TopBar.      | Portaled through `ModalLayer`.                                       |
| F3  | Attachment and underneath z reached the host's `z-[5]` at 5–6 cards.                             | Local order derived from `n` and `m` (§5).                           |
| F4  | Hover zoom covered the TopBar in the Hero Zone but not in the Villain Zone.                      | One `zoom` token below `sticky` everywhere.                          |
| F5  | 15 portaled vs 11 inline modals; Game Over (`z-70` inline) ranked below portaled modals.         | One `ModalLayer`; Game Over at `critical`.                           |
| F6  | Transforms/filters on multi-hero stations re-anchored inline `fixed` modals.                     | Portals; no-op `scale-[1.00]` removed.                               |
| F7  | Magic numbers (`9999`, `10000`, `100000`, `z-[5]`, `z-[60]`, `z-[70]`).                          | Named scale + guard test.                                            |
| F8  | Hand fan `30 - index` went negative from the 32nd card; those cards hid under the tray.          | `getFanZIndex(hand.length, …)`, isolated row.                        |
| F9  | Dead `mode="vertical"`, duplicated DecisionPrompt z, second editor halftone overlay.             | Removed.                                                             |
| F10 | TopBar `sticky` bound to non-scrolling `overflow-x-hidden` ancestors and scrolled away.          | `overflow-x-clip` on the App and GameBoard roots.                    |

---

## Appendix C: The scale and adding a layer

The scale (tokens, values and use) is defined only in [z-layers.ts](../../src/ui/styles/z-layers.ts) (`Z` for inline styles, `Z_CLASS` / `z-<token>` classes), spaced ×10 so each gap holds 99 free values. A table here would drift from the code; `tests/ui/z-layers.test.ts` guards the code.

**Adding a layer:** reuse a token when the role matches. Otherwise add a key to `Z` and `Z_CLASS` in a
free gap, update the layer map above, and record why in an ADR-0082 addendum. Any overlay that must
cover the board goes through `ModalLayer`.

---

## Addendum 2026-10-25 ([Issue #378](https://github.com/SteveRodrigue/MCD/issues/378))

The top bar is gone: the quick-menu rail now sits above the combat log in one `drawer` layer (`SideDock`). The `sticky` layer (500) had no other user and is removed from `Z`, `Z_CLASS` and the Tailwind config; the layer map, owner decision 4 and consistency rule 1 above name the dock instead of the TopBar. Appendix B stays as the record of what was found and fixed in 2026-10-14.

## Addendum 2026-10-25 ([Issue #380](https://github.com/SteveRodrigue/MCD/issues/380))

The hero track's Scroll Left / Scroll Right buttons float at the middle of the screen (`sticky top-1/2`) and use `zoom` (400): they must stay above a Villain or Removed zone raised by hover (`raised`, 200), and below the side dock and every modal. No new layer.
