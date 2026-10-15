# [ADR-0082] UI Z-Index Scale, Isolated Fan Pattern, and Portaled Overlays

- **Status:** Accepted
- **Date:** 2026-10-14
- **Authors:** MCD Core Team
- **Deciders:** User & Claude Code

---

## Context and Problem Statement

A 2026-10-14 audit of every z-index in `src/ui/` ([docs/ui_z_axis_layering.md](../ui_z_axis_layering.md)) found ten defects ([Issue #312](https://github.com/SteveRodrigue/MCD/issues/312)). The visible one: the hover-zoomed villain card slid under the stats, HP and side-scheme panels, because its wrapper (`z-[5]`) formed a stacking context below sibling panels (`z-10`). The root causes were shared:

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

1. **Scale** in [z-layers.ts](../../src/ui/styles/z-layers.ts), spaced ×10 (99 free values per gap): `table` 0, `content` 100, `raised` 200, `zoom` 400, `sticky` 500, `drawer` 600, `modal` 700, `banner` 800, `menu` 900, `critical` 1000. Exposed to Tailwind as `z-<token>` via `theme.extend.zIndex`.
2. **Isolated fans:** every fan container is `isolate` and raises itself with `hover:z-zoom focus-within:z-zoom`. Card values come from [fan-z.ts](../../src/ui/components/cards/fan-z.ts) (`count - index`, hovered `count + 1`), so they never leak and fit any count. `CardAttachmentFan` always wraps its host (local order: underneath `1…m` < attachments `m+1…m+n` < host `m+n+1` < hovered attachment `m+n+2`).
3. **Overlays** render through [ModalLayer](../../src/ui/components/layout/ModalLayer.tsx), a portal to `document.body` with a `layer` prop (`drawer`, `modal`, `banner`, `critical`).
4. **Owner decisions:** a zoomed card never covers the TopBar (`zoom` < `sticky`); Game Over (Heroes Win and Villain Wins) sits at `critical`; no zoom portal for now.
5. **Sticky TopBar:** ancestors use `overflow-x-clip`, which hides horizontal overflow without creating a scroll container.
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
