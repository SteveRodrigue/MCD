# Changelog

All notable changes to **Marvel Champions Digital (MCD)** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

- **Feature & UI: THW / SCH Stat Grounding & ADR-0012 Z-Axis Hover Zoom Elevation (`DualCardInspector.tsx`, `VillainZone.tsx`, `HeroZone.tsx`, `tests/ui/thw-sch-and-zoom-elevation.test.ts`):**
  - **THW / SCH Dynamic Stat Display:** Replaced static `"Thwart"` row in `DualCardInspector.tsx` with dynamic `"THW / SCH"`. For Villains and Minions (`upstream.scheme !== undefined`), displays `${upstream.scheme} (SCH)`; for Heroes and Allies (`upstream.thwart !== undefined`), displays `${upstream.thwart} (THW)`; otherwise displays `'—'`.
  - **ADR-0012 Unconstrained Z-Axis Elevation:** Fixed the preview `<CardView />` wrapper in `DualCardInspector.tsx` by replacing `overflow-hidden` with `overflow-visible relative z-30 hover:z-50`, ensuring the interactive card preview zooms cleanly above all adjacent UI containers without clipping.
  - **Tabletop Stat Visibility:** Added compact SCH & ATK stat badges in `VillainZone.tsx` and engaged minion chips in `HeroZone.tsx` so Scheme and Attack values are immediately visible during gameplay.
  - **Automated Contract Tests:** Added `tests/ui/thw-sch-and-zoom-elevation.test.ts` (6 tests) verifying stat formatting across card types and validating ADR-0012 unconstrained Z-axis elevation CSS invariants.

- **Feature & Tooling: Vanilla Card Support (`noSupplementalNeeded`) & Ability Guardrails (`AbilityFormBuilder.tsx`, `CardGalleryList.tsx`, `CardFilterToolbar.tsx`, `DualCardInspector.tsx`, `api-middleware.ts`, `tests/ui/vanilla-card-editor.test.ts`):**
  - **Form Builder Vanilla Guardrail:** Added a prominent `🛡️ No Supplemental Rules Needed (Vanilla Card)` checkbox in `AbilityFormBuilder.tsx`. When checked, locks ability creation, disables the `+ Add Ability` button, prompts before clearing existing abilities, and displays an informative banner indicating that vanilla cards cannot have abilities.
  - **Visual Status Badges:** Displayed a distinct `🛡️ Vanilla` badge in `CardGalleryList.tsx` and the `DualCardInspector.tsx` card header strip when a card has `noSupplementalNeeded: true` (e.g. Rhino I `01094`).
  - **Visual Review Banner:** In `DualCardInspector.tsx`, replaced empty abilities placeholder with an explicit `Vanilla Card: No supplemental rules needed (no printed abilities)` notification.
  - **Catalog Filtering:** Added `🛡️ Vanilla (No Supplemental Needed)` status filter option to `CardFilterToolbar.tsx` and implemented `status === 'vanilla_supplemental'` filtering in `CardSupplementalService.getCards()`.
  - **Automated Contract Tests:** Added `tests/ui/vanilla-card-editor.test.ts` (6 tests) validating `CardSummary.noSupplementalNeeded` detection on Rhino I (`01094`), exclusion of abilities-bearing cards (`01001a`, `01095`), status filtering, and state transitions.

- **Feature & Tooling: 1:1 Engine Effect Parameter Registry & Dynamic Step Form Builder (`src/ui/components/editor/effect-parameter-registry.ts`, `AbilityFormBuilder.tsx`, `tests/ui/effect-parameter-registry.test.ts`):**
  - **Comprehensive Parameter Descriptor Registry:** Authored `EFFECT_PARAMETER_REGISTRY` covering 100% of all 104 effect primitives in `EffectTypeSchema`, eliminating ad-hoc form fields and guaranteeing exact 1:1 parity between Editor UI and headless rules engine parameter signatures.
  - **Engine-Grounded Parameter Bindings:** Registered first-class typed inputs for parameter keys including `count` (fixing card `01001a` DRAW_CARDS parameter editing), `lookCount`, `takeCount`, `max`, `overkill`, `aerialAllSchemes`, `status`, `resource`, `stat`, `trait`, and `counterType`.
  - **Dynamic Step Parameter Form:** Replaced rigid `amount`/`target` inputs in `AbilityFormBuilder.tsx` with dynamic field rendering driven by `getEffectDescriptor(step.effect)`, rendering checkboxes for booleans, dropdowns for enums, number inputs with validation for numbers, and text fields for identifiers.
  - **Automated Parameter Grounding & Contract Tests:** Added `tests/ui/effect-parameter-registry.test.ts` (8 contract tests) verifying complete `EffectTypeSchema` registry coverage, exact parameter definitions for core game mechanics, and helper fallback behaviors.
  - **Tracked Architectural Refactor Issues:** Opened GitHub issues [#64](https://github.com/SteveRodrigue/MCD/issues/64) (Retaliate keyword stacking), [#65](https://github.com/SteveRodrigue/MCD/issues/65) (Unify EXHAUST/READY primitives), [#66](https://github.com/SteveRodrigue/MCD/issues/66) (Unify DISCARD primitives with filters/untilCondition), [#67](https://github.com/SteveRodrigue/MCD/issues/67) (Eliminate card-specific carolBonus), and [#68](https://github.com/SteveRodrigue/MCD/issues/68) (Streamline TargetSelector taxonomy).

- **Feature & UI: In-Game Tabletop Card Context Menu ([#62](https://github.com/SteveRodrigue/MCD/issues/62), [ADR-0045](docs/decisions/0045-card-supplemental-editor-and-live-reviewer-gui.md), `src/ui/components/cards/CardContextMenu.tsx`, `CardView.tsx`, `tests/ui/card-context-menu.test.ts`):**
  - **Tabletop Right-Click Integration:** Attached custom `onContextMenu` handler to all in-game `<CardView />` instances on the tabletop (Player Hand, Tableau, Villain Zone, Main Scheme, Side Schemes, Attachments).
  - **Open in Supplemental Editor:** Added action launching `/editor?code=<cardCode>` in a new browser tab/window without losing or disrupting active game state.
  - **Developer Ergonomics Helpers:** Added **Copy Card Code** (writes code to clipboard with visual confirmation) and **Inspect Card State** (modal popup showing live card object JSON).
  - **Responsive Boundary Clamping:** Implemented viewport boundary detection and coordinate clamping to prevent the pop-art context menu from clipping off-screen.
  - **Automated Contract Tests:** Added `tests/ui/card-context-menu.test.ts` (3 tests) validating editor deep-link URL creation, clipboard copy execution, and coordinate clamping logic.

- **Feature & Tooling: Declarative Ability Builder & Live Schema Diagnostics ([#63](https://github.com/SteveRodrigue/MCD/issues/63), [ADR-0045](docs/decisions/0045-card-supplemental-editor-and-live-reviewer-gui.md), `src/ui/components/editor/AbilityFormBuilder.tsx`, `RawJsonEditor.tsx`, `DualCardInspector.tsx`, `SupplementalEditorScreen.tsx`):**
  - **Interactive Visual Form Builder:** Created `AbilityFormBuilder.tsx` supporting form-driven editing of card comments, board limits, confidence sliders, attribution, ability identifiers, timing windows (`TimingTypeSchema`), event triggers (`TriggerTypeSchema`), costs (exhaust, self-damage), and sequential resolution steps with codebase-grounded effect primitives (`EffectTypeSchema`), targets, gates, and amounts.
  - **Dual-Mode Editing & Formatting:** Implemented `RawJsonEditor.tsx` with monospace syntax editing and 1-click JSON formatting.
  - **Real-Time Zod Diagnostics:** Integrated live `CardEnrichmentSchema.safeParse` validation running on every edit, with error list badges and save-action gating.
  - **Atomic Save & Hot-Reload Contract:** Connected "Save Card" button and `Ctrl+S` hotkey to `saveCardSupplemental`, persisting changes to pack JSON files with auto-stamped audit metadata and session reload notification toasts.

- **Feature & UI: Card Supplemental Editor & Reviewer Workspace ([#61](https://github.com/SteveRodrigue/MCD/issues/61), [ADR-0045](docs/decisions/0045-card-supplemental-editor-and-live-reviewer-gui.md), `src/ui/components/editor/`, `src/ui/services/supplemental-editor-service.ts`, `src/ui/App.tsx`, `src/ui/components/board/OptionsMenu.tsx`):**
  - **Full-Screen Reviewer Workspace:** Created `SupplementalEditorScreen.tsx` mounted at `/editor` (and via deep link `?code=01001a`) featuring comic pop-art styling, Ben-Day halftone backgrounds, and responsive split-pane navigation.
  - **Multi-Criteria Filtering Toolbar:** Implemented `CardFilterToolbar.tsx` with dynamic dropdowns for Zzorba packs, encounter sets, hero identities, aspect/affinity factions, supplemental status (defined, missing, valid, invalid), and live search.
  - **Card Gallery List & Status Badges:** Implemented `CardGalleryList.tsx` displaying card code, name, and visual status badges (🟢 100% Verified, 🟡 Partial/Draft, 🔴 Schema Error, ⚪ Missing).
  - **Dual-View Inspector:** Implemented `DualCardInspector.tsx` rendering on-the-fly normalized card artwork via `<CardView />`, formatted printed text via `<FormattedCardText />`, raw upstream properties grid, declarative abilities tree, audit metadata, and raw JSON copy inspector.
  - **In-Game Options Integration:** Added direct "Open Supplemental Editor" launcher button inside `OptionsMenu.tsx`.
  - **Vite Configuration Fixes:** Corrected misplaced ES imports in `vite.config.ts` and addressed ESLint empty catch block warnings in card cache middleware.

- **Feature & Tooling: Local Vite Dev Server REST Middleware for Card Supplemental Data ([#60](https://github.com/SteveRodrigue/MCD/issues/60), [ADR-0045](docs/decisions/0045-card-supplemental-editor-and-live-reviewer-gui.md), `src/tools/editor/api-middleware.ts`, `vite.config.ts`, `tests/tools/supplemental-editor-api.test.ts`):**
  - **Local-First Dev REST Middleware:** Implemented `cardSupplementalEditorPlugin` and `CardSupplementalService` in `src/tools/editor/api-middleware.ts` mounted under `/api/supplemental/*` in Vite dev server.
  - **Catalog Discovery Endpoints:** Added `GET /api/supplemental/packs` (aggregating upstream packs, encounter sets, hero sets, and aspect factions) and `GET /api/supplemental/cards` (supporting multi-criteria filtering by pack, set, hero, faction, status, and search query).
  - **Card Inspector & Safe Persistence:** Added `GET /api/supplemental/card/:code` (merging upstream card metadata and supplemental rules) and `POST /api/supplemental/card/:code` (validating payloads against `CardEnrichmentSchema`, auto-stamping ISO `updatedAt` / `reviewedAt` timestamps and attribution, and atomically updating `src/data/supplemental/pack/<pack>.json`).
  - **Automated Contract Tests:** Added `tests/tools/supplemental-editor-api.test.ts` (14 tests) validating discovery, filtering, validation error rejection, and atomic file persistence.

- **Feature & Engine: SUFFERED_DAMAGE Formula for Variable Damage Scaling ([#5](https://github.com/SteveRodrigue/MCD/issues/5), RR v1.8 p. 11, 31, `effects/index.ts`, `schema.ts`, `schema.json`, `suffered-damage-formula.test.ts`):**
  - **Dynamic Sustained Health Delta:** Evaluated `SUFFERED_DAMAGE` formula dynamically at effect resolution time as `Math.max(0, getEffectiveMaxHealth(player, state) - player.health)` with zero card-specific hardcoding or reliance on physical tabletop damage counters.
  - **Declarative Optional Ceiling Parameter:** Removed hardcoded `15` fallback from the engine, establishing `step.params?.max` as a fully declarative, reusable optional ceiling parameter that clamps damage when defined (`Math.min(step.params.max, damageSustained)`) and allows uncapped scaling when omitted.
  - **Supplemental Schema Alignment:** Formalized `AmountFormulaSchema = z.enum(['SUFFERED_DAMAGE', 'HERO_ATK'])` and regenerated `src/data/supplemental/schema.json`.
  - **Dedicated Contract Test Suite:** Created `tests/engine/suffered-damage-formula.test.ts` (7 tests) verifying dynamic sustained damage calculation, optional max ceiling capping, uncapped scaling, 0 damage at full health, minion target routing, and hero-form action legality gating.

- **Feature & Architecture: Canonical English Ingestion, Display-Only Translation Overlay & Supplemental Schema Extension (`src/data/importer/card-loader.ts`, `src/engine/models/card.ts`, `src/engine/models/abilities.ts`, `src/data/supplemental/schema.ts`, `schema.json`, `CardView.tsx`, `tests/engine/i18n-normalization.test.ts`):**
  - **3-Tier Ingestion Architecture:** Enforced that card normalization runs strictly against Canonical English Zzorba data (`data/upstream/pack/*.json`) at application boot, while translations (`data/upstream/translations/{lang}/`) serve as a display overlay for UI components (`name`, `subname`, `text`, `flavor`, `printedTraits`). Guarantees 100% immunity to rules engine breakage across non-English locales (e.g. French).
  - **Supplemental Schema Extension:** Added `keywords?: (Keyword | string)[]`, `traits?: string[]`, `restrictedSlots?: number`, and `additionalBoostCards?: number` to `CardEnrichment` and `schema.json`, ensuring full declarative override capability.
  - **Loader Priority & Keyword Resolution:** Updated `card-loader.ts` to respect supplemental overrides over deduced text properties, added parameterized `Retaliate X` numeric extraction, and implemented `applyTranslationOverlay` and `CardCatalog.applyTranslations`.
  - **Localized Card Presentation:** Added `printedTraits` to `NormalizedCard` and updated `<CardView />` to render localized trait text (e.g. *"Vengeur. Génie."*) on the card face.
  - **Contract Test Suite:** Created `tests/engine/i18n-normalization.test.ts` verifying French translation overlays, trait preservation, Black Cat consequential damage, and Retaliate value extraction.

- **Fix & Architecture: Eliminate Illegal `card.text` References per ADR-0019 ([#49](https://github.com/SteveRodrigue/MCD/issues/49), [ADR-0019](docs/decisions/0019-strict-metadata-driven-rules-execution-and-zero-raw-text-parsing.md)):**
  - **Zero Raw-Text Rules Execution Invariant:** Removed all `card.text` inspection, regex parsing, and substring matching across `legality-checker.ts`, `combat-pipeline.ts`, `villain-phase.ts`, `game-setup.ts`, `effects/index.ts`, `action-dispatcher.ts`, `stat-calculator.ts`, `starter-decks.ts`, `CardPaymentModal.tsx`, `attack-target-utils.ts`, and `HeroZone.tsx`.
  - **Standardized Keyword Helpers (`keyword-helpers.ts`):** Implemented `hasKeyword(cardOrInstance, keyword)` and `getKeywordValue(cardOrInstance, keyword)` supporting case-insensitive and parameterized keywords (e.g. `Retaliate 1`, `Incite 2`, `Restricted`) with zero text parsing.
  - **Declarative Resource Ability & Timing Resolution:** Replaced string matching (`"hero resource:"`, `"alter-ego resource:"`) with structured ability timing evaluation (`isResourceAbility`, `isAbilityPlayableInForm`).
  - **Card Importer Invariant (`card-loader.ts`):** Confined all upstream raw text parsing to import-time data normalization (`parseKeywords`, `restrictedSlots`, `additionalBoostCards`), ensuring runtime engine pipelines execute 100% against structured card models.
  - **Contract Test Suite:** Created `tests/engine/zero-card-text-parsing.test.ts` verifying all game mechanics (Guard, Patrol, Crisis, Restricted, Resource generation, and Starter Decks) operate correctly with empty `card.text`.

- **Fix & Tooling: Automated Git Hooks, Line Ending Normalization & CI Formatting ([#57](https://github.com/SteveRodrigue/MCD/issues/57), `.gitattributes`, `.prettierrc.json`, `.githooks/`, `package.json`, `docs/installation_guide.md`):**
  - **Git Pre-Commit & Pre-Push Hooks:** Configured native cross-platform Git hooks in `.githooks/` activated via `package.json` `"prepare": "git config core.hooksPath .githooks"`. `pre-commit` runs `format:check`, `lint`, and `typecheck`, and `pre-push` runs `npm test` to prevent broken or unformatted code from reaching remote branches.
  - **Cross-Platform Line Ending Normalization:** Added `.gitattributes` to enforce `* text=auto eol=lf` across all text files and configured `.prettierrc.json` with `"endOfLine": "auto"` to eliminate false-positive formatting warnings across Windows, macOS, and Linux.
  - **Full Codebase Formatting:** Executed `npm run format` across all files to ensure 100% Prettier compliance on CI.
  - **Deterministic Lifecycle Test Fix:** Fixed intermittent flakiness in `tests/engine/lifecycle-triggers.test.ts` by supplying `shuffleFn: (arr) => arr` to prevent randomly drawn player obligations from triggering interactive decision prompts during automated villain phase tests.
  - **Documentation & Setup:** Updated `docs/installation_guide.md` with Git hook instructions, explicit `gh.exe` references, and instant terminal PATH reload commands.
  - **Agent Command Execution Policy:** Added strict invariant in `AGENTS.md` and `.agents/rules/command-execution.md` prohibiting redundant `powershell -Command` wrappers, enforcing native direct command execution across all agents.

- **Feature & Architecture: Read-Through On-Demand MarvelCDB Card Art Caching ([ADR-0011](docs/decisions/0011-card-orientation-and-art-caching.md), `vite.config.ts`, `card-cache-service.ts`, `card-cache-service.test.ts`, `card-cache-middleware.test.ts`):**
  - **Dynamic 3-Step Lifecycle:** Implemented automated Check Cache $\rightarrow$ Download & Cache $\rightarrow$ Display from Cache architecture. Missing images are downloaded from MarvelCDB on-demand at runtime and stored directly into both server disk cache (`cache/cards/`) and browser `CacheStorage` (`mcd-card-art-v1`).
  - **Zero Bundled Official Assets Guarantee:** Reaffirmed architectural invariant that official FFG card images will never be packaged or committed with the repository. All images are retrieved on-demand from MarvelCDB or via optional batch pre-caching.
  - **Concurrent Request Deduplication:** Added in-flight request coalescing across both the Vite server middleware and `card-cache-service.ts` to prevent redundant network calls when multiple identical cards render concurrently.
  - **Path Traversal Protection:** Enforced strict filename regex validation (`^[a-zA-Z0-9_-]+\.png$`) on the local card asset endpoint to guard against malicious path traversal.
  - **Automated Contract Tests:** Authored 14 acceptance and contract tests across `tests/ui/card-cache-service.test.ts` and `tests/ui/card-cache-middleware.test.ts`.

- **Docs: Installation & Environment Setup Guide (`docs/installation_guide.md`, `docs/README.md`, `README.md`):**
  - Authored comprehensive environment setup and troubleshooting guide covering Node.js/npm prerequisites, Windows PATH configuration, PowerShell execution policy resolution, Vite dev server execution, production builds, and the full test and verification pipeline.
  - Linked the guide directly in `docs/README.md` and the root `README.md` Getting Started section.

- **Feature & Tooling: Card Text Parsing and Declarative Mapping Analyzer Tool ([#53](https://github.com/SteveRodrigue/MCD/issues/53), [ADR-0044](docs/decisions/0044-card-text-parsing-and-declarative-mapping-analyzer.md), `src/tools/card-text-parser/`, `tools/audit/card-text-parser.ts`, `docs/tools/card_text_parser.md`, `card-text-parser.test.ts`):**
  - **Deterministic Pattern-Matching Library:** Implemented `src/tools/card-text-parser/` with clean-text normalization (`normalizer.ts`), comprehensive regex pattern matching (`patterns.ts`), and parsing coordinator (`parser.ts`) that extracts abilities, names, timings, action traits (`attack`, `thwart`, `defense`), cost arrows (`→`), limits, usage counters, triggers, and effect primitives.
  - **Interactive CLI Analyzer with `--write` Support:** Created `tools/audit/card-text-parser.ts` (`npm run parse:card`) supporting `--code <id>`, `--pack <name>`, `--text "<raw>"`, and `--json` modes with colored terminal feedback for matched tokens, unmatched fragments, and existing supplemental comparison.
  - **Direct Supplemental Updates (`--write` & `--force`):** Added safe writing capability that updates or creates entries in `src/data/supplemental/pack/<pack>.json`, stamping full Step 8 `audit` metadata (`createdAt`, `updatedAt`, `reviewedAt`, `reviewedBy`, `rulesVersion: "v1.8"`, `originalText`) with pre-write schema validation gates.
  - **Safety & Schema Strictness:** Output is validated directly against `CardEnrichmentSchema.strict()` to guarantee zero undeclared keys or invalid primitives. Unmatched text fragments are isolated and confidence scores are calculated to guide human and agent review.
  - **Contract Test Suite:** Created 13 acceptance tests in `tests/tools/card-text-parser.test.ts` verifying Core Set player cards across Spider-Man, Captain Marvel, She-Hulk, and complex cost/trigger patterns.
  - **Architecture & Documentation:** Authored [ADR-0044](docs/decisions/0044-card-text-parsing-and-declarative-mapping-analyzer.md), user/agent guide in `docs/tools/card_text_parser.md`, and quick reference examples in `CHEATSHEET.md`.

- **Fix & Data: Correct Invalid Cost Declarations on Alpha Flight Station & Focused Rage ([#56](https://github.com/SteveRodrigue/MCD/issues/56), RR v1.8 p. 7 "Cost", ADR-0043, `schema.ts`, `schema.json`, `core.json`, `supplemental-schema.test.ts`):**
  - **Declarative Cost Alignment:** Corrected `01015` (*Alpha Flight Station*) from invalid `"discardFromHand": 1` to standard `"discardCard": { "from": "HAND", "count": 1 }`. Corrected `01027` (*Focused Rage*) from invalid `"takeDamage": 1` to standard `"damageHero": 1`, restoring proper damage validation and execution in `cost-engine.ts`.
  - **Strict Cost Schema:** Added `.strict()` to `AbilityCostSchema` and its nested sub-schemas (`discardCard`, `spendCounters`, `spendTokens`) in `src/data/supplemental/schema.ts`, preventing unmodeled cost properties from silently passing validation. Re-exported updated `src/data/supplemental/schema.json`.
  - **Deep CI Quality Gate:** Expanded the automated property audit in `tests/data/supplemental-schema.test.ts` to recursively inspect `ability.cost` properties against `AbilityCostSchema` across all supplemental pack files.

- **Fix & Data: Supplemental Schema Alignment, Strict Unknown Property Rejection & Effect-Derived Combat Onomatopoeia ([#55](https://github.com/SteveRodrigue/MCD/issues/55), ADR-0019, ADR-0030, ADR-0043, `schema.ts`, `schema.json`, `action-dispatcher.ts`, `CardPaymentModal.tsx`, `core.json`, `core_encounter.json`):**
  - **Effect-Derived Combat Onomatopoeia & Target Defaulting:** Eliminated unstructured `"tags": ["ATTACK"]` / `"tags": ["THWART"]` across supplemental abilities. `action-dispatcher.ts` and `CardPaymentModal.tsx` now inspect ability step effect primitives directly (`DEAL_DAMAGE`, `DEAL_DAMAGE_ALL_ENEMIES`, `REPULSOR_BLAST`, `EXPLOSION` $\rightarrow$ `"POW!"`, villain target default; `REMOVE_THREAT` $\rightarrow$ `"FOILED!"`, main scheme target default).
  - **Deduplicated Scheme Orientation:** Removed 8 redundant `"isLandscape": true` lines from `core_encounter.json` schemes, relying on `card-loader.ts` type-based auto-inference (`main_scheme`, `side_scheme`, `player_side_scheme`). Added optional `isLandscape` override to `CardEnrichmentSchema` for future atypical exceptions.
  - **Formalized Schema Properties:** Added `zone: z.enum(['HAND', 'PLAY', 'DISCARD']).optional()` to `CardAbilitySchema` (needed for hand interrupts/responses in `trigger-dispatcher.ts`), and `attackCost` / `thwartCost` to `CardEnrichmentSchema` (needed for ally consequential damage override e.g. Black Cat `01002`).
  - **Strict Zod & CI Quality Gate:** Enforced `.strict()` on `SupplementalPackSchema`, `CardEnrichmentSchema`, `CardAbilitySchema`, `CardUsesSchema`, `AbilityStepSchema`, and `CardAuditRecordSchema`, guaranteeing that any unrecognized properties are immediately rejected at runtime. Added an automated CI audit in `tests/data/supplemental-schema.test.ts` verifying 0 undeclared properties across all supplemental pack files.

- **Fix & Engine: Universal Uses (X) Counter Initialization and Schema Declaration ([#54](https://github.com/SteveRodrigue/MCD/issues/54), RR v1.8 p. 30 "Uses", ADR-0035, ADR-0043, `schema.ts`, `schema.json`, `state-validator.ts`, `action-dispatcher.ts`, `effects/index.ts`):**
  - **Declarative Schema Declaration:** Formalized `CardUsesSchema` with typed properties (`count: non-negative integer`, `type`, `counterType`, `max`, `discardOnEmpty`) and incorporated it into `CardEnrichmentSchema`. Re-exported fresh `schema.json` via `npm run schema:generate` to ensure valid in-editor validation and autocomplete.
  - **Universal Enters-Play Counter Initialization:** Added `initializeCardUses(cardInstance: CardInstance): void` helper in `state-validator.ts` that initializes both the numeric badge `tokens.counters = uses.count` (for UI rendering/comic logs) and the named counter map `counters[type] = uses.count` (for `spendCounters` ability costs per ADR-0035).
  - **Enters-Play Pipeline Integration:** Hooked `initializeCardUses` into `PLAY_CARD` in `action-dispatcher.ts` and `PUT_INTO_PLAY` in `effects/index.ts` so all cards entering play with the `uses` keyword (e.g. *Web-Shooter* `01008`, *Tac Team* `01056`, *Surveillance Team* `01064`, *Hawkeye* `01066`, *Med Team* `01080`) immediately enter play with their full initial counter pool.
  - **Automated Contract Tests:** Added comprehensive test suites in `tests/engine/spider-man-cards.test.ts`, `tests/engine/universal-counter-engine.test.ts`, and `tests/data/supplemental-schema.test.ts`.

- **Feature & Data: Codebase-Grounded Supplemental Schema Validation & Live VS Code Integration ([#52](https://github.com/SteveRodrigue/MCD/issues/52), [ADR-0043](docs/decisions/0043-codebase-grounded-supplemental-schema-validation-and-live-vscode-integration.md), `schema.ts`, `schema.json`, `generate-supplemental-schema.ts`, `supplemental_schema_validation.md`, `supplemental-schema.test.ts`):**
  - **Codebase-Grounded Zod Effect Enums:** Replaced loose string typing in `AbilityStepSchema.effect` with a strict, exhaustive `EffectTypeSchema = z.enum([...])` reflecting all 100+ active, implemented effect primitives across `src/engine/effects/index.ts`, `src/engine/pipeline/stat-calculator.ts`, and `src/engine/pipeline/legality-checker.ts`.
  - **Automated JSON Schema Export Tooling:** Created `tools/generate-supplemental-schema.ts` (`npm run schema:generate`) leveraging native Zod v4 `toJSONSchema()` to export `SupplementalPackSchema` into `src/data/supplemental/schema.json`.
  - **Live In-Editor VS Code Diagnostics & Autocomplete:** Configured `"json.schemas"` in `.vscode/settings.json` and relative `"$schema": "../schema.json"` across pack files, providing instant red squigglies on typos/unimplemented primitives, missing-property errors, and `Ctrl+Space` IntelliSense autocomplete.
  - **Declarative Supplemental Alignment:** Standardized drifted effect names (`01102` Sandman to `ADD_STATUS`, `01108` Crowd Control to `ADD_THREAT_PER_PLAYER`, `01073` The Triskelion to `ALLY_LIMIT_BONUS`).
  - **Automated CI/CD Quality Gates:** Expanded `tests/data/supplemental-schema.test.ts` with strict enum rejection tests, bidirectional parity checks, and schema freshness validation against regressions.
  - **Documentation:** Authored comprehensive architectural guide in `docs/tools/supplemental_schema_validation.md`.

- **Feature & Engine: Player Side Schemes, Victory Display & Auxiliary Scenario Decks ([#34](https://github.com/SteveRodrigue/MCD/issues/34), [ADR-0034](docs/decisions/0034-player-side-schemes-victory-display-and-auxiliary-decks.md), `state.ts`, `card.ts`, `action-dispatcher.ts`, `effects/index.ts`, `card-loader.ts`, `auxiliary-decks.ts`, `player-side-schemes-and-victory-display.test.ts`):**
  - Implemented Milestone 5A (RR v1.8 p. 26 "Player Side Scheme", p. 30 "Victory") with a `PlayerSideSchemeCard` type that enters play via `PLAY_CARD` into the **shared** `state.sideSchemes[]` zone alongside encounter Side Schemes (unified array + new `ownerId` field, refining ADR-0034's originally-separate-array design), automatically eligible for basic hero thwart / thwart events with zero changes to the legality checker or legal-actions generator.
  - Added the reusable `moveDefeatedCardToPile()` helper (checks the printed `Victory X` keyword) and retrofitted **every** existing defeat path — minion defeat (basic attack, ally attack, AoE damage), encounter Side Scheme defeat, and the new Player Side Scheme defeat — to route Victory-keyword cards to the permanent `state.victoryDisplay` zone instead of their normal discard pile.
  - Added the `'DEFEATED'` `TriggerType` (already present in the Zod schema but missing from the TS union) and wired Side Scheme "When Defeated" reward ability resolution into the thwart-to-zero pipeline, which also fixes a previously-dormant _Highway Robbery_ (`01166`) ability that declared this trigger but was never dispatched.
  - Added the `enrichment.victoryPoints` supplemental field (paired with `keywords: ["Victory"]`) for declaring the numeric Victory X value without raw-text parsing (ADR-0019).
  - Added generic, scenario-agnostic `state.auxiliaryDecks` / `auxiliaryDiscards` state fields and `initializeAuxiliaryDeck` / `drawFromAuxiliaryDeck` / `discardToAuxiliaryDeck` primitives (`src/engine/pipeline/auxiliary-decks.ts`) for future campaign scenarios (Infinity Gauntlet, Holding Cell, Evidence).
  - Extended the Universal Card Conservation Law (ADR-0040) traversal/removal helpers in `state-validator.ts` to cover the new auxiliary deck zones.
  - Zero cards in the currently-loaded Core Set catalog use `player_side_scheme` or `Victory` (verified against `data/upstream/schema/` and all synced packs); this is a forward-looking capability validated via synthetic test fixtures in `tests/engine/player-side-schemes-and-victory-display.test.ts` (8 new tests).

- **Feature: Dev Mode "Report a Problem" & Local-First Issue Capture ([ADR-0042](docs/decisions/0042-local-first-developer-problem-reporting.md), `TopBar.tsx`, `ReportProblemModal.tsx`, `problem-report-service.ts`, `vite.config.ts`, `problem-report-triage` skill):**
  - Added a "REPORT" button in the top bar opening a new `ReportProblemModal` where testers pick a report type (Bug / Improvement / Feature Missing-Incomplete), a priority (P0-Critical…P3-Low), write free-text, and submit with the live `GameState` attached automatically.
  - Added `problemReportPlugin()` dev-server middleware in `vite.config.ts` (mirrors the existing `gameStateSnapshotPlugin()` pattern) writing structured reports to `logs/reports/report_{timestamp}_{type}.json`; dev/preview-server only, no-op in production builds.
  - Added `src/ui/services/problem-report-service.ts` with pure, unit-tested label mapping (`bug`→`bug,triage`, `improvement`→`enhancement`, `feature`→`enhancement,feature`, plus `priority:P?-*`) and a token-free prefilled GitHub "New Issue" URL builder as an immediate convenience path.
  - Documented the local-first-capture decision (rejecting direct client-side GitHub API calls to avoid embedding a token in the browser bundle) in [ADR-0042](docs/decisions/0042-local-first-developer-problem-reporting.md).
  - Added the [`problem-report-triage`](.agents/skills/problem-report-triage/SKILL.md) skill: an Inbox-Zero protocol that files each pending `logs/reports/*.json` report as a labeled GitHub Issue (attaching the embedded `GameState` snapshot) and deletes the local file once confirmed filed.
  - Added `tests/ui/problem-report-service.test.ts` covering label mapping, GitHub URL construction, and submit/error handling.

- **Security: Dependabot Dependency Remediation:** Upgraded Vite to `6.4.3` and Vitest to `3.2.7`, resolving the vulnerable Vite/esbuild dependency path and moving Vitest beyond the patched `3.2.6` release. Added the review-gated Dependabot audit skill at [`.agents/skills/dependabot/SKILL.md`](.agents/skills/dependabot/SKILL.md). Full formatting, lint, typecheck, test, and production build checks pass.

- **Docs: Consolidated Rules Reference:** Removed the frozen duplicate `references/rules_reference_v18.md`; the maintained algorithmic rules mapping is now solely `docs/algorithmic_rules_reference.md`, while `references/` contains external read-only sources.

- **Docs: Full Documentation Audit & Code-Truth Synchronization (`documentation-audit` skill, `README.md`, `docs/**`, `AGENTS.md`):\*\*
  - Introduced the [`documentation-audit`](.agents/skills/documentation-audit/SKILL.md) skill: an 8-step Technical Writer protocol that synchronizes the docs set against `src/`, is strictly read-only toward code (writes `*.md` plus its own `logs/skills/` audit log only), files GitHub issues for suspected code defects instead of fixing them, and scores every finding on a pessimistic evidence-only confidence rubric (≥95% auto-apply, 80–94% confirm, <80% open question).
  - **Corrected phantom effect primitives** across `docs/specifications/supplemental/`: `PLACE_THREAT` → `ADD_THREAT` (+ new `ADD_THREAT_PER_PLAYER` section), `SEARCH_AND_DRAW` → `SCRY_AND_SELECT_TRAIT`, `DISCARD_TOP_DECK` → `DISCARD_TOP_DECK_FILTER`, `APPLY_STATUS` → `ADD_STATUS`, `RESOURCE_GENERATION` → `GENERATE_RESOURCE`, `DOUBLE_RESOURCE` → `DOUBLE_RESOURCE_FOR_ASPECT` (re-badged 🟢, it is implemented and used by 4 cards), `TOUGHNESS` reclassified as a keyword, and `DEAL_DAMAGE_SPLIT` downgraded to 🟡. JSON examples and source line links corrected to the params the engine actually reads.
  - **Retired the superseded `sequence: []` vocabulary** in favour of `steps: []` per ADR-0030, with errata footnotes in ADR-0023 and ADR-0029.
  - **ADR-0006** now documents the zzorba/marvelsdb-json-data sync contract: the real `pwsh scripts/sync_data.ps1` entry point, mandatory post-sync verification, and an explicit warning that upstream pulls can break cards via structural/parameter/value changes (supplemental joins upstream **by card code**). Removed the never-built `src/data/overrides/` layer and reframed the normalized catalog as assembled in memory at load time.
  - **ADR-0029** corrected: the never-existent `src/engine/pipeline/zone-helpers.ts` replaced with the four real locations of zone/shuffle mechanics.
  - **`docs/decisions/README.md`**: log table re-sorted to ascending ID order, and the single Mermaid lineage graph split into **6 grouped charts** with headers and explainers; every edge is now backed by an explicit ADR-to-ADR reference or a recorded supersession.
  - Fixed stale ADR ranges, the phantom `src/ui/overlays/` path, `src/engine/scenario/` → `scenarios/`, and missing directories in the `README.md` / `docs/README.md` project trees.
  - Consolidated all skills under `.agents/skills/` (removed the stale duplicate `skills/` tree) and regenerated `docs/reports/supplemental_declarations_usage_report.md`.

- **Docs: ADR Template Normalization & Enforcement (`docs/decisions/*.md`, `template.md`, `AGENTS.md`, skills):**
  - Normalized **all 41 ADRs** to [`docs/decisions/template.md`](docs/decisions/template.md): `# [ADR-XXXX] Title` heading plus the `Status` / `Date` / `Authors` / `Deciders` metadata block, replacing the `## Status` heading style, bare `Date:` lines, emoji-decorated status headings, and the numbered `# 38.` form.
  - Aligned `template.md` bullet markers with the repository formatter.
  - Made the template **mandatory** for every new or edited ADR in `AGENTS.md` and in the `feature-delivery`, `bug-fix`, and `documentation-audit` skills, including bidirectional supersession updates and log-table registration.

- **Build & CI: ESLint 9 Flat Config Migration (`eslint.config.js`, `package.json`, `effects/index.ts`, `comic-log-formatter.ts`, `CardPaymentModal.tsx`):**
  - Added missing `eslint.config.js` flat config (ESLint 9 no longer supports `.eslintrc.*` by default), wiring `@typescript-eslint`, `react-hooks`, and `react-refresh` for `src/**/*.{ts,tsx}`; this fixes the failing `npm run lint` CI step.
  - Updated the `lint` script (removed the flat-config-incompatible `--ext` flag) and added `@eslint/js` + `globals` dev dependencies.
  - Fixed lint errors surfaced by the new config: removed unreachable code in `dealDamage` (`src/engine/effects/index.ts`), corrected a misleading emoji character class regex in `src/ui/utils/comic-log-formatter.ts`, and hoisted `CardPaymentModal` early return below all hooks to respect the Rules of Hooks.

- **Feature & Data: Add `originalText` in Supplemental Audit Metadata ([#47](https://github.com/SteveRodrigue/MCD/issues/47), `schema.ts`, `01_metadata_and_audit.md`, `core.json`, `core_encounter.json`, `supplemental-schema.test.ts`):**
  - Added `originalText: z.string().optional()` to `CardAuditRecordSchema` in `src/data/supplemental/schema.ts` and `CardAudit` analyzer interface.
  - Aligned and populated exact printed rules text (`originalText`) directly above `reconstructedText` across all 156 cards in `src/data/supplemental/pack/core.json` and `src/data/supplemental/pack/core_encounter.json` for 100% self-contained auditability.
  - Updated specifications (`docs/specifications/supplemental/01_metadata_and_audit.md`), agent instructions (`AGENTS.md`), and Card Integration Protocol (`.agents/skills/card-integration-protocol/SKILL.md`).
  - Added schema and pack validation tests in `tests/data/supplemental-schema.test.ts`.

- **Feature & Engine: Cost Arrow Mandatory Resolution, Trigger Pipeline & Self-Damage Cost Primitive ([#8](https://github.com/SteveRodrigue/MCD/issues/8), [#11](https://github.com/SteveRodrigue/MCD/issues/11), [ADR-0041](docs/decisions/0041-cost-arrow-mandatory-resolution-and-self-damage-costs.md), `trigger-dispatcher.ts`, `action-dispatcher.ts`, `cost-engine.ts`, `schema.ts`, `core.json`, `cost-arrow-forced-triggers.test.ts`):**
  - Delivered official Marvel Champions Rules Reference (RR v1.8 p. 8 "Cost", p. 15 "Forced", and p. 27 "Response") and ADR-0041:
    - **Forced Trigger Automated Cost Resolution:** `dispatchTrigger()` now automatically pays mandatory costs (`discardSelf`, `exhaustSelf`, `spendCounters`, `damageSelf`) on `FORCED_RESPONSE` and `FORCED_INTERRUPT` in-play abilities without player prompt loops (e.g. _Superhuman Strength_ `01028` automatically discards itself and stuns the attacked enemy after She-Hulk attacks).
    - **Combat & Thwart Action Triggers:** Integrated `BASIC_ATTACK_PERFORMED`, `ATTACK_RESOLVED`, and `THWART_RESOLVED` lifecycle triggers in `action-dispatcher.ts` with contextual target metadata (`targetType`, `targetInstanceId`).
    - **Direct Damage Self-Cost Primitive (`cost.damageSelf`):** Added `damageSelf` to `AbilityCostSchema` and `cost-engine.ts`, validating and executing direct character self-damage costs (e.g. _War Machine_ `01030` ally action: exhaust & deal 2 damage to self $\rightarrow$ deal 1 damage to all enemies) and cleanly discarding defeated characters via atomic zone transfer `removeCardFromAllZones()`.
    - **Declarative Supplemental Retrofit:** Updated _War Machine_ (`01030`) with exact cost schema and effect parameters at 100% confidence.
  - Added comprehensive contract test suite in [`cost-arrow-forced-triggers.test.ts`](tests/engine/cost-arrow-forced-triggers.test.ts).

- **Bug Fix & Engine: Universal Card Conservation, Atomic Zone Transfers & Villain Attachment Layout ([#44](https://github.com/SteveRodrigue/MCD/issues/44), [ADR-0040](docs/decisions/0040-universal-card-conservation-and-atomic-zone-transfer.md), `state-validator.ts`, `effects/index.ts`, `action-dispatcher.ts`, `CardAttachmentFan.tsx`, `card-conservation-and-attachment.test.ts`):**
  - Resolved Bug #44 per Marvel Champions Rules Reference (RR v1.8 p. 5 "Attachment" & p. 6 "Cards Under Cards") and ADR-0040:
    - **Card Conservation Invariant Engine:** Implemented \`assertCardConservation()\` in \`state-validator.ts\` to enforce the physical card conservation law (every card instance exists in $\\le 1$ active zone/slot across the entire game state tree, failing fast on any duplicate insertion).
    - **Atomic Zone Transfers:** Implemented \`attachCardToHost()\` and \`removeCardFromAllZones()\` to guarantee that attaching cards to hosts automatically strips them from previous zones before placement, eliminating duplicate pre-placement in \`action-dispatcher.ts\`.
    - **Comic Pop-Art Fan-Down Artwork Stack:** Redesigned \`CardAttachmentFan.tsx\` from plain text button blocks to genuine \`CardView\` components cascading in a vertical tabletop stack with dynamic mouseover zoom (\`enableHoverZoom={true}\`) and interactive action triggers.
  - Added contract test suite in [\`card-conservation-and-attachment.test.ts\`](tests/engine/card-conservation-and-attachment.test.ts).

- **Bug Fix & Engine: Payment Generator Legality & Non-Resource Counter Cards Isolation ([#43](https://github.com/SteveRodrigue/MCD/issues/43), `legality-checker.ts`, `CardPaymentModal.tsx`, `tac-team-non-resource-generator.test.ts`):**
  - Resolved Bug #43 per Marvel Champions Rules Reference (RR v1.8 p. 25 "Resource Ability" & p. 8 "Cost"):
    - **Genuine Generator Verification:** Updated \`evaluateCardPlayability()\` in \`legality-checker.ts\` to enforce that any in-play generator in \`generatorInstanceIds\` possesses a genuine resource ability (\`isResourceAbility(a.timing)\`) or resource/cost-reducing effect step (\`GENERATE_RESOURCE\`, \`COST_REDUCER\`, \`GENERATE_TOP_DISCARD_RESOURCES\`, \`DOUBLE_RESOURCE_FOR_ASPECT\`).
    - **Non-Resource Counter Exclusion:** Non-resource counter cards (e.g. _Tac Team_ \`01056\` with attack counters, _Med Team_ \`01080\` with medical counters, _Surveillance Team_ \`01064\`, _Energy Channel_ \`01018\`) are strictly excluded from payment modal discovery and rejected during \`PLAY_CARD\` validation.
    - **Preserved Counter Resource Generators:** Genuine counter-based resource generators (e.g. _Web-Shooter_ \`01008\`, _Enhanced Reflexes_ \`05024\`, _Enhanced Physique_ \`06034\`) continue to be discoverable in the payment modal, exhausting and decrementing 1 counter upon payment.
  - Added contract test suite in [\`tac-team-non-resource-generator.test.ts\`](tests/engine/tac-team-non-resource-generator.test.ts).

- **Bug Fix & Engine: Universal Resource Ability Timing Triad, Form Gating & Payment Window Isolation ([#42](https://github.com/SteveRodrigue/MCD/issues/42), [ADR-0039](docs/decisions/0039-universal-resource-ability-timing-triad-and-form-gating.md), `abilities.ts`, `schema.ts`, `cost-engine.ts`, `legal-actions-generator.ts`, `action-dispatcher.ts`, `CardPaymentModal.tsx`, `core.json`, `resource-abilities-timing.test.ts`):**
  - Resolved Bug #42 per Marvel Champions Rules Reference (RR v1.8 p. 25 "Resource Ability" & p. 14 "Form") and ADR-0039:
    - **First-Class Resource Timing Triad:** Standardized \`HERO_RESOURCE\` and \`ALTER_EGO_RESOURCE\` in \`AbilityTiming\` and Zod schema alongside \`RESOURCE\`, completing the symmetric 3-stance taxonomy across Actions, Interrupts, Responses, and Resources.
    - **Payment Window Isolation:** Updated \`getLegalActionsForPlayer()\` to strictly exclude all resource generation abilities from standalone board actions in the Daily Bugle action newspaper, preventing resource generation outside active cost payment windows.
    - **Form-Gated Payment Discovery:** Integrated \`isAbilityPlayableInForm()\` into \`CardPaymentModal.tsx\` and \`action-dispatcher.ts\`, properly gating \`HERO_RESOURCE\` (Hero-only) and \`ALTER_EGO_RESOURCE\` (Alter-Ego-only) during card and ability cost payments.
    - **Declarative Supplemental Retrofit:** Corrected _Web-Shooter_ (\`01008\`) timing from \`HERO*ACTION\` to \`HERO_RESOURCE\` and \_Pepper Potts* (\`01033\`) timing from \`ACTION\` to \`RESOURCE\` in \`src/data/supplemental/pack/core.json\` with 100% confidence audit metadata.
    - **2-Tier Architecture for Multi-Form & Fan-Made Content:** Tier 1 handles stance gating via timing enums, while Tier 2 handles sub-form traits (_Tiny_, _Giant_, _Dense_, _Intangible_, _Solid_, _Phased_, _Archangel_, _Photon_) via \`cost.requiredSubForm\` and \`cost.requiredTrait\`.
  - Added comprehensive contract test suite in [\`resource-abilities-timing.test.ts\`](tests/engine/resource-abilities-timing.test.ts).

- **Feature & Engine: Hero Setup Abilities Execution during Step 14 of Scenario Setup ([#16](https://github.com/SteveRodrigue/MCD/issues/16), `game-setup.ts`, `scenario-setup-step14-hero-setup.test.ts`):**
  - Implemented the official Marvel Champions RR v1.8 p. 27 ("Step 14: Resolve Character Setup Abilities") state machine in `src/engine/state/game-setup.ts`:
    - **Universal Step 14 Pipeline:** Automatically scans each player's identity cards (`alterEgo` and `hero`) and tableau for `timing === "SETUP"` abilities after opening hands and mulligans are resolved (Step 13) and before Round 1 begins (Step 15).
    - **T'Challa Setup Upgrade (_Foresight_ `01040b`):** Executes declarative `SEARCH_AND_SELECT` to fetch 1 Black Panther upgrade from `player.deck` and put it directly into `player.tableau`, shuffling `player.deck` post-search.
    - **Deterministic Setup Choices:** Supports `PlayerSetupConfig.chosenSetupCardCode` for deterministic test and UI setup selection while maintaining full backward compatibility.
    - **Multiplayer Turn-Order Invariant:** Resolves character setup abilities in player order across all active players.
  - Added comprehensive contract test suite in [`scenario-setup-step14-hero-setup.test.ts`](tests/engine/scenario-setup-step14-hero-setup.test.ts).

- **Feature & Engine: Universal Special Ability Plugin Architecture & Wakanda Forever! Sequential Ordering ([#18](https://github.com/SteveRodrigue/MCD/issues/18), [#19](https://github.com/SteveRodrigue/MCD/issues/19), [#20](https://github.com/SteveRodrigue/MCD/issues/20), [ADR-0038](docs/decisions/0038-universal-special-ability-plugin-architecture-and-sequential-ordering.md), `specials/special-registry.ts`, `specials/wakanda-forever.ts`, `effects/index.ts`, `action-dispatcher.ts`, `legality-checker.ts`, `WakandaForeverModal.tsx`, `wakanda-forever-sequence.test.ts`):**
  - Implemented the official Marvel Champions RR v1.8 p. 28 ("Special") and ADR-0038 universal Special ability plugin registry and interactive sequence ordering engine:
    - **Modular Special Ability Plugins:** Established `src/engine/specials/special-registry.ts` with standardized `SpecialAbilityHandler` contracts, decoupling hero-specific Special mechanics (_Black Panther_, _Doctor Strange_, _Storm_, _Phoenix_, and Fan-Made custom content) from the core primitive dispatcher.
    - **Wakanda Forever! Sequence Engine:** Implemented `src/engine/specials/wakanda-forever.ts` supporting multi-upgrade execution chains across _Energy Daggers_ (`01046`), _Panther Claws_ (`01047`), _Tactical Genius_ (`01048`), and _Panther Suit_ (`01049`).
    - **Dynamic Finisher Scaling:** Automatically applies enhanced finisher bonuses to the final resolved upgrade ($N$-th step boost, e.g. 4 damage for Panther Claws, 2 threat for Tactical Genius, 2 AoE for Energy Daggers, 2 moved damage for Panther Suit).
    - **Play Condition Legality Guard:** Enforces RR v1.8 p. 19 play condition that _Wakanda Forever!_ (`01043a-d`) cannot be played without at least 1 in-play Black Panther upgrade.
    - **Interactive Drag & Drop Sequence Ordering Modal:** Created `WakandaForeverModal.tsx` displaying the _Wakanda Forever!_ card tooltip on the left alongside horizontal drag-and-drop slots on the right with real-time Finisher bonus highlighting.
  - Added comprehensive contract test suite in [`wakanda-forever-sequence.test.ts`](tests/engine/wakanda-forever-sequence.test.ts).

- **Feature & Engine: Universal Card Attachment & Tucked Card Architecture ([#40](https://github.com/SteveRodrigue/MCD/issues/40), `effects/index.ts`, `action-dispatcher.ts`, `legal-actions-generator.ts`, `state.ts`, `CardAttachmentFan.tsx`, `universal-card-attachments.test.ts`):**
  - Implemented the official Marvel Champions RR v1.8 p. 5 ("Attachment") and p. 6 ("Cards Under Cards") universal attachment and reserve card engine:
    - **Multi-Target Attachment Scope:** Universal attachment resolution across Villains, Heroes/Identities (_Caught in a Web_), Allies (_Honorary Avenger_), Minions (_Webbed Up_), and Schemes via expanded `ATTACH_TO_HOST` primitive.
    - **Cascading Discard on Host Departure:** Guarantees that when any host entity (minion, ally, side scheme, tableau card) leaves play, all attached cards and cards placed underneath are cleanly discarded to their respective owner discard piles (`discardHostAttachmentsAndTuckedCards`).
    - **Cards Underneath / Tucked Reserves:** Added engine support for out-of-play cards placed under hosts (`cardsUnderneath: CardInstance[]`) via `PLACE_CARD_UNDER_HOST` and `DISCARD_CARDS_UNDER_HOST`.
    - **Attachment Actions Discovery:** Dynamically surfaces in-play attachment actions and resource-spend discard triggers in legal actions (`getLegalActionsForPlayer`).
    - **1960s Pop-Art UI Stacking:** Created dedicated `CardAttachmentFan.tsx` component rendering face-up attached cards tucked under parent hosts in a vertical fan-down layout with readable stat modifiers and action badges, alongside compact face-down reserve badges for cards underneath.
  - Added comprehensive contract test suite in [`universal-card-attachments.test.ts`](tests/engine/universal-card-attachments.test.ts).

- **Bug Fix & Engine: End of Player Phase Clean-Up & Voluntary Hand Discard ([#41](https://github.com/SteveRodrigue/MCD/issues/41), `player-phase-cleanup.ts`, `action-dispatcher.ts`, `round-upkeep.ts`, `end-of-player-phase-cleanup.test.ts`):**
  - Implemented the official Marvel Champions RR v1.8 p. 23 End of Player Phase Clean-Up state machine in a dedicated module (`src/engine/pipeline/player-phase-cleanup.ts`):
    - **Voluntary Hand Discard Window:** When the player phase concludes, players in player order are presented with an interactive multi-select decision prompt to discard any number of cards from hand or keep all.
    - **Hand Replenishment & Readying (RR v1.8 p. 23):** Draws cards until hand contains cards equal to effective hand size, readies identity, all allies, and tableau upgrades/supports _before_ the Villain Phase begins.
    - **Prompt Queue Integration:** Seamlessly handles multi-card voluntary discards (`PLAYER_PHASE_DISCARD_CARD`) and completion (`FINISH_PLAYER_CLEANUP`) before advancing to next player or launching `executeVillainPhase`.
    - **Upkeep Decoupling:** Cleaned up redundant drawing and readying from round upkeep Step 6, which strictly handles round token rotations, round-end forced ally dismissals (Nick Fury), and round number increments per RR v1.8 p. 32.
  - Added comprehensive contract test suite in [`end-of-player-phase-cleanup.test.ts`](tests/engine/end-of-player-phase-cleanup.test.ts).

- **Feature & Engine: Advanced Status Dynamics (Stalwart, Steady) & Minion Activation Modifiers (Villainous, Quickstrike, Incite, Hinder) ([#35](https://github.com/SteveRodrigue/MCD/issues/35), `effects/index.ts`, `stat-calculator.ts`, `action-dispatcher.ts`, `villain-phase.ts`, `combat-pipeline.ts`, `advanced-status-and-minion-modifiers.test.ts`):**
  - Implemented the official Marvel Champions RR v1.8 p. 14, 16, 18, 28, 30 advanced status mechanics and minion activation modifiers per ADR-0036:
    - **Stalwart Immunity (RR v1.8 p. 28):** Complete immunity to `STUNNED` and `CONFUSED` status card applications across heroes, villains, and minions, emitting comic onomatopoeia `"IMMUNE! (STALWART)"`.
    - **Steady Count-Based Status Thresholds (RR v1.8 p. 28):** Steady characters require **2 copies** of a status card to be incapacitated (1st Stun/Confuse does not cancel actions; 2nd copy cancels the activation and discards both status cards simultaneously).
    - **Villainous Minion Activations (RR v1.8 p. 30):** Elite minions deal and resolve facedown boost cards from the encounter deck during attacks and schemes, accumulating boost icons and star boost effects.
    - **Quickstrike Minion Engagement (RR v1.8 p. 18):** Minions with Quickstrike immediately initiate an attack against engaging heroes upon entering play.
    - **Incite $X$ & Hinder $X$ Threat Modifiers (RR v1.8 p. 14, 16):** Direct main scheme threat placement upon encounter card reveal (Incite) and per-player scaled initial threat on side schemes (Hinder).
    - **Core Encounter Retrofit:** Retrofitted Vulture (`01167`) in `core_encounter.json` to natively utilize the engine's universal Quickstrike keyword pipeline.
  - Added comprehensive contract test suite in [`advanced-status-and-minion-modifiers.test.ts`](tests/engine/advanced-status-and-minion-modifiers.test.ts).

- **Feature & Engine: Universal Named Counter Map, Cross-Entity Targeting & Uses Zero-Counter Discard ([#33](https://github.com/SteveRodrigue/MCD/issues/33), `effects/index.ts`, `cost-engine.ts`, `schema.ts`, `core.json`, `universal-counter-engine.test.ts`):**
  - Implemented the official Marvel Champions RR v1.8 p. 30 ("Uses") and ADR-0035 universal named counter dictionary across all in-play entities:
    - **Named Counter Maps:** Replaced scalar counters with `counters: Record<string, number>` on `CardInstance` and `PlayerState`, seamlessly supporting all 51 catalog counter types (_Charge_, _Growth_, _Ammo_, _Arrow_, _Web_, _Invocation_, _Pym_, _Chi_, _Energy_, _Snoop_, _Medical_, _Attack_).
    - **Atomic Cross-Entity Primitives:**
      - `ADD_COUNTERS`: Adds $N$ named counters to `SELF`, `IDENTITY`, or target card.
      - `SPEND_COUNTERS`: Removes $N$ named counters from `SELF` or `IDENTITY` with legality pre-validation in the cost engine.
      - `REMOVE_COUNTERS_MATCHING_FILTER`: Purges/decrements named counters matching trait and zone filters (_Ebony Maw_, _The Green Gobbler_).
      - `COUNTERS_ON_TARGET`: Dynamic damage/threat formula scaling by active counter count $\times$ multiplier (_Energy Channel_ `01018`).
    - **Uses Zero-Counter Card Discard Lifecycle (RR v1.8 p. 30):** Automatically removes cards from the tableau/allies to discard when their Uses counters reach 0, dispatching the `CARD_DISCARDED` trigger and emitting comic log event `card.discarded.uses_exhausted`.
    - **Complete Core Set Retrofit:** Retrofitted Web-Shooter (`01008`), Energy Channel (`01018`), Tac Team (`01056`), Surveillance Team (`01064`), Hawkeye (`01066`), and Med Team (`01080`).
  - Added comprehensive contract test suite in [`universal-counter-engine.test.ts`](tests/engine/universal-counter-engine.test.ts).

- **Feature & Engine: SEARCH_AND_SELECT Extensible Filtering Engine & Core Set Retrofit ([#38](https://github.com/SteveRodrigue/MCD/issues/38), [#10](https://github.com/SteveRodrigue/MCD/issues/10), `effects/index.ts`, `action-dispatcher.ts`, `schema.ts`, `core.json`, `search-and-select-routing.test.ts`):**
  - Enhanced the universal declarative `SEARCH_AND_SELECT` primitive with comprehensive, extensible card filtering capabilities (`matchCardFilter`) adhering strictly to RR v1.8 p. 19 & 26:
    - **Extensible Declarative Filters:** Evaluates traits (`trait`, `traits`), card types (`type`, `types`, `cardTypes`), card codes (`targetCardCode`, `targetCardCodes`), card names (`targetCardName`), identity specificity (`isIdentitySpecific`), aspects (`aspect`, `aspects`), and printed cost bounds (`costMin`, `costMax`).
    - **Filtered Look-Splitting:** When looking at top $N$ cards with filter criteria (e.g. _Futurist_ filtering for _Tech_ cards), only matching candidate cards are presented in the decision prompt; non-matching looked cards and unchosen matching cards are cleanly routed to `unselectedDestination` (`DISCARD`). If no looked cards match, all $N$ cards are discarded automatically.
    - **Complete Core Set Retrofit:**
      - **Tony Stark (_Futurist_ `01029b`):** Filters top 3 cards for trait _Tech_, routing chosen card to hand and remaining looked cards to discard.
      - **T'Challa (_King of Wakanda_ Setup `01040b`):** Searches deck for _Black Panther_ upgrade and puts directly into tableau.
      - **Shuri (`01041`):** Searches deck for an upgrade and adds to hand.
  - Added comprehensive contract test suite in [`search-and-select-routing.test.ts`](tests/engine/search-and-select-routing.test.ts).

- **Feature & Engine: Restricted Card Keyword Limit & Voluntary Replacement Prompt ([#30](https://github.com/SteveRodrigue/MCD/issues/30), `action-dispatcher.ts`, `legality-checker.ts`, `prompt-queue.ts`, `restricted-keyword-limit.test.ts`):**
  - Implemented the official Marvel Champions RR v1.8 p. 25 ("Restricted") keyword engine and interactive replacement prompt lifecycle (ADR-0018, ADR-0032):
    - **Base Slot Capacity:** Restricts each player to a base limit of 2 restricted cards simultaneously in their tableau.
    - **Slot Weights & Heavy Weapons:** Heavy weapon cards count as 2 restricted slots towards the player's capacity.
    - **Dynamic Modifiers:** Supports cards that grant additional restricted slots (_Side Holster_, `RESTRICTED_LIMIT_BONUS`).
    - **Interactive Replacement Prompt:** When a player attempts to play a restricted card that would exceed their limit while controlling restricted cards in play, [`canPlayCard()`](src/engine/pipeline/legality-checker.ts) permits the play and enqueues an interactive `PendingDecisionPrompt` modal (`DISCARD_RESTRICTED_REPLACEMENT`) listing all in-play restricted cards plus a voluntary `cancel_play` option.
    - **Prompt Resolution & Cancellation:** Choosing an in-play restricted card discards it from the tableau, spends payment resources, and puts the new card into play; choosing `cancel_play` aborts the play action cleanly, leaving the new card and payment resources in hand with the tableau untouched.
  - Added comprehensive contract test suite in [`restricted-keyword-limit.test.ts`](tests/engine/restricted-keyword-limit.test.ts).

- **Feature & Engine: Enforce "Max [X] Per Player" Board Invariants ([#3](https://github.com/SteveRodrigue/MCD/issues/3), `card-loader.ts`, `legality-checker.ts`, `card.ts`, `abilities.ts`, `table-invariants-restricted-and-unicity.test.ts`):**
  - Added automatic text signal parsing via [`parseMaxPerPlayer()`](src/data/importer/card-loader.ts) extracting printed "Max [X] per player" limits across 100+ cards from the upstream Zzorba dataset while cleanly ignoring parenthesized Restricted reminder text.
  - Implemented the Max [X] per player board constraint (RR v1.8 p. 17 "Max") in [`canPlayCard()`](src/engine/pipeline/legality-checker.ts): prevents playing upgrades/supports (e.g. _Energy Channel_ `01018`, _Armored Vest_ `01081`, _Combat Training_ `01057`, _Down Time_ `01061`, _Avengers Mansion_ `01091`, _Helicarrier_ `01092`) if the player already controls the printed maximum number of copies in their tableau.
  - Added contract test suite in [`table-invariants-restricted-and-unicity.test.ts`](tests/engine/table-invariants-restricted-and-unicity.test.ts).

- **Feature & Engine: Global Cross-Player Unicity & Hero Identity Collision Validation ([#31](https://github.com/SteveRodrigue/MCD/issues/31), `legality-checker.ts`, `table-invariants-restricted-and-unicity.test.ts`):**
  - Upgraded [`checkUniqueCardPlayable()`](src/engine/pipeline/legality-checker.ts) and introduced [`isUniqueCollision()`](src/engine/pipeline/legality-checker.ts) adhering strictly to official Marvel Champions RR v1.8 p. 29 ("Unique"):
    - **Cross-Player Unicity:** Evaluates uniqueness across all active players' tableaus, allies, and unique minions.
    - **Hero & Alter-Ego Persona Collision:** Automatically maps a player's alter-ego persona to their hero identity subtitle, preventing playing unique allies/supports that share the same character persona (_Spider-Man: Peter Parker_ ally or _Peter Parker_ support while _Spider-Man / Peter Parker_ identity is in the game).
    - **Subtitle Differentiation Rule (RR v1.8 p. 29):** If two cards share the same title but have different subtitles (such as _Spider-Man: Peter Parker_ and _Spider-Man: Miles Morales_), they are recognized as distinct characters and permitted to enter play simultaneously.
  - Added comprehensive BDD test coverage in [`table-invariants-restricted-and-unicity.test.ts`](tests/engine/table-invariants-restricted-and-unicity.test.ts).

- **Feature & Engine: Mid-Action Player and Encounter Deck Exhaustion & Penalty Invariants ([#32](https://github.com/SteveRodrigue/MCD/issues/32), `effects/index.ts`, `deck-exhaustion.ts`, `deck-exhaustion-invariants.test.ts`):**
  - Unified all card draw, search, milling, discard, and surge primitives across [`src/engine/effects/index.ts`](src/engine/effects/index.ts) to route through centralized [`drawPlayerCard()`](src/engine/pipeline/deck-exhaustion.ts) and [`drawEncounterCard()`](src/engine/pipeline/deck-exhaustion.ts).
  - Enforced official Marvel Champions RR v1.8 p. 11 & p. 18 deck exhaustion invariants:
    - **Player Deck Exhaustion (RR v1.8 p. 18):** Immediately shuffles player discard pile to form a new draw deck, deals 1 facedown encounter card to that player as a penalty, and seamlessly continues mid-card effects (e.g. _Repulsor Blast_, _Black Cat_, _Hulk_, _Draw up to hand size_).
    - **Encounter Deck Exhaustion (RR v1.8 p. 11):** Immediately places 1 permanent acceleration token on the Main Scheme, shuffles encounter discard pile to form a new encounter deck, and continues the current activation/reveal.
  - Added comprehensive contract test suite in [`deck-exhaustion-invariants.test.ts`](tests/engine/deck-exhaustion-invariants.test.ts).

- **Feature (UI & Logging): Hierarchical Combat Log Entry Formatting (`comic-log-formatter.ts`, `comic-log-formatter.test.ts`):**
  - Added [`formatHierarchicalLogKey()`](src/ui/utils/comic-log-formatter.ts) in the Comic Log & Dialogue Engine (ADR-0005, ADR-0009, ADR-0037).
  - Automatically translates dotted hierarchical engine keys into readable, contextual action labels with character/card name prefixes:
    - `card.*` $\rightarrow$ `card.name: remainder` (e.g. `Arc Reactor: effect.readyCharacter`).
    - `player.*` $\rightarrow$ `player.name: remainder` (e.g. `Spider-Man: action.allyAttack`).
    - `villain.*` $\rightarrow$ `villain.name: remainder` (e.g. `Rhino: attack`, `Rhino: boost.revealed`).
    - `minion.*`, `attachment.*`, `scheme.*`, `identity.*`, `status.*`, etc. are similarly formatted with their active entity names.
  - Added comprehensive BDD test suite in [`comic-log-formatter.test.ts`](tests/ui/comic-log-formatter.test.ts).

- **Bug Fix: Nick Fury Forced Response Round-End Discard (`core.json`, `round-upkeep.ts`, `advanced-mechanics.test.ts`):**
  - Added missing `nick_fury_round_end_discard` ability (`timing: "FORCED_RESPONSE"`, `trigger: "ROUND_END"`, `effect: "DISCARD_SELF"`) to Nick Fury (`01084`) in [`core.json`](src/data/supplemental/pack/core.json).
  - Verified in [`advanced-mechanics.test.ts`](tests/engine/advanced-mechanics.test.ts) that Nick Fury is cleanly discarded to player discard at the end of the round during Step 6 round upkeep.

- **Bug Fix & Engine: Interactive Player Choice for Target `CHOSEN_PLAYER` Card Draw Abilities ([#29](https://github.com/SteveRodrigue/MCD/issues/29), `effects/index.ts`, `decision-prompts.test.ts`):**
  - Resolved issue where Carol Danvers' _Commander_ alter-ego ability (`01010b`) and Avengers Mansion (`01091`) with `target: "CHOSEN_PLAYER"` drew cards for self without prompting player choice in 2+ player matches.
  - Implemented smart targeting in `DRAW_CARDS` ([`src/engine/effects/index.ts`](src/engine/effects/index.ts)): seamlessly fast-paths to self in 1-player games without opening extra prompts, while enqueuing an interactive `Choose a Player` decision prompt modal in 2–4 player games.
  - Added regression test suite in [`decision-prompts.test.ts`](tests/engine/decision-prompts.test.ts) verifying single-player direct draw and multiplayer target prompt resolution for Carol Danvers (_Commander_) and Avengers Mansion.

- **Bug Fix & Engine: Interactive Defender Declaration for Villain & Minion Attacks ([#28](https://github.com/SteveRodrigue/MCD/issues/28), `villain-phase.ts`, `action-dispatcher.ts`, `effects/index.ts`, `combat-pipeline.ts`, `combat-defender-prompt.test.ts`):**
  - Resolved issue where villain and minion attacks in the Villain Phase or via encounter treacheries (e.g. _Assault_, _Gang-Up_) executed synchronously without presenting an interactive prompt modal to select a defender (Hero, Ally, or undefended) or trigger defense interrupts (e.g. _Spider-Sense_, _Backflip_).
  - Updated [`step2_villainAndMinionActivations`](src/engine/pipeline/villain-phase.ts) to manage an activation queue that pauses execution cleanly when interactive prompts are enqueued into `pendingDecisionPrompt`.
  - Added [`continueVillainPhase()`](src/engine/pipeline/villain-phase.ts) to resume remaining activations, encounter dealing, and card reveals once defender declaration prompts are resolved.
  - Wired `RESOLVE_DECISION_PROMPT` and `DECLARE_DEFENDER` in [`action-dispatcher.ts`](src/engine/pipeline/action-dispatcher.ts) and [`effects/index.ts`](src/engine/effects/index.ts) to trigger phase resumption in both single-player and multiplayer matches.
  - Added comprehensive regression test suite in [`combat-defender-prompt.test.ts`](tests/engine/combat-defender-prompt.test.ts).

- **Bug Fix & UI: Interactive Attack Target Selection Modal & Ally Minion Targeting (`AttackTargetModal.tsx`, `HeroZone.tsx`, `IdentityActionModal.tsx`, `action-dispatcher.ts`, `legality-checker.ts`):**
  - Implemented pop-art [`AttackTargetModal.tsx`](src/ui/components/board/AttackTargetModal.tsx) to prompt the player to select an enemy target whenever more than 1 valid target exists (e.g. Villain + Engaged Minions), while seamlessly fast-pathing single-target attacks when only 1 valid target is in play.
  - Enforced official Marvel Champions RR v1.8 p. 15 **Guard** invariants across `getValidAttackTargets()`, [`canBasicAttack()`](src/engine/pipeline/legality-checker.ts), and [`canAllyAttack()`](src/engine/pipeline/legality-checker.ts) (blocking attacks against the villain while an engaged minion with Guard is in play, while allowing minions to be targeted).
  - Extended `ALLY_ATTACK` in [`action-dispatcher.ts`](src/engine/pipeline/action-dispatcher.ts) to fully support targeting minions (damage resolution, Tough status card absorption, minion defeat & discard, host attachments defeat triggers, and ally consequential damage).
  - Integrated attack target resolution into [`HeroZone.tsx`](src/ui/components/board/HeroZone.tsx) (Hero & Ally attack buttons and card clicks) and [`IdentityActionModal.tsx`](src/ui/components/board/IdentityActionModal.tsx).
- **Bug Fix: Nick Fury Round-End Forced Discard (`core.json`, `round-upkeep.ts`, `advanced-mechanics.test.ts`):**
  - Added missing `nick_fury_round_end_discard` ability (`timing: "FORCED_RESPONSE"`, `trigger: "ROUND_END"`, `effect: "DISCARD_SELF"`) to Nick Fury (`01084`) in [`core.json`](src/data/supplemental/pack/core.json), strictly adhering to official Marvel Champions RR v1.8 rules that Nick Fury must be discarded at the end of the round.
  - Added comic log entry (`ally.round_end.discarded` with onomatopoeia `'DISMISSED!'`) to [`round-upkeep.ts`](src/engine/pipeline/round-upkeep.ts) when round-end allies are discarded during upkeep step 6.
  - Expanded regression test in [`advanced-mechanics.test.ts`](tests/engine/advanced-mechanics.test.ts) to assert that Nick Fury is discarded to player discard upon round upkeep transition.
- **Bug Fix: Web-Shooter HERO_ACTION Form Gating (`core.json`, `legality-checker.ts`, `CardPaymentModal.tsx`):**
  - Updated Web-Shooter (`01008`) ability timing from generic `"RESOURCE"` to `"HERO_ACTION"` in [`core.json`](src/data/supplemental/pack/core.json), strictly enforcing the Marvel Champions RR v1.8 rule that Hero Action / Hero Resource abilities can only be used in **Hero form**.
  - Enforced form-legality checking in [`legality-checker.ts`](src/engine/pipeline/legality-checker.ts) and [`action-dispatcher.ts`](src/engine/pipeline/action-dispatcher.ts) for all in-play tableau resource generators.
  - Filtered out form-ineligible tableau generators in [`CardPaymentModal.tsx`](src/ui/components/board/CardPaymentModal.tsx) so Web-Shooter is hidden from available generators while in Alter-Ego form.
- **UI Improvement: Vertical Main Scheme Threat Gauge with Dynamic Color Shift (`VillainZone.tsx`):**
  - Moved the Main Scheme threat meter from a horizontal bar to a sleek **vertical gauge positioned along the right edge of the Main Scheme card** (`h-[176px]`).
  - Added bottom-to-top vertical fill with a dynamic smooth color gradient shifting from **Blue (low threat) $\rightarrow$ Yellow/Amber (moderate threat) $\rightarrow$ Red (critical threshold)**.
  - Relocated the text threat counter (`X / Y THREAT`) to the **top-right of the Main Scheme header** with a color-coded status badge.
- **UI Polish & QoL: High-Contrast Resource Badges & Aspect "The Power of..." Auto-Selection (`CardPaymentModal.tsx`, `tailwind.config.js`):**
  - Resolved contrast issue where `"2 Res (2× Aspect)"` on _The Power of Justice_ (and other aspect double resource cards) was pale due to missing `comic-green` palette definition.
  - Added `green: '#16A34A'` to `tailwind.config.js` and upgraded Resource Yield Badges to high-contrast emerald/comic-black pop-art styling.
  - Implemented auto-selection QoL in [`CardPaymentModal.tsx`](src/ui/components/board/CardPaymentModal.tsx): Opening payment for an aspect card automatically pre-selects matching "The Power of [Aspect]" cards from hand up to the required cost.
- **Bug Fix: Identity Actions Overlay Thwart Invalidation & Deactivated Badge Styling (`legality-checker.ts`, `IdentityActionModal.tsx`):**
  - Added 0-threat checks to `canBasicThwart()` in [`legality-checker.ts`](src/engine/pipeline/legality-checker.ts) (enforcing Marvel Champions RR v1.8 p. 29 rule that an entity cannot thwart a scheme with 0 threat).
  - Fixed `IdentityActionModal.tsx` to properly deactivate the Thwart action button when no threat is present across main or side schemes, properly target eligible side schemes when main scheme threat is 0, and gray out button badges and icons when disabled.
- **Asset Resolution & Scenarios: Core Set Inverted Main Scheme Image Resolution (`card-cache-service.ts`, `docs/roadmap_and_milestones.md`):**
  - Created `resolveMainSchemeArtFileName(code, stage)` in [`card-cache-service.ts`](src/ui/services/card-cache-service.ts) to handle the upstream `zzorba` Core Set asset inversion anomaly (where Core Set 1A Setup face maps to `xxxxb.png` and 1B Active face maps to `xxxx.png`) while maintaining standard convention (`xxxx.png`/`xxxxa.png` for Stage A and `xxxxb.png` for Stage B) across all expansions.
  - Documented the caveat and future upstream PR action item in [`docs/roadmap_and_milestones.md`](docs/roadmap_and_milestones.md).
- **Bug Fix: Automated Scenario Setup Enforcement & Stage 1B Main Scheme Resolution (`game-setup.ts`, `App.tsx`):**
  - Resolved bug where launching a scenario in the UI failed to enforce official Scenario Setup rules (loading Stage 1A instead of Stage 1B, and bypassing scenario setup side effects).
  - Integrated `ScenarioRegistry.get(scenarioId).onGameSetup()` directly into `setupGame()` ([`game-setup.ts`](src/engine/state/game-setup.ts)), guaranteeing that starting any game automatically executes the 15-step scenario setup state machine, configures difficulty-scaled villain stages, loads the canonical **Stage 1B** main scheme card face, and passes modular encounter sets from UI launch ([`App.tsx`](src/ui/App.tsx)).
- **Data Architecture & Scenarios: Data-Driven Encounter Stage Resolution (`CardCatalog.getMainSchemeByStage` / `getVillainByStage`):**
  - Added `getMainSchemeByStage(scenarioSetCode, stage)` and `getVillainByStage(scenarioSetCode, stage)` to `CardCatalog` ([`card-loader.ts`](src/data/importer/card-loader.ts)), matching the `getHeroIdentity()` lookup pattern to resolve cards dynamically by their canonical `stage` metadata (`"1B"`, `"2B"`, `"3B"`, `"I"`, `"II"`, `"III"`).
  - Fixed scenario initialization across **Rhino**, **Klaw**, and **Ultron** scenario plugins ([`rhino/plugin.ts`](src/engine/scenarios/built-in/rhino/plugin.ts), [`klaw/plugin.ts`](src/engine/scenarios/built-in/klaw/plugin.ts), [`ultron/plugin.ts`](src/engine/scenarios/built-in/ultron/plugin.ts)) to load active Stage 1B cards (`01097b`, `01116b`, `01137b`) and advance through stages dynamically without arbitrary array indexing or hardcoded card codes.
- **UI Layout: Space-Saving 2-Column Hero Hand Tray (`PlayerHandTray.tsx`):**
  - Refactored `PlayerHandTray` from a stacked 2-row layout into a streamlined **2-column layout** (Column 1: left vertical sidebar stacking Draw Deck, +Add tutor, Discard Pile, and Nemesis Set buttons; Column 2: wide horizontal card fan-out area).
  - Tightened vertical padding and card container boundaries (`cardWidth: 112`, `min-h-[160px]`, `items-center`), eliminating excess white space above/below hand cards and maximizing vertical screen real estate for playmats.
- **Bug Fix: Single-Hero Hand Tray Viewport Containment & Unified Fan-Out Architecture (`PlayerHandTray.tsx`, `GameBoard.tsx`):**
  - Resolved viewport overflow in single-hero mode by eliminating the separate, oversized sticky footer dock and standardizing `PlayerHandTray` on the proven, compact `useHandFanLayout` algorithm (`size="sm"`, `cardWidth: 128`, `defaultGap: 12`, `padding: 24`).
  - Embedded `PlayerHandTray` directly below `HeroZone` within the solo tabletop container, matching the multi-hero station experience with responsive dynamic overlap, clean status indicators, and full-fidelity hover zoom.
- **Dev Tooling & Telemetry: Automated GameState Snapshot Recording (`logs/gamestates/`):**
  - Added `gameStateSnapshotPlugin` to Vite dev server to intercept `POST /api/logs/gamestate` and automatically persist `logs/gamestates/latest_gamestate.json` along with rolling timestamped archives (`gamestate_{timestamp}_rnd{round}_{phase}.json`).
  - Added `gamestate-logger-service.ts` and wired `useEffect` snapshotting on state transitions in `App.tsx`.
  - Added a manual **"📸 Save Snapshot"** button in `OptionsMenu.tsx` (Options Modal & Dev Mode) with visual feedback.
  - Linked snapshot inspection directly into Step 1 and Step 2 of the `bug-fix` skill for rapid triage and 100% faithful test fixture generation.
- **Dev Tooling & Agents: Standardized `bug-fix` Skill (`.agents/skills/bug-fix/SKILL.md`):**
  - Created a deterministic 6-step Test-Driven Development (TDD) protocol skill for triaging, reproducing, diagnosing, fixing, and verifying bugs across the rules engine, UI, data, and asset layers.
  - Enforces failing regression tests first, 3-tier blast-radius guardrails, structured execution logging to `logs/skills/`, and automatic execution of the mandatory 7-point post-task protocol.
- **UI Layout: Permanently Fixed Top Navigation Bar (`TopBar.tsx`, `GameBoard.tsx`):**
  - Converted the TopBar from `sticky` to `fixed top-0 left-0 right-0 z-40`, guaranteeing that the round badges, phase indicator, multi-hero jump selector, Daily Bugle, and combat log controls remain permanently pinned to the top of the viewport regardless of board scrolling.
  - Added dedicated top padding (`pt-20 md:pt-24`) to the panoramic tabletop stage to prevent overlap.
- **UI Polish: Interactive Font Cycling in Combat Log (`CombatLogDrawer.tsx`, `ComicSpeechBalloon.tsx`):**
  - Added a dedicated **"Cycle Font"** button in the Combat Log footer beside "Show Debug" to dynamically cycle and live-preview comic dialogue typography between **Komika Text**, **Comic Relief**, **Comic Neue**, **Clean (Inter)**, and **Bangers**.
  - Persisted user font selection in `localStorage` (`'mcd_combat_log_font'`).
- **UI Polish: Authentic Local-Bundled Comic Dialogue Typography (`Komika Text`, `Comic Relief`, & `Bangers`):**
  - Integrated and bundled **`Komika Text`** (Apostrophic Labs comic dialogue standard via `@typopro/dtp-komika-text`), **`Comic Relief`** (official [`loudifier/Comic-Relief`](https://github.com/loudifier/Comic-Relief) via `@fontsource/comic-relief`), and **`Bangers`** directly into local game resources (`public/fonts/`, `src/assets/fonts/`, `src/ui/styles/index.css`, `tailwind.config.js`).
  - Completely decoupled font delivery from external CDNs, ensuring 100% offline font availability with zero flash-of-unstyled-text (FOUT) across dev and standalone production builds (`dist/assets/*.woff2`).
- **UI Polish: Large-Scale Readable Visual Cards & Banners (`ComicSpeechBalloon.tsx`, `TopBar.tsx`):**
  - Significantly enlarged the Narrator dispatch cards (`HEROES ASSEMBLE!`, `NEW ROUND!`, `DANGER STRIKES!`) with heavier comic typography, expanded padding (`p-4`), prominent onomatopoeia banners (`text-sm sm:text-base font-black px-3 py-1`), and heavy drop shadows (`shadow-comic`).
  - Scaled up the TopBar Round badge (`text-xl px-4 py-1`) and Phase transition badge (`text-base px-4 py-1.5 font-black`) for effortless legibility.
- **UI Polish: Root 110% Base UI Scaling (`src/ui/styles/index.css`):**
  - Enhanced the overall application scale by configuring `html { font-size: 110%; }` in Tailwind base layers, uniformly scaling cards, tableaus, boards, modals, and typography by +10% without requiring browser manual zoom adjustments.
- **UI Polish: Comic Book Dialogue Game Log & Narrative Stream (ADR-0005, ADR-0009, ADR-0037):**
  - Overhauled [`src/ui/components/board/CombatLogDrawer.tsx`](src/ui/components/board/CombatLogDrawer.tsx) from raw JSON dumps into an authentic, living **1960s Comic Book Dialogue & Story Stream**.
  - Implemented 4-tier visual dialogue differentiation via [`src/ui/components/board/ComicSpeechBalloon.tsx`](src/ui/components/board/ComicSpeechBalloon.tsx):
    - **Hero Speech Balloons (`hero_speech`):** White rounded speech balloon with pointer tail, avatar badge (`🕷️ SPIDER-MAN`), in-character quips, and action prose with damage/threat/cost pills.
    - **Alter-Ego Thought Balloons (`hero_thought`):** Scalloped cloud thought balloons for recovery and planning.
    - **Villain Spiky Burst Balloons (`villain_shout`):** Jagged crimson burst balloons with aggressive capitalized shouting threats and attack/scheme actions.
    - **Stan Lee Yellow Caption Boxes (`narrator_caption`):** Golden-yellow rectangular narration boxes (`bg-comic-yellow`) with comic panel headers for round upkeep, phase transitions, and deck exhaustion.
  - Implemented pure narrative formatting and template interpolation engine in [`src/ui/utils/comic-log-formatter.ts`](src/ui/utils/comic-log-formatter.ts).
  - Built multilingual localization dictionaries ([`src/locales/en/combat-log.json`](src/locales/en/combat-log.json), [`src/locales/fr/combat-log.json`](src/locales/fr/combat-log.json)) supporting dynamic on-the-fly language switching and localized onomatopoeias (`POW!` vs. `VLAM !`, `THWIP!` vs. `TCHWIP !`).
  - Authored [**ADR-0037**](docs/decisions/0037-comic-dialogue-presentation-and-voice-localization-engine.md) and updated **ADR-0005**, **ADR-0009**, and master ADR index.
- **UI Polish: Comic Book Carousel Scenario Selector (`ScenarioSelector.tsx`):**
  - Designed and deployed an authentic **1960s Pop-Art Comic Book Carousel** for scenario setup.
  - Implemented an open two-page comic spread featuring:
    - **Left Page (Villain Dossier):** Stage-appropriate Villain card preview (`CardView`), subtitle, and hit points formula badge.
    - **Right Page (Main Scheme Setup):** Main Scheme Stage 1A card preview (`CardView`), setup rules text, and mission briefing.
    - **Spine & Binding Details:** Center fold binding crease, realistic paper texture with halftone pattern, and silver staples.
    - **Vintage Comic Badges:** Price box ("12¢"), Comics Code Authority seal, and issue number banner ("Issue #1 of 3: Rhino").
  - Implemented page-flip navigation (`◀ PREV ISSUE` and `NEXT ISSUE ▶`) and quick-jump scenario issue buttons.
  - Positioned **Encounter Sets & Modular Customizer** and **Difficulty Selection (Skirmish, Standard, Expert + Heroic Mode)** directly below the comic book spread.
  - Re-architected card art URL resolution in [`src/ui/services/card-cache-service.ts`](src/ui/services/card-cache-service.ts) using `getCardArtFileName`: directly reads `card.type` (`type_code`) and `card.stage` to accurately map Main Scheme Stage 1A cards (e.g. `01097a` $\rightarrow$ `01097.png`), Stage 1B cards (e.g. `01097b` $\rightarrow$ `01097b.png`), Hero faces (`01001a` $\rightarrow$ `01001a.png`), and Alter-Ego faces (`01001b` $\rightarrow$ `01001b.png`).
  - Implemented **Local-First Static Card Asset Serving** for complete offline play: configured Vite dev server plugin in [`vite.config.ts`](vite.config.ts) and production bundle asset pipeline to serve disk-cached card assets at `/cards/:fileName` with automatic fallback to MarvelCDB CDN.
- **Milestone 2D: Table Invariants, Deck Exhaustion & Core Set Promotion Pass (Inbox Zero):**
  - **Sub-Milestone 2D-1 (Restricted Keyword & Global Unicity Invariants - RR v1.8 p. 25, 29 / ADR-0018):**
    - Implemented `Keyword` parser and dynamic restricted limit validator (`isCardRestricted`, `getCardRestrictedWeight`, `getPlayerRestrictedLimit`, `getPlayerRestrictedCount`) in [`src/engine/pipeline/legality-checker.ts`](src/engine/pipeline/legality-checker.ts).
    - Supported heavy items ("counts as 2 restricted cards") and dynamic limit expansion modifiers (`RESTRICTED_LIMIT_BONUS`).
    - Implemented global unicity engine (`checkUniqueCardPlayable`) validating unicity across all player tableaus, player allies, engaged minions, and active in-game Hero/Alter-Ego identities (e.g. preventing _Captain Marvel_ ally when _Carol Danvers_ is in play).
  - **Sub-Milestone 2D-2 (Deck Exhaustion & Discard Loop Invariants - RR v1.8 p. 11, 18, 26):**
    - Centralized deck exhaustion in [`src/engine/pipeline/deck-exhaustion.ts`](src/engine/pipeline/deck-exhaustion.ts) with `exhaustPlayerDeck`, `exhaustEncounterDeck`, `drawPlayerCard`, and `drawEncounterCard`.
    - Enforced unconditional penalty invariant: 1 permanent acceleration token placed on Main Scheme on Encounter deck depletion; 1 facedown encounter card dealt to player on Player deck depletion.
    - Enforced search & discard loop termination invariants: searches terminate cleanly if target is not in searched zone; discard loops (`discardFromEncounterDeckUntil`, `discardFromPlayerDeckUntil`) immediately STOP if deck empties and trigger sequential exhaustion without discarding into reshuffled deck.
  - **Sub-Milestone 2D-3 & 2D-4 (Core Set & Aspect Card Promotions — 100% Inbox Zero):**
    - Implemented effect primitives: `MODIFY_COUNTER`, `RETURN_TO_HAND`, `REPULSOR_BLAST`, `GENERATE_TOP_DISCARD_RESOURCES`, `RETRIEVE_TECH_UPGRADE_FROM_DISCARD`, `SEARCH_DECK_FOR_CARD`, `SHUFFLE_DISCARD_INTO_DECK`, `EXECUTE_WAKANDA_FOREVER`, `DEAL_DAMAGE_ALL_ENEMIES`, `TRANSFER_DAMAGE`, `BOOST_STAT_CHOICE`, `BUFF_ALL_FRIENDLY_CHARACTERS`, `CANCEL_WHEN_REVEALED_AND_REVEAL_ANOTHER`, `ATTACH_FACEDOWN_CARDS_FROM_HAND`, `RETURN_FACEDOWN_CARDS_TO_OWNERS`.
    - Promoted all 23 remaining ambiguity cards across Core Set Heroes (_Captain Marvel's Helmet_, _Energy Channel_, _Hellcat_, _Superhuman Strength_, _Repulsor Blast_, _Pepper Potts_, _Stark Tower_, _T'Challa_, _Shuri_, _Ancestral Knowledge_, _Wakanda Forever!_, _Energy Daggers_, _Vibranium Suit_), Aspect cards (_Vision_, _Get Ready_, _Lead from the Front_, _Black Widow_, _Tenacity_), and Encounter pool (_Highway Robbery_).
    - Resolved and deleted all 23 ambiguity reports in `docs/ambiguities/` achieving **100% Inbox Zero (0 open ambiguities)**.
    - Verified 247/247 tests passing across 46 test suites with 0 typecheck errors and clean production build.
  - **Quality Gate & Data Integrity Guardrails (Duplicate JSON Key Detector):**
    - Built and integrated character-by-character AST duplicate key detector ([`src/data/supplemental/duplicate-key-detector.ts`](src/data/supplemental/duplicate-key-detector.ts)).
    - Fixed duplicate card entries in `core_encounter.json` (`01164`, `01168`, `01173`, `01178`) by unifying their `WHEN_REVEALED` and `BOOST` abilities into single multi-ability entries.
    - Enforced duplicate key checks in CI/CD schema test suite ([`tests/data/supplemental-schema.test.ts`](tests/data/supplemental-schema.test.ts)) and declaration usage analyzer ([`tools/audit/supplemental-declarations-analyzer.ts`](tools/audit/supplemental-declarations-analyzer.ts)).
- **Approved Architecture Decision Records (ADR-0034, ADR-0035, ADR-0036):**
  - Formally approved and promoted to **Accepted** status:
    - [`ADR-0034: Player Side Schemes, Victory Display & Auxiliary Scenario Decks Architecture`](docs/decisions/0034-player-side-schemes-victory-display-and-auxiliary-decks.md)
    - [`ADR-0035: Universal Multi-Form Identities, Mass/Energy States & Generic Counter Engine`](docs/decisions/0035-universal-multi-form-identities-and-generic-counter-engine.md)
    - [`ADR-0036: Advanced Status Card Dynamics & Minion Activation Modifiers`](docs/decisions/0036-advanced-status-card-dynamics-and-minion-activations.md)
- **Milestone 2C Implementation: Scenario Setup & Modular Plugin Pipeline (ADR-0033):**
  - Implemented the official 15-step scenario setup sequence (RR v1.8 p. 27–28) in [`src/engine/state/game-setup.ts`](src/engine/state/game-setup.ts).
  - Enforced Step 1 `Permanent` keyword handling (cards with `Keyword.PERMANENT` are put directly into play in player tableaus and excluded from draw decks).
  - Enforced Step 4 & Step 11 0-to-many player obligations support (`obligations?: NormalizedCard[] | NormalizedCard`).
  - Supported Skirmish (Stage I only), Standard (Stages I & II), and Expert (Stages II & III) game modes with scaled villain hit points ($H \times N$).
  - Standardized scenario plugins for **Rhino** ([`src/engine/scenarios/built-in/rhino/`](src/engine/scenarios/built-in/rhino/)), **Klaw** ([`src/engine/scenarios/built-in/klaw/`](src/engine/scenarios/built-in/klaw/)), and **Ultron** ([`src/engine/scenarios/built-in/ultron/`](src/engine/scenarios/built-in/ultron/)).
  - Implemented declarative Stage 1A setup hooks (`resolveStage1ASetup`):
    - Klaw Stage 1A: _Defense Network_ (`01124`) side scheme search/reveal and starting minion engagement deal.
    - Ultron Stage 1A: _Ultron Drones_ (`01140`) environment card deployment and starting 1 HP/1 ATK/1 SCH drone minion spawning.
  - Updated [`src/ui/components/setup/ScenarioSelector.tsx`](src/ui/components/setup/ScenarioSelector.tsx) with modular encounter set customizer, mandatory set badges (`[🔒 MANDATORY]`), and default reset button.
  - Added test suites: [`tests/engine/scenario-setup-15-steps.test.ts`](tests/engine/scenario-setup-15-steps.test.ts), [`tests/engine/scenario-plugins-klaw-ultron.test.ts`](tests/engine/scenario-plugins-klaw-ultron.test.ts), and [`tests/engine/scenario-modular-customization.test.ts`](tests/engine/scenario-modular-customization.test.ts) (217 total tests passing).
- **Catalog Expansion Architecture Records (ADR-0034, ADR-0035, ADR-0036):**
  - Authored `ADR-0034: Player Side Schemes, Victory Display & Auxiliary Scenario Decks Architecture` (Proposed) supporting voluntary player side schemes (35 cards), permanent `state.victoryDisplay` zone, and scenario auxiliary decks (_Infinity Gauntlet_, _Holding Cell_, _Evidence_).
  - Authored `ADR-0035: Universal Multi-Form Identities, Mass/Energy States & Generic Counter Engine` (Proposed) supporting 3-sided identities (_Ant-Man_, _Wasp_), Mass/Energy states (_Spectrum_, _Vision_, _Shadowcat_), and universal `counters: Record<string, number>` map.
  - Authored `ADR-0036: Advanced Status Card Dynamics & Minion Activation Modifiers` (Proposed) supporting `Stalwart` immunity, `Steady` 2-card thresholds, `Villainous` minion boosts, `Quickstrike` entry combat, and `Incite`/`Hinder` entry modifiers.
  - Updated `docs/decisions/README.md` lineage graph and registered all three records.
  - Expanded `docs/roadmap_and_milestones.md` Phase 3 (Multi-Hero `Alliance`/`Team-Up`) and Phase 5 (Milestones 5A, 5B, 5C).
- **Sub-Milestone 2B-3 Implementation: Damage Prevention, Overkill, Retaliate & Direct Damage Invariant (ADR-0031):**
  - Implemented universal damage prevention interrupt processing in Step 6 (`PREVENT_DAMAGE`) with _Backflip_ (`01003`) and _Cosmic Flight_ (`01017`).
  - Enforced Tough status preservation invariant: `StatusCard.TOUGH` is preserved when incoming damage is mitigated down to 0, and consumed only when unmitigated damage $> 0$.
  - Implemented bidirectional **Overkill** keyword routing:
    - Enemy $\rightarrow$ Defending Ally $\rightarrow$ Hero Identity: Excess attack damage beyond defending ally's hit points deals direct damage to Hero identity upon ally defeat.
    - Player $\rightarrow$ Minion $\rightarrow$ Villain: Excess player attack damage beyond target minion's hit points deals direct damage to Villain upon minion defeat (_Relentless Assault_ `01053`).
  - Implemented **Retaliate X** return damage in Step 7 for surviving heroes and minions (_Whiplash_ `01172`).
  - Added formal `dealDirectDamage` engine helper bypassing DEF mitigation and ally blocks while respecting Tough absorption and universal damage prevention.
  - Added `SUFFERED_DAMAGE` formula (_Gamma Slam_ `01021`), `HULK_DISCARD_RESOLUTION` (_Hulk_ `01050`), and `ADD_TRAIT` (_Cosmic Flight_ `01017`).
  - Promoted 8 Core Set cards to 100% confidence: _Backflip_ (`01003`), _Enhanced Spider-Sense_ (`01004`), _Cosmic Flight_ (`01017`), _Gamma Slam_ (`01021`), _Hulk_ (`01050`), _Tigra_ (`01051`), _Relentless Assault_ (`01053`), _Uppercut_ (`01054`).
  - Pruned 4 ambiguity reports from `docs/ambiguities/` (Inbox Zero).
  - Added unit test suite [`tests/engine/combat-damage-prevention-and-overkill.test.ts`](tests/engine/combat-damage-prevention-and-overkill.test.ts) (10 tests, 207 total tests passing).
- **Roadmap Expansion: Table Invariants, Restricted Keyword & Deck Depletion (Milestone 2D / RR v1.8):**
  - Formalized specifications for the **Restricted Keyword Engine** (max 2 limit, heavy item slot weights, dynamic modifiers, voluntary discard replacement prompts per RR v1.8 p. 25).
  - Formalized specifications for **Global Unicity & Identity Collision** (evaluating unicity across all player tableaus, allies, and Hero identities per RR v1.8 p. 29).
  - Formalized specifications for **Mid-Action Player & Encounter Deck Exhaustion Invariants** (immediate reshuffle + acceleration / facedown encounter card penalty per RR v1.8 p. 11, 18).
- **Sub-Milestone 2B-2 Implementation: 0-to-Many Boost Queue, Star Abilities (★) & Boost Chaining (ADR-0031):**
  - Implemented the 0-to-many boost deal queue (Step 4) supporting 0 boost cards for minion attacks, 1 base boost card for villain attacks, and multiple boost cards for extra-boost villains (e.g. Klaw) and attachments.
  - Implemented the iterative 1-by-1 FIFO boost resolution loop in `step4_and_5_dealAndResolveBoostCards` in `combat-pipeline.ts`.
  - Added support for `WHEN_BOOST_CARD_REVEALED` interrupt trigger window and declarative ★ Star Boost ability resolution (`timing === 'BOOST'` or `trigger === 'BOOST'`).
  - Added generic boost effect primitives in `src/engine/effects/index.ts`: `GIVE_ADDITIONAL_BOOST_CARD` / `DEAL_ADDITIONAL_BOOST_CARD`, `PUT_INTO_PLAY_ENGAGED`, `DISCARD_CARDS_FROM_HAND_AT_RANDOM`, and `DISCARD_UPGRADE_OR_SUPPORT`.
  - Supported dynamic boost card chaining (appending new boost cards into `activeAttackContext.boostQueue` mid-loop).
  - Promoted Core Set Star Boost encounter cards (_Titania's Fury_ `01164`, _Sweeping Swoop_ `01168`, _Electric Whip Attack_ `01173`, _Kree Manipulator_ `01178`) to 100% confidence.
  - Added test suite [`tests/engine/combat-boost-and-star-abilities.test.ts`](tests/engine/combat-boost-and-star-abilities.test.ts) (7 new tests, 197 total tests passing).
- **Sub-Milestone 2B-1 Implementation: Core Combat Lifecycle & Defender Declaration Engine (ADR-0031):**
  - Created dedicated combat module [`src/engine/pipeline/combat-pipeline.ts`](src/engine/pipeline/combat-pipeline.ts) implementing the 7-step combat lifecycle.
  - Implemented Step 1 Stun & Webbed Up cancellation intercepts and Step 2 Initiation triggers (`VILLAIN_INITIATES_ATTACK` / _Spider-Sense_ card draw).
  - Implemented Step 3 `DECLARE_DEFENDER` modal prompt with Basic Hero Defend (exhausts hero, mitigates attack with `Hero.DEF`, sets `heroDefended = true`), Ally Block (exhausts ally, ally absorbs attack up to HP), and Take Undefended ($\text{DEF} = 0$).
  - Added headless synchronous execution helper with configurable defense policy (`TAKE_UNDEFENDED`, `HERO_IF_READY`, `ALLY_CHUMP_BLOCK`, `AUTO_OPTIMAL`).
  - Added `DeclareDefenderAction` action handler in `action-dispatcher.ts` and refactored `villain-phase.ts` to route attacks through `combat-pipeline.ts`.
  - Promoted _Armored Vest_ (`01081`) and _Indomitable_ (`01082`) to 100% confidence.
  - Added test suite [`tests/engine/combat-pipeline-step1-3.test.ts`](tests/engine/combat-pipeline-step1-3.test.ts) (9 new tests, 190 total tests passing).

## [Unreleased]

### Added
- **Gate 1: The "Rhino Release" Vertical Slice Governance (`AGENTS.md`, `roadmap_and_milestones.md`, `skills`):** Realigned all project roadmaps, prioritization engines (`next-task`), and development skills (`feature-delivery`, `bug-fix`, `card-integration-protocol`) around a strict scope boundary: delivering 100% of Core Set Player cards (101 cards across 5 Heroes + 4 Aspects + Basic) and the Rhino Scenario (34 cards: Rhino I/II/III, Standard, Expert, Bomb Scare, and 5 Nemesis Sets). Non-Rhino villains (Klaw, Ultron) and expansion mechanics are strictly deferred to subsequent release gates.

- **Supplemental Retrofit & Audit Metadata Protocol (`AGENTS.md`, `feature-delivery`, `bug-fix`):** Mandatory rule requiring agents to search `src/data/supplemental/pack/*.json` for all cards affected by any engine, primitive, keyword, or timing changes, retrofit the updated declarative definitions, and update `"updatedAt"`, `"reviewedAt"`, and `"reviewedBy"` metadata with current ISO timestamps.
- **Declarative Data-First Invariant (`AGENTS.md`, `bug-fix`, `feature-delivery`):** Architectural rule mandating that card-specific defects must always be triaged and audited against `src/data/supplemental/` first, avoiding bespoke engine functions and ensuring fixes are classified as Tier 1 Data-Only fixes whenever existing primitives suffice.

- **Mandatory Usage Audit Protocol Enforcement (`AGENTS.md` & `SKILL.md`):**
  - Updated Point 7 of the Mandatory Post-Task Protocol in `AGENTS.md` to require running `npm run report:declarations` (or `npx tsx tools/audit/supplemental-declarations-analyzer.ts`) whenever cards, abilities, effects, or ambiguity reports change.
  - Updated Step 8 Verification Protocol in `.agents/skills/card-integration-protocol/SKILL.md` to mandate running the declarations analyzer on every card modification.
  - Added audit verification instructions and updated schema specification links in `docs/guidelines/hero_creation_guide.md` and `docs/guidelines/scenario_creation_guide.md`.
- **Milestone 2A Implementation: Universal Resolution Stack & Decision Prompt Queue (ADR-0032):**
  - Implemented `ExecutionFrame` resolution stack (`executionStack`) and serializable FIFO prompt queue (`pendingDecisionQueue`) in `src/engine/pipeline/prompt-queue.ts`.
  - Added support for voluntary reaction windows with dedicated "Pass / Do Nothing" options in `DecisionPromptModal.tsx` and visual queue depth badges (`QUEUE: 1 OF 2`).
  - Added `READY_IDENTITY`, `CANCEL_WHEN_REVEALED_AND_ATTACK`, and `TAKE_THREAT_AS_DAMAGE` composable generic effect primitives in `src/engine/effects/index.ts`.
  - Promoted 5 Core Set ambiguity cards to 100% confidence with full ability declarations: _Emergency_ (`01085`), _Great Responsibility_ (`01061`), _Get Behind Me!_ (`01078`), _One-Two Punch_ (`01024`), and _Counter-Punch_ (`01077`).
  - Pruned 5 ambiguity reports in `docs/ambiguities/` (reduced open ambiguities from 32 down to 27).
  - Added comprehensive test suite `tests/engine/resolution-stack-and-prompt-queue.test.ts` (8 new tests, 181 total tests passing).
- **ADR Lifecycle & Lineage Evolution Registry (`docs/decisions/README.md`):**
  - Added visual Mermaid Lineage & Evolution graph mapping relationships across Foundation, Declarative Data, Combat, and Setup pipelines.
  - Formally updated superseded status on `ADR-0010` (superseded by `ADR-0033`), `ADR-0020` (superseded by `ADR-0032`), and `ADR-0028` (superseded by `ADR-0030`).
- **Universal Resolution Stack & Nested Interrupt Pipeline (ADR-0032 / RR v1.8 p. 16, 24):**
  - Formulated the frame-based execution stack (`executionStack`) and multi-prompt queue (`pendingDecisionQueue`) replacing single prompt overwrites.
  - Authored `docs/decisions/0032-universal-resolution-stack-decision-prompt-queue-and-nested-interrupts.md` (Accepted) to support 318 Interrupt cards and 451 Response cards across all official packs.
- **Official 15-Step Scenario Setup Engine & Modular Plugin Pipeline (ADR-0033 / RR v1.8 p. 27–28):**
  - Formulated the declarative `ScenarioPlugin` interface and standardized 15-step setup protocol (`createGame(scenarioConfig, playerConfigs)`).
  - Authored `docs/decisions/0033-official-15-step-scenario-setup-engine-and-modular-plugin-pipeline.md` (Accepted) supporting all 62 official scenario Stage 1A setups, modular encounter customization, and `ScenarioSelector.tsx` UI integration.
- **Comprehensive Combat, Enemy Attack & Multi-Window Defense Pipeline (ADR-0031 / RR v1.8 p. 4, 7, 11, 24):**
  - Formulated the 5-phase reactive enemy attack state machine: Phase 1 (Initiation/Spider-Sense), Phase 2 (Defender Declaration / Basic Hero DEF / Ally blocks / Co-op), Phase 3 (Boost resolution / Boost cancellations), Phase 4 (Damage calculation / DEF subtraction / Damage prevention / Tough / Overkill), and Phase 5 (Post-defense responses / Retaliate).
  - Established the Direct Damage Invariant: non-attack damage bypasses DEF and ally blocks, prohibiting attack-specific defense cards while preserving universal prevention (_Cosmic Flight_, _Tough_).
  - Authored `docs/decisions/0031-comprehensive-combat-enemy-attack-and-multi-window-defense-pipeline.md` and integrated into Milestone 2B of `docs/roadmap_and_milestones.md`.
- **Strategic Roadmap & Milestone Architecture Realignment (`docs/roadmap_and_milestones.md`):**
  - Re-anchored the development roadmap on a **Capability-First, Headless-Simulation-Driven** milestone sequence to minimize tech debt and eliminate card-by-card refactor loops.
  - Sequenced foundational engine pipelines (**Milestone 2A: Universal Resolution Stack & Prompt Queue / ADR-0032**, **Milestone 2B: Unified Combat & Damage Event Pipeline / ADR-0031**, **Milestone 2C: Scenario Setup & Modular Plugin Pipeline / ADR-0033**) ahead of card batch promotion (**Milestone 2D: The Great Core Set Promotion Pass / Inbox Zero**).
  - Placed **Automated Headless Match Simulation** (Phase 3) as the quality gate prior to Tabletop UI polish (Phase 4).
- **Documentation & Protocol Link Resolution:**
  - Fixed relative path depth resolution in `.agents/skills/card-integration-protocol/SKILL.md` (pointing from 3 directory levels deep to `../../../docs/` and `../../../references/`).
  - Fixed relative reference link in `docs/decisions/0007-official-rules-authority-rr-v18.md` (`../../references/`).
  - Validated 100% of markdown links across `docs/` and `.agents/`.
- **Unified Constant Card Zoom Scaling & Custom Magnification Settings (UI/UX Improvement):**
  - Standardized hover zoom scaling across all card sizes (`sm`, `md`, `lg`, `xl`) and orientations (portrait vs. landscape) in `CardView.tsx`.
  - Replaced the fixed multiplier ($1.9\times$) with size-adaptive scale factors (`sm` portrait $2.75\times$, `md` portrait $1.75\times$, `sm` landscape $2.5\times$, `md` landscape $1.72\times$), ensuring cards in Hand, Hero Zone, Tableau, Villain Zone, and Schemes all scale to the exact same readable target preview dimensions (~308px portrait width, ~440px landscape width).
  - Added user-configurable **Card Zooming** preference to `OptionsMenu.tsx` and persistent `GameSettingsContext.tsx` with three magnification presets: **Small (90%)**, **Normal (100%, default)**, and **Larger (110%)**.
  - Updated viewport boundary collision detection in `CardView.tsx` and tooltip labels in `PlayerHandTray.tsx`.
- **Unified Ability Step Sequence Architecture & Supplemental Data Normalization (ADR-0030 / RR v1.8):**
  - Strictly decoupled ability declaration headers (`CardAbility`: timing, trigger, cost, limit, errata, tags) from execution operations (`AbilityStep[]`: effect, params, gate, filter), eliminating top-level effect duality and conditional branching.
  - Updated Zod schema `CardAbilitySchema` to mandate `steps: z.array(AbilityStepSchema).min(1)` and removed deprecated top-level `effect`, `params`, `gate`, `filter`, and recursive `sequence`.
  - Created automated migration tooling `tools/migrate-supplemental-to-steps.ts` and migrated 100% of supplemental card packs (`core.json` and `core_encounter.json` across 115 cards and 128 abilities).
  - Refactored core execution engine `src/engine/effects/index.ts` to process unified `AbilityStep` sequences with `executeSequence` and `executeStep`, supporting conditional gating (`ALWAYS`, `THEN`, `IF_AMOUNT_ZERO`, `IF_ALREADY_HAS_STATUS`, `IF_FAILED`) and contextual entity flow.
  - Updated pipeline and rules modules (`action-dispatcher.ts`, `legality-checker.ts`, `stat-calculator.ts`, `villain-phase.ts`, `round-upkeep.ts`, `trigger-dispatcher.ts`, `player-bot.ts`) to query declarative steps.
  - Updated UI modals (`CardPaymentModal.tsx`, `IdentityActionModal.tsx`) and audit tool `tools/audit/supplemental-declarations-analyzer.ts` to inspect step arrays.
  - Updated `.agents/skills/card-integration-protocol/SKILL.md` (Step 3 schema template and Step 5 decompiler protocol) and supplemental specifications suite (`09_sequences_and_prompts.md`, `hero_creation_guide.md`).
  - Verified with 100% passing test suite across all 35 test files and 171 tests (`npm test && npm run typecheck && npm run build`).
- **Generic Zone Transfer & Deck Manipulation Primitives (ADR-0029 / RR v1.8 p. 14, 33):**
  - Implemented generic `PUT_INTO_PLAY` (`from`, `to`, `filter`) resolving Toughness/Guard keywords, side scheme base threat calculations, and entrance trigger responses.
  - Implemented generic `SHUFFLE_INTO_DECK` (`from`, `toDeck`, `filter`) supporting set-aside, discard, and hand card transfers to Encounter and Player decks.
  - Enhanced `shouldExecuteStep` with targeted step result lookup (`targetStepId`) via `stepResultsMap`.
  - Decomposed _Shadow of the Past_ (`01190`) from monolithic `SPAWN_NEMESIS` into a declarative 4-step sequence (`PUT_INTO_PLAY` Minion $\rightarrow$ `PUT_INTO_PLAY` Scheme $\rightarrow$ `SHUFFLE_INTO_DECK` $\rightarrow$ `TRIGGER_SURGE` `gate: IF_FAILED`).
  - Added dedicated test suite `tests/engine/shadow-of-the-past-sequencing.test.ts` verifying both standard and fallback Surge cases.
  - Updated specification `docs/specifications/supplemental/05_effects_zones_cards.md` to `🟢 IMPLEMENTED (v1.0)`.
- **Declarative Effect Sequencing & Conditional Gates Pipeline (ADR-0028 / RR v1.8 p. 2, 24):**
  - Extended `CardAbilitySchema` and engine pipeline with recursive `sequence: CardAbility[]` array.
  - Implemented `ConditionGate` supporting `'ALWAYS'`, `'THEN'`, `'IF_PREVIOUS_SUCCESS'`, `'IF_AMOUNT_ZERO'`, `'IF_ZERO_HEALED'`, `'IF_FAILED'`, `'IF_ALREADY_HAS_STATUS'`, and `'IF_RESOURCE_MATCH'`.
  - Added contextual entity and target passing (`target: "PREVIOUS_TARGET"`, `"PREVIOUS_SELECTED_CARD"`).
  - Decomposed core set composite single-use primitives: _Split Personality_ (`01025`), _Hard to Keep Down_ (`01104`), _"I'm Tough"_ (`01105`), and _Under Fire_ (`01193`).
  - Added comprehensive test suite in `tests/engine/effect-sequences-and-gates.test.ts`.
  - Updated specification `docs/specifications/supplemental/09_sequences_and_prompts.md` to `🟢 IMPLEMENTED (v1.0)`.
- **False-Vanilla Encounter Cards Remediation & Quality Gate Gate:**
  - Audited `core_encounter.json` to eliminate invalid `"noSupplementalNeeded": true` flags on cards with active printed rules text.
  - Implemented and promoted active declarations for _Personal Challenge_ (`01161`), _Imminent Overload_ (`01171`), _The Psyche-Magnitron_ (`01176`), and _Kree Manipulator_ (`01178`).
  - Isolated _Highway Robbery_ (`01166`) with Circuit-Breaker into `docs/ambiguities/core_encounter_01166_highway_robbery.md` pending facedown scheme attachment engine mechanics.
  - Added automated CI unit test in `tests/data/supplemental-schema.test.ts` ensuring no card with printed rules text can ever be marked `noSupplementalNeeded: true`.
- **Card Integration Protocol Ambiguity Alignment & Promotions:**
  - Ran Card Integration Protocol across all 39 cards in `docs/ambiguities/`.
  - Promoted 8 fully implemented cards to $\ge 98\%$ confidence and pruned their ambiguity reports (Inbox Zero): _Armored Vest_ (`01081`), _Indomitable_ (`01082`), _Helicarrier_ (`01092`), _Make the Call_ (`01071`), _The Power of Aggression_ (`01055`), _The Power of Justice_ (`01062`), _The Power of Leadership_ (`01072`), and _The Power of Protection_ (`01079`).
  - Aligned all 31 remaining blocked cards with strict Circuit-Breaker isolation: active `abilities: [...]` stripped, `"ambiguityFile"` metadata stamped, and logs recorded in `logs/skills/card_integration_2026-08-30.log`.
- **Supplemental Declarations Usage & Impact Analyzer Tool (`tools/audit/`):**
  - Built automated analytics tool `tools/audit/supplemental-declarations-analyzer.ts` and `npm run report:declarations` script.
  - Automatically parses all supplemental card definitions (`src/data/supplemental/pack/*.json`) and generates comprehensive impact reports in [`docs/reports/supplemental_declarations_usage_report.md`](docs/reports/supplemental_declarations_usage_report.md).
  - Categorizes primitives by blast-radius impact ($\ge 5$ cards), single-use specialization ($= 1$ card), and zero-usage specifications ($= 0$ cards) to guide decomposition and refactoring decisions.
- **Documentation Architecture Consolidation:**
  - Consolidated legacy `docs/specs/` directory into authoritative `docs/specifications/` hub.
  - Relocated `docs/specs/card-mechanics-breakdown.md` to [`docs/specifications/card_mechanics_breakdown.md`](docs/specifications/card_mechanics_breakdown.md) and pruned `docs/specs/`.
  - Updated all internal links across `CHEATSHEET.md`, `docs/README.md`, `ADR-0021`, and skill protocols.
- **Modular Phase Pipelines & Lifecycle Hooks Architecture (ADR-0027 / RR v1.8 p. 15, 22, 32):**
  - Refactored monolithic phase logic into single-responsibility modules:
    - `src/engine/pipeline/player-phase.ts`: Implemented `startPlayerPhase`, `endPlayerPhase`, and `passActivePlayer`.
    - `src/engine/pipeline/villain-phase.ts`: Encapsulated strictly Steps 1 through 5 (Threat, Interleaved Activations, Dealing, Reveals).
    - `src/engine/pipeline/round-upkeep.ts`: Encapsulated `step6_passFirstPlayerAndRoundUpkeep`, forced round-end discards (_Nick Fury_ `01084`), hand refills, deck cycling, First Player token rotation, and round incrementation.
  - Implemented strict phase-level ability resets: `usedAbilitiesThisPhase = {}` resets upon entering Player Phase and entering Villain Phase (enforcing `ONCE_PER_PHASE` limits).
  - Implemented round-level ability resets: `usedAbilitiesThisRound = {}` and `basicChangeFormUsedThisRound = false` upon new round transition.
  - Re-exported all pipeline symbols through `src/engine/pipeline/index.ts` with 100% backwards compatibility.
  - Expanded test suite `tests/engine/lifecycle-triggers.test.ts` to verify phase rotation and ability limit resets.
- **Turn-Gated Form Changes & Phase/Round Lifecycle Triggers (RR v1.8 p. 8, 22, 24):**
  - Enforced official 1/round basic form change limit (`basicChangeFormUsedThisRound: boolean`) across engine and UI (`canChangeForm`, `HeroZone.tsx`, `IdentityActionModal.tsx`).
  - Separated card-effect form flips (e.g. _Split Personality_ `01025`) from basic form flips, allowing card effects to flip identity without consuming the once-per-round basic action limit.
  - Implemented `CHANGE_FORM_DRAW_TO_HAND_SIZE` effect primitive and promoted _Split Personality_ (`01025`) to 98% confidence, resolving and deleting ambiguity report `core_01025_split_personality.md` (Inbox Zero).
  - Established formal phase and round lifecycle trigger pipeline (`ROUND_BEGAN`, `ROUND_ENDED`, `PLAYER_PHASE_BEGAN`, `PLAYER_PHASE_ENDED`, `VILLAIN_PHASE_BEGAN`, `VILLAIN_PHASE_ENDED`).
  - Automated round reset of `basicChangeFormUsedThisRound = false` upon new round transition in `step6_passFirstPlayerAndRoundUpkeep`.
  - Added unit test suites `tests/engine/form-change-rules.test.ts` and `tests/engine/lifecycle-triggers.test.ts`.
- **Heroic Mode & Difficulty Controls in UI Settings & Scenario Selector:**
  - Added dedicated difficulty selection buttons (`SKIRMISH`, `STANDARD`, `EXPERT`) and **Heroic Mode Variant** level selectors (`Off`, `Heroic 1`, `Heroic 2`, `Heroic 3`) to `ScenarioSelector.tsx`.
  - Added visual badges distinguishing `⭐ OFFICIAL FFG HEROIC MODE` (on Expert) from `⚡ CUSTOM VARIANT` (on Standard / Skirmish).
  - Added persistent default difficulty and Heroic level preferences in `GameSettingsContext.tsx` and `OptionsMenu.tsx`.
  - Connected `App.tsx` $\rightarrow$ `setupGame` to seamlessly pass `difficulty` and `heroicLevel` into the live game state.
- **Sequential Hazard Icon Distribution & Heroic Mode (RR v1.8 p. 11, p. 22):**
  - Refactored Step 4 of the Villain Phase in `src/engine/pipeline/villain-phase.ts` to implement official two-pass encounter card dealing.
  - **Pass 1 (Base & Heroic):** Deals $1 + \text{heroicLevel}$ encounter cards to each player in player order starting with the First Player.
  - **Pass 2 (Hazard Icons):** Deals 1 extra encounter card per active Hazard icon sequentially in player order starting from the First Player (round-robin).
  - Orthogonalized `heroicLevel` ($0, 1, 2 \dots$) from `DifficultyMode` (`SKIRMISH`, `STANDARD`, `EXPERT`), allowing Heroic variants across all game modes.
  - Added test suite `tests/engine/keywords-hazard.test.ts`.
- **Interleaved Villain & Minion Activations (RR v1.8 p. 22):**
  - Restructured Step 2 of the Villain Phase in `src/engine/pipeline/villain-phase.ts` to follow the official player-by-player activation loop starting from the First Player.
  - For each player in player order: the villain activates against the player (Attacks if hero, Schemes if alter-ego), followed immediately by all minions engaged with that player activating against them.
  - Implemented `executeMinionSchemeAgainstPlayer` so that minions add threat equal to their SCH stat when their engaged player is in Alter-Ego form.
  - Added unit test coverage for multi-player interleaved activation sequences and first player rotation.
- **1960s Daily Bugle Action Dispatcher & Auto End-Turn Flow (ADR-0021):**
  - Built pure engine evaluator `legal-actions-generator.ts` discovering legal basic attacks, thwarts, card plays, and ability activations.
  - Interactive retro newspaper broadsheet `DailyBugleActionNewspaper.tsx` with woodblock masthead, columnar action dispatches, and click-to-execute controls.
  - Automatic `EndTurnConfirmationModal.tsx` prompting confirmation when only "End Turn" remains.
  - Top navigation bar hover/click button `📰 DAILY BUGLE [N]` displaying live actionable count badge.
- **Identity Action Console & Modal:**
  - Interactive `IdentityActionModal.tsx` opened by clicking Identity card (Tony Stark / Iron Man).
  - Lists form-aware actions: Recover (greyed out when at full health with HP explanation), Identity Abilities (e.g. _Futurist_), Basic Attacks/Thwarts, and Suit Up/Flip.
- **Interactive Player Decision Prompt for Scrying (_Futurist_):**
  - Strict RR v1.8 p. 19 ("Player Choice") implementation for scrying abilities in `src/engine/effects/index.ts`.
  - Visual **DECISION REQUIRED** prompt (`DecisionPromptModal.tsx`) showing top 3 revealed cards side-by-side with non-matching cards cleanly grayed out and selectable Tech cards highlighted.
  - Explicit option to decline and discard all revealed cards.
- **Dynamic Fan-Out Stack Hand Layout (Zero Overflow):**
  - Responsive `useHandFanLayout.ts` hook measuring container width and dynamically tightening negative margins to prevent hand overflow across any hand size (6, 7, 8+ cards).
  - Leftmost card in hand stacked on top (`z-index: 30 - index`).
  - Active hovered card elevated to `z-index: 60` with upward float elevation (`-translate-y-12`) and unconstrained 1.9× Comic Zoom.
  - Hardware-accelerated `transition-transform duration-150` eliminating sluggish accordion compression on card additions.

### Changed

- **Physical Game Counter Token Styling:**
  - Standard game counters rendered as solid green rounded-squares in the bottom-right corner of cards (`CardView.tsx`) replicating physical tabletop tokens.

### Fixed

- **Resource Card Play Legality (RR v1.8 p. 24):**
  - Enforced in `legality-checker.ts` that standalone Resource cards (_Energy_, _Genius_, _Strength_) cannot be played as independent actions; they are discarded strictly during resource payment.
- **Interactive Tableau & Ally Triggers:**
  - Added click handlers and action mini-bars (`[⚡ USE]`, `[⚔️ ATK]`, `[🛡️ THW]`) for tableau upgrades/supports and allies in `HeroZone.tsx`.
- **Solid Matte Grayscale Rendering (No Transparency):**
  - Removed `opacity-40` and `opacity-65` from unplayable/non-matching cards across `DecisionPromptModal.tsx` and `CardView.tsx`, ensuring 100% solid, opaque cards without background bleed.
- **Modal Z-Axis and Clipping:**
  - Removed `overflow-hidden` from `DecisionPromptModal.tsx` and elevated hovered card wrapper z-index so zoomed cards never get cropped.

---

## [0.1.0] - 2026-08-26

### Added

- **Headless Rules Engine (ADR-0002):**
  - Deterministic state machine covering Player Phase, Villain Phase, and status effects (_Tough_, _Stunned_, _Confused_).
  - Action pipeline with nested trigger priority (Forced Interrupts, Interrupts, Replacement Effects, Forced Responses, Responses).
  - Full automated scenario validation for _Spider-Man (Justice) vs. Rhino (Standard I + Bomb Scare)_ with 56 unit tests.
- **Data-Driven Card Catalog (ADR-0006):**
  - Ingestion of official `marvelsdb-json-data` core and encounter sets.
  - Orientation metadata and cache-first MarvelCDB card art loader (ADR-0011).
- **60s Comic Pop-Art Presentation Layer (ADR-0004):**
  - Ben-Day halftone dot pattern overlays and retro comic panel borders.
  - Interactive multi-hero setup and Mulligan phase state machine (ADR-0010).
- **Project Infrastructure & Architecture Records:**
  - Architecture Decision Records ADR-0001 through ADR-0010.
  - Vitest test suite, TypeScript 5 strict type checking, and GitHub Actions CI workflow.
