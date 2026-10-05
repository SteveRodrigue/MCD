# Plan: #222, form-literal "your hero" target selector `SELF_HERO`

> **Status:** implemented 2026-10-04 (approved; uncommitted). **Decision taken by the user: the selector is named `SELF_HERO` (option A of the naming comparison); the related selector cleanup in section 2b is part of this change.** Tier 2 (new generic selector, schema + engine + editor + docs) plus card integration of the cards it unblocks. Engine prerequisite for the Rhino slice; unblocks `01168` (When Revealed), `01173` (When Revealed, closes #241) and, once the discard-then-choose amount is confirmed, `01159`. `01164` also needs #223.
> **UI / Card Editor impact:** the selector appears in every target dropdown automatically (they are built from `TargetSelectorSchema`); a registry test pins it.

## 1. Problem

Printed "**your hero**" must resolve to the resolving player's hero identity **only while it is in hero form**, never to the alter-ego (project rule: cards are read literally). No selector expresses it:

| Selector today | Behaviour | Why it is wrong for "your hero" |
| :-- | :-- | :-- |
| `SELF_IDENTITY` | the player's identity in either form | correct for "take damage" / "your identity", but damages or stuns the alter-ego when the card says "your hero" |
| `ALL_HEROES` | every player in hero form | hits other players (the original #133 bug) |
| `HERO` (not in `TargetSelectorSchema`, handled ad hoc in `DEAL_DAMAGE`) | every hero-form player in `DEAL_DAMAGE` (`effects/index.ts` ~L2000), the resolving or targeted player in the resolver | unvalidated string that passes only because `effectParams` is an untyped bag |
| `TRIGGERING_HERO` | the resolver already returns the resolving player's hero only in hero form (`target-resolver.ts` L265), but the name says "the hero that triggered the event" and `DEAL_DAMAGE` has no branch for it | misleading name, not wired into damage |

## 2. Proposal (the shape the issue asks for)

Add one generic selector, **`SELF_HERO`**: the resolving player's identity while `currentForm === 'hero'`; **nothing** in alter-ego form (the step is skipped, never a fallback to the alter-ego); other players are never touched.

- `target-resolver.ts`: `resolveTargets` case `SELF_HERO` (and the `getEligibleTargets` candidate case, so `canInitiateAbility` checks agree). Every effect that resolves targets through `resolveCharacterTargets` (`ADD_STATUS`, `EXHAUST`, `READY`, `HEAL_DAMAGE`, ...) gets the behaviour for free.
- `effects/index.ts` `DEAL_DAMAGE`: it resolves targets with ad-hoc string branches, not the resolver. The identity-damage block for `SELF_IDENTITY`/`IDENTITY`/`SELF` (Tough check, `DAMAGE_TAKEN` interrupt window, health, defeat) is extracted into one local helper and reused by a new `SELF_HERO` branch that first checks the form (alter-ego form: no-op result `success: true, mutatedState: false`).
- `schema.ts` `TargetSelectorSchema` + regenerated `schema.json`.
- Docs: `03_costs_and_targeting.md` (selector table, the "your hero" paragraph at L130 and the orthogonal-scopes matrix), `05_effects_combat_threat.md` (`DEAL_DAMAGE` target list), ADR-0058 addendum (taxonomy). The ad-hoc `HERO` and the overlapping `TRIGGERING_HERO` are **not** changed here; they are noted for the WP5 guard (a `target` value that is not a valid selector should fail the data test) and WP7.
- Out of scope: attack primitives targeting "your hero" (`01164` Titania, needs #223).

## 2b. Selector hygiene (same change, so nothing is postponed)

Naming rationale: schema selectors are `PREFIX_NOUN` families anchored to an entity (`SELF_`, `ALL_`, `CHOSEN_`, `TRIGGERING_`, `HOST_`). `ACTIVE_PLAYER` means the **turn player** (`state.players[state.activePlayerIndex]`), not the player resolving the card, so `ACTIVE_HERO` would anchor on the wrong player. The Rules Reference "YOU, YOUR" entry anchors on "the player resolving the card ability", which is the `SELF_` family (`SELF_IDENTITY`, now `SELF_HERO`). `SELF_ALTER_EGO` is added only when a card needs it.

A survey of every `target` value in the three packs against `TargetSelectorSchema` (`target` inside `effectParams` is not schema-validated) found **four values that are not in the schema**. Fate of each:

| Value | Used by | Fate in this change |
| :-- | :-- | :-- |
| `ACTIVE_IDENTITY` | `01112` False Alarm ("You are confused", the identity in either form) | Data migrated to `SELF_IDENTITY` (same behaviour, pinned by a test written first). The engine labels `ACTIVE_IDENTITY` in `target-resolver.ts` (two sites) are deleted: the name suggested "the turn player" but resolved the resolving player, and an alias outside the schema is banned by our ADRs. |
| `THIS_SIDE_SCHEME` | `01107`, `01109` | A working selector (resolver L1043, spec `05` mentions it) missing from the enum and from spec `03`: **added** to `TargetSelectorSchema` and documented. |
| `DEFENDING_PLAYER` | `01173` (the boost, WP8) | A working selector (resolver L346): **added** to the enum and documented. |
| `ATTACHED_VILLAIN` | `01098` Charge (`ATTACHMENT_DAMAGE_SHIELD.target`) | The effect is a no-op case and the `target` is never read (audit class B): the key is **removed** from the data now (the rest of the WP7 shield cleanup stays in WP7, #232). |

Result: **every `target` value in the packs is a valid `TargetSelector`**, and a new data test enforces it with **zero exemptions** (it is the `target` slice of WP5, #230).

**Left in the engine and documented for later tasks (not data-visible, so no card is affected):**
- Ad-hoc selector strings still handled only in engine code: `HERO` (`DEAL_DAMAGE` and the resolver), `IDENTITY` (resolver, formula evaluator, counters), `ALTER_EGO` (resolver candidates). No pack uses them. They are recorded under **WP7 (#232)**: replace each by a schema selector or delete it (`HERO` is superseded by `SELF_HERO` and `ALL_HEROES`; `IDENTITY` is legitimate in the narrow `target: SELF | IDENTITY` enum of the counter params, which is a separate schema and stays).
- `TRIGGERING_HERO` overlaps `SELF_HERO` in the resolver but means "the hero that triggered the event" in the docs: decide in WP7 whether to implement its documented meaning or remove it.
- WP5 (#230) keeps its broader scope (per-effect allowed `effectParams` keys); its `target` slice is delivered here.

## 3. Cards integrated in the same change (protocol: printed text, original data, proposed data, why)

### 3.1 Sweeping Swoop `01168`, When Revealed (boost stays blocked on #221)

- **Printed:** *When Revealed: Stun your hero. If Vulture is in play, this card gains surge.* / *[star] Boost: If this activation deals damage to a friendly character, stun that character.*
- **Original data:** abilities stripped under the circuit-breaker (placeholder `DEAL_DAMAGE 2 / HERO` and an unconditional boost stun were removed in #133's follow-up).
- **Proposed:** `WHEN_REVEALED`: step 1 `ADD_STATUS { status: STUNNED, target: SELF_HERO }`; step 2 `SURGE` gated `IF_CARD_IN_PLAY` `gateParams.cardCode: "01167"` (Vulture). The boost stays stripped (needs the "this activation deals damage" gate, #221); the ambiguity report is updated to say only the boost is still blocked.
- **Why:** the `SURGE` effect and `IF_CARD_IN_PLAY` already exist; the Surge *keyword* (#218) is a different mechanism and not used here.

### 3.2 Electric Whip Attack `01173`, When Revealed (closes #241)

- **Printed:** *When Revealed: Choose to either deal 1 damage to your hero for each upgrade you control or choose and discard an upgrade you control.*
- **Original data:** the When Revealed ability is absent (stripped in WP8); the boost is done.
- **Proposed:** `WHEN_REVEALED`, one `PLAYER_CHOICE` step with two options (option-level `steps`, ADR-0075): (a) `DEAL_DAMAGE` on `SELF_HERO` with `amount: { from: ENTITY_COUNT, filter: { types: [upgrade] } }`; (b) `DISCARD` `source: TABLEAU`, `filter: { types: [upgrade] }`, `target: DEFENDING_PLAYER` (same shape as the boost; `DEFENDING_PLAYER` is the revealing player here, to be confirmed by a test). Then `audit.confidence` back to 98+, `audit.ambiguityFile` removed, ambiguity report deleted.
- **Open check (test decides):** in alter-ego form option (a) is a no-op; if the choice should then be unavailable rather than a wasted pick, I will report it before adding any extra gating.

### 3.3 Ritual Combat `01159` (stretch, no decision needed)

- **Printed:** *When Revealed: Discard the top card of the encounter deck. Then, choose to either deal X damage to your hero or place X threat on the main scheme. X is 1 more than the number of boost icons on the discarded encounter card.*
- **Proposed:** `DISCARD` (`source: ENCOUNTER_DECK`, top, 1), then `PLAYER_CHOICE` with `DEAL_DAMAGE` on `SELF_HERO` and `ADD_THREAT` on `MAIN_SCHEME`, both `amount: 1` plus `dynamicBonus: { from: DISCARDED_CARDS, discardAttribute: BOOST_ICONS }`.
- **Risk:** the ambiguity report flags that option amounts may not read the discarded card once the prompt resolves after the discard step. I will write the test first. If it cannot be made to pass without a new engine primitive, the card stays stripped (circuit-breaker), the report is updated with the exact gap, and a new engine issue is filed; nothing else in this plan depends on it.

`01164` Titania's Fury stays blocked on #223 (named-minion attack); its report is updated to say the hero selector is no longer a blocker.

## 4. Tests (TDD, each written first and seen failing)

New `tests/engine/self-hero-selector.test.ts`:
1. `resolveTargets(..., 'SELF_HERO')`: hero form returns the hero, alter-ego form returns nothing, a second player is never returned; `SELF_IDENTITY` still returns the identity in both forms (guard).
2. `DEAL_DAMAGE` on `SELF_HERO`: damages the resolving player in hero form (Tough absorbs, `DAMAGE_TAKEN` window fires like `SELF_IDENTITY`), no damage and no fallback in alter-ego form, other players untouched; a formula `amount` (`ENTITY_COUNT` of upgrades) works.
3. `ADD_STATUS` stunned on `SELF_HERO`: stunned in hero form, untouched in alter-ego form.
4. Hygiene: a data test that every `target` string in every pack is a member of `TargetSelectorSchema` (fails today on the four values above); `01112` False Alarm confuses the resolving player's identity in both forms before and after the migration (written first, passes both sides: it pins the behaviour); `THIS_SIDE_SCHEME` and `DEFENDING_PLAYER` are accepted by the schema.

Card tests through the real reveal path, same style as the Hydra Bomber tests: `01168` (hero form: stunned; alter-ego form: not stunned; Vulture in play: surge, otherwise none), `01173` (both options with 0 and 2 upgrades, alter-ego form), `01159` per section 3.3. Registry test: `SELF_HERO` is listed in `TARGET_OPTIONS`. Schema test: the new selector and the three card shapes validate. Existing tests keep passing unchanged.

## 5. Files

`src/data/supplemental/schema.ts` (`SELF_HERO`, `THIS_SIDE_SCHEME`, `DEFENDING_PLAYER`), regenerated `schema.json`, `src/engine/effects/target-resolver.ts`, `src/engine/effects/index.ts`, `src/data/supplemental/pack/core_encounter.json` (`01168`, `01173`, `01112`, `01098`, and `01159` if it passes), specs `03` and `05`, ADR-0058 addendum, ambiguity reports (`01168` updated, `01173` deleted, `01159` updated or deleted, `01164` updated), new and extended tests, `CHANGELOG.md`, the remediation tracker (WP8 done), status doc (#222 done, #241 closed), `npm run report:declarations`.

## 5b. Implementation notes (2026-10-04)

- `01159` Ritual Combat integrated, no circuit-breaker needed: the one engine gap was that a `PLAYER_CHOICE` option could not read the cards discarded before the choice. Fixed generically (`PendingDecisionPrompt.discardedCards`, handed back when the option resolves). Amounts use `{ from: DISCARDED_CARDS, discardAttribute: BOOST_ICONS, offset: 1 }` for both options; `ADD_THREAT` does not read `dynamicBonus`, so the formula carries the "+1" itself.
- `01173` option (a) in alter-ego form is a no-op (damage skipped); the player still gets the choice. No extra gating added.
- The tests that pin the stripped state (`blocked-placeholder-cards.test.ts`, the WP8 "no abilities beyond the boost" test) were updated to the new reality (`01159` removed from the blocked list, `01168` keeps its When Revealed only).
- **New finding, filed as [#242](https://github.com/SteveRodrigue/MCD/issues/242):** False Alarm `01112` prints "If you are already confused, this card gains surge", which its data does not model.

## 6. Open decisions

None blocking. The name `SELF_HERO` was chosen by the user. One choice of mine you can veto: integrating the unblocked cards in the same change (consistent with your earlier instruction not to postpone follow-ups) rather than as separate items.
