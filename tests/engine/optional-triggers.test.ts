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
  StatusCard,
} from '@engine/index';

import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Optional Interrupts & Responses Prompting (RR v1.8 & Issue #77)', () => {
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

  describe('Core Set Interrupt 1: Spider-Sense (01001a) on VILLAIN_INITIATES_ATTACK', () => {
    it('prompts the player with generic copy and draws 1 card when choosing Yes', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;
      gameState.players[0].hand = [];
      const initialDeckCount = gameState.players[0].deck.length;

      // Villain activates against Spider-Man
      step2_villainActivations(gameState);

      // Verify prompt is enqueued for Spider-Sense with exact generic wording
      const prompt = gameState.pendingDecisionPrompt;
      expect(prompt).toBeDefined();
      expect(prompt?.title).toBe('Do you want to use the following ability from Spider-Man?');
      expect(prompt?.description).toBe('VILLAIN_INITIATES_ATTACK -> DRAW_CARDS (1)');
      expect(prompt?.isVoluntary).toBe(true);
      expect(prompt?.options.some((o) => o.label === 'Yes')).toBe(true);
      expect(prompt?.options.some((o) => o.label === 'No' || o.id === 'pass')).toBe(true);

      // Hand count is still 0 before resolving prompt
      expect(gameState.players[0].hand.length).toBe(0);

      // Player selects 'Yes'
      const yesOption = prompt!.options.find((o) => o.label === 'Yes')!;
      const res = dispatchAction(gameState, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: yesOption.id,
      });

      expect(res.result.success).toBe(true);
      // Hand now has 1 card drawn from deck
      expect(res.state.players[0].hand.length).toBe(1);
      expect(res.state.players[0].deck.length).toBe(initialDeckCount - 1);

      // Queue continues to Defender declaration prompt
      expect(
        res.state.pendingDecisionPrompt?.options.some((o) => o.effect === 'DECLARE_DEFENDER'),
      ).toBe(true);
    });

    it('prompts the player and draws 0 cards when player chooses No / Pass', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;
      gameState.players[0].hand = [];
      const initialDeckCount = gameState.players[0].deck.length;

      step2_villainActivations(gameState);

      const prompt = gameState.pendingDecisionPrompt;
      expect(prompt?.title).toBe('Do you want to use the following ability from Spider-Man?');

      // Player selects 'No' / 'pass'
      const res = dispatchAction(gameState, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'pass',
      });

      expect(res.result.success).toBe(true);
      // Hand still has 0 cards, deck untouched
      expect(res.state.players[0].hand.length).toBe(0);
      expect(res.state.players[0].deck.length).toBe(initialDeckCount);

      // Queue continues to Defender declaration prompt
      expect(
        res.state.pendingDecisionPrompt?.options.some((o) => o.effect === 'DECLARE_DEFENDER'),
      ).toBe(true);
    });
  });

  describe('Core Set Interrupt 2: Backflip (01003) on TAKE_ATTACK_DAMAGE', () => {
    it('prompts the player and prevents all damage when player chooses Yes', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;
      gameState.players[0].hand = [];

      const backflipCard = catalog.getCard('01003')!;
      const backflipInstance = createCardInstance(backflipCard);
      gameState.players[0].hand = [backflipInstance];

      const initialHealth = gameState.players[0].health;

      // Villain attacks with TAKE_UNDEFENDED to reach damage step
      step2_villainActivations(gameState, {
        synchronousPolicy: 'TAKE_UNDEFENDED',
        acceptOptionalTriggers: false,
      });

      // First prompt is Spider-Sense on attack initiation
      if (gameState.pendingDecisionPrompt?.title?.includes('Spider-Man')) {
        gameState = dispatchAction(gameState, {
          type: 'RESOLVE_DECISION_PROMPT',
          playerId: 'p1',
          selectedOptionId: 'pass',
        }).state;
      }

      // Now at damage step: Backflip prompt enqueued
      const prompt = gameState.pendingDecisionPrompt;
      expect(prompt).toBeDefined();
      expect(prompt?.title).toBe('Do you want to use the following ability from Backflip?');
      expect(prompt?.description).toBe('TAKE_ATTACK_DAMAGE -> PREVENT_DAMAGE (ALL)');

      // Select 'Yes'
      const yesOption = prompt!.options.find((o) => o.label === 'Yes')!;
      const res = dispatchAction(gameState, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: yesOption.id,
      });

      expect(res.result.success).toBe(true);
      // Damage prevented
      expect(res.state.players[0].health).toBe(initialHealth);
      // Backflip discarded
      expect(res.state.players[0].discard.some((c) => c.card.code === '01003')).toBe(true);
      expect(res.state.players[0].hand.length).toBe(0);
    });

    it('applies full damage when player chooses No / Pass for Backflip', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;
      gameState.players[0].hand = [];

      const backflipCard = catalog.getCard('01003')!;
      const backflipInstance = createCardInstance(backflipCard);
      gameState.players[0].hand = [backflipInstance];

      const initialHealth = gameState.players[0].health;

      step2_villainActivations(gameState, {
        synchronousPolicy: 'TAKE_UNDEFENDED',
        acceptOptionalTriggers: false,
      });

      // Pass Spider-Sense
      if (gameState.pendingDecisionPrompt?.title?.includes('Spider-Man')) {
        gameState = dispatchAction(gameState, {
          type: 'RESOLVE_DECISION_PROMPT',
          playerId: 'p1',
          selectedOptionId: 'pass',
        }).state;
      }

      // Pass Backflip
      const prompt = gameState.pendingDecisionPrompt;
      expect(prompt?.title).toBe('Do you want to use the following ability from Backflip?');

      const res = dispatchAction(gameState, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'pass',
      });

      expect(res.result.success).toBe(true);
      // Damage applied (Rhino ATK is 2 + boost)
      expect(res.state.players[0].health).toBeLessThan(initialHealth);
      // Backflip remained in hand!
      expect(
        res.state.players[0].hand.some((c) => c.instanceId === backflipInstance.instanceId),
      ).toBe(true);
    });
  });

  describe('Core Set Response 1: Spider-Woman (01011) on CARD_PLAYED', () => {
    it('prompts the player and confounds villain when player chooses Yes', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;

      const spiderWomanCard = catalog.getCard('01011')!;
      const spiderWomanInstance = createCardInstance(spiderWomanCard);

      // Create resource payment cards
      const res1 = createCardInstance(catalog.getCard('01004')!);
      const res2 = createCardInstance(catalog.getCard('01005')!);
      const res3 = createCardInstance(catalog.getCard('01007')!);

      gameState.players[0].hand = [spiderWomanInstance, res1, res2, res3];

      const playRes = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: spiderWomanInstance.instanceId,
        paymentCardInstanceIds: [res1.instanceId, res2.instanceId, res3.instanceId],
      });

      expect(playRes.result.success).toBe(true);

      // Prompt should be open for Spider-Woman
      const prompt = playRes.state.pendingDecisionPrompt;
      expect(prompt).toBeDefined();
      expect(prompt?.title).toBe('Do you want to use the following ability from Spider-Woman?');
      expect(prompt?.description).toBe('CARD_PLAYED -> ADD_STATUS (CONFUSED)');

      // Select 'Yes'
      const yesOption = prompt!.options.find((o) => o.label === 'Yes')!;
      const promptRes = dispatchAction(playRes.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: yesOption.id,
      });

      expect(promptRes.result.success).toBe(true);
      expect(promptRes.state.villain.statusCards).toContain(StatusCard.CONFUSED);
    });

    it('does not confuse villain when player chooses No / Pass', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;

      const spiderWomanCard = catalog.getCard('01011')!;
      const spiderWomanInstance = createCardInstance(spiderWomanCard);

      const res1 = createCardInstance(catalog.getCard('01004')!);
      const res2 = createCardInstance(catalog.getCard('01005')!);
      const res3 = createCardInstance(catalog.getCard('01007')!);

      gameState.players[0].hand = [spiderWomanInstance, res1, res2, res3];

      const playRes = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: spiderWomanInstance.instanceId,
        paymentCardInstanceIds: [res1.instanceId, res2.instanceId, res3.instanceId],
      });

      const promptRes = dispatchAction(playRes.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'pass',
      });

      expect(promptRes.result.success).toBe(true);
      expect(promptRes.state.villain.statusCards).not.toContain('CONFUSED');
    });
  });

  describe('Core Set Response 2: Daredevil (01058) on THWART_RESOLVED', () => {
    it('prompts the player and deals 1 damage to enemy when choosing Yes', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;

      const daredevilCard = catalog.getCard('01058')!;
      const daredevilInstance = createCardInstance(daredevilCard);
      gameState.players[0].allies = [daredevilInstance];

      gameState.mainScheme.threat = 5;
      const initialVillainHealth = gameState.villain.health;

      // Daredevil thwarts
      const thwartRes = dispatchAction(gameState, {
        type: 'ALLY_THWART',
        playerId: 'p1',
        allyInstanceId: daredevilInstance.instanceId,
        targetType: 'main_scheme',
      });

      expect(thwartRes.result.success).toBe(true);

      // Prompt for Daredevil response
      const prompt = thwartRes.state.pendingDecisionPrompt;
      expect(prompt).toBeDefined();
      expect(prompt?.title).toBe('Do you want to use the following ability from Daredevil?');
      expect(prompt?.description).toBe('THWART_RESOLVED -> DEAL_DAMAGE (1)');

      // Choose 'Yes'
      const yesOption = prompt!.options.find((o) => o.label === 'Yes')!;
      const promptRes = dispatchAction(thwartRes.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: yesOption.id,
      });

      expect(promptRes.result.success).toBe(true);
      expect(promptRes.state.villain.health).toBe(initialVillainHealth - 1);
    });

    it('does not deal damage when player chooses No / Pass on Daredevil', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;

      const daredevilCard = catalog.getCard('01058')!;
      const daredevilInstance = createCardInstance(daredevilCard);
      gameState.players[0].allies = [daredevilInstance];

      gameState.mainScheme.threat = 5;
      const initialVillainHealth = gameState.villain.health;

      // Daredevil thwarts
      const thwartRes = dispatchAction(gameState, {
        type: 'ALLY_THWART',
        playerId: 'p1',
        allyInstanceId: daredevilInstance.instanceId,
        targetType: 'main_scheme',
      });

      const promptRes = dispatchAction(thwartRes.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'pass',
      });

      expect(promptRes.result.success).toBe(true);
      expect(promptRes.state.villain.health).toBe(initialVillainHealth);
    });
  });

  describe('Forced Triggers Contrast (Never Prompt)', () => {
    it('executes Black Cat FORCED_RESPONSE immediately without prompt', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;

      const blackCatCard = catalog.getCard('01002')!;
      const blackCatInstance = createCardInstance(blackCatCard);

      const res1 = createCardInstance(catalog.getCard('01004')!);
      const res2 = createCardInstance(catalog.getCard('01005')!);

      gameState.players[0].hand = [blackCatInstance, res1, res2];
      const initialDeckLength = gameState.players[0].deck.length;

      const playRes = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: blackCatInstance.instanceId,
        paymentCardInstanceIds: [res1.instanceId, res2.instanceId],
      });

      expect(playRes.result.success).toBe(true);
      // Black Cat's ability is FORCED_RESPONSE, so no decision prompt should be opened for it!
      expect(playRes.state.pendingDecisionPrompt).toBeUndefined();
      // 2 cards discarded from deck
      expect(playRes.state.players[0].deck.length).toBe(initialDeckLength - 2);
    });
  });
});
