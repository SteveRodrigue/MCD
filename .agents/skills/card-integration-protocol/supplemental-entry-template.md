# Card Integration: Supplemental Entry Template

Strict template: the entry must match the schema in `src/data/supplemental/schema.ts` exactly. Replace the `<placeholders>`; timestamps and `reviewedBy` follow the [audit stamp rules](../../rules/shared-quality-gates.md#audit-stamp).

```json
"{card_code}": {
  "audit": {
    "createdAt": "YYYY-MM-DDTHH:mm:ssZ",
    "updatedAt": "YYYY-MM-DDTHH:mm:ssZ",
    "reviewedAt": "YYYY-MM-DDTHH:mm:ssZ",
    "reviewedBy": "<current agent identity, e.g. claude>",
    "rulesVersion": "v1.8",
    "confidence": 98,
    "originalText": "<Exact printed card text from upstream/printed card>"
  },
  "abilities": [
    {
      "id": "<card_name_ability_slug>",
      "timing": "<TIMING>",
      "trigger": "<TRIGGER_IF_REACTIVE>",
      "limit": "<ONCE_PER_ROUND | ONCE_PER_PHASE>",
      "cost": {
        "exhaustSelf": true,
        "removeCounter": 1,
        "discardSelf": true,
        "resourceCost": { "physical": 1 }
      },
      "steps": [
        {
          "id": "<optional_step_id>",
          "effect": "<EFFECT_PRIMITIVE>",
          "gate": "<ALWAYS | THEN | IF_AMOUNT_ZERO | IF_ALREADY_HAS_STATUS | IF_FAILED>",
          "params": {
            "searchZones": ["ENCOUNTER_DECK", "ENCOUNTER_DISCARD"],
            "shuffleDeck": "ENCOUNTER_DECK",
            "revealTarget": true
          }
        }
      ]
    }
  ]
}
```
