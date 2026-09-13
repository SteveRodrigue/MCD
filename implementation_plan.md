# Phase 2 Implementation Plan: Additive Schema & Engine Changes

**Tracking issue:** #111  
**Governing ADR:** ADR-0058  
**Scope:** Phase 2 only; legacy names remain valid throughout this phase.  
**Approval gate:** No source, test, schema JSON, or supplemental data edits begin until this plan is explicitly approved.

## Rules Reference (RR v1.8) & Spec Analysis

- **Timing and trigger priority:** Preserve the existing interrupt/response ordering defined by RR v1.8 pp. 23–24. Add canonical trigger dispatches alongside legacy dispatches so existing responses remain valid during the compatibility window.
- **Defeat and lifecycle events:** A defeated entity must emit the appropriate event after the state mutation is complete, with entity context available to response abilities. The universal `DEFEATED` event and narrower `CHARACTER_DEFEATED` / `SCHEME_DEFEATED` events will be additive aliases, not replacements.
- **Damage and prevention windows:** Keep prospective damage handling in the current RR v1.8 p. 24 pipeline. `DAMAGE_WOULD_BE_TAKEN` must coexist with `TAKE_ATTACK_DAMAGE` / `TAKE_DAMAGE` until data migration and cleanup phases.
- **Status rules:** Stalwart and Steady behavior remains governed by RR v1.8 p. 28. `REMOVE_STATUS` must use the same target resolution and status-token conventions as `ADD_STATUS`, and `STATUS_REMOVED` must be dispatched only when a status is actually removed.
- **Search and zone rules:** Preserve the zone and selection semantics described by RR v1.8 pp. 19 and 26. Add `SEARCH` as an additive alias for `SEARCH_AND_SELECT` and support `autoSelectIfUnambiguous?: boolean`, defaulting to the existing automatic behavior when candidates are no more numerous than `takeCount`.
- **Cost and atomic resolution:** No Phase 2 change may bypass the existing cost/resolution stack or prompt queue. Any synchronous search resolution must use the existing card-transfer path and preserve shuffle, destination, voluntary-selection, and pending-prompt behavior.
- **Active architectural decisions:** ADR-0046 governs composable card filters; ADR-0048 governs timing versus trigger vocabulary; ADR-0049 and ADR-0052 govern dynamic values and event interception; ADR-0053 governs trigger-loop safeguards; ADR-0058 governs the canonical names and additive-before-cleanup sequencing.

## Proposed Changes

- **[MODIFY] `src/data/supplemental/schema.ts`**
  - Add the Phase 2 canonical trigger members alongside all legacy members.
  - Add canonical effect members and the optional `autoSelectIfUnambiguous` parameter shape without removing existing effect names.
  - Add controlled, friendly, side-scheme, all-scheme, and triggering-scheme selectors alongside existing selectors.
  - Keep `DEFEATED` if already present and avoid duplicate enum entries.

- **[MODIFY] `src/engine/models/abilities.ts`**
  - Extend the hand-maintained `TriggerType` and `EffectType` unions to cover the Zod vocabulary 1:1 where these unions are used by engine contracts.
  - Preserve existing compatibility literals and avoid broad unrelated type consolidation in this phase.

- **[MODIFY] `src/engine/effects/index.ts`**
  - Add `REMOVE_STATUS` handling beside `ADD_STATUS`, including status selection, target resolution, immunity/duplicate behavior, mutation reporting, and `STATUS_REMOVED` dispatch.
  - Add canonical effect switch aliases (`DRAW`, `DISCARD`, `PUT_INTO_PLAY`, `PLAY_FROM_ZONE`, `SEARCH`, canonical counter/status/limit/form names) falling through to existing handlers where semantics are already equivalent.
  - Add `SEARCH` handling as an additive path over `SEARCH_AND_SELECT`; implement default automatic resolution only for an unambiguous candidate set and retain the pending decision path otherwise.
  - Extend target resolution for controlled versus friendly characters/allies and the new scheme selectors without changing existing selector behavior.
  - Add canonical defeat/scheme trigger dispatches alongside existing legacy dispatches at the relevant mutation sites.

- **[MODIFY] `src/engine/pipeline/combat-pipeline.ts`**
  - Dispatch `ENEMY_INITIATES_ATTACK`, `DAMAGE_WOULD_BE_TAKEN`, and `ATTACK_DEFENDED` alongside their legacy trigger names at the existing combat timing points.
  - Add canonical defeat dispatches where the combat pipeline currently emits legacy defeat events, preserving event context and dispatch ordering.

- **[MODIFY] `src/engine/pipeline/action-dispatcher.ts`**
  - Add canonical trigger dispatches at action-driven defeat/scheme/form lifecycle sites and update any trigger-name checks required to recognize both vocabulary generations.
  - Do not remove or rewrite legacy branches in Phase 2.

- **[MODIFY] `src/engine/triggers/trigger-dispatcher.ts`**
  - Add compatibility handling for canonical damage/attack triggers where the current dispatcher has explicit legacy-name checks, preserving loop guards and optional-trigger behavior.

- **[MODIFY] `src/data/supplemental/schema.json`**
  - Regenerate with `npm run schema:generate` after the TypeScript/Zod schema changes.

- **[NEW] `tests/engine/remove-status-effect.test.ts`**
  - Contract-test removing each supported status, `ALL`, missing-status no-op behavior, status-removal trigger emission, and target legality.

- **[NEW] `tests/engine/defeated-trigger-dispatch.test.ts`**
  - Contract-test canonical universal/narrow defeat events, entity context, legacy event preservation, and scheme defeat dispatch.

- **[MODIFY] Nearby existing contract tests only where needed for new additive behavior**
  - `tests/data/supplemental-schema.test.ts` for additive enum and parameter acceptance.
  - `tests/engine/search-and-select-routing.test.ts` for `SEARCH` alias and automatic-versus-prompted selection.
  - `tests/engine/advanced-status-and-minion-modifiers.test.ts` for `REMOVE_STATUS` status semantics.
  - `tests/engine/attachments-player.test.ts` for controlled/friendly selector validation if the existing selector contract is the nearest fixture.
  - Existing assertions remain unchanged unless a new additive assertion is required.

## Acceptance / Contract Tests Plan

- `TriggerTypeSchema.safeParse` accepts every Phase 2 canonical trigger and continues accepting every legacy trigger.
- `EffectTypeSchema.safeParse` accepts canonical effects, `REMOVE_STATUS`, and `SEARCH` with `autoSelectIfUnambiguous`; legacy effects still parse.
- `TargetSelectorSchema.safeParse` accepts all nine new selectors and existing selectors remain valid.
- `REMOVE_STATUS` removes one requested status, removes all requested statuses, does nothing when absent, respects target legality, and emits `STATUS_REMOVED` only after an actual mutation.
- Defeating a character or scheme emits canonical trigger context while preserving the corresponding legacy trigger dispatch.
- Enemy attack initiation, prospective damage, and defense dispatch canonical triggers without changing the existing prompt/interrupt order.
- `SEARCH` auto-resolves when `autoSelectIfUnambiguous !== false` and candidates are `<= takeCount`; it creates the existing pending decision when ambiguous or explicitly disabled.
- Controlled selectors never target another player’s board; friendly/table-wide selectors include eligible entities across players.
- `npm run schema:generate` produces a schema JSON containing the additive enum members.
- Full Phase 2 gate must pass with existing assertions intact:
  `npm run format:check && npm run lint && npm run typecheck && npm test && npm run build && npm run report:declarations`.

## Open Questions & Design Decisions

> [!IMPORTANT]
> The current report lists several canonical names whose existing handlers are not yet proven equivalent (`DISCARD`, `HEAL_DAMAGE`, `PREVENT_DAMAGE`, `MODIFY_STAT`, and some zone/form variants). Before implementing each alias, inspect its current parameter shape and handler semantics. If the shapes differ materially, keep the alias out of that switch until a focused additive contract is defined; do not silently coerce data in Phase 2.

> [!WARNING]
> The report requests `DEFEATED` / `CHARACTER_DEFEATED` / `SCHEME_DEFEATED` dispatches at every legacy defeat call site, but the current code also contains attachment-specific `HOST_DEFEATED` handling. The implementation must preserve attachment cascade timing and avoid firing character-only triggers for attachments. Confirm the `entityType` mapping in the nearest state mutation code before editing.

> [!IMPORTANT]
> The current `TriggerTypeSchema` and engine `TriggerType` union are already not perfectly aligned. Phase 2 will add the requested canonical members and the minimum missing existing members required for type-safe dispatch, but a broad schema/union cleanup belongs in a separately scoped refactor unless the compiler makes it unavoidable.

> [!WARNING]
> Phase 2 must not rewrite supplemental pack JSON or delete legacy enum members/handlers. Those actions are reserved for Phases 3 and 4 under ADR-0058’s sequencing invariant.

## Execution Order

1. Obtain explicit approval for this plan.
2. Re-check the current worktree, open PRs/issues, and controlled Phase 2 files.
3. Add schema and type vocabulary entries.
4. Add engine aliases and genuinely new handlers with focused tests.
5. Regenerate `schema.json` and run the focused contract tests.
6. Run the complete Phase 2 quality gate.
7. Update Phase 2 checkboxes and the migration log only after the gate passes.
8. Commit one Phase 2 sub-phase commit referencing issue #111; do not begin Phase 3 in the same change.

---

# Phase 3 Implementation Plan: Batch Supplemental Data Migration

**Tracking issue:** #111  
**Governing ADR:** ADR-0058  
**Scope:** Phase 3 only; legacy schema names remain valid until Phase 4 cleanup.  
**Approval gate:** No migration script, supplemental pack JSON, tests, or generated declaration report changes begin until this Phase 3 plan is explicitly approved.

## Rules Reference (RR v1.8) & Spec Analysis

- Preserve the Phase 2 additive compatibility window: every legacy and canonical name must parse and execute while data is migrated.
- Use ADR-0058 as the sole rename/decomposition source. Do not infer mappings from current card text or derive ad hoc transforms.
- Preserve RR v1.8 timing, target ownership, zone routing, and cost semantics. String renames may be mechanical; shape-changing primitives require dedicated transforms and manual review.
- `SEARCH` migrations must use `source: 'PLAYER_DISCARD'`, `takeCount: 1`, `selectedDestination: 'HAND'`, and `autoSelectIfUnambiguous: true` for both `RETRIEVE_*` primitives.
- Nested `PLAYER_CHOICE` and `FORM_BRANCH` step arrays must be traversed recursively. Audit fields are derived metadata and may be updated mechanically after the gameplay declaration is transformed.

## Proposed Changes

- **[NEW] `tools/audit/migrate-declarative-taxonomy.ts`**
  - Read one or more selected files under `src/data/supplemental/pack/`.
  - Support `--dry-run`, `--file <name>`, and an explicit write mode; default behavior must not write files.
  - Use stable JSON serialization and print per-card/per-field before/after diffs.
  - Keep the rename map as a single hard-coded constant sourced from ADR-0058.

- **[MODIFY] `src/data/supplemental/pack/core.json` and `core_encounter.json`**
  - Migrate one pack at a time only after reviewing its dry-run diff.
  - Rewrite ability triggers, step effects, target values, nested filter target values, and applicable audit reconstruction text.
  - Do not change card `originalText`, card identity, timing, cost, or unrelated fields.

- **[NEW/MODIFY] Focused migration tests or audit fixtures**
  - Test idempotency, dry-run no-write behavior, recursive nested walking, exact rename coverage, and each bespoke decomposition.
  - Validate output through `SupplementalPackSchema` and `report:declarations` after each pack.

- **[MODIFY] `docs/reports/card_editor_and_supplemental_schema_audit_report.md` and migration log**
  - Check off each Phase 3 sub-phase only after its own dry-run, reviewed write, validation, and quality gate.

## Acceptance / Contract Tests Plan

- `--dry-run` produces deterministic diffs and leaves file hashes unchanged.
- Re-running the migration on already canonical data produces no diff and no additional changes.
- Every `ability.trigger`, `step.effect`, `params.target`, `params.exhaustCard`, and nested filter target is visited recursively.
- `NICK_FURY_CHOICE`, `EXPLOSION`, `HULK_DISCARD_RESOLUTION`, `FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE`, and `REPULSOR_BLAST`/`REPULSOR_BLAST_DAMAGE` become the exact composable step shapes specified by ADR-0058.
- `RETRIEVE_CARD_FROM_DISCARD` and `RETRIEVE_TECH_UPGRADE_FROM_DISCARD` become canonical `SEARCH` declarations with the prescribed discard source/filter/destination/default selection behavior.
- `core.json` and `core_encounter.json` each pass `SupplementalPackSchema` after migration, with zero duplicate keys and zero open ambiguity reports.
- `npm run report:declarations` completes after each pack and the final Phase 3 metrics are recorded.
- Phase 3 handoff gate: `npm run typecheck` passes; `npm test` may fail only for expected legacy string assertions and those failures are recorded, not repaired in Phase 3.

## Open Questions & Design Decisions

> [!IMPORTANT]
> The report describes five shape-changing decompositions but does not provide every existing card parameter shape. Before writing transforms, inspect each matching card entry and isolate any card whose fields cannot be mapped with >=95% confidence; do not guess or silently drop parameters.

> [!WARNING]
> `core.json` and `core_encounter.json` contain the active release catalog. The first write must be limited to one file, reviewed with `git diff`, and schema-validated before the second file is touched.

> [!IMPORTANT]
> Phase 3 intentionally does not update test assertions. Any failures caused solely by legacy string literals must be reported as the planned Phase 3→5 red-test window, while parse/type/schema failures must stop the phase immediately.

## Execution Order

1. Obtain explicit approval for this Phase 3 plan.
2. Re-check `git status`, open PRs/issues, controlled files, and script-name collision.
3. Add migration script tests and implement dry-run-only logic first.
4. Run a no-write dry-run against `core.json`; review every diff category.
5. Write and validate `core.json`; record its migration log entry.
6. Run the same dry-run/write/validate sequence for `core_encounter.json`.
7. Regenerate audit reconstruction fields and run declarations analysis.
8. Run Phase 3 typecheck/test handoff gate and record expected legacy assertion failures without fixing them.
9. Check off Phase 3 items, commit one issue-referenced Phase 3 commit, and stop before Phase 4.

## Phase 3 Execution Result

**Blocked before commit:** The dry-run found two unsupported shape changes in `core.json` (`REPULSOR_BLAST`/`REPULSOR_BLAST_DAMAGE` and `HULK_DISCARD_RESOLUTION`). Dedicated issues were created: [#112](https://github.com/SteveRodrigue/MCD/issues/112) and [#113](https://github.com/SteveRodrigue/MCD/issues/113). Their unsupported `abilities` arrays are withheld while audit metadata, printed text, mechanic steps, and machine-readable ambiguity links are preserved. A safe-write probe for the remaining declarations was schema-valid but caused 16 behavioral regressions, including attachment defeat timing, canonical attack trigger handling, canonical search prompt behavior, and Explosion's Bomb Scare conditional behavior. The temporary migration was rolled back before the cleanup; the cleaned pack baseline is green.

**Verified after cleanup:** `npm run typecheck` passes; `npm test` passes with 106 files, 773 tests, and 1 existing skipped test; focused data tests pass; `npm run report:declarations` reports 144 cards with abilities, 166 abilities, and 0 open ambiguities.

**Required prerequisite before retry:** Complete the active-catalog canonical engine compatibility paths, then restart Phase 3 from a clean baseline. Repulsor Blast and Hulk are deferred post-Phase-8 re-integrations, not blockers for Phase 4 cleanup; their dedicated capabilities can be built later under issues #112 and #113.

**Sub-phases closed:** 3.1, 3.2, 3.3, 3.4, 3.5, and 3.6. **Still blocked/open:** 3.7-3.11, pending active-catalog compatibility fixes and a valid migration commit.
