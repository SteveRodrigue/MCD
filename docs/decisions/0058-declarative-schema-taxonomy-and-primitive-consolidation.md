# [ADR-0058] Declarative Schema Taxonomy and Primitive Consolidation

- **Status:** Accepted
- **Date:** 2026-09-13
- **Authors:** MCD Core Team
- **Deciders:** User & Antigravity

---

## Context and Problem Statement

The declarative supplemental layer has accumulated overlapping trigger, effect, and target-selector vocabulary as the engine evolved through ADR-0046 (universal card filtering), ADR-0048 (timing and trigger disambiguation), and ADR-0049 (composable value transformers and event interception). Multiple names describe the same rules concept, while several genuinely universal capabilities are missing. This creates avoidable schema ambiguity, duplicated engine dispatch branches, editor complexity, and migration risk.

The governing audit report defines a canonical vocabulary and a phased migration plan. This ADR records the naming and consolidation decision as the authoritative contract for Phases 2–8 of the migration tracked by GitHub issue #111. The migration must preserve backward compatibility until all supplemental data and tests have moved to canonical names.

## Decision Drivers

- **Rules fidelity:** Canonical names must express Marvel Champions timing, event tense, targeting, and effect semantics precisely under Rules Reference v1.8.
- **Composable primitives:** Card-specific one-off effects should be decomposed into reusable declarative steps rather than retained as bespoke engine handlers.
- **Backward compatibility:** Additive aliases must precede data migration and legacy-name removal.
- **Schema and editor clarity:** The Zod schema, TypeScript models, JSON Schema export, editor descriptors, and documentation should share one vocabulary.
- **Deterministic migration:** Every rename and decomposition must be auditable, repeatable, and reversible at the data-file level.
- **Engine safety:** The migration must not introduce a card-specific engine path or break existing supplemental declarations during the transition.

## Considered Options

1. **Status quo:** Keep the existing overlapping vocabulary and add new capabilities beside it.
2. **Full canonical consolidation:** Establish one canonical vocabulary, add compatibility aliases, migrate data, then remove legacy names in ordered phases.
3. **Partial consolidation:** Rename only the most visible duplicates and retain bespoke primitives and selector variants indefinitely.

## Decision Outcome

**Chosen Option:** **Option 2: Full canonical consolidation with additive compatibility and phased cleanup**

### Rationale ("The Why")

A single canonical vocabulary reduces ambiguity across the schema, engine, supplemental JSON, editor, tests, and documentation. The additive-before-cleanup sequence preserves the working game while cards are migrated: new names are introduced alongside old names, supplemental data is rewritten, tests are realigned, and only then are legacy members removed. This ordering is mandatory because deleting a legacy identifier before the last card using it is migrated would make valid existing data fail to parse or execute.

`SEARCH` receives an `autoSelectIfUnambiguous?: boolean` parameter so the unified primitive can preserve the current no-prompt behavior for unambiguous retrievals without retaining retrieval-specific effect names. `REMOVE_STATUS` is introduced as a genuinely missing composable primitive, paired with `STATUS_REMOVED`. Controlled and friendly selectors are explicit so ownership and table-wide targeting cannot be conflated.

`ENEMY_INITIATES_ATTACK` is a universal event, not a synonym for villain attack. Its context must identify attacker kind (`VILLAIN` or `MINION`), attacker instance, attacked player, and engagement scope. Ability declarations must support a scope filter, such as `attackerKind: 'VILLAIN'` for Spider-Sense, so villain-only, minion-only, enemy-wide, and engaged-player reactions do not depend on which event names the pipeline happens to dispatch. This trigger-filter contract is a required follow-up, not yet an implemented Phase 2 capability.

The full mapping contract follows. These tables are copied from Sections 1.1–1.3 of the governing audit report and are self-contained here so later implementation work does not depend on the report remaining unchanged.

### 1. Trigger Types (`TriggerTypeSchema`)

#### A. Defeat & Lifecycle Windows

| Canonical Trigger        | Meaning & Supported Context                                                                                                                | Replaces / Consolidates                                                                                      |
| :----------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **`DEFEATED`**           | Universal root trigger emitted whenever any entity is defeated. Context provides `entityType` (`'CHARACTER'`, `'SCHEME'`, `'ATTACHMENT'`). | `MINION_DEFEATED`, `MINION_DEFEATED_BY_ATTACK`, `ENEMY_DEFEATED_BY_HERO_ATTACK`, `HOST_DEFEATED`, `DEFEATED` |
| **`CHARACTER_DEFEATED`** | Explicit trigger for when a character (Hero, Ally, Minion, Villain) is reduced to 0 HP and defeated.                                       | `MINION_DEFEATED`, `HOST_DEFEATED`                                                                           |
| **`SCHEME_DEFEATED`**    | Explicit trigger for when a scheme (Side Scheme or Main Scheme) is defeated / cleared of threat.                                           | `SCHEME_THREAT_REDUCED_TO_ZERO`                                                                              |
| **`ENTERS_PLAY`**        | Card enters the in-play zone. Context provides entering card instance and controller.                                                      | `ENTERS_PLAY`, `MINION_ENTERS_PLAY`                                                                          |
| **`CARD_PLAYED`**        | Card was actively played from hand or non-hand zone with resources paid.                                                                   | `CARD_PLAYED`, `PLAYED`                                                                                      |

#### B. Combat & Damage Windows

| Canonical Trigger            | Timing / Tense          | Meaning                                                                                                                |
| :--------------------------- | :---------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **`ENEMY_INITIATES_ATTACK`** | Interrupt (Prospective) | Enemy declares attack against player identity / character. Replaces `VILLAIN_INITIATES_ATTACK`.                        |
| **`DAMAGE_WOULD_BE_TAKEN`**  | Interrupt (Prospective) | Damage calculated and about to be dealt (prevention/replacement window). Replaces `TAKE_ATTACK_DAMAGE`, `TAKE_DAMAGE`. |
| **`DAMAGE_TAKEN`**           | Response (Past)         | Damage was successfully dealt and applied to hit points.                                                               |
| **`ATTACK_DEFENDED`**        | Response (Past)         | Identity or ally successfully exhausted to defend against an attack. Replaces `HERO_DEFENDED_ATTACK`.                  |
| **`ATTACK_RESOLVED`**        | Response (Past)         | Full attack execution pipeline concluded.                                                                              |
| **`THWART_RESOLVED`**        | Response (Past)         | Full thwart execution pipeline concluded.                                                                              |

#### C. Threat & Scheme Windows

| Canonical Trigger            | Timing / Tense          | Meaning                                                                             |
| :--------------------------- | :---------------------- | :---------------------------------------------------------------------------------- |
| **`THREAT_WOULD_BE_PLACED`** | Interrupt (Prospective) | Threat is about to be placed on a scheme (Great Responsibility / Emergency window). |
| **`THREAT_PLACED`**          | Response (Past)         | Threat was successfully added to a scheme.                                          |
| **`MAIN_SCHEME_ADVANCED`**   | Response (Past)         | Main scheme exceeded threshold and advanced to next stage.                          |

#### D. Form, Status, Phase & Encounter Windows

| Canonical Trigger                                 | Timing / Meaning                                                          | Replaces                                                            |
| :------------------------------------------------ | :------------------------------------------------------------------------ | :------------------------------------------------------------------ |
| **`FORM_CHANGED`**                                | Form change completed (context carries `newForm: 'hero' \| 'alter_ego'`). | `FORM_CHANGED_TO_HERO`, `FORM_CHANGED_TO_ALTER_EGO`, `HERO_FLIPPED` |
| **`STATUS_REMOVED`**                              | Status card (Stunned, Confused, Tough) was discarded / cured.             | _New primitive companion trigger_                                   |
| **`WHEN_REVEALED`**                               | When-revealed resolution / interrupt window.                              | `WHEN_REVEALED`, `TREACHERY_REVEALED`                               |
| **`ROUND_BEGAN` / `ROUND_ENDED`**                 | Round lifecycle boundaries.                                               | `ROUND_END`, `ROUND_ENDED`                                          |
| **`PLAYER_PHASE_BEGAN` / `PLAYER_PHASE_ENDED`**   | Player phase boundaries.                                                  | `PHASE_START`                                                       |
| **`VILLAIN_PHASE_BEGAN` / `VILLAIN_PHASE_ENDED`** | Villain phase boundaries.                                                 | —                                                                   |

### 2. Effect Primitives (`EffectTypeSchema`)

#### A. Card & Zone Operations (No "CARD", Always Plural)

| Canonical Effect        | Parameter Schema & Description                                                                                                                                                                                                                                                                                   | Replaces                                                                                                           |
| :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **`DRAW`**              | `{ count?: number \| DynamicValueSource, limit?: 'HAND_SIZE' \| 'PRINTED_HAND_SIZE', target?: TargetSelector }`                                                                                                                                                                                                  | `DRAW_CARDS`                                                                                                       |
| **`DISCARD`**           | `{ count?: number \| 'ALL' \| DynamicValueSource, source?: 'HAND' \| 'DECK' \| 'TABLEAU' \| 'HOST' \| 'SELF', filter?: UniversalCardFilter, mode?: 'CHOSEN' \| 'RANDOM' \| 'TOP' }`                                                                                                                              | `DISCARD`, `DISCARD_CARDS`                                                                                         |
| **`PUT_INTO_PLAY`**     | `{ destination?: 'TABLEAU' \| 'ENGAGED_WITH_PLAYER', engagedWith?: 'SELF' \| 'TARGET', target?: TargetSelector }`                                                                                                                                                                                                | `PUT_INTO_PLAY`, `PUT_INTO_PLAY_ENGAGED`, `SPAWN_MINION_ENGAGED`                                                   |
| **`PLAY_FROM_ZONE`**    | `{ source: 'PLAYER_DISCARD' \| 'ANY_PLAYER_DISCARD' \| 'PLAYER_DECK' \| 'SET_ASIDE', filter?: UniversalCardFilter, costMode?: 'PRINTED_COST' \| 'FREE' \| 'REDUCED' }`                                                                                                                                           | `PLAY_CARD_FROM_ZONE`                                                                                              |
| **`SEARCH`**            | `{ source: 'PLAYER_DECK' \| 'ENCOUNTER_DECK' \| 'PLAYER_DISCARD' \| 'ENCOUNTER_DISCARD' \| 'PLAYER_HAND', lookCount?: number \| DynamicValueSource, takeCount?: number, filter?: UniversalCardFilter, selectedDestination?: 'HAND' \| 'TABLEAU' \| 'DECK_TOP' \| 'DISCARD', autoSelectIfUnambiguous?: boolean }` | `SEARCH_AND_SELECT`, `SEARCH_AND_PLAY_UPGRADE`, `RETRIEVE_CARD_FROM_DISCARD`, `RETRIEVE_TECH_UPGRADE_FROM_DISCARD` |
| **`RETURN_TO_HAND`**    | `{ target?: TargetSelector, filter?: UniversalCardFilter }`                                                                                                                                                                                                                                                      | `RETURN_TO_HAND`, `RETURN_FACEDOWN_CARDS_TO_OWNERS`                                                                |
| **`SHUFFLE_INTO_DECK`** | `{ source?: 'DISCARD' \| 'HAND' \| 'PLAY', target?: TargetSelector }`                                                                                                                                                                                                                                            | `SHUFFLE_DISCARD_INTO_DECK`, `SHUFFLE_INTO_DECK`                                                                   |

> [!NOTE]
> **`SEARCH` Consolidation Rationale:** `RETRIEVE_CARD_FROM_DISCARD` / `RETRIEVE_TECH_UPGRADE_FROM_DISCARD` are a redundant, hand-rolled special case of `SEARCH` with `source: 'PLAYER_DISCARD'` — both scan a zone, apply a `UniversalCardFilter`, and route matches to a destination. The rename from `SEARCH_AND_SELECT` to `SEARCH` aligns with RR v1.8 p. 26 ("Search") and drops the narrative `_AND_SELECT` suffix (selection is implied by every zone-inspection primitive). To preserve the current silent/automatic UX of `RETRIEVE_*` (no prompt when there is only one valid outcome), `SEARCH` gains a new `autoSelectIfUnambiguous?: boolean` param (default `true`): when the number of matching candidates is `<= takeCount`, the effect resolves automatically without a `PendingDecisionPrompt`. This also benefits every other `SEARCH` call with an equivalently unambiguous match set.
>
> **Considered Alternative (Rejected for Now):** Splitting into `SEARCH` (full-zone, `lookCount` omitted, RR p. 26) vs. `LOOK_AT` (top-N, `lookCount` set, RR p. 19 "Look at") would more precisely mirror the two distinct RR phrases, but adds a second enum value for a distinction the existing `lookCount` param already self-documents. Revisit only if Card Editor UX reviewers need the RR terms to be visually separated.

#### B. Combat, Damage & Threat Primitives

| Canonical Effect     | Parameter Schema & Description                                                                             | Replaces                                                              |
| :------------------- | :--------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- |
| **`DEAL_DAMAGE`**    | `{ amount: number \| DynamicValueSource, target: TargetSelector, overkill?: boolean, ranged?: boolean }`   | `DEAL_DAMAGE`, `DEAL_DAMAGE_ALL_ENEMIES`                              |
| **`HEAL_DAMAGE`**    | `{ amount: number \| DynamicValueSource, target: TargetSelector }`                                         | `HEAL_DAMAGE`, `HEAL_DAMAGE_WITH_SURGE`                               |
| **`PREVENT_DAMAGE`** | `{ amount: number \| 'ALL' \| DynamicValueSource, target?: TargetSelector }`                               | `PREVENT_DAMAGE`, `CONSUME_INTERCEPTED_EVENT`                         |
| **`REMOVE_THREAT`**  | `{ amount: number \| DynamicValueSource, target: TargetSelector }`                                         | `REMOVE_THREAT`                                                       |
| **`ADD_THREAT`**     | `{ amount: number \| DynamicValueSource, target: TargetSelector, cardCode?: string, perPlayer?: boolean }` | `ADD_THREAT`, `ADD_THREAT_PER_PLAYER`, `PLACE_THREAT_PER_SIDE_SCHEME` |

#### C. Counters & Status Primitives (Symmetric Status & Strict Plural Counters)

| Canonical Effect      | Parameter Schema & Description                                                                                                                               | Replaces                                                                                 |
| :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **`ADD_COUNTERS`**    | `{ amount: number \| DynamicValueSource, counterType?: string, target?: TargetSelector }`                                                                    | `ADD_COUNTER`, `ADD_COUNTERS`                                                            |
| **`REMOVE_COUNTERS`** | `{ amount: number \| 'ALL' \| DynamicValueSource, counterType?: string, target?: TargetSelector, filter?: UniversalCardFilter, discardWhenEmpty?: boolean }` | `REMOVE_COUNTER`, `REMOVE_COUNTERS`, `SPEND_COUNTERS`, `REMOVE_COUNTERS_MATCHING_FILTER` |
| **`ADD_STATUS`**      | `{ status: 'STUNNED' \| 'CONFUSED' \| 'TOUGH', target: TargetSelector }`                                                                                     | `ADD_STATUS`, `ADD_STATUS_WITH_SURGE`                                                    |
| **`REMOVE_STATUS`**   | `{ status: 'STUNNED' \| 'CONFUSED' \| 'TOUGH' \| 'ALL', target: TargetSelector }`                                                                            | _New Missing Core Primitive_                                                             |

#### D. Stats, Limits & Control Flow Primitives

| Canonical Effect              | Parameter Schema & Description                                                                                                                                                  | Replaces                                                           |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------- |
| **`MODIFY_STAT`**             | `{ stat: 'ATK' \| 'THW' \| 'DEF' \| 'REC' \| 'SCHEME', amount: number \| DynamicValueSource, target: TargetSelector, duration?: 'UNTIL_END_OF_PHASE' \| 'UNTIL_END_OF_ROUND' }` | `MODIFY_STAT`, `BOOST_STAT_CHOICE`, `BUFF_ALL_FRIENDLY_CHARACTERS` |
| **`MODIFY_ALLY_LIMIT`**       | `{ amount: number, target?: TargetSelector }`                                                                                                                                   | `MODIFY_ALLY_LIMIT`, `ALLY_LIMIT_BONUS`                            |
| **`MODIFY_RESTRICTED_LIMIT`** | `{ amount: number, target?: TargetSelector }`                                                                                                                                   | `RESTRICTED_LIMIT_BONUS`                                           |
| **`MODIFY_HAND_SIZE`**        | `{ amount: number, target?: TargetSelector }`                                                                                                                                   | `MODIFY_HAND_SIZE`                                                 |
| **`MODIFY_MAX_HEALTH`**       | `{ amount: number, target?: TargetSelector }`                                                                                                                                   | `MODIFY_MAX_HEALTH`                                                |
| **`PLAYER_CHOICE`**           | `{ options: Array<{ label: string, steps: AbilityStep[] }> }`                                                                                                                   | `PLAYER_CHOICE`, `NICK_FURY_CHOICE`                                |
| **`FORM_BRANCH`**             | `{ heroSteps?: AbilityStep[], alterEgoSteps?: AbilityStep[] }`                                                                                                                  | `HERO_FORM_BRANCH`, `FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE`          |

#### E. Retirement of Bespoke Legacy Primitives (Tech Debt Decomposition)

| Legacy Single-Use Primitive               | Decomposed Into Composable Architecture                                                                               |
| :---------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `NICK_FURY_CHOICE`                        | `PLAYER_CHOICE` with 3 options: (1) `DRAW` count 3, (2) `REMOVE_THREAT` amount 2, (3) `DEAL_DAMAGE` amount 4          |
| `EXPLOSION`                               | `DEAL_DAMAGE` (`target: 'ALL_CHARACTERS'`, `amount: 3`) + `DISCARD` (`target: 'SELF'`)                                |
| `HULK_DISCARD_RESOLUTION`                 | `DISCARD` (`count: 1`, `source: 'HAND'`) + `DynamicValueSource` (`attribute: 'PRINTED_RESOURCES'`)                    |
| `FORM_BRANCH_VILLAIN_ATTACK_OR_SURGE`     | `FORM_BRANCH` (`heroSteps: [VILLAIN_ATTACKS]`, `alterEgoSteps: [TRIGGER_SURGE]`)                                      |
| `REPULSOR_BLAST`, `REPULSOR_BLAST_DAMAGE` | `DISCARD` (`count: 3`, `source: 'DECK'`) + `DEAL_DAMAGE` (`amount: DynamicValueSource from DISCARDED_RESOURCE_COUNT`) |

### 3. Target Selector Types (`TargetSelectorSchema`)

Disambiguates **Controlled** (player's own board area) vs. **Friendly / Table-Wide** (any player's allies/characters across the board):

```typescript
export const TargetSelectorSchema = z.enum([
  // 1. Identity & Self
  'SELF', // The triggering card / ability host itself
  'SELF_IDENTITY', // The active player's Hero or Alter-Ego
  'TRIGGERING_HERO', // Hero that initiated or suffered the trigger

  // 2. Players
  'ACTIVE_PLAYER', // Player whose turn/action it currently is
  'CHOSEN_PLAYER', // Prompted target player
  'ALL_PLAYERS', // Every player at the table

  // 3. Controlled Entities (Own Player Board)
  'CHOSEN_CONTROLLED_ALLY', // "an ally you control"
  'ALL_CONTROLLED_ALLIES', // "all allies you control"
  'CHOSEN_CONTROLLED_CHARACTER', // "a character you control" (Hero or own ally)
  'ALL_CONTROLLED_CHARACTERS', // "all characters you control"

  // 4. Friendly Entities (Table-Wide Player Side)
  'CHOSEN_ALLY', // "an ally" (any player's ally in play)
  'ALL_ALLIES', // "all allies in play"
  'CHOSEN_FRIENDLY_CHARACTER', // "a friendly character" (any hero or ally)
  'ALL_FRIENDLY_CHARACTERS', // "all friendly characters" (all heroes + allies)
  'ALL_HEROES', // "all heroes"

  // 5. Enemies (Villain & Minions)
  'VILLAIN', // Primary scenario villain
  'CHOSEN_ENEMY', // Prompted enemy (Villain or any Minion)
  'ALL_ENEMIES', // Villain + all minions in play
  'ENGAGED_ENEMIES', // Enemies engaged with active player
  'CHOSEN_MINION', // Prompted minion across entire table
  'ALL_MINIONS', // All minions in play
  'CHOSEN_ENGAGED_MINION', // Prompted minion engaged with active player
  'ENGAGED_MINIONS', // All minions engaged with active player
  'TRIGGERING_ENEMY', // Enemy that caused the trigger event
  'TRIGGERING_MINION', // Minion that caused the trigger event

  // 6. Universal Characters (Both Sides)
  'CHOSEN_CHARACTER', // Any character in play (Friend or Foe)
  'ALL_CHARACTERS', // All heroes, allies, villains, minions

  // 7. Schemes (Main & Side)
  'MAIN_SCHEME', // Primary main scheme
  'CHOSEN_SIDE_SCHEME', // Prompted side scheme
  'CHOSEN_SCHEME', // Prompted scheme (Main or Side)
  'ALL_SCHEMES', // Main scheme + all side schemes in play
  'TRIGGERING_SCHEME', // Scheme causing the trigger event

  // 8. Pipeline Context Continuity
  'PREVIOUS_TARGET', // Inherited target from immediate preceding step
  'PREVIOUS_SELECTED_CARD', // Card resolved in previous search/select step
]);
```

## Evaluation of Options

### Option 1: Status quo

- **Pros:** No migration cost; no compatibility window required.
- **Cons:** Preserves overlapping names, duplicated handlers, and editor ambiguity; does not provide the missing universal primitives.

### Option 2: Full canonical consolidation with additive compatibility and phased cleanup (Selected)

- **Pros:** One vocabulary across all layers; deterministic migration; backward compatibility during the transition; composable replacements for bespoke effects; clear ownership semantics for targets.
- **Cons:** Requires a multi-phase migration, temporary duplicate aliases and dispatch cases, and coordinated data, test, editor, and documentation updates.

### Option 3: Partial consolidation

- **Pros:** Smaller immediate diff and lower short-term migration effort.
- **Cons:** Leaves the most difficult legacy primitives and ambiguities in place, produces no stable long-term taxonomy, and defers rather than removes maintenance cost.

## Consequences

### Positive Consequences

- Supplemental declarations become easier to validate, search, review, and author.
- Engine dispatch and editor descriptors can converge on one canonical vocabulary.
- `SEARCH` can replace retrieval-specific handlers while preserving unambiguous automatic resolution.
- `REMOVE_STATUS` and `STATUS_REMOVED` provide a symmetric status lifecycle.
- Explicit controlled, friendly, and table-wide selectors reduce targeting mistakes.
- The additive-first sequence keeps existing cards executable throughout Phases 2 and 3.

### Negative Consequences / Risks & Mitigations

- **Migration complexity:** A large catalog and multiple subsystems must be updated. Mitigation: use the report’s file-by-file phases, deterministic migration script, dry-run diffs, and per-sub-phase quality gates.
- **Temporary vocabulary duplication:** Old and new names coexist during the compatibility window. Mitigation: track aliases and data migration from this ADR, then remove legacy values only after the catalog and tests are canonical.
- **Potential semantic drift:** A mechanical rename may hide a shape change. Mitigation: hand-write decompositions for the five bespoke primitives and validate every declaration against the Zod schema.
- **Cross-player targeting risk:** Controlled and friendly selectors may be confused. Mitigation: encode the distinction in selector names, engine contract tests, and editor descriptors.
- **Scope expansion:** Expansion cards and non-Rhino scenarios remain outside this migration’s active release scope under the repository’s Rhino-first boundary.
