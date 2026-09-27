# [ADR-0071] Nested Allies and Two-Tier Player Tableau Architecture

- **Status:** Accepted
- **Date:** 2026-09-27
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity
- **Related Issues:** #156 ("We should improve the player tableau")

---

## Context and Problem Statement

Previously, `HeroZone.tsx` arranged the player's play area into 3 independent sibling blocks placed inside a loose `flex flex-wrap items-start gap-4` container:

1. `Identity Station` (Hero / Alter-Ego card, health bar, stat strip, action buttons)
2. `Allies Row` (Allies in play floating in a standalone box)
3. `Tableau` (Supports and Upgrades expanding into remaining space)

This created significant visual hierarchy and layout issues:

1. **Disjointed Character Hierarchy:** In Marvel Champions rules (RR v1.8 p. 11), a player's hero and allies comprise the "characters you control". Presenting allies in a floating standalone box detached from the Hero broke tabletop visual intuition.
2. **Unpredictable Horizontal Squishing & Wrapping:** In panoramic multi-hero stations (`w-[820px]` to `w-[880px]`) or solo tabletop viewports, as allies or tableau cards accumulated, the three boxes wrapped irregularly—either compressing the Tableau into an unusable vertical sliver or wrapping it under Allies while leaving large dead spaces adjacent to the Hero.

Issue #156 requested nesting Allies directly in the top row alongside the Hero Identity, with Upgrades and Supports occupying a dedicated second row that wraps naturally.

---

## Decision Drivers

- **Player Character Army Ergonomics:** Grouping Hero and Allies inside a unified roster reflects the "characters you control" identity.
- **Predictable Responsive Wrapping:** The top tier (Hero + Allies) remains stable and compact; the bottom tier (Tableau) spans the full station width and wraps cleanly across multiple lines as supports/upgrades accumulate.
- **Comic Pop-Art Consistency (ADR-0004, ADR-0056):** Retain bold 2px/3px comic borders, drop shadows (`shadow-comic-sm`), and clear header badges.
- **Preserve Combat & Attachment Interactions:** Staircase attachment fans, hover zoom, and ally Attack/Thwart action bars must remain fully functional.

---

## Architecture: Two-Tier Layout

```text
+----------------------------------------------------------------------------------------------------------+
|  MINIONS ENGAGED WITH HERO (Perimeter Threat Banner)                                                     |
+==========================================================================================================+
|  ROW 1: HERO & ALLIES ROSTER CONTAINER (data-testid="hero-allies-roster", bg-sky-50/80)                  |
|  +---------------------------+ | +---------------------------------------------------------------------+ |
|  | IDENTITY STATION          | | | NESTED ALLIES SECTION (data-testid="nested-allies-section")         | |
|  | [SPIDER-MAN (HERO)]       | | | Allies in Play (2 / 3)                                              | |
|  | HP: [========  ] 8/10     | | |  +-------------------+  +-------------------+     +------------------+ | |
|  | THW:1  ATK:2  DEF:3 HAND:5| | |  | [⚔️ 1]   [🛡️ 1]  |  |  | [⚔️ 2]   [🛡️ 2]  |  |  | (Empty Slot)  | | |
|  | +-----------------------+ | | |  | [THW 1 | ATK 1]   |  |  | [THW 2 | ATK 2]   |  |  |  [+] Ally     | | |
|  | |   CardView: Hero      | | | |  | +---------------+ |  |  | +---------------+ |  |  |  Limit: 3     | | |
|  | +-----------------------+ | | |  | |   BLACK CAT   | |  |  | |  SPIDER-WOMAN | |  |  +---------------+ | |
|  | [FLIP]  [ATK 2]  [THW 1]  | | |  +-------------------+  +--------------------+ |  |                 | |
|  +---------------------------+ | +---------------------------------------------------------------------+ |
+==========================================================================================================+
|  ROW 2: TABLEAU: UPGRADES & SUPPORTS (data-testid="tableau-section", bg-slate-50, w-full)                |
|  +----------------------------------------------------------------------------------------------------+  |
|  |  ⚡ TABLEAU: UPGRADES & SUPPORTS (Total: 4)                                                       |  |
|  |  +--------------+  +--------------+  +--------------+  +--------------+                            |  |
|  |  | CardView     |  | CardView     |  | CardView     |  | CardView     |                            |  |
|  |  | Web-Shooter  |  | Avengers     |  | Helicarrier  |  | Armored Vest |   (Wraps across multiple   |  |
|  |  | (3 counters) |  | Mansion      |  | (Discount)   |  | (+1 DEF)     |    lines when >5 cards)    |  |
|  |  | [⚡ USE]     |  | [⚡ USE]     |  | [⚡ USE]     |  | (Constant)   |                          |  |
|  |  +--------------+  +--------------+  +--------------+  +--------------+                            |  |
|  +----------------------------------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------------------------+
```

---

## Decision Outcome

**Chosen Solution:**

1. **Row 1 (`hero-allies-roster`):**
   - Encases `identity-station` (`w-full md:w-[220px] shrink-0`) and `nested-allies-section` (`flex-1 min-w-0`) within a shared comic panel container with a subtle vertical divider on medium+ screens.
   - When 0 allies are in play, an informative dashed comic placeholder indicates the player's active ally limit.
2. **Row 2 (`tableau-section`):**
   - Spans the full width (`w-full`) of the hero station.
   - Hosts all tableau cards with `flex-wrap gap-3`, cleanly wrapping lines when many upgrades and supports are in play.

---

## Consequences

- **Positive:** Closes Issue #156 with an intuitive, unified character army layout.
- **Positive:** Zero horizontal squishing across wide screens and multi-hero panoramic stations.
- **Positive:** Tested and verified with 7 targeted automated tests in `tests/ui/hero-zone-tableau-layout.test.tsx`.
