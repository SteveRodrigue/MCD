import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '@data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  dispatchAction,
  step2_villainActivations,
  VillainCard,
  MainSchemeCard,
  createCardInstance,
} from '@engine/index';

import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Spider-Man Signature Cards & Data-Driven Triggers (RR v1.8 & ADR-0008)', () => {
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

  describe('Spider-Sense Interrupt (01001a)', () => {
    it('draws 1 card dynamically via VILLAIN_INITIATES_ATTACK trigger', () => {
      // Put player in Hero form with empty hand
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;
      gameState.players[0].hand = [];

      const initialDeckCount = gameState.players[0].deck.length;

      // Step 2 Villain activates against hero
      step2_villainActivations(gameState, { acceptOptionalTriggers: true });

      // Spider-Sense triggered: hand should have drawn 1 card
      expect(gameState.players[0].hand.length).toBe(1);
      expect(gameState.players[0].deck.length).toBe(initialDeckCount - 1);
    });
  });

  describe('Backflip Defense Interrupt (01003)', () => {
    it('prevents all attack damage and discards Backflip via TAKE_ATTACK_DAMAGE trigger', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;
      gameState.players[0].hand = []; // Clean hand

      // Add Backflip card to hand
      const backflipCard = catalog.getCard('01003')!;
      const backflipInstance = createCardInstance(backflipCard);
      gameState.players[0].hand = [backflipInstance];

      const initialHealth = gameState.players[0].health; // 10

      // Step 2 Villain Attacks (with TAKE_UNDEFENDED to reach damage calculation step)
      step2_villainActivations(gameState, { synchronousPolicy: 'TAKE_UNDEFENDED' });

      // All damage prevented by Backflip (HP remains 10)
      expect(gameState.players[0].health).toBe(initialHealth);
      // Backflip was discarded
      expect(gameState.players[0].discard.some((c) => c.card.code === '01003')).toBe(true);
      expect(
        gameState.players[0].hand.some((c) => c.instanceId === backflipInstance.instanceId),
      ).toBe(false);
    });
  });

  describe('Swinging Web Kick Hero Action (01005)', () => {
    it('deals 8 damage to the villain via declarative DEAL_DAMAGE effect', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;

      const kickCard = catalog.getCard('01005')!;
      const resource1 = catalog.getCard('01003')!;
      const resource2 = catalog.getCard('01004')!;
      const resource3 = catalog.getCard('01007')!;

      const kickInst = createCardInstance(kickCard);
      const r1 = createCardInstance(resource1);
      const r2 = createCardInstance(resource2);
      const r3 = createCardInstance(resource3);

      gameState.players[0].hand = [kickInst, r1, r2, r3];

      const initialVillainHealth = gameState.villain.health; // 14

      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: kickInst.instanceId,
        paymentCardInstanceIds: [r1.instanceId, r2.instanceId, r3.instanceId],
      });

      expect(res.result.success).toBe(true);
      // 14 - 8 = 6 HP
      expect(res.state.villain.health).toBe(initialVillainHealth - 8);
    });
  });

  describe('Aunt May Alter-Ego Action (01006)', () => {
    it('heals 4 damage from Peter Parker via USE_CARD_ABILITY action', () => {
      gameState.players[0].currentForm = 'alter_ego';
      gameState.players[0].health = 5; // Damaged to 5/10

      const auntMayCard = catalog.getCard('01006')!;
      const auntMayInst = createCardInstance(auntMayCard);
      gameState.players[0].tableau.push(auntMayInst);

      const res = dispatchAction(gameState, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: auntMayInst.instanceId,
        abilityId: 'aunt_may',
      });

      expect(res.result.success).toBe(true);
      // 5 + 4 = 9 HP
      expect(res.state.players[0].health).toBe(9);
      expect(
        res.state.players[0].tableau.find((c) => c.instanceId === auntMayInst.instanceId)
          ?.exhausted,
      ).toBe(true);
    });
  });

  describe('Web-Shooter Uses & Resource (01008)', () => {
    it('enters play with 3 web-counters and exhausts via USE_CARD_ABILITY', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;

      const webShooterCard = catalog.getCard('01008')!;
      const paymentCard = catalog.getCard('01003')!;

      const shooterInst = createCardInstance(webShooterCard);
      const payInst = createCardInstance(paymentCard);

      gameState.players[0].hand = [shooterInst, payInst];

      // Play Web-Shooter
      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: shooterInst.instanceId,
        paymentCardInstanceIds: [payInst.instanceId],
      });

      expect(res.result.success).toBe(true);
      const inPlayShooter = res.state.players[0].tableau.find((c) => c.card.code === '01008')!;
      expect(inPlayShooter).toBeDefined();
      expect(inPlayShooter.tokens?.counters).toBe(3); // 3 counters initialized!
      expect(inPlayShooter.counters?.web).toBe(3); // Typed web counter initialized!

      // Activate Web-Shooter resource ability
      const resourceRes = dispatchAction(res.state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: inPlayShooter.instanceId,
        abilityId: 'web_shooter_resource',
      });

      expect(resourceRes.result.success).toBe(true);
      const updatedShooter = resourceRes.state.players[0].tableau.find(
        (c) => c.card.code === '01008',
      )!;
      expect(updatedShooter.tokens?.counters).toBe(2);
      expect(updatedShooter.counters?.web).toBe(2);
      expect(updatedShooter.exhausted).toBe(true);
    });

    it('prevents Web-Shooter (01008) HERO_ACTION from being used while in Alter-Ego form', () => {
      gameState.players[0].currentForm = 'alter_ego';
      gameState.players[0].activeFormCard = gameState.players[0].alterEgo;

      const webShooterCard = catalog.getCard('01008')!;
      const shooterInst = createCardInstance(webShooterCard);
      shooterInst.tokens = { counters: 3 };
      gameState.players[0].tableau.push(shooterInst);

      const resourceRes = dispatchAction(gameState, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: shooterInst.instanceId,
        abilityId: 'web_shooter_resource',
      });

      expect(resourceRes.result.success).toBe(false);
      expect(resourceRes.result.error).toContain('Hero form');
    });
  });
});
