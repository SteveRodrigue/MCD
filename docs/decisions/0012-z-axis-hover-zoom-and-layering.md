# [ADR-0012] Z-Axis Unconstrained Elevation & Hover-Zoom Architecture

* **Status:** Accepted
* **Date:** 2026-08-27
* **Deciders:** Core Architecture Team
* **Consulted:** UX Guidelines, Golden Rule (Visual Fidelity & Comic Styling)
* **Informed:** MCD Frontend Developers

---

## Context and Problem Statement

When users hover over cards in the Player Hand tray to inspect card text and art, the card scales up ($1.9\times$) and elevates upwards. 

However, when the parent container has `overflow-x: auto` or `overflow: hidden`, CSS creates a clipping boundary and stacking context. When the transformed card visual boundary exceeds the parent box, the browser spawns unwanted horizontal and vertical scrollbars, and clips the top of the card.

---

## Decision Drivers

* **Zero Layout Shift / Disruption:** Card zooming must never trigger container scrollbars, shift neighboring elements, or alter the board geometry.
* **Tactile CCG Interaction:** Cards in hand should feel like they are lifted up towards the user along the 3D Z-axis.
* **Viewport Safety:** Scaled cards must float cleanly on top of all tabletop zones with unconstrained Z-index elevation (`z-50`).

---

## Decision Outcome

**Chosen Design: Unconstrained Z-Axis Elevation (Approach A)**

1. **Overflow Exemption for Interactive Docks:**
   * Interactive card docks (such as `PlayerHandTray`) must declare `overflow-visible` rather than `overflow-x: auto` / `overflow: hidden`.
   * Sufficient top padding and negative elevation headroom (`pt-8`, `-translate-y-12` to `-translate-y-16`) are provided so elevated cards clear the tray boundary.

2. **Strict Z-Index Hierarchy:**
   * Base Tabletop Layers: `z-0` to `z-10`
   * Bottom Hand Tray Base: `z-20`
   * Hovered / Elevated Card: `z-50` with high-contrast comic drop shadow (`shadow-2xl`).

---

## Consequences & Tradeoffs

### Positive:
* **No Scrollbars:** Zero unwanted scrollbars or clipped card headers on hover.
* **Smooth Tactile Feel:** Hovering a card smoothly projects it into the foreground over the board without layout shifts.
* **Zero Overhead:** Accomplished purely with standard CSS3 transforms and unconstrained stacking contexts without extra portal DOM nodes.

### Negative / Tradeoffs:
* On extremely small mobile viewports with large hands (>8 cards), cards must wrap or flex with minimal overlap rather than relying on native container scrollbars.
