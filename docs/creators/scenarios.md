# Scenario Creation & Extensibility Guide

> [!IMPORTANT]
> **Synchronous Documentation Mandate (ADR-0022 / Mandate #16):**  
> Any new scenario hook, manifest property, or capability added to `src/engine/scenarios/` or to the pack hook contract (`src/engine/plugin-api/`) **must immediately be documented in this guide**.

This guide explains how to author scenarios for **Marvel Champions Digital**.

A scenario is a folder inside a content pack (ADR-0092). The content loader reads it at runtime and the engine builds every scenario the same way, from its `definition.json` and, when a rule cannot be data yet, a hook from the same pack's script. The official scenarios (`rhino`, `klaw`, `ultron`) are loaded from the Core pack exactly like a scenario from any other pack.

---

## 📁 Package Directory Structure

Every scenario lives in its own directory inside the pack that owns it, `content/packs/<pack>/scenarios/<scenario_id>/`:

```text
content/packs/<pack>/scenarios/my_custom_scenario/
├── definition.json      # Declarative Manifest: stages, threat targets, modular sets
└── README.md            # Optional: scenario rules breakdown & creator notes
```

The Setup and When Revealed abilities printed on the scenario's main scheme cards are supplemental data of those cards (see below), so most scenarios need no code at all. Only a rule that cannot be expressed with the existing effects needs a script (Step 2); Ultron's facedown Drone setup is the one example today.

The loader validates `definition.json` against `ScenarioDefinitionSchema`. A pack with an invalid definition, or whose scenario id is already used by an earlier pack, is disabled with a reason. A scenario whose pack is not loaded is not offered. The selector lists scenarios in ascending `scenarioCardCode` order.

---

## 📄 Step 1: Create the Manifest (`definition.json`)

The manifest defines the static properties, stages, and modular sets. Properties at the top level of `definition.json`:

| Property                | Required | Meaning                                                                                                                                                                                           |
| ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$schema`               | no       | Editor hint for JSON completion.                                                                                                                                                                  |
| `id`                    | yes      | Scenario id, unique across enabled packs.                                                                                                                                                         |
| `name`                  | yes      | Display name.                                                                                                                                                                                     |
| `scenarioCardCode`      | yes      | Code of the scenario card; also the sort key in the selector.                                                                                                                                     |
| `author`                | no       | Credit.                                                                                                                                                                                           |
| `version`               | no       | Your version string.                                                                                                                                                                              |
| `description`           | no       | One line shown in the selector.                                                                                                                                                                   |
| `setupOnomatopoeia`     | no       | Comic sound effect shown with the setup log entry.                                                                                                                                                |
| `supportedDifficulties` | yes      | The difficulties the player can pick, in button order: `SKIRMISH`, `STANDARD`, `EXPERT`. Each needs villain stages.                                                                               |
| `villainSetup`          | yes      | `villainName` and `stages`: villain card codes per difficulty. `SKIRMISH` lists the versions the players choose from; the game plays one, and the first is the default.                           |
| `mainSchemeSetup`       | yes      | Main scheme `stages` plus `startingThreat`, `targetThreatPerPlayer`, `escalationThreatPerPlayer`.                                                                                                 |
| `modularEncounterSets`  | yes      | `mandatory` set codes; optional `slotCount` (0: no modular slot) and `recommendedModularSets`.                                                                                                    |
| `encounterSetRules`     | no       | Only for a scenario that breaks the usual Standard or Expert set rule, see below.                                                                                                                 |
| `tokens`                | no       | Minions with no printed card that a pack script puts into play (`code`, `name`, `type`, `packCode`, `traits`, `scheme`, `attack`, `health`). An [art pack](art-packs.md) can give a token images. |

Unknown properties are rejected. Example:

```json
{
  "$schema": "../../../../../src/data/packs/scenario.schema.json",
  "id": "my_custom_scenario",
  "name": "The Crimson Syndicate",
  "scenarioCardCode": "custom_001",
  "author": "Community Creator",
  "version": "1.0.0",
  "description": "Stop the Syndicate before they assemble the Omega Device!",
  "setupOnomatopoeia": "THE SYNDICATE STRIKES!",
  "supportedDifficulties": ["SKIRMISH", "STANDARD", "EXPERT"],

  "villainSetup": {
    "villainName": "Crimson Leader",
    "stages": {
      "SKIRMISH": ["custom_v1", "custom_v2", "custom_v3"],
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
    "slotCount": 1,
    "recommendedModularSets": ["bomb_scare"]
  }
}
```

**Standard and Expert sets are not listed in a manifest.** The player picks them at setup from the sets of the enabled packs (`encounter-sets.json`), and a new set needs no manifest edit. Standard difficulty adds no Expert set, Expert requires one, and Skirmish may add one. Heroic mode selects no set.

A scenario that breaks this rule says so in `encounterSetRules`: `fixed` is the one set it always uses, or `null` for none. It shows as a locked badge, or no choice at all:

```json
{
  "supportedDifficulties": ["STANDARD", "EXPERT"],
  "modularEncounterSets": { "mandatory": ["my_set"], "slotCount": 0 },
  "encounterSetRules": { "standard": { "fixed": null }, "expert": { "fixed": null } }
}
```

To add a set to the deck, list it in `mandatory`.

`setupOnomatopoeia` (optional) is the comic sound effect shown with the setup log entry.

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

## 💻 Step 2: Pack script (only when a rule cannot be data)

An official pack can ship a script for what its cards and `definition.json` cannot express yet. The script exports a special handler (`SpecialAbilityHandler`, `src/engine/specials/special-registry.ts`), the pack's script index lists it in `PackHooks.specialHandlers`, and card data calls it with `EXECUTE_SPECIAL`:

```typescript
// content/packs/<pack>/scripts/scenarios/my_custom_scenario.ts
import type { SpecialAbilityHandler } from '@engine/plugin-api';

export const myHandler: SpecialAbilityHandler = {
  id: 'MY_SPECIAL',
  execute: (state, context, params) => {
    // ...change the state...
    return { state, success: true };
  },
};
```

```typescript
// content/packs/<pack>/scripts/index.ts
const hooks: PackHooks = {
  specialHandlers: [myHandler],
};
```

```json
{ "effect": "EXECUTE_SPECIAL", "effectParams": { "specialId": "MY_SPECIAL" } }
```

After adding a script, run `npm run schema:generate`: it rebuilds the hook map (`src/data/content/pack-hooks.generated.ts`) that lets the build find the pack's hooks. `npm run pack:validate -- content/packs` fails an official pack that has `scripts/` but no map entry.

**How the Ultron script works.** Many Ultron cards say a player puts the top card of their deck into play facedown, engaged with them, as a Drone minion. `content/packs/core/scripts/scenarios/ultron.ts` exports the `ULTRON_DRONE` handler for this, and each card calls it from its data with `target` and `count` (see `EXECUTE_SPECIAL` in the supplemental reference). A Drone is a minion shell (`isShell`: "Drone", SCH 1 / ATK 1 / HP 1, Drone trait) with the real card tucked under it, owned by the player whose deck it came from. When the shell leaves play it is removed, and the tucked card goes to its owner's discard pile through the normal tucked-card cleanup. Everything else about Ultron (his stages, the Ultron Drones environment, the sound effect) is data. When a second scenario needs the same concept (Vision), the script can be revisited.

> [!NOTE]
> **User packs cannot ship scripts.** They are JSON-only until a sandbox ADR exists (`pack:validate` rejects a user pack with `scripts/`). A scenario in a user pack uses `definition.json` and supplemental data only.

---

## 🔌 Step 3: Loading and registration

There is nothing to register by hand. When the app starts, the content loader reads every enabled pack, `applyContent` builds one `DeclarativeScenarioPlugin(definition, hooks?)` per scenario (with the hooks of the same pack when its script lists the scenario id) and puts it into `ScenarioRegistry`. `resetContent` empties the registry. In tests, the shared setup loads the real content; use `ScenarioRegistry.get('rhino')` to reach a plugin.

---

## 🧪 Step 4: Verify & Run Declarations Audit

After authoring the scenario and its cards:

```bash
npm run schema:generate       # schemas and the pack hook map
npm run pack:validate -- content/packs
```

```bash
npm run report:declarations   # Regenerates docs/reports/supplemental_declarations_usage_report.md
npx vitest run                # Runs full test suite
npm run typecheck             # Verifies TypeScript types
```

---

## 📚 Related References

- [Supplemental Data Schema Specification](supplemental-reference/README.md)
- [Hero & Identity Creation Guide](./cards-and-heroes.md)
- [Card Integration Protocol (SKILL.md)](../../.agents/skills/card-integration-protocol/SKILL.md)
