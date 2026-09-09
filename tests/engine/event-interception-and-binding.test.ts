import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '@data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  VillainCard,
  MainSchemeCard,
  createCardInstance,
} from '@engine/index';
import { dispatchTrigger } from '@engine/triggers/trigger-dispatcher';
import { resolveNumericAmount } from '@engine/effects';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Universal CONSUME_INTERCEPTED_EVENT and Scalar Value Binding (ADR-0049 & Issue #90)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
  let gameState: ReturnType<typeof setupGame>;

  beforeEach(() => {
    resetInstanceCounter();

    const identity = catalog.getHeroIdentity('spider_man')!;
    const signatureCards = catalog.getCardsBySet('spider_man').flatMap((c) => {
      if (c.type === 'hero' || c.type === 'alter_ego') return [];
      return Array(c.quantity).fill(c);
    });
    const justiceCards = catalog
      .getCardsByFaction('justice' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const basicCards = catalog
      .getCardsByFaction('basic' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const deck = [...signatureCards, ...justiceCards, ...basicCards].slice(0, 40);

    const rhinoCards = catalog.getCardsBySet('rhino').filter((c) => c.type !== 'villain');
    const standardCards = catalog.getCardsBySet('standard');
    const bombScareCards = catalog.getCardsBySet('bomb_scare');
    const encounterCards = [...rhinoCards, ...standardCards, ...bombScareCards].flatMap((c) =>
      Array(c.quantity).fill(c),
    );

    const villain = catalog.getCard('01094') as VillainCard;
    const mainScheme = catalog.getCard('01097b') as MainSchemeCard;

    gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: identity.hero,
          alterEgo: identity.alterEgo,
          deckCards: deck,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
      shuffleFn: (arr) => arr,
    });
  });

  describe('resolveNumericAmount helper & DynamicValueSource', () => {
    it('resolves literal numbers directly', () => {
      expect(resolveNumericAmount(5, {})).toBe(5);
      expect(resolveNumericAmount(0, {})).toBe(0);
    });

    it('resolves INTERCEPTED_VALUE directly from context', () => {
      expect(resolveNumericAmount({ from: 'INTERCEPTED_VALUE' }, { interceptedValue: 4 })).toBe(4);
    });

    it('resolves INTERCEPTED_VALUE with multiplier and offset formula', () => {
      expect(
        resolveNumericAmount(
          { from: 'INTERCEPTED_VALUE', multiplier: 2, offset: -1 },
          { interceptedValue: 3 },
        ),
      ).toBe(5); // 3 * 2 - 1 = 5
      expect(
        resolveNumericAmount({ from: 'INTERCEPTED_VALUE', offset: -1 }, { interceptedValue: 3 }),
      ).toBe(2); // 3 - 1 = 2
    });

    it('clamps negative dynamic values to 0', () => {
      expect(
        resolveNumericAmount({ from: 'INTERCEPTED_VALUE', offset: -5 }, { interceptedValue: 2 }),
      ).toBe(0);
    });
  });

  describe('Great Responsibility (01061): Threat-to-damage replacement', () => {
    it('consumes impending threat and deals damage to hero equal to intercepted threat', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;
      gameState.players[0].health = 10;
      gameState.mainScheme.threat = 2;

      const greatRespCard = catalog.getCard('01061')!;
      const greatRespInst = createCardInstance(greatRespCard);
      gameState.players[0].hand = [greatRespInst];

      // Threat would be placed: 3 threat
      const dispatchRes = dispatchTrigger(gameState, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
        acceptOptionalTriggers: true,
      });

      // Threat placement was completely consumed!
      expect(dispatchRes.threatAmount).toBe(0);
      // Hero took 3 damage (10 - 3 = 7)
      expect(dispatchRes.state.players[0].health).toBe(7);
      // Great responsibility was discarded
      expect(
        dispatchRes.state.players[0].discard.some((c) => c.instanceId === greatRespInst.instanceId),
      ).toBe(true);
    });
  });

  describe('Emergency (01085): Partial threat reduction', () => {
    it('consumes 1 of the impending threat and allows remainder to place', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;

      const emergencyCard = catalog.getCard('01085')!;
      const emergencyInst = createCardInstance(emergencyCard);
      gameState.players[0].hand = [emergencyInst];

      // 3 threat would be placed
      const dispatchRes = dispatchTrigger(gameState, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
        acceptOptionalTriggers: true,
      });

      // Impending threat was reduced by 1 (3 -> 2)
      expect(dispatchRes.threatAmount).toBe(2);
      // Emergency card discarded
      expect(
        dispatchRes.state.players[0].discard.some((c) => c.instanceId === emergencyInst.instanceId),
      ).toBe(true);
    });
  });

  describe('Backflip (01003): Damage interception and nullification', () => {
    it('consumes all impending attack damage, reducing damage to 0', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;
      gameState.players[0].health = 10;

      const backflipCard = catalog.getCard('01003')!;
      const backflipInst = createCardInstance(backflipCard);
      gameState.players[0].hand = [backflipInst];

      // 4 damage would be dealt
      const dispatchRes = dispatchTrigger(gameState, 'TAKE_ATTACK_DAMAGE', {
        targetPlayerId: 'p1',
        damageAmount: 4,
        acceptOptionalTriggers: true,
      });

      // Damage was completely consumed
      expect(dispatchRes.damageAmount).toBe(0);
      expect(dispatchRes.preventedDamage).toBe(true);
      expect(dispatchRes.state.players[0].health).toBe(10);
    });
  });
});
