# [ADR-0075] Obligation Engine: Zone, Recipient Resolution and Ability-Based Resolution

- **Status:** Accepted
- **Date:** 2026-10-03
- **Authors:** MCD Core Team
- **Deciders:** User & Claude
- **Related Issues:** #158 (obligation engine), #208 (player-deck obligations, deferred), #209 (conditional-attach family, deferred), #175 (unconditional attachments)

---

## Context and Problem Statement

Obligations (RR v1.8 "Obligation") are shuffled into the encounter deck at setup, but on reveal the engine treated them like a treachery with no effect and silently discarded them. The five core-set obligations (Affairs of State, Legal Work, Eviction Notice, Business Problems, Family Emergency) all follow one printed pattern: *give to a specific identity's player; the player may flip to alter-ego form; then choose between "exhaust the alter-ego → remove this card from the game" and a card-specific penalty (+ surge on two of them)*.

An audit of all 106 upstream obligation cards (`data/upstream/pack/*.json`, zzorba datasets) showed: 68 say "Give to the <identity> player" and their `set_code` is exactly that hero's set; 2 say "Give to the first player" (*Now It's Personal*, Civil War); 35 have no give-to line and belong to non-hero (encounter or campaign) sets; none puts a condition on the recipient.

---

## Decision Drivers

- Zero text parsing and zero card-specific engine code (ADR-0018, ADR-0019): card type and set data drive generic behavior.
- Minimal supplemental data: the common case should need no declaration; only real derogations are declared.
- Reuse existing machinery (`ENTERS_PLAY`, `PLAYER_CHOICE`, step gates from ADR-0019 addendum, ability costs) instead of a parallel obligation schema.
- Card conservation (ADR-0040) and a UI home that leaves room for other encounter cards placed in front of a player.

---

## Considered Options

1. **Dedicated `obligation` block** (`recipient`, `mayFlipTo`, `options[{cost, steps}]`) on every card.
2. **Type-driven engine behavior + ordinary abilities** (chosen).
3. A Civil-War-style explicit recipient on every card (rejected: boilerplate on 105 of 106 cards).

---

## Decision Outcome

**Chosen Option:** **Option 2: type-driven engine behavior plus ordinary abilities.**

### 1. Recipient: data-derived default, optional override outside the abilities

- **Default (no declaration).** An obligation revealed from the encounter deck goes to the owner of its **hero set** when the card belongs to one (the player whose hero/alter-ego `setCode` equals the card's `setCode`); otherwise to the **revealing player** (rule 3). When the hero is not in the game, rule 2 applies: remove the card from the game and reveal an additional encounter card. Rule 2 is engine behavior with **no card field**: no obligation overrides it.
- **`belongsToHeroSet`** is a flag derived by `CardCatalog` at load time from set data (some hero/alter-ego card in the same catalog carries the same `setCode`). It is not derived from card text, and it keeps the headless engine independent of the catalog singleton.
- **Override.** Optional top-level enrichment field `recipient` (a sibling of `maxPerPlayer`, outside `abilities`): `FIRST_PLAYER`, `REVEALING_PLAYER`, `CARD_SET_OWNER` (explicit default) or `IDENTITY { codes }`. Absent means nothing changes. Only the two PvP cards need it today; *Now It's Personal* `56128b` is implemented as the real proof card (its Action ability needs Civil War teams and leaders: `docs/ambiguities/cw_56128b_now-its-personal.md`).

### 2. Zone and UI

- New flat `PlayerState.obligations` (like `engagedMinions` and `dealtEncounterCards`; no nested `threatZone` yet), registered in the card-conservation scans. It is deliberately not `tableau`, so obligations stay out of upgrade/support logic (ADR-0074 actionability graying, Max-per-player).
- `HeroZone` renders each seat's **Threat Zone** as ordered sub-zones: Encounter Facedown, **Obligations**, (future persistent encounter cards), Minions Engaged (`ThreatZoneSubzone`). The header strings asserted by existing tests are unchanged when a seat holds no obligations, and gain `• K Obligations` otherwise.

### 3. Resolution is an ordinary ability (B2)

Each card declares one ability `timing: FORCED_RESPONSE`, `trigger: ENTERS_PLAY` (mandatory, so it auto-executes): an optional `CHANGE_FORM` to alter-ego, then a `PLAYER_CHOICE` whose options carry their own `steps`, and optionally an availability `gate` and a `cost`:

- **Ruling (user, 2026-10-03): Option A requires alter-ego form.** "Exhaust Carol Danvers" interacts with the alter-ego; per RR "Form", while in hero form abilities that interact with the alter-ego do not interact with the identity. The option therefore declares `gate: IF_FORM alter_ego` plus `cost: exhaustCard SELF_IDENTITY`. The optional flip before the choice is what makes it reachable from hero form; Option B is always available.
- **Availability is evaluated when a prompt becomes the active head**, not when it is enqueued (`refreshPromptOptionAvailability`, re-run after each resolved option), because sequences do not suspend on prompts: the flip prompt and the choice prompt are queued together, and the choice must reflect the flip. Options are cloned per prompt so shared card data is never mutated.
- Flipping by card ability does not use the once-per-turn voluntary form change (RR "Form").
- **Engine-owned completion default:** after the chosen option resolves, an obligation still in the owner's zone is discarded to the encounter discard; an option that removed it from the game leaves nothing to discard.
- The placeholder supplemental entries (`WHEN_REVEALED` + `DISCARD SELF`, confidence 50) are replaced. This also removes an unintended cancel window: with a `WHEN_REVEALED` ability, *Enhanced Spider-Sense* could have cancelled an obligation (same class of defect as #175).

### 4. New generic capabilities (none obligation-specific)

`REMOVE_FROM_GAME` (moves the source card to `removedFromGame`), `PLAYER_CHOICE` option-level `gate`/`cost`/`steps`, optional `CHANGE_FORM` (`form`, `optional`).

---

## Evaluation of Options

### Option 1: Dedicated `obligation` block
- **Pros:** self-contained and explicit.
- **Cons:** new schema and editor UI parallel to `PLAYER_CHOICE`/`CHANGE_FORM`, duplicated per card, no reuse for other card families.

### Option 3: Explicit recipient on every card
- **Pros:** no derived flag.
- **Cons:** boilerplate on nearly every card; the data already identifies the owner through `set_code`.

---

## Consequences

### Positive Consequences
- Five core obligations need no recipient data and one ability each; the Card Editor already edits abilities and steps.
- Prompt availability for gated or costed options now works for any `PLAYER_CHOICE` card.
- Clear extension points: sub-zones in the Threat Zone, `recipient` for new derogations.

### Negative Consequences / Risks & Mitigations
- Prompt options with `gate`/`cost` are re-evaluated whenever a prompt becomes the head. Mitigation: pure, cheap checks; covered by `tests/engine/obligations.test.ts`.
- The default relies on `set_code` conventions upstream. Mitigation: audited 106 cards; the 3 outliers are explicit (2 PvP cards declare `recipient`; Burning Hunger `34028` has no upstream text at all).
- Out of scope, tracked separately: obligations drawn from a player deck (#208) and the "Attach to X. Otherwise …" family (#209).

---

## Addendum (follow-up commit): remaining core obligations, tableau selector and acceleration

- **Business Problems `01170` ("exhaust each upgrade you control")** uses a **zone-generic selector** `ALL_CONTROLLED_TABLEAU` plus the existing `UniversalCardFilter` (`filter: { types: ["upgrade"] }`), not a type-specific selector. `EXHAUST` and `READY` now honor `filter` (the Card Editor and the spec already advertised it, the engine ignored it); a filter matching nothing is a no-op and never falls back to the identity. Options considered: type-specific `ALL_CONTROLLED_UPGRADES` (rejected: card type baked into the name), `source`/`count` params mirroring `DISCARD` (rejected: two ways to pick targets), plural `CardLocationSelector` (deferred: larger, revisit if a third primitive needs it).
- **Legal Work `01160`** uses the new generic `ADD_ACCELERATION` primitive on `GameState.accelerationTokens` (the existing field used by the villain-phase threat formula and the deck-exhaustion pipeline).
- All five core obligations are now integrated; each follows the same ability skeleton and none needs a `recipient` declaration.
