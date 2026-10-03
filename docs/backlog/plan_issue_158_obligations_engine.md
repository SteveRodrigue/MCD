# Plan: Issue #158 — Obligation engine (the five core-set obligations)

> Status: **Awaiting approval** (no source/test/data edits made yet). Largest item in Phase 3. Scope: **all five core-set obligations** (01155, 01160, 01165, 01170, 01175) plus one real proof card for the `recipient` override (*Now It's Personal* `56128b`), delivered in two commits.
>
> History: r2 generic recipient selector; r3 obligations live in the per-seat Threat Zone; r4 five-card scope, S1 selector; **r5 (2026-10-03): decisions R2 + B2.** r6: user rulings applied (Option A requires alter-ego form; proof card stays out of the live loader; two commits). Default recipient is derived from set data, so only 2 of the 106 audited cards (the two PvP *Now It's Personal* cards) need an explicit field, and only one of them is implemented here as the proof; obligation behavior is expressed as ordinary abilities/steps (no `obligation` block); `recipient` is an optional top-level enrichment field outside the abilities.

## 1. Problem (verified)

- Obligations are shuffled into the encounter deck at setup (`game-setup.ts:187-193`), so they are reachable in a Rhino game.
- On reveal, `resolveActiveEncounterCardAfterInterrupt` (`villain-phase.ts:~626`) has branches for minion, side scheme and attachment; an obligation falls into the generic **treachery** `else` branch: no effect runs and the card is discarded to the encounter discard. There is no give-to-player, no choice, no surge.
- `src/data/supplemental/pack/core_encounter.json` has **no entry** for any obligation (`01175` returns `null`), and no engine code handles obligation resolution.
- Five core obligations share one pattern (`core_encounter.json`):

| Card | Give to | Option A (exhaust identity → remove from game) | Option B (then discard obligation) |
|---|---|---|---|
| 01155 Affairs of State | T'Challa | Exhaust T'Challa | Choose and discard a Black Panther upgrade you control |
| 01160 Legal Work | Jennifer Walters | Exhaust Jennifer Walters | Main scheme gets 1 acceleration token |
| 01165 Eviction Notice | Peter Parker | Exhaust Peter Parker | Discard 1 random card from hand; **surge** |
| 01170 Business Problems | Tony Stark | Exhaust Tony Stark | Exhaust each upgrade you control |
| 01175 Family Emergency | Carol Danvers | Exhaust Carol Danvers | You are stunned; **surge** |

> Out of scope, tracked separately: obligations drawn from a player deck (#208). Also out of scope, tracked separately: the conditional-attach family (#209).

## 2. Rules (RR v1.8, "Obligation", verified via `npm run rule -- obligation`)

1. Revealed obligation with "Give to the X player": place it in that player's play area; that player decides how to resolve it.
2. If it cannot be given to the specified player: ignore its ability, **remove it from the game**, and **reveal an additional encounter card**.
3. Obligation without "Give to": the revealing player takes it.
4. Only the player holding it can trigger its abilities or pay its costs.
5. Drawn from a player deck: goes to the player's play area, with no replacement draw unless refilling hand. (Out of scope here: issue #208, decision 4.)

Also follow the See also links: Encounter Card, Reveal, Enters Play, Removed from the Game, Form (AGENTS.md cross-cutting protocol).

## 2b. Investigation of upstream data (`data/upstream/pack/*.json`, zzorba datasets, 106 obligation cards)

Cross-tab by give-to wording, hero-set membership of the card's `set_code`, and file kind:

| Group | Count | Where `set_code` points |
|---|---|---|
| `Give to the <identity> player.` | 68 | the hero's own set (e.g. `captain_marvel`): owner derivable from data |
| `Give to the first player.` | 2 | `standard_pvp`, not a hero set (*Now It's Personal* `56128b`, `56206b`, Civil War) |
| No give-to line, encounter or campaign set | 35 | not a hero set (e.g. Hunted `dystopian_nightmare`, Panicked Refugees `aoa_campaign`) |
| No give-to line, hero set | 1 | `34028` Burning Hunger (`phoenix`): the upstream record has **no `text` at all**, so this is a data gap, not a real derogation |

Conditions on the recipient: **none** (no "if…" wording on any give-to line). The only condition is rule 2.

Consequence: "owner of the card's hero set" is the correct default for every card that says "Give to <identity>", and cards from non-hero sets (encounter/campaign) correctly default to the revealing player (rule 3). Only the two PvP cards need an explicit override.

Related families outside obligations, **not in scope**: 42 "Attach to X. Otherwise …" cards (host selector with fallback), "engages the first player" (Mister Sinister, Abyss), "deal to the player who defeated him" (Dreadpool), give-as-boost-card (Falcon, Hercules, ...). The recipient concept can be reused for them later.

## 3. Design

### 3.1 Recipient: type-driven default, optional override outside the abilities

**Default (no declaration, decision R2).** When an obligation is revealed from the encounter deck:
- if the card belongs to a hero set → the recipient is the player whose hero `setCode` equals the card's `setCode`; if no such player is in the game, rule 2 applies (remove from the game, reveal an additional encounter card);
- otherwise → the revealing player (rule 3).

This needs one derived flag. `[MODIFY]` `card-loader.ts`: at catalog construction, mark each `NormalizedCard` with `belongsToHeroSet: boolean` (true when some hero/alter-ego card in the same catalog has the same `setCode`). It is computed from set data, **not from card text** (ADR-0019), and lives on the card so the headless engine has no dependency on the catalog singleton. In a catalog without a hero's pack the flag is false and the card goes to the revealing player.

**Override (optional, top-level, outside `abilities`).** A new optional enrichment field `recipient`, a sibling of `maxPerPlayer`, `uses`, `playRequirements` in `CardEnrichmentSchema` (`schema.ts:874`, `schema.json`):

```json
"recipient": { "type": "FIRST_PLAYER" }
```

`recipient.type` (new `PlayerRecipientSchema`, separate from `TargetSelectorSchema` so it cannot be confused with effect targets):
- `FIRST_PLAYER`: `state.firstPlayerIndex`.
- `REVEALING_PLAYER`: the player who revealed it.
- `CARD_SET_OWNER`: explicit form of the default (hero-set owner).
- `IDENTITY` with `codes: [...]`: explicit hero/alter-ego codes, for hand-authored cases.

When `recipient` is absent nothing changes (the default above). When present, the engine uses it instead of the default. Rule 2 (cannot be given → remove from game + reveal another card) stays engine behavior with no card field (decision 8).

### 3.2 Reveal branch, zone and conservation

- `[MODIFY]` `villain-phase.ts` `resolveActiveEncounterCardAfterInterrupt`: new `CardType.OBLIGATION` branch. Resolve the recipient (3.1). No recipient → `state.removedFromGame`, log, reveal an additional encounter card (existing surge pattern, `effects/index.ts:~1138`). Recipient found → place the card in `recipient.obligations`, dispatch `ENTERS_PLAY` (the same trigger used by allies/supports, `action-dispatcher.ts:1565`), which starts the card's own resolution ability (3.3).
- `[NEW]` `PlayerState.obligations: CardInstance[]`, a flat per-player field like `engagedMinions` and `dealtEncounterCards` (no refactor of existing fields, no nested `threatZone` for now, user decision). It is **not** `tableau`, so obligations are excluded from tableau logic (#185 graying, Max-per-player). Initialize in `game-setup.ts`; register in `state-validator.ts` zone scans (card conservation, ADR-0040).
- Rule 4: only the owning player is prompted and can pay costs.

### 3.3 Behavior is ordinary abilities and steps (decision B2)

The card type already tells the engine it is an obligation, so there is **no `obligation` block** and no `options`/`mayFlipTo` schema. Each card declares one ordinary ability using the existing precedent (`timing: "RESPONSE"`, `trigger: "ENTERS_PLAY"`, as on Spider-Woman/Shuri/Maria Hill):

```json
"01175": {
  "abilities": [
    {
      "id": "family_emergency_resolve",
      "timing": "RESPONSE",
      "trigger": "ENTERS_PLAY",
      "steps": [
        { "effect": "CHANGE_FORM", "effectParams": { "form": "ALTER_EGO", "optional": true } },
        {
          "effect": "PLAYER_CHOICE",
          "effectParams": {
            "title": "Family Emergency",
            "options": [
              {
                "id": "exhaust_identity",
                "label": "Exhaust Carol Danvers",
                "gate": "IF_FORM",
                "gateParams": { "form": "alter_ego" },
                "cost": { "exhaustCard": "SELF_IDENTITY" },
                "steps": [ { "effect": "REMOVE_FROM_GAME", "effectParams": { "target": "SELF" } } ]
              },
              {
                "id": "take_effect",
                "label": "You are stunned. This card gains surge.",
                "steps": [
                  { "effect": "ADD_STATUS", "effectParams": { "status": "STUNNED", "target": "SELF_IDENTITY" } },
                  { "effect": "SURGE" }
                ]
              }
            ]
          }
        }
      ]
    }
  ]
}
```

Engine-owned by card type (not card data): placement (3.1/3.2), the obligations zone, and a **completion default**: once the chosen option has resolved, an obligation still in the owner's `obligations` zone is discarded to the encounter discard (so card data never says "discard this obligation"); an option that removed it from the game leaves nothing to discard.

**New generic capabilities this needs (each small, reusable, none obligation-specific):**

| Capability | Why | Status today |
|---|---|---|
| `PLAYER_CHOICE` option-level `gate` + `cost` | "Exhaust <alter-ego name> → …" is only available in alter-ego form (**ruling, decision 3**) and only when the identity is ready; otherwise the option is disabled with a reason, and the cost is paid on selection | Options support `steps` (`prompt-queue.ts:~409`), `requiresPayment`, static `disabled`; **no `cost`/`gate`**. Add: evaluate `gate` with the shared evaluator from #122 (`evaluateStepGate`, `IF_FORM`) and `cost` with `canPayAbilityCost` when building the prompt (set `disabled` + `disabledReason`, e.g. "Requires alter-ego form"), run `executeAbilityCost` on selection, then the option steps |
| Optional `CHANGE_FORM` (`optional: true`) | "You may flip to alter-ego form" (flipping by card ability does **not** count against the once-per-turn voluntary form change, RR "Form"; no `basicChangeFormUsedThisRound` consumption) | `CHANGE_FORM`/`FLIP_FORM` exist (`effects/index.ts:~4065`); optional/voluntary prompt to be confirmed and added if absent. Sequence resumes after the prompt (existing resolution stack) |
| `REMOVE_FROM_GAME` (target `SELF`) | Option A on all five | **New.** Moves the card to `state.removedFromGame` (exists in state and validator, but no effect fills it) |
| `ADD_ACCELERATION` (`amount`, target `MAIN_SCHEME`) | 01160 | **New.** `state.mainScheme.accelerationTokens` exists (`state.ts:433`); no effect modifies it |
| `ALL_CONTROLLED_TABLEAU` selector + `filter` honored by `EXHAUST`/`READY` | 01170 | **New** (S1, decision 9), see 3b |
| Existing, no change | stun + surge, random hand discard, discard a filtered upgrade with choice | `ADD_STATUS`, `SURGE`, `DISCARD` source `HAND` mode `RANDOM` (`effects/index.ts:~909`), `DISCARD` source `TABLEAU` + `filter` (#184) |

Exact param spellings (status key, `form` casing, option `cost` shape) are confirmed against `schema.ts` when writing the schema tests.

### 3a. Declarations for the five core obligations (`core_encounter.json`, `audit.comment` untouched)

All five follow the 3.3 skeleton; only the labels and the `take_effect` steps differ. No `recipient` field is needed: each card's `set_code` is its hero's set, so the R2 default applies.

| Card | `take_effect` steps (Option B) | Option A (all five) |
|---|---|---|
| 01155 Affairs of State | `DISCARD` `{ source: "TABLEAU", mode: "CHOSEN", filter: { types: ["upgrade"], traits: ["Black Panther"] } }` | `gate: IF_FORM alter_ego`, cost `exhaustCard: SELF_IDENTITY`, then `REMOVE_FROM_GAME` (label uses the alter-ego name: T'Challa, Jennifer Walters, Peter Parker, Tony Stark, Carol Danvers) |
| 01160 Legal Work | `ADD_ACCELERATION` `{ amount: 1, target: "MAIN_SCHEME" }` | same |
| 01165 Eviction Notice | `DISCARD` `{ source: "HAND", mode: "RANDOM", count: 1 }`, then `SURGE` | same |
| 01170 Business Problems | `EXHAUST` `{ target: "ALL_CONTROLLED_TABLEAU", filter: { types: ["upgrade"] } }` | same |
| 01175 Family Emergency | `ADD_STATUS` stunned on the identity, then `SURGE` | same |

The card-text parser (`src/tools/card-text-parser/patterns.ts`) gets no "Give to" pattern: under R2 the default needs no data for those cards. (Only the two PvP cards carry `recipient`; revisit the parser when more `Give to the first player` cards appear.)

### 3b. "Exhaust each upgrade you control": selector decision (S1 selected)

Evidence: `TargetSelectorSchema` (`schema.ts:98-139`) is by entity kind and has no tableau/upgrade selector; `UniversalCardFilter` with `types: ["upgrade"]` already exists (ADR-0046) and is used by `DISCARD` (`TABLEAU`) and the payment modal; the Card Editor registry already advertises an optional `filter` on `EXHAUST` (`effect-parameter-registry.ts:~785`) but engine `EXHAUST` (`effects/index.ts:3607`) and `READY` (`:3578`) never read it (latent editor/engine mismatch); `DISCARD`/tableau has no "each" mode; `locateCard` returns a single card.

| | Option | Verdict |
|---|---|---|
| **S1 (selected)** | New zone-generic selector `ALL_CONTROLLED_TABLEAU` + existing `filter: { types: ["upgrade"] }`; `EXHAUST` and `READY` apply `matchesCardFilter` when `filter` is present. About 8 lines in `target-resolver.ts`, ~6 each in `EXHAUST`/`READY`; fixes the editor mismatch; reusable ("each support", *Black Panther* CW 56155). | Selected |
| S2 | `source`/`count: "ALL"`/`filter` params on `EXHAUST` mirroring `DISCARD` | Not retained |
| S3 | Plural `CardLocationSelector` + `locateCards` | Not retained (revisit if a third primitive needs it) |
| S0 | `ALL_CONTROLLED_UPGRADES` | Rejected (type baked into the name) |

### 3c. UI: obligations are a sub-zone of the per-seat Threat Zone

Today `HeroZone.tsx:366-455` renders one bordered row per seat titled `Minions Engaged with <hero> (N)`, or `Threat Zone: <hero> (N Minions • M Dealt Cards)` when facedown cards exist. It already hosts facedown dealt encounter cards (`FacedownEncounterCard`) and engaged minions. Later scenarios put more encounter-side cards in front of a player, so this row becomes the seat's **Threat Zone** with ordered sub-zones:

| # | Sub-zone | Source | Status |
|---|---|---|---|
| 1 | Encounter Facedown | `player.dealtEncounterCards` | exists (unchanged) |
| 2 | **Obligations** | `player.obligations` | **new in this issue** |
| 3 | Treachery / other persistent encounter cards | future state field | placeholder only (not built) |
| 4 | Minions Engaged | `player.engagedMinions` | exists (unchanged; keeps "Perimeter secure" empty state) |

- `[NEW]` `src/ui/components/board/ThreatZoneSubzone.tsx`: small presentational wrapper (label chip, count, content slot, `data-testid`). Adding a sub-zone later is one entry in an ordered list in `HeroZone`.
- `[MODIFY]` `HeroZone.tsx`: extract the row into a `data-testid="threat-zone"` container holding the sub-zones. A sub-zone renders only when it has cards, except Minions Engaged, which keeps today's placeholder. Obligation cards render with `CardView` (small, hover zoom), not grayed.
- **Header text contract is preserved:** `tests/ui/facedown-encounter-cards-display.test.tsx:150-222` asserts `Minions Engaged with <hero> (0)` and `Threat Zone: <hero> (M Minions • N Dealt Cards)`. Those strings stay byte-identical with no obligations; with obligations the header becomes the Threat Zone variant and appends `• K Obligations`. No existing test changes.
- Each seat shows only its own obligations (rule 4). The resolution prompt opens from the existing decision-prompt flow; the card stays visible until resolved.
- Card Editor impact: new `recipient` field editor (optional, in the card attributes section) and registry entries for `REMOVE_FROM_GAME` / `ADD_ACCELERATION` (ADR-0069 parity). No `obligation` block editor needed (B2).

### 3d. Proof card for the `recipient` override: *Now It's Personal* (`56128b`)

The only real derogations in the audit are the two PvP cards. Implement `recipient` now and prove it with **one** real card, `56128b` (Civil War, `cw_encounter`, `set_code: standard_pvp`, type `obligation`, text "Give to the first player. Action: Remove this card from the game → each player on your team chooses 2 of your leader's set-aside player cards and adds them to their hand."). Its sibling `56206b` is left out ("this card alone").

- `[NEW]` `src/data/supplemental/pack/cw_encounter.json` (registered in `src/data/supplemental/index.ts` next to core/core_encounter):

  ```json
  { "cards": { "56128b": { "recipient": { "type": "FIRST_PLAYER" }, "audit": { "originalText": "<b><i>Give to the first player.</i></b>\n<b>Action</b>: Remove this card from the game → ..." } } } }
  ```

  Created following the `card-integration-protocol` skill at implementation time. The card's Action ability depends on Civil War team/leader mechanics that do not exist yet, so the entry declares **only** `recipient`; this limitation is recorded in `docs/ambiguities/` (never in `audit.comment`, per AGENTS.md).
- The production loader (`card-loader.ts:475-478`) still loads only core + core_encounter, so this card is not in the live catalog. Tests build an ad-hoc catalog (`new CardCatalog([...corePack, ...coreEncounterPack, <56128b record>])`, the pattern used by `tests/ui/tableau-form-legality.test.tsx`), and the supplemental registry is keyed by code, so the enrichment attaches without loading the whole pack. The live loader is **not** changed and the full `cw_encounter` pack is **not** loaded (user decision, 2026-10-03): only this single card is used, from an ad-hoc catalog in tests.
- This card is real proof of two things: the override is honored by the engine, and the default is **not** applied when `recipient` is present (without it, `standard_pvp` is not a hero set, so the card would go to the revealing player).

## 4. Files

| Tag | File | Change |
|---|---|---|
| MODIFY | `src/data/supplemental/schema.ts`, `schema.json` | `recipient` (top-level enrichment), `PlayerRecipientSchema`, selector `ALL_CONTROLLED_TABLEAU`, effects `REMOVE_FROM_GAME` / `ADD_ACCELERATION`, `PLAYER_CHOICE` option `cost`, `CHANGE_FORM.optional` |
| MODIFY | `src/data/importer/card-loader.ts`, `src/engine/models/card.ts` | `belongsToHeroSet` derived flag |
| NEW | `src/data/supplemental/pack/cw_encounter.json`; MODIFY `src/data/supplemental/index.ts` | proof card `56128b` |
| MODIFY | `src/engine/models/state.ts`, `state/game-setup.ts`, `state/state-validator.ts` | `PlayerState.obligations`, init, conservation scan |
| MODIFY | `src/engine/pipeline/villain-phase.ts` | obligation reveal branch, recipient resolution, rule 2 default |
| MODIFY | `src/engine/pipeline/prompt-queue.ts` | option `cost`, completion default (discard if still in zone) |
| MODIFY | `src/engine/effects/index.ts`, `effects/target-resolver.ts` | `REMOVE_FROM_GAME`, `ADD_ACCELERATION`, `EXHAUST`/`READY` honor `filter`, optional `CHANGE_FORM`, `ALL_CONTROLLED_TABLEAU` |
| MODIFY | `src/data/supplemental/pack/core_encounter.json` | five obligations (abilities only) |
| MODIFY | `src/ui/components/board/HeroZone.tsx`; NEW `ThreatZoneSubzone.tsx` | Threat Zone sub-zones |
| MODIFY | `src/ui/components/editor/effect-parameter-registry.ts`, card attributes editor | new primitives, `recipient` field |
| NEW | `tests/engine/obligations.test.ts`, `tests/engine/obligation-recipient.test.ts`, `tests/ui/threat-zone-obligations.test.tsx` | see 5 |
| DOCS | New **ADR-0075** (see decision 5 for its content); supplemental spec (`recipient`, new primitives/selector, `PLAYER_CHOICE` option cost); `docs/ambiguities/` (Civil War ability limitation, flip timing ruling); regenerated declarations report; CHANGELOG; backlog |

## 5. TDD (red first)

**Recipient (`obligation-recipient.test.ts`)**
1. Default R2: a hero-set obligation (01175) goes to the player whose hero set matches, even when another player is active/revealing; both forms match (hero and alter-ego).
2. Default R2: an obligation from a non-hero set (synthetic card in an encounter set) goes to the revealing player.
3. Rule 2: hero-set obligation whose hero is not in the game → removed from the game (conservation holds), an additional encounter card is revealed, no prompt, and the card declares no fallback field.
4. **Proof card `56128b`** (ad-hoc catalog incl. `cw_encounter`): `recipient: FIRST_PLAYER` → goes to the first player when a different player revealed it; the same card with `recipient` stripped goes to the revealing player (proves the override changes behavior and "absent = default").
5. Other override types: `REVEALING_PLAYER`, `CARD_SET_OWNER`, `IDENTITY` (explicit codes) via synthetic cards; schema rejects an unknown `recipient.type`.
6. `belongsToHeroSet` loader flag: true for core obligations, false for `56128b`, false when the hero's pack is absent from the catalog.

**Resolution (`obligations.test.ts`)**
7. Family Emergency lands in `obligations`, not discarded; `ENTERS_PLAY` fires; the prompt goes only to the owner (multi-player, rule 4).
8. Option A, parameterized over all five cards: **alter-ego form required** (ruling): in hero form the option is disabled with reason "Requires alter-ego form"; after the optional flip (or when already in alter-ego form) and with the identity ready → identity exhausted, obligation moved to `removedFromGame`, no surge, nothing discarded; disabled (with reason) when the alter-ego is already exhausted (option-level `gate` + `cost`).
9. Option B per card: 01175 stunned + surge, obligation in the encounter discard; 01165 one random hand card discarded (seeded/mocked RNG) + surge, empty hand still surges and discards the obligation; 01160 `mainScheme.accelerationTokens` +1; 01170 every `upgrade` in the owner's tableau exhausted while supports, allies and other players' tableaus are untouched, none → resolves with nothing; 01155 choice prompt among Black Panther upgrades only (non-Black-Panther not offered), none → resolves with nothing.
10. Optional flip: offered before the choice; declining or accepting both proceed to the choice; accepting changes form, enables Option A, and does **not** consume the once-per-turn voluntary form change (`basicChangeFormUsedThisRound` unchanged; RR "Form"). Declining in hero form leaves only Option B available.
11. Primitives: `REMOVE_FROM_GAME`, `ADD_ACCELERATION`, `ALL_CONTROLLED_TABLEAU` resolver, `EXHAUST` and `READY` honoring `filter` (the editor `filter` param now has an effect; unfiltered behavior unchanged).
12. Card conservation: obligations counted exactly once across zones at every step.

**UI (`threat-zone-obligations.test.tsx`)**
13. The obligation renders inside the `threat-zone` container's Obligations sub-zone, in the owner's seat only, **not** in the tableau section; order Facedown → Obligations → Minions; header strings from `facedown-encounter-cards-display.test.tsx` unchanged with 0 obligations and gain `• K Obligations` with K > 0; the Option A button is disabled when the identity is exhausted. Existing UI tests pass unchanged.

## 6. Open decisions

1. **Delivery (resolved, user: two commits).** Commit 1 = `belongsToHeroSet`, `recipient` + proof card `56128b`, obligations zone, reveal branch, Threat Zone sub-zone, `PLAYER_CHOICE` option `gate`/`cost`, optional `CHANGE_FORM`, `REMOVE_FROM_GAME`, completion default, Family Emergency + Eviction Notice + Affairs of State (no further new primitive), message `Refs #158`. Commit 2 = `ADD_ACCELERATION` (Legal Work) and `ALL_CONTROLLED_TABLEAU` + `filter` support (Business Problems), message `Fixes #158`.
2. **Zone (resolved).** Flat `PlayerState.obligations`, displayed as a Threat Zone sub-zone; no nested `threatZone` for now (user decision).
3. **Rules ruling (resolved, user 2026-10-03): alter-ego form is required for Option A.** "Carol Danvers" is only the alter-ego, so "Exhaust Carol Danvers" needs the alter-ego form and a ready alter-ego. Supported by RR v1.8 "Form": while in hero form, abilities that interact with the alter-ego do not interact with the identity. Consequence: the optional flip before the choice is what makes Option A reachable from hero form; Option B stays available regardless. Flip timing: offered only before the choice. To record in `docs/ambiguities/`.
4. **Deck-drawn obligations (rule 5) (resolved, user 2026-10-03): out of scope.** Tracked in GitHub issue [#208](https://github.com/SteveRodrigue/MCD/issues/208) (rules, audit of the 7 player-side obligations, draw call sites, proposed approach, acceptance criteria, tests, open questions). It depends on this issue's `obligations` zone and `ENTERS_PLAY` resolution flow.
5. **ADR (resolved, user: yes, a new ADR).** **ADR-0075** (to unpack: obligation zone as a Threat Zone sub-zone and flat `PlayerState.obligations`; R2 data-derived default recipient and the `belongsToHeroSet` flag; optional top-level `recipient` override; B2 ability-based resolution via `ENTERS_PLAY` + `PLAYER_CHOICE` option `gate`/`cost`; engine-owned completion default and rule 2 default; alter-ego-form ruling; selector S1 and `EXHAUST`/`READY` `filter`; scope boundaries and links to #208 and the conditional-attach family). Written in commit 1 (decisions up to the resolve flow) and completed in commit 2 (S1 selector, `ADD_ACCELERATION`), index entry in `docs/decisions/README.md` each time.
6. **Recipient selector kinds (resolved).** `FIRST_PLAYER`, `REVEALING_PLAYER`, `CARD_SET_OWNER`, `IDENTITY`; default derived from set data (R2); override is a top-level optional field outside abilities.
7. **Conditional-attach family (42 cards) (resolved, user 2026-10-03): out of scope.** Tracked in GitHub issue [#209](https://github.com/SteveRodrigue/MCD/issues/209) (audit of all 42 cards, fallback and host-selector breakdown, current engine behavior, proposed approach, acceptance criteria, pilot set, open questions). No dependency on #158: `recipient` here is player-only, the attach family needs its own host selector.
8. **Fallback field (resolved, option A).** No `onUnavailable`; rule 2 is the engine default.
9. **Selector for "exhaust each upgrade" (resolved, S1).**
10. **New generic primitives `REMOVE_FROM_GAME`, `ADD_ACCELERATION`.** (Recommended: yes.)
11. **Obligation resolution as ordinary abilities (resolved, B2).** Needs: option-level `cost` on `PLAYER_CHOICE`, optional `CHANGE_FORM`, engine completion default (discard after resolution).
12. **Proof card (resolved by your direction): `56128b` only, kept out of the live loader.** The full `cw_encounter` pack is not loaded; tests use an ad-hoc catalog containing just this card.
13. **Burning Hunger (`34028`).** Upstream has no text; (Recommended: ignore, note in the ambiguity file as an upstream data gap).

## 7. Verification

`rtk npm test -- tests/engine/obligations.test.ts tests/engine/obligation-recipient.test.ts tests/ui/threat-zone-obligations.test.tsx`, then `rtk npm run report:declarations`, `rtk npm run format:check`, `rtk npm run lint`, `rtk npm run typecheck`, `rtk npm test` (0 failed, 0 skipped).

## 8. Estimate and risk

About 6-7 hours for everything: commit 1 about 4 h (flag + recipient + proof card, zone + reveal branch, option cost, optional flip, `REMOVE_FROM_GAME`, Threat Zone UI, three cards), commit 2 about 2-3 h (`ADD_ACCELERATION`, selector + `filter` in `EXHAUST`/`READY`, two cards, editor registry, docs). Risk medium-high: new zone touches state validation, setup and UI; B2 extends `PLAYER_CHOICE` (used by existing cards, covered by existing tests) and `EXHAUST`/`READY`; mitigated by TDD, the conservation test and keeping unfiltered behavior under existing tests.
