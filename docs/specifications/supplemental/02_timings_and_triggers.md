# 02. Ability Timings & Event Triggers

> [!NOTE]
> **Status:** 🟢 `IMPLEMENTED (v1.0)`  
> Validated via [`TimingTypeSchema`](file:///c:/Users/steve/OneDrive/Documents/Coding/MCD/src/data/supplemental/schema.ts#L25) and [`TriggerTypeSchema`](file:///c:/Users/steve/OneDrive/Documents/Coding/MCD/src/data/supplemental/schema.ts#L48).

---

## 1. Ability Timing Types (`timing`)

The `timing` field specifies when an ability can be initiated or how it intercepts engine execution:

| `timing` Enum Literal | Engine Category | Description | Form Gating |
| :--- | :--- | :--- | :--- |
| `'ACTION'` | Player Action | Voluntary player action during their turn in Player Phase. | Either Form |
| `'HERO_ACTION'` | Player Action | Action restricted strictly to Hero form. | Hero only |
| `'ALTER_EGO_ACTION'` | Player Action | Action restricted strictly to Alter-Ego form. | Alter-Ego only |
| `'INTERRUPT'` | Voluntary Reaction | Optional reaction interrupting an event before resolution. | Any |
| `'FORCED_INTERRUPT'` | Mandatory Reaction | Mandatory reaction interrupting an event before resolution. | Any |
| `'HERO_INTERRUPT'` | Reaction | Interrupt restricted to Hero form. | Hero only |
| `'ALTER_EGO_INTERRUPT'`| Reaction | Interrupt restricted to Alter-Ego form. | Alter-Ego only |
| `'RESPONSE'` | Voluntary Reaction | Optional reaction occurring immediately after event resolution. | Any |
| `'FORCED_RESPONSE'` | Mandatory Reaction | Mandatory reaction occurring immediately after event resolution. | Any |
| `'HERO_RESPONSE'` | Reaction | Response restricted to Hero form. | Hero only |
| `'ALTER_EGO_RESPONSE'` | Reaction | Response restricted to Alter-Ego form. | Alter-Ego only |
| `'WHEN_REVEALED'` | Encounter Mandatory | Triggered when encounter card is revealed in Step 5 or spawned. | Encounter |
| `'CONSTANT'` | Static / Aura | Continuous passive modifier while card remains face-up in play. | Any |
| `'SPECIAL'` | Composite Trigger | Triggered specifically by a parent event (e.g. *Wakanda Forever!*). | Any |
| `'SETUP'` | Scenario Setup | Executed during Step 4/8 of game setup (e.g. *T'Challa* upgrade search). | Setup Phase |
| `'BOOST'` | Boost Resolution | Triggered when card is flipped as a Villain or Minion boost card. | Step 2/3 Boost |
| `'CARD_PLAYED'` | On-Play Attachment | Triggered when upgrade/attachment is played onto a host. | Play window |

---

## 2. Event Trigger Windows (`trigger`)

When an ability is an Interrupt or Response, `trigger` binds it to an engine dispatch signal:

| `trigger` Enum Literal | Description | Source Pipeline |
| :--- | :--- | :--- |
| `'WHEN_REVEALED'` | Card is being revealed from encounter deck or dealt cards. | `step5_revealEncounterCards` |
| `'ATTACK'` | Target character is declared as the recipient of an attack. | `executeVillainAttackAgainstPlayer` |
| `'MINION_ATTACKED'` | Minion completes an attack activation against a player. | `executeMinionAttackAgainstPlayer` |
| `'VILLAIN_INITIATES_ATTACK'` | Villain begins attack sequence (Spider-Sense window). | `villain-phase.ts` |
| `'TAKE_ATTACK_DAMAGE'` | Character is about to suffer attack damage (Backflip window). | `damage-pipeline.ts` |
| `'TAKE_DAMAGE'` | Character suffers damage from any source. | `damage-pipeline.ts` |
| `'CARD_PLAYED'` / `'PLAYED'` | Card enters play from hand or zone. | `action-dispatcher.ts` |
| `'MINION_DEFEATED'` | Any minion is reduced to 0 HP. | `scenario-helpers.ts` |
| `'ATTACHED_MINION_DEFEATED'`| Minion hosting this attachment is defeated (Spider-Tracer window). | `scenario-helpers.ts` |
| `'ATTACHED_ENEMY_ATTACKS'` | Enemy hosting this attachment initiates attack (Webbed Up window). | `villain-phase.ts` |
| `'THREAT_WOULD_BE_PLACED'` | Threat is about to be placed on a scheme (Great Responsibility window). | `villain-phase.ts` |
| `'MAIN_SCHEME_ADVANCED'` | Main scheme reaches target threat and advances stage. | `scenario-helpers.ts` |
| `'FORM_CHANGED_TO_HERO'` | Player flips to Hero form. | `action-dispatcher.ts` |
| `'FORM_CHANGED_TO_ALTER_EGO'`| Player flips to Alter-Ego form. | `action-dispatcher.ts` |
| `'ROUND_END'` | Round upkeep begins. | `step6_endOfRoundUpkeep` |
| `'PHASE_START'` | A new game phase begins. | `pipeline.ts` |
| `'DEFEATED'` | General character or scheme defeat event. | `pipeline.ts` |
