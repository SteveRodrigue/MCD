# Scenario Creation & Extensibility Guide

> [!IMPORTANT]
> **Synchronous Documentation Mandate (ADR-0022 / Mandate #16):**  
> Any new lifecycle hook, parameter, manifest property, or capability added to `src/engine/scenarios/` **must immediately be documented in this guide** with copy-pasteable TypeScript and JSON examples. Official scenarios and community custom scenarios share 100% architectural symmetry.

This guide explains how to author custom scenarios for **Marvel Champions Digital**. 

The engine uses a **universal scenario package format** where official built-in scenarios (`rhino`, `klaw`, `ultron`) and custom community fan-made scenarios share the **exact same public API, manifest schema, folder structure, and lifecycle hooks**.

---

## 📁 Package Directory Structure

Every scenario lives in its own self-contained directory under `src/engine/scenarios/built-in/<scenario_id>/` or `src/engine/scenarios/custom/<scenario_id>/`:

```text
src/engine/scenarios/custom/my_custom_scenario/
├── definition.json      # Declarative Manifest: stages, threat targets, modular sets
├── plugin.ts            # Executable Lifecycle Hooks: Stage transitions, custom rules
└── README.md            # Scenario rules breakdown & creator notes
```

---

## 📄 Step 1: Create the Manifest (`definition.json`)

The manifest defines the static properties, stages, health per player, and modular sets:

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
    },
    "healthPerPlayer": {
      "custom_v1": 12,
      "custom_v2": 15,
      "custom_v3": 18
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

## 📚 Related References
* [Supplemental Data Schema Specification](../specifications/supplemental_data_schema.md)
* [Hero & Identity Creation Guide](./hero_creation_guide.md)
* [Card Integration Protocol (SKILL.md)](../../.agents/skills/card-integration-protocol/SKILL.md)

