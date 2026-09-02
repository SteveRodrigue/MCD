import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { executeEffect } from '@engine/effects';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { canPlayCard } from '@engine/pipeline/legality-checker';

describe('Wakanda Forever! Special Ability Sequential Chaining (Issue #18, ADR-0038, RR v1.8 p. 28)', () => {
  let blackPantherHero: any;
  let tchallaAlterEgo: any;
  let rhinoVillain: any;
  let mainScheme: any;

  beforeEach(() => {
    blackPantherHero = cardCatalog.getCard('01040a')!;
    tchallaAlterEgo = cardCatalog.getCard('01040b')!;
    rhinoVillain = cardCatalog.getCard('01094')!;
    mainScheme = cardCatalog.getCard('01097')!;
  });

  it('1. Single Upgrade: Deals 4 damage finisher when only Panther Claws is in play', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Black Panther',
          hero: blackPantherHero,
          alterEgo: tchallaAlterEgo,
          deckCards: [cardCatalog.getCard('01044')!],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = blackPantherHero;

    // Put only Panther Claws in tableau
    const pantherClaws = createCardInstance(cardCatalog.getCard('01047')!);
    player.tableau = [pantherClaws];

    const initialHp = state.villain.health;

    // Execute Wakanda Forever!
    const wakandaForever = createCardInstance(cardCatalog.getCard('01043a')!);
    const result = executeEffect(
      state,
      {
        id: 'wf_test',
        timing: 'HERO_ACTION',
        steps: [{ effect: 'EXECUTE_WAKANDA_FOREVER' }],
      },
      { playerId: 'p1', sourceCardInstance: wakandaForever },
    );

    expect(result.success).toBe(true);
    // Since Panther Claws is the only (and thus final) upgrade, it deals 4 damage instead of 2
    expect(result.state.villain.health).toBe(initialHp - 4);
  });

  it('2. Multi-Upgrade Custom Order: Base effects for steps 1-3, Finisher for step 4', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Black Panther',
          hero: blackPantherHero,
          alterEgo: tchallaAlterEgo,
          deckCards: [cardCatalog.getCard('01044')!],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = blackPantherHero;
    player.health = 8; // Max 11, taken 3 damage

    // Setup 1 minion engaged
    const minion = createCardInstance(cardCatalog.getCard('01096')!); // Armored Guard (6 HP)
    player.engagedMinions = [minion];

    // Main scheme starts with 4 threat
    state.mainScheme.threat = 4;

    const initialVillainHp = state.villain.health;

    // Control all 4 upgrades
    const energyDaggers = createCardInstance(cardCatalog.getCard('01046')!);
    const tacticalGenius = createCardInstance(cardCatalog.getCard('01048')!);
    const pantherSuit = createCardInstance(cardCatalog.getCard('01049')!);
    const pantherClaws = createCardInstance(cardCatalog.getCard('01047')!);

    player.tableau = [energyDaggers, tacticalGenius, pantherSuit, pantherClaws];

    // Execute Wakanda Forever with explicit order:
    // 1. Energy Daggers (1 AoE: 1 to villain, 1 to minion)
    // 2. Tactical Genius (1 THW from main scheme)
    // 3. Panther Suit (1 damage moved from hero to villain)
    // 4. Panther Claws (FINISHER: 4 damage to villain)
    const wakandaForever = createCardInstance(cardCatalog.getCard('01043a')!);
    const result = executeEffect(
      state,
      {
        id: 'wf_test',
        timing: 'HERO_ACTION',
        steps: [
          {
            effect: 'EXECUTE_WAKANDA_FOREVER',
            params: {
              sequenceOrder: [
                energyDaggers.instanceId,
                tacticalGenius.instanceId,
                pantherSuit.instanceId,
                pantherClaws.instanceId,
              ],
            },
          },
        ],
      },
      { playerId: 'p1', sourceCardInstance: wakandaForever },
    );

    expect(result.success).toBe(true);

    // 1. Threat: 4 - 1 = 3
    expect(result.state.mainScheme.threat).toBe(3);

    // 2. Hero Health: 8 + 1 (moved) = 9
    expect(result.state.players[0].health).toBe(9);

    // 3. Minion Damage: 1 from Energy Daggers
    expect(result.state.players[0].engagedMinions[0].tokens?.damage).toBe(1);

    // 4. Villain Health: initial - 1 (Daggers) - 1 (Suit) - 4 (Claws Finisher) = initial - 6
    expect(result.state.villain.health).toBe(initialVillainHp - 6);
  });

  it('3. Permutation Finisher: Tactical Genius as 4th upgrade removes 2 threat (Finisher)', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Black Panther',
          hero: blackPantherHero,
          alterEgo: tchallaAlterEgo,
          deckCards: [cardCatalog.getCard('01044')!],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = blackPantherHero;
    state.mainScheme.threat = 5;
    const initialVillainHp = state.villain.health;

    const pantherClaws = createCardInstance(cardCatalog.getCard('01047')!);
    const tacticalGenius = createCardInstance(cardCatalog.getCard('01048')!);
    player.tableau = [pantherClaws, tacticalGenius];

    // Order: 1. Panther Claws (2 damage base), 2. Tactical Genius (2 threat finisher)
    const wakandaForever = createCardInstance(cardCatalog.getCard('01043a')!);
    const result = executeEffect(
      state,
      {
        id: 'wf_test',
        timing: 'HERO_ACTION',
        steps: [
          {
            effect: 'EXECUTE_WAKANDA_FOREVER',
            params: {
              sequenceOrder: [pantherClaws.instanceId, tacticalGenius.instanceId],
            },
          },
        ],
      },
      { playerId: 'p1', sourceCardInstance: wakandaForever },
    );

    expect(result.success).toBe(true);
    // Panther Claws base damage = 2
    expect(result.state.villain.health).toBe(initialVillainHp - 2);
    // Tactical Genius finisher threat = 2 (5 - 2 = 3)
    expect(result.state.mainScheme.threat).toBe(3);
  });

  it('4. Play Legality: Cannot play Wakanda Forever with 0 Black Panther upgrades in play', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Black Panther',
          hero: blackPantherHero,
          alterEgo: tchallaAlterEgo,
          deckCards: [cardCatalog.getCard('01044')!],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = blackPantherHero;
    player.tableau = []; // 0 upgrades

    const wakandaForever = createCardInstance(cardCatalog.getCard('01043a')!);
    const canPlay = canPlayCard(state, 'p1', wakandaForever);
    expect(canPlay.allowed).toBe(false);
  });

  it('5. Interactive Prompt Flow: Multi-upgrade enqueues WAKANDA_FOREVER_SEQUENCE_ORDER and resolves via Action Dispatcher', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Black Panther',
          hero: blackPantherHero,
          alterEgo: tchallaAlterEgo,
          deckCards: [cardCatalog.getCard('01044')!],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const player = state.players[0];
    player.currentForm = 'hero';
    player.activeFormCard = blackPantherHero;
    const initialHp = state.villain.health;

    const claws = createCardInstance(cardCatalog.getCard('01047')!);
    const daggers = createCardInstance(cardCatalog.getCard('01046')!);
    player.tableau = [claws, daggers];

    // Trigger Wakanda Forever without predefined order
    const wakandaForever = createCardInstance(cardCatalog.getCard('01043a')!);
    const execRes = executeEffect(
      state,
      {
        id: 'wf_test',
        timing: 'HERO_ACTION',
        steps: [{ effect: 'EXECUTE_WAKANDA_FOREVER' }],
      },
      { playerId: 'p1', sourceCardInstance: wakandaForever },
    );

    expect(execRes.success).toBe(true);
    // Prompt was queued
    expect(execRes.state.pendingDecisionQueue?.length).toBe(1);
    expect(execRes.state.pendingDecisionPrompt?.sourceCardName).toBe('Wakanda Forever!');

    // Player resolves prompt choosing [daggers, claws]
    const dispatchRes = dispatchAction(execRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: daggers.instanceId,
      sequenceOrder: [daggers.instanceId, claws.instanceId],
    } as any);

    expect(dispatchRes.result.success).toBe(true);
    // Prompt popped
    expect(dispatchRes.state.pendingDecisionQueue?.length).toBe(0);
    // Daggers (1 dmg) + Claws Finisher (4 dmg) = 5 total damage to villain
    expect(dispatchRes.state.villain.health).toBe(initialHp - 5);
  });
});
