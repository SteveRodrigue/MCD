# [ADR-0031] Comprehensive Combat, Enemy Attack & Multi-Window Defense Pipeline

* **Status:** Accepted
* **Date:** 2026-08-31
* **Authors:** MCD Core Team
* **Deciders:** User & Antigravity

---

## Context and Problem Statement
In *Marvel Champions: The Card Game* (Rules Reference v1.8 p. 4 "Attack", p. 7 "Defend, Defense", p. 11 "Damage"), combat is not a simple integer subtraction (`player.health -= attack`). Rather, an enemy attack is a multi-step interactive state machine spanning **5 distinct timing windows**, supporting **Basic Hero/Ally Defense**, **Defense Events**, **In-Play Defense Upgrades**, **Boost Cancellations**, **Damage Prevention**, **Overkill**, **Retaliate**, and **Post-Defense Reactions**.

Previously, the MCD rules engine bypassed the entire defense subsystem:
1. `player.hero.defense` was never subtracted from incoming attacks.
2. Players could not exhaust a ready Hero or Ally to defend.
3. Defense Events (e.g. *Backflip* `01003`) and Defense Responses (e.g. *Indomitable* `01082`, *Counter-Punch* `01077`) lacked formal trigger windows.
4. Direct damage from treacheries and hazards was not formally distinguished from attack damage.

How should we design a complete, rules-accurate, and headless-decoupled Combat & Defense Pipeline that supports all 103+ defense-related cards in the Marvel Champions catalog?

---

## Decision Drivers
* **Driver 1: Official Rules Authority (RR v1.8 p. 4, 7, 11, 24):** Exact compliance with the 4-step enemy attack sequence, defense keyword invariants, overkill routing, and boost timing.
* **Driver 2: Direct Damage Invariant:** Strictly separate *Attack Damage* (defendable with DEF, ally blocks, and attack defense cards) from *Direct / Indirect Damage* (non-attack; DEF and attack defense cards forbidden).
* **Driver 3: Decoupled Headless Engine (ADR-0002):** Support interactive UI prompts (`DECLARE_DEFENDER`) while enabling deterministic automated policies for headless test simulations.
* **Driver 4: Complete Zzorba Catalog Compatibility:** Provide native trigger hooks for all 5 timing windows represented across 103 defense cards in the upstream data packs.

---

## Considered Options
1. **Option 1 (Ad-Hoc Damage Modifiers):** Keep direct state mutation in `villain-phase.ts` and add card-specific `if/else` checks for Backflip and DEF.
2. **Option 2 (5-Phase Reactive Combat State Machine):** Formally model enemy attacks as a 5-phase event pipeline (`AttackExecutionContext`) with discrete trigger windows and interactive prompt delegation.

---

## Decision Outcome

**Chosen Option:** **Option 2: 5-Phase Reactive Combat State Machine**

### The 5-Phase Attack State Machine

```mermaid
flowchart TD
    subgraph P1["Phase 1: Initiation & Pre-Attack"]
        A1["Check Stun / Webbed Up (Clear stun & cancel attack)"]
        A2["Dispatch 'WHEN_ENEMY_INITIATES_ATTACK' (Spider-Sense, Powerful Punch)"]
    end

    subgraph P2["Phase 2: Defender Declaration Window"]
        B1{"Open 'DECLARE_DEFENDER' Decision Window"}
        B1 -- 1. Basic Hero Defend --> B2["Exhaust Hero (Hero.DEF mitigates damage)"]
        B1 -- 2. Ally Defend --> B3["Exhaust Ally (Ally absorbs attack; Overkill check)"]
        B1 -- 3. Co-op Teammate Defend --> B4["Exhaust Teammate Hero/Ally (Switches target)"]
        B1 -- 4. Defense Initiation Event --> B5["Play 'I Can Do This All Day' / 'Mutant Protectors'"]
        B1 -- 5. Take Undefended --> B6["Identity is Target (DEF stat = 0)"]
    end

    subgraph P3["Phase 3: Boost Resolution & Boost Interrupts"]
        C1["Deal facedown Boost Card(s)"]
        C2["Boost Interrupt Window (Defiance, Preemptive Strike)"]
        C3["Count Boost Icons + Resolve ★ Star Boost abilities"]
        C4["Compute Total ATK = Base ATK + Boost Icons + Attachments"]
    end

    subgraph P4["Phase 4: Damage Calculation & Prevention Interrupts"]
        D1["Raw Damage = Total ATK - (Hero.DEF if defended by Hero)"]
        D2["Damage Prevention Window (Backflip, Cosmic Flight, Side Step)"]
        D3["Check Tough Status (absorb remaining damage if > 0)"]
        D4["Apply Final Damage (If Ally defeated & Overkill -> spillover to Hero)"]
        D5["Check Defeat / Knockout"]
    end

    subgraph P5["Phase 5: Post-Attack Responses & Retaliate"]
        E1["Retaliate Trigger (Defender deals damage back to attacker)"]
        E2["Dispatch 'HERO_DEFENDED_ATTACK' (Indomitable, Counter-Punch, Unflappable)"]
        E3["Dispatch 'ATTACK_RESOLVED'"]
    end

    P1 --> P2 --> P3 --> P4 --> P5
```

---

## Detailed Rules Specifications

### 1. The `(defense)` Trait Invariant (RR v1.8 p. 7)
* Playing any event labeled `(defense)` or triggering an in-play ability labeled `(defense)` automatically designates that player's hero as the **Defender** for that attack (unless an ally was already declared as defender).
* The hero is considered to have **defended the attack** (setting `attackContext.heroDefended = true`), satisfying prerequisite timing for *Indomitable*, *Counter-Punch*, and *Unflappable*.

### 2. Direct Damage vs. Attack Damage Invariant
* **Attack Damage:** Originates from enemy attack activations (Villain/Minion). Enables Hero DEF subtraction, Ally blocking, and attack-specific defense cards (*Backflip*, *Expert Defense*, *Never Back Down*).
* **Direct / Indirect Damage:** Originates from encounter cards (e.g. *Explosion* `01111`, *Hydra Bomber* `01108`, hazard icons) or consequential damage.
  - **Hero DEF CANNOT be used (0 DEF).**
  - **Allies CANNOT block.**
  - **Attack-specific defense cards (`"from an attack"`) are ILLEGAL to play.**
  - **Universal damage-prevention cards** (e.g. *Cosmic Flight* `01017` *"When Captain Marvel would take damage"*, *Forcefield*, or *Tough* status cards) remain fully functional.

### 3. Dual-Mode Execution Architecture
* **Interactive Mode:** Enqueues `DECLARE_DEFENDER` and `DEFENSE_INTERRUPT` prompts into `pendingDecisionQueue`.
* **Headless Simulation Mode:** Evaluates an automated defense policy (`NEVER_DEFEND`, `HERO_ALWAYS`, `ALLY_CHUMP_BLOCK`, or `HEURISTIC_OPTIMAL`) to run deterministic headless simulations at thousands of games per second.

---

## Consequences

### Positive Consequences
* Fully unlocks and implements 8+ Core Set cards (*Backflip*, *Cosmic Flight*, *Indomitable*, *Counter-Punch*, *Armored Vest*, *Get Behind Me!*, *Great Responsibility*, and all Ally blockers).
* Establishes permanent architecture for 103+ defense cards across all 170 official expansion packs.
* Prevents damage-related regressions by routing all attacks through a single deterministic combat pipeline.
