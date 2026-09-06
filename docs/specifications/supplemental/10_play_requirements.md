# Supplemental Data Schema Specification — Play Requirements

> [!IMPORTANT]
> **Authoritative Specification & Single Source of Truth:**  
> This specification defines the declarative schema for card-level play restrictions and requirements (`PlayRequirementsSchema`) as governed by the Marvel Champions Rules Reference (RR v1.8 p. 16 "Play Restrictions, Permissions, & Instructions").
>
> All supplemental files are automatically validated during CI/CD via `tests/data/supplemental-schema.test.ts`.

---

## 🏷️ Implementation Status Legend

- 🟢 **`IMPLEMENTED (v1.0)`**: Fully wired into `src/engine/pipeline/legality-checker.ts`, validated against `canPlayCard` and `evaluateCardPlayability`, tested via unit/contract tests, and supported in `src/ui/components/editor/AbilityFormBuilder.tsx`.

---

## 🏛️ Rules Reference (RR v1.8 p. 16) Alignment

Per Marvel Champions Rules Reference v1.8 p. 16 ("Play Restrictions, Permissions, & Instructions"):
1. Many cards have play restrictions printed on them (such as *"Hero form only."*, *"Alter-Ego form only."*, *"Play only if you have the Mystic trait."*, or *"Play only if you control an upgrade."*).
2. A player cannot play a card from their hand unless all of its play restrictions and play permissions are satisfied at the time of play.
3. Card-level play restrictions must be cleanly distinguished from triggered ability costs/timings on in-play cards (e.g. an upgrade with a `HERO_ACTION` in-play triggered ability can still be played from hand in Alter-Ego form unless the card explicitly states *"Hero form only."* or is an event).

---

## 📐 Schema Definition (`PlayRequirementsSchema`)

`PlayRequirementsSchema` is defined in `src/data/supplemental/schema.ts` and attached optionally to `CardEnrichmentSchema`:

```typescript
export const PlayRequirementsSchema = z
  .object({
    identityForm: z
      .enum(['HERO', 'ALTER_EGO'])
      .optional()
      .describe('Specifies required form to play card (RR v1.8 p. 16 "Hero form only" / "Alter-Ego form only").'),
    formTrait: z
      .string()
      .min(1)
      .optional()
      .describe('Required trait on current active form (e.g. "Giant", "Tiny" for Ant-Man cards).'),
    identityTraits: z
      .array(z.string().min(1))
      .optional()
      .describe('Required trait(s) on identity (e.g. ["Avenger"], ["Mystic"], ["X-Men"]).'),
    controlFilter: UniversalCardFilterSchema.optional().describe(
      'Required card in play under player control matching this universal filter (e.g. Wakanda Forever requiring Black Panther upgrade).',
    ),
    controlZones: z
      .array(z.enum(['tableau', 'allies', 'identity']))
      .optional()
      .describe('In-play zones to search for controlled cards. Defaults to ["tableau", "allies", "identity"].'),
    identityNames: z
      .array(z.string().min(1))
      .optional()
      .describe('Required identity card title or alter-ego name (e.g. ["Peter Parker"], ["Tony Stark"]).'),
  })
  .strict();
```

---

## 🔍 Supported Properties

| Property | Type | Description | Example Printed Text | Example Cards |
| :--- | :--- | :--- | :--- | :--- |
| `identityForm` | `'HERO' \| 'ALTER_EGO'` | Restricts card play to either Hero or Alter-Ego form. | *"Hero form only."* | `01009` (*Webbed Up*), `01018` (*Get Over Here!*) |
| `formTrait` | `string` | Requires the active identity card to have the specific trait. | *"Play only if you are in Giant form."* | Ant-Man / Wasp cards |
| `identityTraits` | `string[]` | Requires the identity (Hero or Alter-Ego side) to possess at least one matching trait. | *"Play only if your identity has the Mystic trait."* | Doctor Strange, Scarlet Witch cards |
| `controlFilter` | `UniversalCardFilter` | Evaluates cards currently **in play under player control** (`tableau`, `allies`, `identity`) against universal filter (traits, types, etc.). Per RR v1.8 p. 11 ("Control") & p. 16 ("In Play"), cards in hand, deck, or discard pile are out-of-play and strictly not controlled. | *"Play only if you control a Black Panther upgrade."* | `01043` (*Wakanda Forever!*) |
| `controlZones` | `('tableau' \| 'allies' \| 'identity')[]` | (Optional) Specific in-play zones to inspect for `controlFilter`. Defaults to `["tableau", "allies", "identity"]`. For example, setting `["tableau"]` restricts the search exclusively to player tableau upgrades and supports. | *"Play only if you control an upgrade in your tableau."* | `01043` (*Wakanda Forever!*) |
| `identityNames` | `string[]` | Requires identity title or alter-ego name to match one of the listed names. | *"Play only if you are Peter Parker."* | Hero-specific upgrades / allies |

---

## 📋 Supplemental JSON Examples

### 1. Hero Form Only (Upgrade) — `01009` (Webbed Up)
```json
{
  "code": "01009",
  "name": "Webbed Up",
  "comment": "Hero form only upgrade attachment to enemy.",
  "playRequirements": {
    "identityForm": "HERO"
  },
  "abilities": [
    {
      "timing": "HERO_ACTION",
      "steps": [{ "effect": "ATTACH_TO_HOST", "target": "CHOSEN_ENEMY" }]
    }
  ]
}
```

### 2. Controlled Card Filter (Event) — `01043a-d` (Wakanda Forever!)
```json
{
  "code": "01043a",
  "name": "Wakanda Forever!",
  "comment": "Requires at least 1 Black Panther upgrade in play.",
  "playRequirements": {
    "controlFilter": {
      "traits": ["Black Panther"],
      "types": ["upgrade"]
    }
  },
  "abilities": [
    {
      "timing": "HERO_ACTION",
      "steps": [{ "effect": "RESOLVE_SPECIAL" }]
    }
  ]
}
```

---

## ⚙️ Engine Integration (`evaluatePlayRequirements`)

`legality-checker.ts` exposes `evaluatePlayRequirements(state, player, card)` which evaluates:
1. `identityForm` against `player.currentForm` (as well as default hero timing checks for events and attachments).
2. `formTrait` against `player.activeFormCard.traits`.
3. `identityTraits` against `player.activeFormCard.traits`, `player.hero.traits`, and `player.alterEgo.traits`.
4. `controlFilter` using `matchesUniversalCardFilter` across `player.tableau`.
5. `identityNames` against `player.hero.name`, `player.alterEgo.name`, and active form titles.

Both `canPlayCard` and `evaluateCardPlayability` call `evaluatePlayRequirements` synchronously before evaluating resource costs or target validation.
