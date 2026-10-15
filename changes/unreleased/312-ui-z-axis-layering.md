---
type: Fixed
---

- **Fix (UI): Consistent z-axis layering, sticky Top Menu, and fan overflow ([Issue #312](https://github.com/SteveRodrigue/MCD/issues/312))**
  - The hover-zoomed villain card now renders above the SCH/ATK, HP and side-scheme panels instead of sliding under them.
  - The Top Menu stays visible while scrolling: `overflow-x-clip` replaces `overflow-x-hidden` on the App and GameBoard roots, so `sticky` binds to the viewport.
  - Added a named z-index scale spaced ×10 (`src/ui/styles/z-layers.ts`, Tailwind `z-<token>` classes) and a guard test that rejects raw z literals in `src/ui/`.
  - Every modal, drawer and banner now renders through a shared `ModalLayer` portal; Game Over (Heroes Win and Villain Wins) sits above every prompt.
  - Fans (hand, attachments, cards underneath) use isolated, count-derived z values (`fan-z.ts`): hands of 32+ cards no longer hide cards, and large attachment stacks no longer cover their host.
  - Removed the unused `CardAttachmentFan` vertical mode and the Card Editor's duplicate halftone overlay. See ADR-0082 and `docs/ui_z_axis_layering.md`.
  - Pile inspectors (player deck/discard/set-aside, encounter deck/discard, removed from game, facedown peek) show the `#N` position tag on the card's top-right corner so it no longer covers the cost.
  - The Removed from Game panel title is shortened to "OUT OF PLAY" so it no longer wraps over 3 lines.
  - Villain & Scenario Zone panels (villain, main scheme, side schemes) now share one row height; the villain card stays vertically centred.
  - Digits in the Bangers title font now render in Comic Relief Bold (digits-only `Comic Digits` face), so 1 and 7 are easy to tell apart at small sizes.
  - Villain and hero health gauges show the heart at the top and the `health/max` number as the bottom label, replacing the hard-to-read "HP" text.
  - The hand tray's Deck / Discard / Nemesis sidebar now matches the hand card height on desktop (the fan row is exactly one card tall); only the deck card back grows, the buttons keep their size.
