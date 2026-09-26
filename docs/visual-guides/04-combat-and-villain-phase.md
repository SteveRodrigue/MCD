# 04. Combat & Villain Phase Sequences

> Companion to [05. Combat & Threat](../specifications/supplemental/05_effects_combat_threat.md)
> and [08. Villain & Nemesis](../specifications/supplemental/08_effects_villain_nemesis.md).
> Ground truth: [`src/engine/pipeline/combat-pipeline.ts`](../../src/engine/pipeline/combat-pipeline.ts)
> and [`src/engine/pipeline/villain-phase.ts`](../../src/engine/pipeline/villain-phase.ts).

---

## 1. Attack Resolution — `combat-pipeline.ts` Steps 1–7

```mermaid
sequenceDiagram
    participant E as Enemy (Villain/Minion)
    participant CP as combat-pipeline.ts
    participant TD as trigger-dispatcher.ts
    participant D as Defending Player

    CP->>CP: step1_preAttackAndStunCheck<br/>(Webbed Up / Stun intercepts)
    CP->>TD: step2_dispatchInitiationTriggers<br/>(ENEMY_INITIATES_ATTACK — Spider-Sense window)
    CP->>D: step3_openDefenderDeclarationPrompt<br/>(choose defender or take undefended)
    CP->>CP: step4_and_5_dealAndResolveBoostCards<br/>(reveal boost, resolve BOOST / BOOST_STAR_RESOLVED)
    CP->>TD: DAMAGE_WOULD_BE_TAKEN window<br/>(Backflip-style prevention)
    CP->>CP: step6_calculateAndApplyAttackDamage<br/>(ATK vs DEF, Piercing/Overkill math)
    CP->>TD: DAMAGE_TAKEN / CHARACTER_DEFEATED (if applicable)
    CP->>CP: step7_resolvePostAttackAndRetaliate<br/>(Retaliate damage back to attacker)
```

| Step | Function                               | Card-author-relevant trigger(s)                  |
| :--- | :------------------------------------- | :----------------------------------------------- |
| 1    | `step1_preAttackAndStunCheck`          | `ATTACHED_ENEMY_ATTACKS` (e.g. Webbed Up)        |
| 2    | `step2_dispatchInitiationTriggers`     | `ENEMY_INITIATES_ATTACK`                         |
| 3    | `step3_openDefenderDeclarationPrompt`  | `ATTACK_DEFENDED`                                |
| 4–5  | `step4_and_5_dealAndResolveBoostCards` | `BOOST`, `BOOST_STAR_RESOLVED`                   |
| —    | _(intercept window between 5 and 6)_   | `DAMAGE_WOULD_BE_TAKEN`                          |
| 6    | `step6_calculateAndApplyAttackDamage`  | `DAMAGE_TAKEN`, `CHARACTER_DEFEATED`, `DEFEATED` |
| 7    | `step7_resolvePostAttackAndRetaliate`  | `ATTACK_RESOLVED`                                |

---

## 2. The 6-Step Villain Phase

```mermaid
flowchart TD
    S1["Step 1: Place Threat<br/>step1_placeThreat<br/>(escalation + acceleration tokens)"] --> S2["Step 2: Enemies Activate<br/>step2_villainAndMinionActivations<br/>(interleaved 2a villain + 2b minions per player)"]
    S2 --> S3["Step 3: Deal Encounter Cards<br/>step3_dealEncounterCards<br/>(1 per player + Hazard icons, sequential)"]
    S3 --> S4["Step 4: Reveal Encounter Cards<br/>step4_revealEncounterCards<br/>(WHEN_REVEALED / TREACHERY_REVEALED)"]
    S4 --> S5["Step 5: Pass First Player Token<br/>step5_passFirstPlayerToken<br/>(rotate first player token clockwise)"]
    S5 --> S6["Step 6: End of Phase & Round Upkeep<br/>step6_endVillainPhaseAndRound<br/>(6a expire phase/round effects, 6b phase/round ended triggers)"]
    S6 -->|roundNumber++| NextRound(["Next Player Phase"])
```

> [!NOTE]
> RR v1.8 p. 47 describes Step 2 as "Enemies Activate" containing an interleaved player-by-player loop
> (2a the villain activates against a player, then 2b each minion engaged with that player activates against them),
> implemented by `step2_villainAndMinionActivations` (aliased as `step2_villainActivations` for backward compatibility).
> Encounter cards are dealt in **Step 3** (`step3_dealEncounterCards`, aliased as `step4_dealEncounterCards`) and
> revealed in **Step 4** (`step4_revealEncounterCards`, aliased as `step5_revealEncounterCards`).
> In **Step 5**, the first player token passes clockwise (`step5_passFirstPlayerToken`).
> In **Step 6** (`step6_endVillainPhaseAndRound`, composite wrapper `step6_passFirstPlayerAndRoundUpkeep`):
> - **Step 6a:** Effects lasting until the end of the phase/round expire, and once-per-phase/round limits reset.
> - **Step 6b:** Triggers for `VILLAIN_PHASE_ENDED` and `ROUND_ENDED` resolve in turn order starting with the newly designated first player, followed by round transition to the next Player Phase.
>
> Runtime orchestrator in `continueVillainPhase` (`villain-phase.ts`):
>
> ```ts
> // Step 2: Activations
> if (state.villainPhaseStep === VillainPhaseStep.VILLAIN_ACTIVATIONS) {
>   state = step2_villainAndMinionActivations(state, options);
>   ...
>   state.villainPhaseStep = VillainPhaseStep.DEAL_ENCOUNTER_CARDS;
> }
> // Step 3: Deal Encounter Cards
> if (state.villainPhaseStep === VillainPhaseStep.DEAL_ENCOUNTER_CARDS) {
>   state = step3_dealEncounterCards(state);
>   ...
>   state.villainPhaseStep = VillainPhaseStep.REVEAL_ENCOUNTER_CARDS;
> }
> // Step 4: Reveal Encounter Cards
> if (state.villainPhaseStep === VillainPhaseStep.REVEAL_ENCOUNTER_CARDS) {
>   state = step4_revealEncounterCards(state);
>   ...
> }
> // Step 5 & 6: Pass First Player & Round Upkeep
> state = step5_passFirstPlayerToken(state);
> return step6_endVillainPhaseAndRound(state);
> ```

### Step 2 detail — per-player interleaving

```mermaid
flowchart LR
    Loop(["for player in state.playersInTurnOrder<br/>(inside step2_villainAndMinionActivations)"]) --> Form{"player.currentForm"}
    Form -->|alter_ego| VS["Villain schemes<br/>against player"]
    Form -->|hero| VA["Villain attacks<br/>player"]
    VS --> MinLoop(["for minion in player.engagedMinions"])
    VA --> MinLoop
    MinLoop --> MForm{"player.currentForm"}
    MForm -->|alter_ego| MS["Minion schemes<br/>against player"]
    MForm -->|hero| MA["Minion attacks<br/>player"]
    MS --> NextP(["Next player in turn order"])
    MA --> NextP
    NextP --> Loop
```

> [!NOTE]
> A `WHEN_REVEALED` ability on an encounter card you're authoring always resolves inside
> **Step 4**, and never earlier — treachery text that reads "when revealed" should never be
> modeled as a `RESPONSE`/`INTERRUPT`.

---

**Previous:** [03. Trigger Resolution Stack](./03-trigger-resolution-stack.md)
**Next:** [05. Card Authoring Decision Guide](./05-card-authoring-decision-guide.md) — pick the
right `timing`/`trigger`/`effect` combination for a new card from scratch.
