import { describe, it, expect, beforeEach } from 'vitest';
import { defaultScenarioId } from '@engine/scenarios';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard, getActiveVillain } from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { executeEnemyAttackSynchronously } from '@engine/pipeline';
import { exerciseAbility, buildAbilityInventory } from '@engine/simulation';

describe('Tiger Shark (01131)', () => {
  let state: GameState;

  const player = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  const setup = () => {
    resetInstanceCounter();
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [player('p1', '01001a', '01001b')],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    const p = state.players[0];
    p.currentForm = 'hero';
    p.activeFormCard = p.hero;
    p.hand = [];
    state.encounterDeck = [];
    state.encounterDiscard = [];
  };

  beforeEach(() => {
    setup();
  });

  describe('Forced Response: After Tiger Shark attacks, give him a tough status card', () => {
    it('gives Tiger Shark a tough status card after he attacks', () => {
      const tigerSharkCard = cardCatalog.getCard('01131')!;
      const tigerShark = createCardInstance(tigerSharkCard, 'encounter');
      state.players[0].engagedMinions.push(tigerShark);

      expect(tigerShark.statusCards ?? []).not.toContain(StatusCard.TOUGH);

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: tigerShark },
        'p1',
        'TAKE_UNDEFENDED',
      );

      const inPlayMinion = state.players[0].engagedMinions.find(
        (m) => m.instanceId === tigerShark.instanceId,
      );
      expect(inPlayMinion).toBeDefined();
      expect(inPlayMinion!.statusCards).toContain(StatusCard.TOUGH);
    });

    it('does not give multiple tough status cards if Tiger Shark is already tough', () => {
      const tigerSharkCard = cardCatalog.getCard('01131')!;
      const tigerShark = createCardInstance(tigerSharkCard, 'encounter');
      tigerShark.statusCards = [StatusCard.TOUGH];
      state.players[0].engagedMinions.push(tigerShark);

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: tigerShark },
        'p1',
        'TAKE_UNDEFENDED',
      );

      const inPlayMinion = state.players[0].engagedMinions.find(
        (m) => m.instanceId === tigerShark.instanceId,
      );
      expect(inPlayMinion!.statusCards?.filter((s) => s === StatusCard.TOUGH).length).toBe(1);
    });

    it('does not trigger if Tiger Shark is defeated prior to attack completion', () => {
      // Setup Black Panther who has printed Retaliate 1
      resetInstanceCounter();
      state = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        players: [player('p1', '01040a', '01040b')],
        villain: cardCatalog.getCard('01094') as any,
        mainScheme: cardCatalog.getCard('01097b') as any,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });
      state.players[0].currentForm = 'hero';
      state.players[0].activeFormCard = state.players[0].hero;
      state.players[0].hand = [];
      state.encounterDeck = [];

      const tigerSharkCard = cardCatalog.getCard('01131')!;
      const tigerShark = createCardInstance(tigerSharkCard, 'encounter');
      tigerShark.tokens = { damage: 5 }; // Tiger Shark has 6 HP, so 1 retaliate damage will defeat him
      state.players[0].engagedMinions.push(tigerShark);

      executeEnemyAttackSynchronously(
        state,
        { type: 'MINION', card: tigerShark },
        'p1',
        'HERO_IF_READY',
      );

      // Tiger Shark was defeated by Retaliate
      expect(state.players[0].engagedMinions).not.toContainEqual(tigerShark);
      expect(tigerShark.statusCards ?? []).not.toContain(StatusCard.TOUGH);
    });
  });

  describe('Boost: Give the villain a tough status card', () => {
    it('gives the villain a tough status card when revealed as boost', () => {
      const tigerSharkCard = cardCatalog.getCard('01131')!;
      const boostCard = createCardInstance(tigerSharkCard, 'encounter');
      state.encounterDeck = [boostCard];

      const villain = getActiveVillain(state);
      expect(villain.statusCards ?? []).not.toContain(StatusCard.TOUGH);

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      expect(villain.statusCards).toContain(StatusCard.TOUGH);
    });

    it('does not give multiple tough status cards if villain is already tough', () => {
      const tigerSharkCard = cardCatalog.getCard('01131')!;
      const boostCard = createCardInstance(tigerSharkCard, 'encounter');
      state.encounterDeck = [boostCard];

      const villain = getActiveVillain(state);
      villain.statusCards = [StatusCard.TOUGH];

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      expect(villain.statusCards.filter((s) => s === StatusCard.TOUGH).length).toBe(1);
    });
  });

  describe('Simulation Stage-Setter', () => {
    it('successfully exercises forced response and boost abilities in simulation', () => {
      const allCards = cardCatalog.getAllCards();
      const inventory = buildAbilityInventory(allCards);
      const forcedTarget = inventory.find(
        (t) => t.cardCode === '01131' && t.abilityId === 'tiger_shark_forced_response',
      );
      const boostTarget = inventory.find(
        (t) => t.cardCode === '01131' && t.abilityId === 'tiger_shark_boost',
      );

      expect(forcedTarget).toBeDefined();
      expect(boostTarget).toBeDefined();

      const forcedOutcome = exerciseAbility(forcedTarget!, {
        catalog: cardCatalog,
        allCards,
        scenarioId: defaultScenarioId(),
      });
      expect(forcedOutcome.ok, forcedOutcome.reason).toBe(true);

      const boostOutcome = exerciseAbility(boostTarget!, {
        catalog: cardCatalog,
        allCards,
        scenarioId: defaultScenarioId(),
      });
      expect(boostOutcome.ok, boostOutcome.reason).toBe(true);
    });
  });
});
