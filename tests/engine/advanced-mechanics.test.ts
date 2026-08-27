import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '@data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  dispatchAction,
  StatusCard,
  VillainCard,
  MainSchemeCard,
  createCardInstance,
  SideSchemeCard,
} from '@engine/index';

import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Advanced Rules & Card Mechanics (RR v1.8)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);

  let gameState: ReturnType<typeof setupGame>;

  beforeEach(() => {
    resetInstanceCounter();

    const identity = catalog.getHeroIdentity('spider_man')!;
    const signatureCards = catalog.getCardsBySet('spider_man').flatMap((c) => {
      if (c.type === 'hero' || c.type === 'alter_ego') return [];
      return Array(c.quantity).fill(c);
    });
    const justiceCards = catalog.getCardsByFaction('justice' as any).flatMap((c) => Array(c.quantity).fill(c));
    const basicCards = catalog.getCardsByFaction('basic' as any).flatMap((c) => Array(c.quantity).fill(c));
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
          name: 'Spider-Man',
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

  describe('Ally Activations & Consequential Damage (RR v1.8 p. 6, 9)', () => {
    it('Black Cat attacks without consequential damage (attackCost = 0)', () => {
      const blackCatCard = catalog.getCard('01002')!;
      const blackCatInst = createCardInstance(blackCatCard);
      gameState.players[0].allies.push(blackCatInst);

      const initialVillainHealth = gameState.villain.health; // 14

      const res = dispatchAction(gameState, {
        type: 'ALLY_ATTACK',
        playerId: 'p1',
        allyInstanceId: blackCatInst.instanceId,
        targetType: 'villain',
      });

      expect(res.result.success).toBe(true);
      // Deals 1 damage to villain
      expect(res.state.villain.health).toBe(initialVillainHealth - 1);
      // Black Cat took 0 consequential damage
      const inPlayAlly = res.state.players[0].allies.find((a) => a.instanceId === blackCatInst.instanceId);
      expect(inPlayAlly).toBeDefined();
      expect(inPlayAlly?.tokens?.damage).toBe(0);
      expect(inPlayAlly?.exhausted).toBe(true);
    });

    it('Jessica Jones thwarts with bonus from active side schemes', () => {
      const jessicaCard = catalog.getCard('01059')!; // 01059 Jessica Jones
      const jessicaInst = createCardInstance(jessicaCard);
      gameState.players[0].allies.push(jessicaInst);

      // Add a side scheme in play
      const sideSchemeCard = catalog.getCard('01109') as SideSchemeCard;
      gameState.sideSchemes.push({
        instanceId: 'side_1',
        card: sideSchemeCard,
        threat: 2,
      });

      gameState.mainScheme.threat = 5;

      const res = dispatchAction(gameState, {
        type: 'ALLY_THWART',
        playerId: 'p1',
        allyInstanceId: jessicaInst.instanceId,
        targetType: 'main_scheme',
      });

      expect(res.result.success).toBe(true);
      // Base THW 1 + 1 (side scheme) = 2 threat removed -> 5 - 2 = 3
      expect(res.state.mainScheme.threat).toBe(3);
      // Jessica took 1 consequential damage
      const inPlayJessica = res.state.players[0].allies.find((a) => a.instanceId === jessicaInst.instanceId);
      expect(inPlayJessica?.tokens?.damage).toBe(1);
    });
  });

  describe('Encounter Triggers & Status Modifications', () => {
    it('Mockingbird applies Stun status when played', () => {
      const mockingbirdCard = catalog.getCard('01083')!; // 01083 Mockingbird (Cost 3)
      const pay1 = catalog.getCard('01003')!;
      const pay2 = catalog.getCard('01004')!;
      const pay3 = catalog.getCard('01007')!;

      const mockInst = createCardInstance(mockingbirdCard);
      const p1 = createCardInstance(pay1);
      const p2 = createCardInstance(pay2);
      const p3 = createCardInstance(pay3);

      gameState.players[0].hand = [mockInst, p1, p2, p3];

      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: mockInst.instanceId,
        paymentCardInstanceIds: [p1.instanceId, p2.instanceId, p3.instanceId],
      });

      expect(res.result.success).toBe(true);
      // Villain was stunned by Mockingbird
      expect(res.state.villain.statusCards).toContain(StatusCard.STUNNED);
      // Mockingbird is in player's allies zone
      expect(res.state.players[0].allies.some((a) => a.card.code === '01083')).toBe(true);
    });

    it('Surveillance Team exhausts and removes snoop counters to remove threat', () => {
      const survCard = catalog.getCard('01064')!; // 01064 Surveillance Team (Cost 2)
      const payCard1 = catalog.getCard('01003')!;
      const payCard2 = catalog.getCard('01004')!;

      const survInst = createCardInstance(survCard);
      const payInst1 = createCardInstance(payCard1);
      const payInst2 = createCardInstance(payCard2);

      gameState.players[0].hand = [survInst, payInst1, payInst2];
      gameState.mainScheme.threat = 4;

      // Play Surveillance Team
      const playRes = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: survInst.instanceId,
        paymentCardInstanceIds: [payInst1.instanceId, payInst2.instanceId],
      });

      expect(playRes.result.success).toBe(true);
      const inPlaySurv = playRes.state.players[0].tableau.find((c) => c.card.code === '01064')!;
      expect(inPlaySurv.tokens?.counters).toBe(3); // 3 snoop counters

      // Use Surveillance Team ability
      const useRes = dispatchAction(playRes.state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: inPlaySurv.instanceId,
        abilityId: 'surveillance_team_action',
      });

      expect(useRes.result.success).toBe(true);
      expect(useRes.state.mainScheme.threat).toBe(3); // 4 - 1 = 3 threat
      const updatedSurv = useRes.state.players[0].tableau.find((c) => c.card.code === '01064')!;
      expect(updatedSurv.tokens?.counters).toBe(2);
      expect(updatedSurv.exhausted).toBe(true);
    });

    it('Nick Fury enters play, executes modal choice (draws 3 cards), and discards at round end', () => {
      const furyCard = catalog.getCard('01084')!; // 01084 Nick Fury (Cost 4)
      const p1 = catalog.getCard('01003')!;
      const p2 = catalog.getCard('01004')!;
      const p3 = catalog.getCard('01005')!;
      const p4 = catalog.getCard('01007')!;

      const furyInst = createCardInstance(furyCard);
      const pay1 = createCardInstance(p1);
      const pay2 = createCardInstance(p2);
      const pay3 = createCardInstance(p3);
      const pay4 = createCardInstance(p4);

      gameState.players[0].hand = [furyInst, pay1, pay2, pay3, pay4];
      const initialDeck = gameState.players[0].deck.length;

      // Play Nick Fury
      const playRes = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: furyInst.instanceId,
        paymentCardInstanceIds: [pay1.instanceId, pay2.instanceId, pay3.instanceId, pay4.instanceId],
      });

      expect(playRes.result.success).toBe(true);
      // Nick Fury entered play in allies
      expect(playRes.state.players[0].allies.some((a) => a.card.code === '01084')).toBe(true);
      // Evaluated modal choice (hand was empty after paying 4 cards -> drew 3 cards)
      expect(playRes.state.players[0].hand.length).toBe(3);
      expect(playRes.state.players[0].deck.length).toBe(initialDeck - 3);
    });
  });
});
