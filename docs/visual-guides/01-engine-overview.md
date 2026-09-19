# 01. Engine & Round Overview

> Companion to [`algorithmic_rules_reference.md §2`](../algorithmic_rules_reference.md#2-core-game-loop--state-machine).
> This page re-frames the same state machine visually, oriented around "where does my card
> live, and when does its owner get to act?"

---

## 1. The Round Loop (Bird's-Eye View)

```mermaid
flowchart LR
    Setup(["Setup<br/>(scenario, decks, mulligan)"]) --> PP["Player Phase<br/>(player-phase.ts)"]
    PP --> VP["Villain Phase<br/>(villain-phase.ts)"]
    VP -->|roundNumber++| PP
    VP -->|Main Scheme fully advances| Defeat(["Defeat"])
    PP -->|Villain HP reaches 0| Victory(["Victory"])
```

- **Player Phase:** every player takes turns until all have passed. This is where `ACTION`,
  `RESOURCE`, and both `HERO_*`/`ALTER_EGO_*` timings fire.
- **Villain Phase:** a fixed 6-step machine (see [04. Combat & Villain Phase](./04-combat-and-villain-phase.md))
  where `WHEN_REVEALED`, `BOOST`, and villain/minion activation triggers fire.
- Round-boundary triggers (`ROUND_BEGAN`, `ROUND_ENDED`, `PLAYER_PHASE_BEGAN/ENDED`,
  `VILLAIN_PHASE_BEGAN/ENDED`) are dispatched at the transitions above — see
  [`src/engine/pipeline/round-upkeep.ts`](../../src/engine/pipeline/round-upkeep.ts).

---

## 2. Player Turn — Where Each `timing` Fires

```mermaid
flowchart TD
    Start(["Active player's turn begins"]) --> Choice{"Player chooses one action"}
    Choice -->|"timing: ACTION / HERO_ACTION / ALTER_EGO_ACTION"| Basic["Basic action:<br/>attack, thwart, recover, change form"]
    Choice -->|"timing: ACTION"| PlayCard["Play a card from hand<br/>(pays printed cost)"]
    Choice -->|"timing: RESOURCE / HERO_RESOURCE / ALTER_EGO_RESOURCE"| Resource["Generate a resource<br/>(during any open payment window)"]
    Choice -->|"timing: ACTION"| UseAbility["Use an in-play card's ability<br/>(USE_CARD_ABILITY)"]
    Choice -->|no legal/desired action| Pass(["Pass turn"])
    Basic --> End["Turn ends, next player"]
    PlayCard --> End
    Resource -.->|"resources feed into"| PlayCard
    Resource -.->|"resources feed into"| UseAbility
    UseAbility --> End
    Pass --> End
    End --> Next{"More players?"}
    Next -->|yes| Start
    Next -->|no| Villain(["→ Villain Phase"])
```

> [!TIP]
> `INTERRUPT` / `RESPONSE` / `FORCED_*` timings are **not** chosen from this menu — they are
> reactions dispatched by the [Trigger Resolution Stack](./03-trigger-resolution-stack.md) in
> response to _any_ player or villain-phase event, including the ones drawn above.

---

## 3. Zone Map (Where Targets & Effects Live)

```mermaid
flowchart TB
    subgraph Shared["Shared In-Play Area"]
        Villain["state.villain<br/>+ attachments"]
        MainScheme["state.mainScheme"]
        SideSchemes["state.sideSchemes[]"]
        EncounterDeck["state.encounterDeck / encounterDiscard"]
        Boost["state.activeBoostCard"]
    end
    subgraph PerPlayer["Per-Player Area (repeated per seat)"]
        Identity["player.activeFormCard<br/>hand / deck / discard"]
        Tableau["player.tableau<br/>(upgrades, supports)"]
        Allies["player.allies[]"]
        Engaged["player.engagedMinions[]"]
        Dealt["player.dealtEncounterCards[]"]
    end
    subgraph OutOfPlay["Out-of-Play"]
        SetAside["player.setAsideCards[]"]
        Victory["state.victoryDisplay[]"]
        Removed["state.removedFromGame[]"]
    end
```

Full field-level detail: [`algorithmic_rules_reference.md §3`](../algorithmic_rules_reference.md#3-formal-play-areas--zones-architecture-rr-v18-p-22-23).

---

**Next:** [02. Ability Lifecycle](./02-ability-lifecycle.md) — what happens the instant a
player or the engine decides to resolve one of your card's abilities.
