# Plan: Issue #194 — Replace `state.villain` / `state.mainScheme` legacy pointers with typed accessors [AUD-F003]

> Status: **Revision 3, batches 0-5 committed (ba31d33, 09c80bd, 1c8a74f, a3fc747), batch 6 done (uncommitted)**. Next: batch 7.

## 1. Confirmation

- `teamwork_status_and_next_target.md` names #194 the active next target; the issue is OPEN, P2, `impact:high`, with no blocker. Working tree clean on `main` (`69c32e2`).
- The issue's own sentence "prerequisite to any multi-villain phase scheduling work" is the reason this plan must be shaped by MC03 (Wrecking Crew) now, not after.

## 2. Rules findings (what multi-villain actually requires)

Sources: RR v1.8 glossary (`references/rules/`: single-villain only, so MC03 adds new rules), the MC03 rules insert (`references/mc03_*.pdf`, text extracted with `pdftotext`), the official FAQ in `references/rules/appendices/04_faq.md`, and the Hall of Heroes FFG rulings page (Wrecking Crew section; secondary source, answers signed Caleb/Boggs). Tower Defense (multi-main-scheme) is explicitly **out of scope**; Wrecking Crew is the reference scenario for multi-villain design.

| # | Rule | Source | Model implication |
|---|---|---|---|
| R1 | 4 villains in play at once. Only the **active villain** (holder of the active counter, an all-purpose counter) activates in the villain phase. | MC03 p.6 | `villains[]` plus an active marker. |
| R2 | The active counter is placed and moved **by card effects at any time** (Breakout 1B after step 1, Buddy System, Escaped Convict "least threat", on active-villain defeat "most threat side scheme"; ties go to the first player). Moving mid-activation does not change who is mid-activation, but players who haven't yet been activated against get the new active villain. | MC03 p.6, Hall of Heroes (Buddy System) | Active marker must be mutable via a setter that resolves by villain **id** (see 3.1). Active-villain resolution must be read at the time of each activation, not cached. |
| R3 | "The villain" in card text = the **active villain only** (so Energy Daggers can't hit all four). "The encounter deck" = the active villain's deck. | MC03 p.6, Hall of Heroes | `getActiveVillain` is correct for the card-text meaning of "the villain". |
| R4 | Players may **attack any villain and thwart any scheme**, regardless of active. **Guard blocks attacks on all villains.** | MC03 p.6, Hall of Heroes (Guard) | Legality and target lists must enumerate every villain in play, not the active one. |
| R5 | Each villain has its **own encounter deck and discard pile**. Encounter cards that leave play go to their own deck's discard. Boost cards come from the active villain's deck, and so do encounter cards dealt to players. Reshuffling an empty deck adds acceleration to the main scheme. Surge's extra card: any deck allowed, active recommended. | MC03 p.6, Hall of Heroes (Surge/Boggs) | `encounterDeck` / `encounterDiscard` are the same class of singleton as `villain`. See 3.4. |
| R6 | Each villain has a **signature side scheme** ("cannot leave play while its villain is in play"), placed above its villain. It is not discarded at 0 threat, and is **removed from the game when that villain is defeated** (final stage). If an A side is defeated, the side scheme **stays**. "Followed" does not trigger. | MC03 p.4-7, Hall of Heroes | Side schemes need an owner link (`ownerVillainId`), declarative in supplemental data. |
| R7 | Wrecking Crew villains' schemes place threat on **their own side scheme, not the main scheme**. | Villain cards | A per-villain "scheme threat destination" hook. Not an engine constant (`threat-pipeline.ts:125` assumes the main scheme). |
| R8 | Villain defeat has two outcomes: stage advance (A to B, RR "Villain Defeat" rule: same title keeps attachments and tokens) or final stage (villain removed; win only when **all 4** are gone). | MC03 p.7, RR glossary | `replaceVillain` (stage) and `removeVillain` (final) are different operations. |

## 3. Design

### 3.1 Active marker: store the villain's id, not an index
`activeVillainIndex` breaks when a villain is removed (R6/R8 shift the array) and when a stage replaces an entity. Replace it with `activeVillainId: string` (instanceId). Wrecking Crew has a single main scheme, so `activeMainSchemeIndex` is kept as is (decision 6). Migration of the two existing `*Index` fields (about 20 refs) happens in batch 1 with the setters.

### 3.2 Accessor API (all in `src/engine/models/state.ts`)

| Function | Meaning | Rule |
|---|---|---|
| `getActiveVillain(state)` | the villain "the villain" refers to; used by card text, villain phase, boost source | R1, R3 |
| `getVillainsInPlay(state)` | all villains, for targeting, Guard checks, win checks | R4 |
| `getVillainById(state, id)` | an already-chosen villain (combat target, attachment host); exists, extend | R4 |
| `setActiveVillain(state, id)` | move the counter | R2 |
| `replaceVillain(state, oldId, next)` | stage advance, keeps the counter if it was active | R8 |
| `removeVillain(state, id)` | final-stage defeat; moves the counter per the "most side-scheme threat, tie to first player" rule via a callback so the engine does not hard-code the scenario | R2, R8 |
| `getMainSchemesInPlay`, `getMainSchemeById`, `getActiveMainScheme` | same split for main schemes 
`getActiveVillain` keeps its empty-collection fallback to the legacy field until removal, so the 621 test-fixture references keep working.

### 3.3 Call-site classification (replaces "map everything to the active villain")
Each of the ~400 `src/` sites is tagged **A** (active/"the villain" semantics), **B** (by id, from an already-chosen or hosting entity), or **T** (targeting: enumerate all in play). Rule of thumb from the sources:

- **T:** attack/thwart target lists, `legality-checker`, `legal-actions-generator`, the UI target utils, `target-resolver` entries for chosen-villain targets, the Guard check, the win check.
- **A:** `villain-phase` activation, boost dealing, card text "the villain" (target-resolver `VILLAIN` entries), `getEffectiveRetaliate` for an attack already declared uses **B**.
- **B:** combat and damage once a target is chosen (`combat-pipeline`, `damage-pipeline`), attachment hosts (`hostInstanceId`), `state-validator`.

In **batches 1-6 behavior for the single-villain core scenarios must be byte-identical.** The multi-villain behavior itself (R1-R8 gameplay) is delivered later, but the call sites are tagged now so it's a data/scenario change then, not a second migration. The classification is written to a table in the ADR so reviewers can audit it.

### 3.4 Encounter decks (same debt, separate issue)
`state.encounterDeck` has 51 refs in 12 files and `encounterDiscard` 52. R5 requires per-villain decks. **Recommendation:** do not fold into #194 (it doubles the blast radius). Tracked in #210, sequenced right after #194, because it keys off villain id. #194 only guarantees the id-keyed accessors it depends on, and adds no new uses of `state.encounterDeck`.

### 3.5 Guard (architecture) test
`tests/architecture/legacy-villain-pointers.test.ts` scans `src/**` for `\.(villain|mainScheme)\b` on state-typed expressions, with an allowlist that only shrinks per batch. It ends at `models/state.ts`, `game-setup.ts` (initial construction) and nothing else. It also pins the **tags**: no `getActiveVillain` call inside files tagged T (a lint-style check on `legality-checker`, `legal-actions-generator`, `*-target-utils`), so a later "convenient" mapping to the active villain can't reintroduce the bug.

### 3.6 Out of scope for #194 (unblocked and designed for)
Each item below now has a GitHub issue (all P3, `enhancement`, no immediate impact, to be implemented when Wrecking Crew is scheduled):

| Issue | Topic | Rules |
|---|---|---|
| [#210](https://github.com/SteveRodrigue/MCD/issues/210) | Per-villain encounter decks and discards | R5 |
| [#211](https://github.com/SteveRodrigue/MCD/issues/211) | Per-villain scheme threat destination and signature side schemes | R6, R7 |
| [#212](https://github.com/SteveRodrigue/MCD/issues/212) | Multi-villain targeting, Guard, win condition | R4, R8 |
| [#213](https://github.com/SteveRodrigue/MCD/issues/213) | Active counter placement and movement effects | R1, R2 |
| [#214](https://github.com/SteveRodrigue/MCD/issues/214) | MC03 Wrecking Crew scenario plugin and card data | all |
| [#215](https://github.com/SteveRodrigue/MCD/issues/215) | Remove deprecated legacy fields and migrate ~620 test-fixture references | n/a |

Tower Defense and multiple main schemes are not tracked and not designed for.

## 4. Rules / docs
- Rules for the final behavior: RR v1.8 "Villain", "Villain Defeat", "Villain Phase", "Activation" plus MC03 insert pages 6-7. No gameplay change in #194.
- Docs: new **ADR-0076** covering canonical collections, the id-keyed active marker, the A/B/T classification table and the JSON-clone divergence (why the legacy pointer can't stay). Update `docs/algorithmic_rules_reference.md` (it already mentions modular multi-villain scenarios), and cross-link the MC03 rules from the ADR.
- `CHANGELOG.md` `[Unreleased]` and the backlog status doc updated with each batch.

## 5. TDD sequence

**Batch 0: red tests first (no source edits)**
1. `tests/engine/active-villain-accessors.test.ts`:
   - Divergence/characterization: after `dispatch` (JSON clone), a villain-damage effect lands on `getActiveVillain(next)`. Red because it hits the detached legacy copy (**confirmed red on batch 0: after a dispatched attack, `getActiveVillain(next).health` is stale at full health; the damage landed on the detached legacy copy**).
   - `setActiveVillain` by id; `replaceVillain` keeps the counter on the replaced villain; `removeVillain` removes it, keeps the other three, and moves the counter via the callback; `getVillainsInPlay` returns all four.
   - **Four-villain fixture (MC03-shaped):** `getActiveVillain` follows `activeVillainId`; `getVillainsInPlay` returns all four; `BASIC_ATTACK` with a villain `targetInstanceId` damages that villain and not the active one (B: by id); without an id it hits the active villain. Listing every villain as an attack option in `legal-actions-generator` (T) moves to #212, because it needs a new legality signature (`canBasicAttack` has no villain id today).
   - Fallback to the legacy field only when `villains` is empty (existing behavior, pinned).
2. Architecture guard test, seeded green with the full allowlist, plus a scanner control case.

**Batches 1-7 (each: red where applicable, edit, affected tests, all green, one commit)**

| # | Scope | Refs |
|---|---|---|
| 1 | `state.ts` API (3.2), `activeVillainId` migration, setters, plugin writers (rhino, klaw, ultron), `game-setup.ts`, ADR-0076, batch-0 tests | ~50 |
| 2 | `effects/index.ts` (two commits by line range) | 91 |
| 3 | `target-resolver.ts`, `dynamic-formula-evaluator.ts`: T vs A tagging | ~70 |
| 4 | Pipelines: `action-dispatcher`, `combat-pipeline`, `damage-pipeline`, `threat-pipeline` | ~80 |
| 5 | `villain-phase`, `legality-checker`, `legal-actions-generator`, `state-validator`, `step-gate-evaluator`, `stat-calculator`, `trigger-dispatcher` | ~110 |
| 6 | Remaining engine and UI: `card-inspector`, `wakanda-forever`, `player-bot`, `card-loader`, `CardPaymentModal`, `GameBoard`, `HeroZone`, `*-target-utils`, `comic-log-formatter` | ~45 |
| 7 | `@deprecated` on the legacy fields, final allowlist, CHANGELOG, backlog doc | |

Test fixtures are not rewritten here (decision 3).

## 6. Verification (each batch)
`rtk npm test -- <affected>`, full `rtk npm test` (baseline 1,545 passing, 0 failed, 0 skipped), `rtk npm run typecheck`, `rtk npm run lint`, `rtk npm run format:check`.

## 7. Decisions (all resolved)
1. **Delivery shape:** 7 commits, `Refs #194`, last one `Fixes #194`. *Approved.*
2. **Closing #194:** after batch 7; physical field removal is [#215](https://github.com/SteveRodrigue/MCD/issues/215). *Approved.*
3. **Test fixtures:** untouched in #194, handled in #215. *Approved.*
4. **`activeVillainId` replaces `activeVillainIndex`.** *Approved.*
5. **Follow-up issues:** created as #210-#215 (3.6). *Done.*
6. **Main schemes:** single main scheme only; `getActiveMainScheme` and `activeMainSchemeIndex` stay; Tower Defense ignored. *Approved.*
7. **Source authority:** the MC03 insert and the current RR win over the Hall of Heroes rulings (secondary, pre-RRG 1.5); conflicts are recorded in `docs/ambiguities/` only if one appears at scenario time. *Default, no objection.*

## 8. Estimate
Large: about 7 commits over 3-4 sessions, (follow-up issues already created). Risk is high in batches 2-5 (core pipelines), mitigated by the existing suite, the guard test and the two-villain fixture.
