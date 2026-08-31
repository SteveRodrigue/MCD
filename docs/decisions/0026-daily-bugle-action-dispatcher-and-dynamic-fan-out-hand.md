# ADR-0026: 1960s Daily Bugle Action Dispatcher & Dynamic Fan-Out Hand Architecture

* **Status:** **Accepted**
* **Date:** 2026-08-30
* **Author:** @SteveRodrigue & Antigravity (Google DeepMind)
* **Deciders:** Steve Rodrigue, Antigravity Agent
* **Technical Areas:** UI Presentation Layer, Rules Engine Integration, Accessibility, Layout Systems

---

## Context & Problem Statement

As the complexity of player board states grew (allies, upgrades, supports, identity forms, and card events), two ergonomic challenges emerged:
1. **Player Cognitive Load & Legal Move Discovery:** Players needed an intuitive, centralized place to see all legal basic actions, abilities, and card plays for the active turn without clicking every card on the table, complete with automatic turn-ending verification.
2. **Hand Dock Card Overflow & Overlap:** Hand sizes vary dynamically (e.g. Iron Man 6–8 cards, bonus draws). Fixed flexbox gaps caused cards to overflow the hand dock or wrap into awkward rows. When cards zoomed or fanned, naive transitions caused sluggish layout reflows and z-index overlap clipping.

---

## Decision Drivers

* **Rules Reference v1.8 Legality Compliance:** Must evaluate valid targets (e.g. non-zero threat for thwarts, alive enemies for attacks, resource card constraints).
* **1960s Comic Pop-Art Theme:** All HUD components must feel like physical comic artifacts (e.g. 1960s Daily Bugle newspaper broadsheet with woodblock mastheads).
* **Zero Container Overflow:** Hand tray must dynamically scale to any hand size without scrollbars or visual cropping.
* **Instant Responsiveness:** Card layout adjustments must snap instantly (0ms) without slow accordion reflow lag.

---

## Considered Options

1. **Option 1: Basic Horizontal Scrollbar on Hand Tray & Simple Action List:**
   * *Cons:* Clunky UI, breaks immersion, requires horizontal scrolling.
2. **Option 2: Dynamic Fan-Out Stack with Responsive Negative Margin & 1960s Daily Bugle Broadsheet Action Dispatcher:**
   * *Pros:* 100% immersive 1960s theme, pure engine action discovery (`legal-actions-generator.ts`), zero overflow auto-tightening (`useHandFanLayout.ts`), and instant 0ms layout transitions.
   * *Selected.*

---

## Decision Outcome

1. **Daily Bugle Action Dispatcher (`DailyBugleActionNewspaper.tsx`):**
   * Built a pure engine action evaluator `legal-actions-generator.ts` that categorizes all available moves (Basic Attacks, Basic Thwarts, Card Plays, Upgrade/Support Abilities, and Form Changes).
   * Rendered as an authentic 1960s newspaper broadsheet with click-to-dispatch controls and a top-bar `📰 DAILY BUGLE [N]` badge.
   * Automatic confirmation dialog `EndTurnConfirmationModal.tsx` when no legal actions remain.
2. **Dynamic Fan-Out Hand (`PlayerHandTray.tsx` + `useHandFanLayout.ts`):**
   * Stacks cards with the leftmost card on top (`z-index: 30 - index`).
   * Uses `ResizeObserver` to compute exact negative margins so the hand never overflows the usable container width.
   * Hovered card pops to `z-index: 60` with upward float elevation (`-translate-y-12`) and 1.9× Comic Zoom.
   * Hardware-accelerated `transition-transform duration-150` eliminates sluggish accordion reflows.

---

## Consequences

* **Positive:**
  * Clean, immersive player experience with zero hand overflow.
  * Instant feedback on available moves and why actions are illegal.
  * Solid matte desaturation (zero transparency artifacts) for inactive and non-matching cards.
* **Negative:**
  * Requires maintaining pure evaluator rules synchronization in `legal-actions-generator.ts`.
