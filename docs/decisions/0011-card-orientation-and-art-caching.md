# [ADR-0011] Card Orientation Metadata & Cache-First Art Resolution Architecture

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

### 3. Local-First Card Art Static Serving & Fallback Architecture
* **Strategy:**
  1. **Primary Local Static Endpoint (`/cards/:fileName`):** [`card-cache-service.ts`](../../src/ui/services/card-cache-service.ts) resolves local paths `/cards/${code}${side}.png` directly.
  2. **Vite Local Static Middleware & Production Bundler (`vite.config.ts`):**
     * **Dev Mode:** Intercepts `/cards/:fileName` requests and streams local card images directly from `cache/cards/` with immutable caching headers.
     * **Production Build:** Copies `cache/cards/` into `dist/cards/` for self-contained, 100% offline distribution.
  3. **Automatic CDN Fallback (`CardView.tsx`):** If a card image is not yet cached locally on disk (404), `CardView.tsx` catches `onError` on the `<img>` element and automatically falls back to remote MarvelCDB CDN (`https://marvelcdb.com/bundles/cards/${code}.png`).
  4. **Vector Art Fallback:** If both local and remote assets fail, the system renders a stylized 60s Comic Pop-Art vector card.
* **Local CLI Ingestion:** `npm run cache:cards` (`scripts/cache-card-images.ts`) fetches and caches card images locally into `cache/cards/`.

---

## Consequences & Tradeoffs

### Positive:
* **Tabletop Accuracy:** Main Schemes and Side Schemes automatically render in wide landscape mode.
* **True Local-First & 0ms Latency:** Card images load directly from local static storage without network delay.
* **Offline-Proof:** Opening images in new tabs or playing offline resolves entirely from local `/cards/` routes.
* **Resilient Graceful Fallback:** Missing local assets transparently fall back to the MarvelCDB CDN without breaking game UI.
* **Safe Overrides:** Future expansion cards with unique aspect ratios can override orientation without changing the core loader.

### Negative / Tradeoffs:
* Requires maintaining `cache/cards/` disk cache and copying static assets to `dist/cards/` during production builds.
