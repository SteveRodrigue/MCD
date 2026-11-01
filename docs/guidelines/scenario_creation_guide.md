# Scenario Creation & Extensibility Guide

> [!IMPORTANT]
> **Synchronous Documentation Mandate (ADR-0022 / Mandate #16):**  
> Any new lifecycle hook, parameter, manifest property, or capability added to `src/engine/scenarios/` **must immediately be documented in this guide** with copy-pasteable TypeScript and JSON examples. Official scenarios and community custom scenarios share 100% architectural symmetry.

This guide explains how to author custom scenarios for **Marvel Champions Digital**. 

The engine uses a **universal scenario package format** where official built-in scenarios (`rhino`, `klaw`, `ultron`) and custom community fan-made scenarios share the **exact same public API, manifest schema, folder structure, and lifecycle hooks**.

---

## 📁 Package Directory Structure

Every scenario lives in its own directory inside the pack that owns it, `content/packs/<pack>/scenarios/<scenario_id>/`:

```text
content/packs/<pack>/scenarios/my_custom_scenario/
├── definition.json      # Declarative Manifest: stages, threat targets, modular sets
└── README.md            # Scenario rules breakdown & creator notes
```

The Setup and When Revealed abilities printed on the scenario's main scheme cards are supplemental data of those cards (see below), so most scenarios need no code at all. Only a rule that cannot be expressed with the existing effects needs a script (`plugin.ts`, Step 2); Ultron's facedown Drone setup is the one example today.

---

## 📄 Step 1: Create the Manifest (`definition.json`)

The manifest defines the static properties, stages, and modular sets:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "my_custom_scenario",
  "name": "The Crimson Syndicate",
  "scenarioCardCode": "custom_001",
  "author": "Community Creator",
  "version": "1.0.0",
  "description": "Stop the Syndicate before they assemble the Omega Device!",
  "supportedDifficulties": ["SKIRMISH", "STANDARD", "EXPERT"],
  
  "villainSetup": {
    "villainName": "Crimson Leader",
    "stages": {
      "SKIRMISH": ["custom_v1"],
      "STANDARD": ["custom_v1", "custom_v2"],
      "EXPERT": ["custom_v2", "custom_v3"]
    }
  },

  "mainSchemeSetup": {
    "stages": ["custom_ms1a", "custom_ms1b"],
    "startingThreat": 0,
    "targetThreatPerPlayer": 6,
    "escalationThreatPerPlayer": 1
  },

  "modularEncounterSets": {
    "mandatory": ["crimson_syndicate"],
    "defaults": {
      "SKIRMISH": ["standard", "bomb_scare"],
      "STANDARD": ["standard", "bomb_scare"],
      "EXPERT": ["standard", "expert", "bomb_scare"]
    }
  }
}
```

Villain hit points are not declared here: each stage's hit points are the printed `health` of its villain card (per player when the card says so) times the number of players, set by `advanceVillainStage` (`src/engine/scenarios/advance-villain-stage.ts`).

---

## 🧩 Step 1b: Main Scheme Setup and When Revealed (data)

The text printed on a main scheme card is declared like any other card ability, in the supplemental data of its pack (`content/packs/<pack>/supplemental/`). The engine resolves it at the two moments the Rules Reference names (Appendix II step 12, and the main scheme entry):

1. **At setup:** the `SETUP` abilities of side A (stage 1A), then side 1B is placed and its `WHEN_REVEALED` abilities resolve, before the villain's own When Revealed.
2. **When the main scheme advances:** the `WHEN_REVEALED` abilities of the new A side, then the new B side is placed with its starting threat and its `WHEN_REVEALED` abilities resolve.

A `SETUP` ability has no `trigger`. Klaw's stage 1A and 1B, using existing effects:

```json
"01116a": {
  "abilities": [{
    "id": "klaw_underground_distribution_setup",
    "timing": "SETUP",
    "steps": [{
      "effect": "SEARCH",
      "effectParams": {
        "source": ["ENCOUNTER_DECK"],
        "filter": { "codes": ["01125"] },
        "takeCount": 1,
        "selectedDestination": "REVEAL",
        "autoSelectIfUnambiguous": true
      }
    }]
  }]
},
"01116b": {
  "abilities": [{
    "id": "klaw_underground_distribution_when_revealed",
    "timing": "WHEN_REVEALED",
    "trigger": "WHEN_REVEALED",
    "steps": [{
      "effect": "DISCARD",
      "effectParams": {
        "source": "ENCOUNTER_DECK",
        "mode": "UNTIL_MATCH",
        "untilFilter": { "types": ["minion"] },
        "matchingDestination": "PLAY",
        "target": "FIRST_PLAYER"
      }
    }]
  }]
}
```

Searching a deck shuffles it afterwards (Search rule), so a `SEARCH` step needs no extra shuffle. A main scheme with no abilities (Rhino's) does nothing.

**Environments** are put into play by the same effects: `SEARCH` with `selectedDestination: "TABLEAU"` puts a found environment card into the villain's play area (Ultron's stage 1A: filter `codes: ["01140"]`), and an environment revealed from the encounter deck enters play like any other card type.

---

## 💻 Step 2: Implement Lifecycle Hooks (`plugin.ts`)

Implement the `ScenarioPlugin` interface:

```typescript
import { GameState, VillainState, MainSchemeState } from '@engine/models';
import { cardCatalog } from '@data/card-loader';
import { ScenarioPlugin, ScenarioDefinition, GameSetupOptions } from '../../types';
import definitionData from './definition.json';

export class CustomScenarioPlugin implements ScenarioPlugin {
  definition = definitionData as ScenarioDefinition;

  onGameSetup(state: GameState, options: GameSetupOptions): GameState {
    // Custom setup logic...
    return state;
  }

  onVillainDefeated(state: GameState, defeatedVillainInstanceId: string) {
    // Stage transition or victory declaration...
    return { state, victory: true };
  }

  onMainSchemeCompleted(state: GameState, completedSchemeInstanceId: string) {
    // Main scheme defeat or advancement...
    return { state, defeat: true };
  }
}
```

---

## 🔌 Step 3: Register in `ScenarioRegistry`

Register your scenario in `ScenarioRegistry`:

```typescript
import { ScenarioRegistry } from '@engine/scenarios';
import { customPlugin } from './plugin';

ScenarioRegistry.register(customPlugin);
```

---

## 🧪 Step 4: Verify & Run Declarations Audit

After authoring and registering scenario cards:
```bash
npm run report:declarations   # Regenerates docs/reports/supplemental_declarations_usage_report.md
npm test                      # Runs full test suite
npm run typecheck             # Verifies TypeScript types
```

---

## 📚 Related References
* [Supplemental Data Schema Specification](../specifications/supplemental/README.md)
* [Hero & Identity Creation Guide](./hero_creation_guide.md)
* [Card Integration Protocol (SKILL.md)](../../.agents/skills/card-integration-protocol/SKILL.md)

