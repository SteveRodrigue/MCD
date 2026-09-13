# [ADR-0056] Unified Comic Pop-Art Modal & Dialog Design System

- **Status:** Accepted
- **Date:** 2026-09-13
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement
Over time, modals, decision prompts, action pickers, and settings dialogs in *Marvel Champions Digital* (MCD) evolved with disparate visual treatments:
1. Some prompts used hyper-saturated solid yellow containers (`DecisionPromptModal`).
2. Action modals mixed newsprint serif styling with comic styling (`IdentityActionModal` vs. `AllyActionModal` / `TableauActionModal`).
3. Utility dialogs (`OptionsMenu`, `ReportProblemModal`, card inspection) defaulted to modern, bland white box web forms.
4. Special prompts (`WakandaForeverModal`) defaulted to dark slate mode.
5. In-universe newspapers (`DailyBugleActionNewspaper`, `EndTurnConfirmationModal`) featured a distinct 1960s newsprint broadsheet aesthetic.

This visual fragmentation compromised interface immersion and visual hierarchy. We need a coherent design system that unifies all gameplay, action, and utility dialogs under MCD's 1960s Comic Pop-Art visual identity (ADR-0004), while preserving the in-universe vintage newsprint style of *The Daily Bugle*.

---

## Decision Drivers
- **Aesthetic Coherence & Immersion:** Every in-game dialog should feel like an authentic, tangible element of a 1960s comic book.
- **Strict Visual Hierarchy (3-Tier Design System):** Clear distinction between gameplay prompts, in-universe newsprint publications, and bullpen utility worksheets.
- **Preservation of The Daily Bugle:** Keep the retro tabloid newspaper aesthetic completely intact for round recaps and legal action broadsheets.
- **High Readability & Contrast:** Ensure all typography, action buttons, and resource badges maintain strong contrast and accessibility.
- **DRY & Maintainable UI Architecture:** Establish standardized container and header patterns rather than ad-hoc inline styles.

---

## Considered Options
1. **Option 1: Complete Monolithic Uniformity:** Force all modals (including *The Daily Bugle* and *OptionsMenu*) into an identical yellow/black pop-art container.
2. **Option 2: 3-Tier Categorized Design System (Chosen):**
   - **Tier 1 (Comic Pop-Art Gameplay Prompts):** `bg-comic-paper` base with halftone dots, thick 4px black borders, action-coded pop-art header banners (Red for Attack, Blue for Thwart, Yellow for Play/Resource/Choice, Green for Defense), and comic push buttons.
   - **Tier 2 (In-Universe Broadsheet Press):** *The Daily Bugle* and *EndTurnConfirmationModal* remain dedicated 1960s newsprint broadsheets (`font-serif`, woodblock mastheads, newsprint paper background).
   - **Tier 3 (Comic Bullpen Utility Worksheets):** Utility dialogs (*OptionsMenu*, *ReportProblemModal*, inspector modals) use `bg-comic-paper` base with dark navy/red bullpen headers and framed comic card sections instead of sterile white boxes.
3. **Option 3: Modern Dark/Light Web Theme:** Adopt neutral slate dark/light theme standard modal components.

---

## Decision Outcome

**Chosen Option:** **Option 2: 3-Tier Categorized Design System**

### Rationale ("The Why")
Option 2 delivers visual cohesion across all player interactions while respecting context:
- Gameplay prompts feel dynamic and punchy, matching the game table.
- *The Daily Bugle* retains its distinctive in-universe narrative flavor without interference.
- Utility screens (options, error reporting) feel like creative bullpen production sheets rather than disconnected SaaS forms.

---

## Evaluation of Options

### Option 1: Complete Monolithic Uniformity
- **Pros:** Maximum structural homogeneity.
- **Cons:** Destroys the unique charm of *The Daily Bugle* broadsheet and makes simple settings menus overly noisy.

### Option 2: 3-Tier Categorized Design System (Chosen)
- **Pros:**
  - Standardizes all gameplay prompts (`DecisionPromptModal`, `CardPaymentModal`, `IdentityActionModal`, `AllyActionModal`, `TableauActionModal`, `WakandaForeverModal`) onto consistent paper canvas, halftone overlays, and action-coded banners.
  - Fixes the bland white utility dialogs into thematic comic bullpen sheets.
  - Completely protects *The Daily Bugle* retro newsprint experience.
- **Cons:** Requires updating several modal components to align classes and structure.

### Option 3: Modern Dark/Light Web Theme
- **Pros:** Standard web design pattern.
- **Cons:** Directly violates ADR-0004 (1960s Comic Pop-Art art direction) and breaks immersion.

---

## Consequences

### Positive Consequences
- Immediate visual polish and consistent user experience across every modal and prompt in the game.
- Clear color semantics: Red for attacks/errors, Blue for thwarts/settings, Yellow for decisions/payments/actions, Green for recovery/defense, Purple for hero-special sequences.
- Reusable UI styling patterns that simplify the creation of future game prompts.

### Negative Consequences / Risks & Mitigations
- *Risk:* Visual noise if halftone dot textures or drop shadows are too heavy.
- *Mitigation:* Keep halftone overlays subtle (`opacity-10`), use crisp `bg-comic-paper` backgrounds with dark text (`text-slate-950` / `text-comic-black`), and maintain standard font hierarchy.
