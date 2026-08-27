# [ADR-0004] Visual Art Direction: 60s Comic Pop-Art & Batman '66 Aesthetic

* **Status:** Accepted
* **Date:** 2026-08-26
* **Authors:** MCD Core Team
* **Deciders:** User & Antigravity

---

## Context and Problem Statement
Digital card games often default to generic high-end 3D physics engines (e.g. Hearthstone-style 3D wooden taverns or MTG Arena 3D battlefields). For *Marvel Champions Digital*, we want a distinct, fun, and thematic visual identity that celebrates Marvel's comic book heritage, drawing inspiration from **Silver Age Marvel comics and the 1960s Batman Pop-Art visual style**.

---

## Decision Drivers
1. **Thematic Immersion:** The interface should feel like playing inside an interactive, dynamic comic book page.
2. **2D Graphic Polish over 3D Complexity:** Prioritizing vibrant 2D graphic design, punchy onomatopoeia, and animated comic panels over heavy 3D mesh rendering.
3. **Performance & Lightweight Footprint:** 2D CSS/SVG/Canvas rendering runs at 60+ FPS on virtually any device without requiring dedicated GPUs.
4. **Speed of UI Iteration:** Fast styling and animation tuning of comic bubbles, typography, and card frames.

---

## Visual & Interaction Elements

### 1. Dynamic Onomatopoeia Popups
* Whenever an Attack, Thwart, Defense, or Villain Activation resolves, visual burst overlays appear:
  * **Attacks / Damage:** `POW!`, `BAM!`, `KAPOW!`, `SMASH!`, `WHAM!`
  * **Spider-Man Abilities:** `THWIP!`, `SPIDEY-SENSE!`
  * **Thwarts / Schemes:** `SCHEME!`, `FOILED!`, `THWART!`
  * **Tough Card Absorptions:** `CLANG!`, `BOING!`
* Starburst action-badge graphics with bold comic outlines and drop shadows.

### 2. Comic Panel Layout & Ben-Day Dots
* The game board is arranged as a sequence of **comic book panels** (e.g., Villain Panel at top, Threat/Scheme Panel, Hero Playmat Panel at bottom).
* Backgrounds feature stylized **Ben-Day dot / halftone patterns** and aged comic-paper textures.
* Cards and UI dialogs have thick black ink borders with bold, punchy drop shadows.

### 3. Typography & Dialogue Bubbles
* Expressive comic book display fonts (e.g., *Bangers*, *Komika*, *Action Man*).
* Status effects and hero/villain actions communicate through **speech and thought bubbles**.

---

## Technical Impact on Technology Stack

* **Reinforces TypeScript + React / CSS / Framer Motion / SVG:**
  * CSS transforms, SVG starburst shapes, and Framer Motion spring physics excel at pop-in/pop-out comic onomatopoeia bursts.
  * No requirement for complex 3D rigging, lighting, or mesh rendering.
  * Easy integration of custom SVG filters for halftone dot effects and screen-print color separation.

---

## Consequences

### Positive Consequences
* Highly memorable and charming retro-comic aesthetic.
* Development effort focuses on crisp 2D juice, fluid timing, and gameplay feel rather than 3D asset modeling.
* Extremely low system resource usage and instant load times.
