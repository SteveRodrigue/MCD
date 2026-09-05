import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  dispatchAction,
  VillainCard,
  MainSchemeCard,
  MinionCard,
  createCardInstance,
} from '@engine/index';
import { executeEffect } from '@engine/effects';

describe('SUFFERED_DAMAGE Formula for Variable Damage Scaling (Issue #5 & RR v1.8 p. 11, 31)', () => {
  let gameState: ReturnType<typeof setupGame>;

  beforeEach(() => {
    resetInstanceCounter();

    const identity = cardCatalog.getHeroIdentity('she_hulk')!;
    const signatureCards = cardCatalog.getCardsBySet('she_hulk').flatMap((c) => {
      if (c.type === 'hero' || c.type === 'alter_ego') return [];
      return Array(c.quantity).fill(c);
    });
    const aggressionCards = cardCatalog
      .getCardsByFaction('aggression' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const basicCards = cardCatalog
      .getCardsByFaction('basic' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const deck = [...signatureCards, ...aggressionCards, ...basicCards].slice(0, 40);

    const rhinoCards = cardCatalog.getCardsBySet('rhino').filter((c) => c.type !== 'villain');
    const standardCards = cardCatalog.getCardsBySet('standard');
    const bombScareCards = cardCatalog.getCardsBySet('bomb_scare');
    const encounterCards = [...rhinoCards, ...standardCards, ...bombScareCards].flatMap((c) =>
      Array(c.quantity).fill(c),
    );

    const villain = cardCatalog.getCard('01094') as VillainCard; // Rhino I (HP: 14)
    const mainScheme = cardCatalog.getCard('01097b') as MainSchemeCard;

    gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Jennifer Walters',
          hero: identity.hero,
          alterEgo: identity.alterEgo,
          deckCards: deck,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
      shuffleFn: (arr) => arr,
      skipMulligan: true,
    });
  });

  describe('Unit & Primitive Execution (executeEffect)', () => {
    it('calculates damage dynamically as effectiveMaxHealth - currentHealth (10 sustained -> 10 damage)', () => {
      const player = gameState.players[0];
      // She-Hulk base max health is 15
      player.health = 5; // 10 sustained damage
      gameState.villain.health = 14;

      const ability = {
        id: 'test_gamma_slam',
        timing: 'HERO_ACTION' as const,
        steps: [
          {
            effect: 'DEAL_DAMAGE' as const,
            params: {
              amountFormula: 'SUFFERED_DAMAGE',
              max: 15,
              target: 'ENEMY',
            },
          },
        ],
      };

      const result = executeEffect(gameState, ability, { playerId: player.id });
      expect(result.success).toBe(true);
      // Villain takes 10 damage: 14 - 10 = 4
      expect(result.state.villain.health).toBe(4);
    });

    it('enforces max ceiling parameter when sustained damage exceeds max (18 sustained, max 15 -> 15 damage)', () => {
      const player = gameState.players[0];
      // Add an upgrade in tableau providing +5 max health via CONSTANT MODIFY_MAX_HEALTH
      player.tableau.push({
        instanceId: 'test_health_upgrade',
        card: {
          code: 'test_hp',
          name: 'Health Booster',
          type: 'upgrade' as any,
          enrichment: {
            abilities: [
              {
                id: 'boost_hp',
                timing: 'CONSTANT',
                steps: [{ effect: 'MODIFY_MAX_HEALTH', params: { amount: 5 } }],
              },
            ],
          },
        } as any,
        exhausted: false,
      });
      player.health = 2; // Sustained damage = (15 + 5) - 2 = 18
      gameState.villain.health = 20;

      const ability = {
        id: 'test_gamma_slam_capped',
        timing: 'HERO_ACTION' as const,
        steps: [
          {
            effect: 'DEAL_DAMAGE' as const,
            params: {
              amountFormula: 'SUFFERED_DAMAGE',
              max: 15,
              target: 'ENEMY',
            },
          },
        ],
      };

      const result = executeEffect(gameState, ability, { playerId: player.id });
      expect(result.success).toBe(true);
      // Capped at 15 damage: 20 - 15 = 5
      expect(result.state.villain.health).toBe(5);
    });

    it('scales uncapped when optional max parameter is omitted from ability params', () => {
      const player = gameState.players[0];
      // Add an upgrade in tableau providing +5 max health via CONSTANT MODIFY_MAX_HEALTH
      player.tableau.push({
        instanceId: 'test_health_upgrade',
        card: {
          code: 'test_hp',
          name: 'Health Booster',
          type: 'upgrade' as any,
          enrichment: {
            abilities: [
              {
                id: 'boost_hp',
                timing: 'CONSTANT',
                steps: [{ effect: 'MODIFY_MAX_HEALTH', params: { amount: 5 } }],
              },
            ],
          },
        } as any,
        exhausted: false,
      });
      player.health = 2; // 18 sustained damage (20 - 2)
      gameState.villain.health = 25;

      const ability = {
        id: 'test_gamma_slam_uncapped',
        timing: 'HERO_ACTION' as const,
        steps: [
          {
            effect: 'DEAL_DAMAGE' as const,
            params: {
              amountFormula: 'SUFFERED_DAMAGE',
              // Note: 'max' omitted intentionally to verify uncapped scaling
              target: 'ENEMY',
            },
          },
        ],
      };

      const result = executeEffect(gameState, ability, { playerId: player.id });
      expect(result.success).toBe(true);
      // Uncapped 18 damage: 25 - 18 = 7
      expect(result.state.villain.health).toBe(7);
    });

    it('deals 0 damage when player is at full health (0 sustained damage)', () => {
      const player = gameState.players[0];
      player.health = 15; // Full health -> 0 sustained damage
      gameState.villain.health = 14;

      const ability = {
        id: 'test_gamma_slam_full_health',
        timing: 'HERO_ACTION' as const,
        steps: [
          {
            effect: 'DEAL_DAMAGE' as const,
            params: {
              amountFormula: 'SUFFERED_DAMAGE',
              max: 15,
              target: 'ENEMY',
            },
          },
        ],
      };

      const result = executeEffect(gameState, ability, { playerId: player.id });
      expect(result.success).toBe(true);
      // 0 damage dealt: Villain remains at 14 HP
      expect(result.state.villain.health).toBe(14);
    });

    it('deals calculated damage to a chosen minion target when targetInstanceId is provided', () => {
      const player = gameState.players[0];
      player.health = 11; // 4 sustained damage

      // Spawn an engaged minion (Hydra Mercenary: 3 HP)
      const minionCard = cardCatalog.getCard('01110') as MinionCard;
      const minionInstance = createCardInstance(minionCard);
      player.engagedMinions.push(minionInstance);

      const ability = {
        id: 'test_gamma_slam_minion',
        timing: 'HERO_ACTION' as const,
        steps: [
          {
            effect: 'DEAL_DAMAGE' as const,
            params: {
              amountFormula: 'SUFFERED_DAMAGE',
              max: 15,
              target: 'ENEMY',
            },
          },
        ],
      };

      const result = executeEffect(gameState, ability, {
        playerId: player.id,
        targetInstanceId: minionInstance.instanceId,
      });

      expect(result.success).toBe(true);
      // 4 damage dealt to 3 HP minion -> defeated and removed from engaged minions
      expect(result.state.players[0].engagedMinions.length).toBe(0);
      expect(
        result.state.encounterDiscard.some((c) => c.instanceId === minionInstance.instanceId),
      ).toBe(true);
      // Villain was untouched
      expect(result.state.villain.health).toBe(14);
    });
  });

  describe('Action Dispatcher Integration (PLAY_CARD for Gamma Slam 01021)', () => {
    it('successfully plays Gamma Slam in Hero form, paying costs and dealing calculated damage to Villain', () => {
      const player = gameState.players[0];
      player.currentForm = 'hero';
      player.activeFormCard = player.hero;
      player.health = 7; // 8 sustained damage (15 - 7)

      const gammaSlamCard = cardCatalog.getCard('01021')!; // Cost 4 Event
      const gammaSlamInstance = createCardInstance(gammaSlamCard);

      // Create 4 resource cards to pay cost
      const resourceCard = cardCatalog.getCard('01053')!;
      const pay1 = createCardInstance(resourceCard);
      const pay2 = createCardInstance(resourceCard);
      const pay3 = createCardInstance(resourceCard);
      const pay4 = createCardInstance(resourceCard);

      player.hand = [gammaSlamInstance, pay1, pay2, pay3, pay4];
      gameState.villain.health = 14;

      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: player.id,
        cardInstanceId: gammaSlamInstance.instanceId,
        paymentCardInstanceIds: [
          pay1.instanceId,
          pay2.instanceId,
          pay3.instanceId,
          pay4.instanceId,
        ],
      });

      expect(res.result.success).toBe(true);
      // 8 damage dealt to Rhino: 14 - 8 = 6
      expect(res.state.villain.health).toBe(6);
      // Gamma Slam moved to discard
      expect(
        res.state.players[0].discard.some((c) => c.instanceId === gammaSlamInstance.instanceId),
      ).toBe(true);
    });

    it('rejects playing Gamma Slam when in Alter-Ego form due to HERO_ACTION timing restriction', () => {
      const player = gameState.players[0];
      player.currentForm = 'alter_ego';
      player.activeFormCard = player.alterEgo;
      player.health = 7;

      const gammaSlamCard = cardCatalog.getCard('01021')!;
      const gammaSlamInstance = createCardInstance(gammaSlamCard);
      const resourceCard = cardCatalog.getCard('01053')!;
      const pay1 = createCardInstance(resourceCard);
      const pay2 = createCardInstance(resourceCard);
      const pay3 = createCardInstance(resourceCard);
      const pay4 = createCardInstance(resourceCard);

      player.hand = [gammaSlamInstance, pay1, pay2, pay3, pay4];

      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: player.id,
        cardInstanceId: gammaSlamInstance.instanceId,
        paymentCardInstanceIds: [
          pay1.instanceId,
          pay2.instanceId,
          pay3.instanceId,
          pay4.instanceId,
        ],
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toMatch(/Hero Action|form/i);
      // Card remains in hand
      expect(
        res.state.players[0].hand.some((c) => c.instanceId === gammaSlamInstance.instanceId),
      ).toBe(true);
    });
  });
});
