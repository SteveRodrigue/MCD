# Specification: Card Supplemental Editor & Live Reviewer GUI

- **Status:** 🟢 IMPLEMENTED / SPECIFIED
- **Related ADR:** [ADR-0045](../../decisions/0045-card-supplemental-editor-and-live-reviewer-gui.md)
- **Author:** MCD Core Team
- **Date:** 2026-09-05

---

## 1. Overview & Objectives

The **Card Supplemental Editor & Live Reviewer GUI** is an integrated developer tool that streamlines reviewing, verifying, and enriching card supplemental data (`src/data/supplemental/pack/*.json`) directly within the Marvel Champions Digital web application.

### Key Objectives
1. **Multi-Criteria Discovery:** Filter and search cards across all 170+ official Zzorba packs, encounter sets, hero identities, and aspect affinities.
2. **Dual-Inspector Reviewer:** Compare printed card art and text alongside raw upstream attributes and declarative supplemental rules in real time.
3. **Live Schema Validation:** Enforce strict adherence to `CardEnrichmentSchema` ([ADR-0043](../../decisions/0043-codebase-grounded-supplemental-schema-validation-and-live-vscode-integration.md)), reporting line-level errors for invalid effect primitives, parameters, or timings.
4. **Local REST Persistence:** Save modifications directly to disk via Vite dev middleware, updating pack JSON files and stamping audit records automatically.
5. **In-Game Tabletop Inspection:** Right-click any card on the tabletop during gameplay to jump directly to its supplemental definition in a new tab.
6. **Live Reloading:** Hot-reload card rules in the application upon saving.

---

## 2. Architecture & Data Flow

```mermaid
graph TD
    subgraph Browser Client
        Game["Tabletop Game View<br/>(Hero/Villain/Hand/Schemes)"]
        ContextMenu["Right-Click Context Menu<br/>'Open in Supplemental Editor'"]
        Editor["Supplemental Reviewer & Editor<br/>(/editor?code=01001)"]
        ZodValidator["Live Client Zod Validator<br/>(CardEnrichmentSchema)"]
    end

    subgraph Vite Dev Server
        ViteMiddleware["cardSupplementalEditorPlugin<br/>(/api/supplemental/*)"]
        AuditAutoStamper["Audit Trail Stamper<br/>(updatedAt, reviewedBy)"]
        FS["Node.js FileSystem<br/>(src/data/supplemental/pack/*.json)"]
        HMR["Vite HMR Module Reloader"]
    end

    Game -->|Right-Click Card| ContextMenu
    ContextMenu -->|window.open('/editor?code=...')| Editor
    Editor -->|Live Schema Diagnostics| ZodValidator
    Editor -->|GET /api/supplemental/packs| ViteMiddleware
    Editor -->|GET /api/supplemental/card/:code| ViteMiddleware
    Editor -->|POST /api/supplemental/card/:code| ViteMiddleware
    ViteMiddleware -->|Validate Zod Payload| AuditAutoStamper
    AuditAutoStamper -->|Write Formatted JSON| FS
    FS -->|File Change Detected| HMR
    HMR -->|Hot-Reload Modules| Game
```

---

## 3. Local Vite REST API Middleware Specification

The API is served directly by the local Vite development server via a custom plugin (`cardSupplementalEditorPlugin` in `vite.config.ts`), active only during development.

### 3.1. `GET /api/supplemental/packs`
Returns catalog categorization metadata for populating multi-select filter menus:
```json
{
  "packs": [
    { "code": "core", "name": "Core Set", "pack_type_code": "core", "size": 355 },
    { "code": "cap", "name": "Captain America", "pack_type_code": "hero", "size": 56 }
  ],
  "sets": [
    { "code": "rhino", "name": "Rhino", "card_set_type_code": "villain" },
    { "code": "spider_man", "name": "Spider-Man", "card_set_type_code": "hero" },
    { "code": "bomb_scare", "name": "Bomb Scare", "card_set_type_code": "modular" }
  ],
  "factions": [
    { "code": "aggression", "name": "Aggression" },
    { "code": "justice", "name": "Justice" },
    { "code": "leadership", "name": "Leadership" },
    { "code": "protection", "name": "Protection" },
    { "code": "basic", "name": "Basic" },
    { "code": "encounter", "name": "Encounter" },
    { "code": "hero", "name": "Hero" }
  ]
}
```

### 3.2. `GET /api/supplemental/cards?pack=:pack&set=:set&faction=:faction&search=:query`
Returns filtered cards across the catalog with enrichment status flags:
```json
{
  "total": 101,
  "cards": [
    {
      "code": "01001a",
      "name": "Spider-Man",
      "packCode": "core",
      "setCode": "spider_man",
      "factionCode": "hero",
      "typeCode": "hero",
      "hasSupplemental": true,
      "isValid": true,
      "confidence": 100
    }
  ]
}
```

### 3.3. `GET /api/supplemental/card/:code`
Fetches the complete card definition, including raw upstream data and supplemental definition:
```json
{
  "code": "01001a",
  "packCode": "core",
  "upstream": {
    "code": "01001a",
    "name": "Spider-Man",
    "text": "<b>Interrupt</b>: When the villain initiates an attack...",
    "traits": "Avenger.",
    "type_code": "hero"
  },
  "supplemental": {
    "abilities": [ ... ],
    "audit": {
      "reviewedBy": "antigravity",
      "confidence": 100,
      "updatedAt": "2026-09-01T15:00:00Z"
    }
  },
  "validation": {
    "valid": true,
    "errors": []
  }
}
```

### 3.4. `POST /api/supplemental/card/:code`
Validates and persists changes to the card's supplemental definition:
- **Request Body:**
  ```json
  {
    "packCode": "core",
    "supplemental": {
      "abilities": [ ... ],
      "audit": {
        "reviewedBy": "developer_name",
        "confidence": 100,
        "rulesVersion": "1.8"
      }
    }
  }
  ```
- **Server Behavior:**
  1. Validates payload using `CardEnrichmentSchema.safeParse(supplemental)`. Returns HTTP 400 with structured Zod errors if invalid.
  2. Resolves target pack file: `src/data/supplemental/pack/${packCode}.json`.
  3. Reads existing pack JSON, merges/updates `cards[code]`, stamps `audit.updatedAt` with the current ISO timestamp (`YYYY-MM-DDTHH:MM:SSZ`), preserves existing fields, and formats JSON with 2-space indentation.
  4. Writes atomically to disk.
  5. Returns HTTP 200: `{ "success": true, "code": "01001a", "updatedAt": "..." }`.

---

## 4. User Interface & Layout Specifications

The Supplemental Editor UI adheres strictly to the **1960s Comic Pop-Art Theme** ([ADR-0004](../../decisions/0004-visual-art-direction-comic-pop-art.md)):
- Bold heavy black comic borders (`border-3 border-black shadow-comic-pop`).
- Dynamic Ben-Day halftone dot backgrounds.
- Bangers headings and high-contrast typography.
- Status badges: 🟢 Green (100% Verified), 🟡 Yellow (Partial / Draft), 🔴 Red (Schema Error / Missing).

### 4.1. Workspace Layout
The Editor is organized into a 3-column split view:

```
+-----------------------------------------------------------------------------------------------+
| TOP BAR: [MCD Card Supplemental Reviewer] | Filter Presets | [Save Card (Ctrl+S)] [Hot Reload]|
+------------------------------------+--------------------------+-------------------------------+
| LEFT: FILTER & CARD LIST           | CENTER: INSPECTOR        | RIGHT: SUPPLEMENTAL BUILDER   |
| - Pack: [Core Set          v]      | [CardView Visual Preview]| [Form View] | [Raw JSON View] |
| - Set:  [All Sets          v]      |                          |                               |
| - Faction: [All Factions   v]      | ------------------------ | Abilities Tree:               |
| - Search: [spider...       ]       | Printed Text:            | [+] Add Ability               |
| ---------------------------------- | "Interrupt: When..."     | ├─ Timing: [HERO_INTERRUPT v] |
| Cards (101):                       |                          | ├─ Trigger: [VILLAIN_INIT...] |
| > 01001a Spider-Man        [100%]  | Upstream Zzorba Meta:    | ├─ Cost: [Exhaust: Yes]       |
|   01001b Peter Parker      [100%]  | - Traits: Avenger        | └─ Steps (1):                 |
|   01002  Spider-Tracer     [100%]  | - Type: Hero             |    └─ Primitive: [DRAW_CARDS] |
|   01003  Web-Shooter       [100%]  | - Hand Size: 5           |       Params: { amount: 1 }   |
|   01004  Backflip          [100%]  | - HP: 10                 |                               |
|                                    |                          | Live Zod Diagnostics: (0 err) |
+------------------------------------+--------------------------+-------------------------------+
```

### 4.2. Dual-Mode Supplemental Builder (Form vs. Raw JSON)
1. **Form Builder Mode:**
   - Dropdown selectors for `timing` (`TimingTypeSchema`), `trigger` (`TriggerTypeSchema`), and `effect` primitives.
   - Dynamic parameter fields based on selected effect primitive (e.g. `amount`, `target`, `gate`, `duration`).
   - Audit trail metadata fields (`confidence`, `reviewedBy`, `originalText`, `reconstructedText`).
2. **Raw JSON Mode:**
   - Embedded interactive JSON editor with syntax highlighting and live error underlines.
   - Real-time Zod validation badges indicating exact JSONPath error locations.

---

## 5. In-Game Context Menu Integration

Every card rendered on the active game board wraps or attaches an `onContextMenu` handler:
1. **Trigger:** Right-clicking any `<CardView />` on the board (Player Hand, Tableau, Villain Zone, Main Scheme, Side Schemes, Attachment, Discard pile preview).
2. **Context Menu Options:**
   - 🔍 **"Open in Supplemental Editor"**
   - 📋 **"Copy Card Code"** (`01001a`)
   - ℹ️ **"Inspect Upstream Data"**
3. **Action:** Clicking "Open in Supplemental Editor" executes:
   ```ts
   window.open(`/editor?code=${card.code}`, '_blank');
   ```
4. **Game Continuity Invariant:** The current game state remains open in its original tab. Saving modified supplemental data in the new tab will trigger Vite HMR; users are notified that active games may reset or desynchronize.

---

## 6. Acceptance & Contract Criteria

1. **Catalog Completeness:** Filter controls can discover and list all cards across upstream `data/upstream/pack/*.json`.
2. **Dual-View Fidelity:** The center inspector accurately renders card artwork via `CardView` and displays raw upstream text matching the physical card.
3. **Live Zod Validation:** Attempting to save invalid effect primitives (e.g. `INVALID_PRIMITIVE`) or malformed parameters is blocked in the UI with red error markers.
4. **Atomic Disk Persistence:** Clicking "Save" updates the corresponding pack JSON file with clean 2-space indentation and auto-stamped audit metadata (`updatedAt`, `reviewedBy`).
5. **Right-Click Context Menu:** Right-clicking any card on the tabletop in an active game opens the editor in a new tab focused on that card.
