import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  CardInstance,
  CardType,
  CardResources,
} from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { dispatchAction } from '../../src/engine/pipeline';
import { executeEffect } from '../../src/engine/effects';
import { createCardInstance } from '../../src/engine/state/card-instance';

function makeResources(type: 'physical' | 'energy' | 'mental' | 'wild', count = 1): CardResources {
  return {
    physical: type === 'physical' ? count : 0,
    energy: type === 'energy' ? count : 0,
    mental: type === 'mental' ? count : 0,
    wild: type === 'wild' ? count : 0,
    total: count,
  };
}

describe('Resource Payment Kicker & Gate Parameters Engine (Issue #107, ADR-0060)', () => {
  describe('Direct Ability Execution with ConditionGate IF_RESOURCE_MATCH', () => {
    let state: GameState;

    beforeEach(() => {
      state = {
        roundNumber: 1,
        phase: 'PLAYER',
        firstPlayerIndex: 0,
        activePlayerIndex: 0,
        players: [
          {
            id: 'p1',
            name: 'Captain Marvel',
            health: 10,
            maxHealth: 12,
            deck: [
              {
                instanceId: 'deck-c1',
                card: { code: 'c1', name: 'Deck Card 1', type: CardType.EVENT },
              } as CardInstance,
              {
                instanceId: 'deck-c2',
                card: { code: 'c2', name: 'Deck Card 2', type: CardType.EVENT },
              } as CardInstance,
            ],
            hand: [],
            discard: [],
            tableau: [],
            engagedMinions: [],
            statusCards: [],
            dealtEncounterCards: [],
            currentForm: 'hero',
          } as any,
        ],
        villain: {
          instanceId: 'v1',
          health: 15,
          maxHealth: 15,
          statusCards: [],
          attachments: [],
          card: { code: '01094', name: 'Rhino', type: CardType.VILLAIN } as any,
        } as any,
        mainScheme: {
          instanceId: 'ms1',
          threat: 0,
          targetThreat: 7,
          card: { code: '01097', name: 'The Break-In!' } as any,
        } as any,
        sideSchemes: [],
        log: [],
      } as any;
    });

    const photonicBlastSteps = [
      {
        id: 'photonic_blast_damage',
        effect: 'DEAL_DAMAGE',
        effectParams: {
          amount: 5,
          target: 'CHOSEN_ENEMY',
        },
      },
      {
        id: 'photonic_blast_draw',
        gate: 'IF_RESOURCE_MATCH',
        gateParams: {
          resource: 'energy',
          count: 1,
        },
        effect: 'DRAW',
        effectParams: {
          count: 1,
        },
      },
    ];

    it('Resolves damage and draws 1 card when paid with Energy', () => {
      const player = state.players[0];
      const initialDeckCount = player.deck.length;

      const result = executeEffect(
        state,
        {
          steps: photonicBlastSteps,
        } as any,
        {
          playerId: player.id,
          targetInstanceId: 'v1',
          resourcesSpent: ['energy', 'physical', 'physical'],
        },
      );

      expect(result.success).toBe(true);
      expect(state.villain.health).toBe(10); // 15 - 5
      expect(player.hand.length).toBe(1); // Drew 1 card
      expect(player.deck.length).toBe(initialDeckCount - 1);
    });

    it('Resolves damage and draws 0 cards when paid without Energy', () => {
      const player = state.players[0];
      const initialDeckCount = player.deck.length;

      const result = executeEffect(
        state,
        {
          steps: photonicBlastSteps,
        } as any,
        {
          playerId: player.id,
          targetInstanceId: 'v1',
          resourcesSpent: ['physical', 'physical', 'mental'],
        },
      );

      expect(result.success).toBe(true);
      expect(state.villain.health).toBe(10); // 15 - 5
      expect(player.hand.length).toBe(0); // Drew 0 cards
      expect(player.deck.length).toBe(initialDeckCount);
    });

    it('Resolves damage and draws 1 card when paid with Wild (substitutes for Energy)', () => {
      const player = state.players[0];

      const result = executeEffect(
        state,
        {
          steps: photonicBlastSteps,
        } as any,
        {
          playerId: player.id,
          targetInstanceId: 'v1',
          resourcesSpent: ['wild', 'physical', 'physical'],
        },
      );

      expect(result.success).toBe(true);
      expect(state.villain.health).toBe(10);
      expect(player.hand.length).toBe(1);
    });

    it('Enforces multi-resource kicker count (count: 2)', () => {
      const player = state.players[0];
      const multiEnergySteps = [
        {
          id: 'step_damage',
          effect: 'DEAL_DAMAGE',
          effectParams: { amount: 3, target: 'CHOSEN_ENEMY' },
        },
        {
          id: 'step_draw',
          gate: 'IF_RESOURCE_MATCH',
          gateParams: { resource: 'energy', count: 2 },
          effect: 'DRAW',
          effectParams: { count: 1 },
        },
      ];

      // 1 Energy spent -> gate fails
      executeEffect(
        state,
        {
          steps: multiEnergySteps,
        } as any,
        {
          playerId: player.id,
          targetInstanceId: 'v1',
          resourcesSpent: ['energy', 'physical'],
        },
      );
      expect(player.hand.length).toBe(0);

      // 2 Energy spent -> gate succeeds
      executeEffect(
        state,
        {
          steps: multiEnergySteps,
        } as any,
        {
          playerId: player.id,
          targetInstanceId: 'v1',
          resourcesSpent: ['energy', 'energy'],
        },
      );
      expect(player.hand.length).toBe(1);
    });

    it('Enforces printedResource requirement', () => {
      const player = state.players[0];
      const printedOnlySteps = [
        {
          id: 'step_draw',
          gate: 'IF_RESOURCE_MATCH',
          gateParams: { resource: 'energy', count: 1, printedResource: true },
          effect: 'DRAW',
          effectParams: { count: 1 },
        },
      ];

      // Wild spent with printedResource: true -> gate fails
      executeEffect(
        state,
        {
          steps: printedOnlySteps,
        } as any,
        {
          playerId: player.id,
          resourcesSpent: ['wild'],
        },
      );
      expect(player.hand.length).toBe(0);

      // Energy spent with printedResource: true -> gate succeeds
      executeEffect(
        state,
        {
          steps: printedOnlySteps,
        } as any,
        {
          playerId: player.id,
          resourcesSpent: ['energy'],
        },
      );
      expect(player.hand.length).toBe(1);
    });

    it('Enforces only requirement (no non-matching resources allowed)', () => {
      const player = state.players[0];
      const onlyEnergySteps = [
        {
          id: 'step_draw',
          gate: 'IF_RESOURCE_MATCH',
          gateParams: { resource: 'energy', count: 1, only: true },
          effect: 'DRAW',
          effectParams: { count: 1 },
        },
      ];

      // Mixed resources spent (energy + physical) -> gate fails
      executeEffect(
        state,
        {
          steps: onlyEnergySteps,
        } as any,
        {
          playerId: player.id,
          resourcesSpent: ['energy', 'physical'],
        },
      );
      expect(player.hand.length).toBe(0);

      // Only energy resources spent -> gate succeeds
      executeEffect(
        state,
        {
          steps: onlyEnergySteps,
        } as any,
        {
          playerId: player.id,
          resourcesSpent: ['energy', 'energy'],
        },
      );
      expect(player.hand.length).toBe(1);
    });
  });

  describe('End-to-End PLAY_CARD with Photonic Blast (01013)', () => {
    let state: GameState;
    let captainMarvelHero: HeroCard;
    let carolDanversAlterEgo: AlterEgoCard;

    beforeEach(() => {
      captainMarvelHero = cardCatalog.getCard('01010b') as HeroCard;
      carolDanversAlterEgo = cardCatalog.getCard('01010a') as AlterEgoCard;

      state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Carol Danvers',
            hero: captainMarvelHero,
            alterEgo: carolDanversAlterEgo,
            deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
          },
        ],
        villain: cardCatalog.getCard('01094') as any,
        mainScheme: cardCatalog.getCard('01097b') as any,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      // Switch to hero form to allow Hero Action
      state.players[0].currentForm = 'hero';
      state.players[0].activeFormCard = captainMarvelHero;
    });

    it('Pays 3 Physical resources: deals 5 damage and draws 0 cards', () => {
      const p1 = state.players[0];
      const initialDeckCount = p1.deck.length;
      const initialVillainHp = state.villain.health;

      // Photonic Blast (cost 3)
      const photonicBlastCard = cardCatalog.getCard('01013')!;
      const pbInstance = createCardInstance(photonicBlastCard);

      const physicalCard = cardCatalog.getCard('01053') || cardCatalog.getCard('01005')!;
      const pay1 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
      const pay2 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
      const pay3 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });

      p1.hand = [pbInstance, pay1, pay2, pay3];

      const res = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: p1.id,
        cardInstanceId: pbInstance.instanceId,
        targetInstanceId: state.villain.instanceId,
        paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId, pay3.instanceId],
      });

      expect(res.result.success).toBe(true);
      expect(res.state.villain.health).toBe(initialVillainHp - 5);
      // Hand should be empty (played pb + discarded 3 payment cards, drew 0 cards)
      expect(res.state.players[0].hand.length).toBe(0);
      expect(res.state.players[0].deck.length).toBe(initialDeckCount);
    });

    it('Pays 2 Physical + 1 Energy resource: deals 5 damage and draws 1 card', () => {
      const p1 = state.players[0];
      const initialDeckCount = p1.deck.length;
      const initialVillainHp = state.villain.health;

      const photonicBlastCard = cardCatalog.getCard('01013')!;
      const pbInstance = createCardInstance(photonicBlastCard);

      const physicalCard = cardCatalog.getCard('01005')!;
      const pay1 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
      const pay2 = createCardInstance({ ...physicalCard, resources: makeResources('physical', 1) });
      const energyCard = cardCatalog.getCard('01014') || cardCatalog.getCard('01005')!;
      const pay3 = createCardInstance({ ...energyCard, resources: makeResources('energy', 1) });

      p1.hand = [pbInstance, pay1, pay2, pay3];

      const res = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: p1.id,
        cardInstanceId: pbInstance.instanceId,
        targetInstanceId: state.villain.instanceId,
        paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId, pay3.instanceId],
      });

      expect(res.result.success).toBe(true);
      expect(res.state.villain.health).toBe(initialVillainHp - 5);
      // Hand should contain the 1 drawn card!
      expect(res.state.players[0].hand.length).toBe(1);
      expect(res.state.players[0].deck.length).toBe(initialDeckCount - 1);
    });

    it('Pays with Wild resource: substitutes for Energy, deals 5 damage and draws 1 card', () => {
      const p1 = state.players[0];
      const initialDeckCount = p1.deck.length;
      const initialVillainHp = state.villain.health;

      const photonicBlastCard = cardCatalog.getCard('01013')!;
      const pbInstance = createCardInstance(photonicBlastCard);

      const card = cardCatalog.getCard('01005')!;
      const pay1 = createCardInstance({ ...card, resources: makeResources('physical', 1) });
      const pay2 = createCardInstance({ ...card, resources: makeResources('physical', 1) });
      const pay3 = createCardInstance({ ...card, resources: makeResources('wild', 1) });

      p1.hand = [pbInstance, pay1, pay2, pay3];

      const res = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: p1.id,
        cardInstanceId: pbInstance.instanceId,
        targetInstanceId: state.villain.instanceId,
        paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId, pay3.instanceId],
      });

      expect(res.result.success).toBe(true);
      expect(res.state.villain.health).toBe(initialVillainHp - 5);
      expect(res.state.players[0].hand.length).toBe(1);
      expect(res.state.players[0].deck.length).toBe(initialDeckCount - 1);
    });
  });
});
