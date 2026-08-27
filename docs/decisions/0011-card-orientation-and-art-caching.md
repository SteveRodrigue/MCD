# ADR-0011: Card Orientation Metadata & Cache-First Art Resolution Architecture

* **Status:** Accepted
* **Date:** 2026-08-27
* **Deciders:** Core Architecture Team
* **Consulted:** Rules Reference v1.8 (Cards, Schemes, and Exhaustion p. 13-14, 22-23), MarvelCDB API
* **Informed:** MCD Frontend & Engine Developers

---

## Context and Problem Statement

In *Marvel Champions: The Card Game*, cards are printed in two distinct physical orientations:
1. **Portrait ($2.5 \times 3.5$ aspect ratio):** Heroes, Alter-Egos, Villains, Allies, Events, Supports, Upgrades, Minions, Attachments, Treacheries, Environments, Obligations.
2. **Landscape ($3.5 \times 2.5$ aspect ratio):** Main Schemes, Side Schemes, and Player Side Schemes.

Without explicit orientation metadata and responsive sizing in the UI layer:
* Scheme cards rendered in standard portrait slots get horizontally squeezed, distorted, or letterboxed.
* Rotations for exhaustion or form flipping become ambiguous.

Additionally, card art assets fetched from remote CDNs (MarvelCDB) must not introduce runtime latency, network overhead, or fail when offline.

---

## Decision Drivers

* **Visual Fidelity (ADR-0004):** Accurate rendering matching the physical tabletop game with 60s Comic Pop-Art styling.
* **Offline-First & Zero Latency:** Card images must be cached persistently in client storage (CacheStorage / IndexedDB) with an optional local asset cache (`cache/cards/`).
* **Multi-Sided Support:** Clean resolution of distinct sides (Hero side A `01001a` vs Alter-Ego side B `01001b`, Scheme 1A `01097a` vs Scheme 1B `01097b`).
* **Extensible Override:** Allow individual cards in future expansions to override orientation via supplemental card enrichment.

---

## Decision Outcome

**Chosen Design:**

### 1. Card Orientation Hierarchy & Normalization
* **Model Fields on `NormalizedCard`:**
  * `isLandscape: boolean`
  * `orientation: 'portrait' | 'landscape'`
* **Resolution Algorithm:**
  1. Check if `card.enrichment?.isLandscape` is explicitly defined (highest priority override).
  2. Otherwise, return `true` if `type_code` is `main_scheme`, `side_scheme`, or `player_side_scheme`.
  3. Otherwise, default to `false` (Portrait).

### 2. Responsive UI Sizing ([`CardView.tsx`](../../src/ui/components/cards/CardView.tsx))
* **Portrait Dimensions:** $28 \times 40$ (sm), $44 \times 64$ (md), $56 \times 80$ (lg), $72 \times 410$ (xl).
* **Landscape Dimensions:** $40 \times 28$ (sm), $64 \times 44$ (md), $80 \times 56$ (lg), $410 \times 72$ (xl).
* **Exhaustion Invariant:** Exhausted cards rotate $90^\circ$ clockwise regardless of base orientation.

### 3. Cache-First Card Art Service ([`card-cache-service.ts`](../../src/ui/services/card-cache-service.ts))
* **Strategy:**
  1. In-memory `Map` Object URL cache.
  2. Browser `CacheStorage` (`mcd-card-art-v1`).
  3. Remote fetch from MarvelCDB CDN (`https://marvelcdb.com/bundles/cards/${code}.png`).
  4. Graceful fallback to 60s Comic Pop-Art vector card if offline or image unavailable.
* **Local CLI Script:** `npm run cache:cards` (`scripts/cache-card-images.ts`) to pre-download all card images locally into `cache/cards/` (ignored in `.gitignore`).

---

## Consequences & Tradeoffs

### Positive:
* **Tabletop Accuracy:** Main Schemes and Side Schemes automatically render in wide landscape mode.
* **Instant Rendering:** Cached card images load with 0ms network latency.
* **Safe Overrides:** Future expansion cards with unique aspect ratios can override orientation without changing the core loader.

### Negative / Tradeoffs:
* Requires handling differing flex/grid space for mixed portrait and landscape cards on the board layout.
