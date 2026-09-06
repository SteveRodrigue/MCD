import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '@data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  dispatchAction,
  StatusCard,
  SideSchemeCard,
  VillainCard,
  MainSchemeCard,
  createCardInstance,
  evaluateCardPlayability,
  Keyword,
} from '@engine/index';

import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Player Actions Pipeline (Rules Reference v1.8)', () => {
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

  describe('Change Form (RR v1.8 p. 13-14)', () => {
    it('flips from Alter-Ego to Hero form and enforces once-per-round limit', () => {
      expect(gameState.players[0].currentForm).toBe('alter_ego');

      // 1. Change Form to Hero (Spider-Man)
      const res1 = dispatchAction(gameState, {
        type: 'CHANGE_FORM',
        playerId: 'p1',
        targetFormCode: '01001a',
      });
      expect(res1.result.success).toBe(true);
      expect(res1.result.onomatopoeia).toBe('SUIT UP!');
      expect(res1.state.players[0].currentForm).toBe('hero');
      expect(res1.state.players[0].activeFormCard.code).toBe('01001a');
      expect(res1.state.players[0].formChangedThisRound).toBe(true);

      // 2. Second Change Form in same round is rejected
      const res2 = dispatchAction(res1.state, {
        type: 'CHANGE_FORM',
        playerId: 'p1',
        targetFormCode: '01001b',
      });
      expect(res2.result.success).toBe(false);
      expect(res2.result.error).toContain('Limit once per round');
    });
  });

  describe('Basic Recover (RR v1.8 p. 23)', () => {
    it('recovers HP in Alter-Ego form and exhausts character', () => {
      // Damage player to 6 HP (out of 10)
      gameState.players[0].health = 6;

      const res = dispatchAction(gameState, {
        type: 'BASIC_RECOVER',
        playerId: 'p1',
      });

      expect(res.result.success).toBe(true);
      // Peter Parker has REC 3 -> 6 + 3 = 9 HP
      expect(res.state.players[0].health).toBe(9);
      expect(res.state.players[0].exhausted).toBe(true);

      // Cannot recover again while exhausted
      const res2 = dispatchAction(res.state, {
        type: 'BASIC_RECOVER',
        playerId: 'p1',
      });
      expect(res2.result.success).toBe(false);
      expect(res2.result.error).toContain('exhausted');
    });

    it('prevents Recover while in Hero form', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;

      const res = dispatchAction(gameState, {
        type: 'BASIC_RECOVER',
        playerId: 'p1',
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toContain('Alter-Ego form');
    });
  });

  describe('Basic Attack & Keyword Checks (RR v1.8 p. 5-6, 15, 26, 27)', () => {
    beforeEach(() => {
      // Put Spider-Man in Hero form
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;
    });

    it('deals basic attack damage to the Villain', () => {
      const initialVillainHealth = gameState.villain.health; // 14

      const res = dispatchAction(gameState, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'villain',
      });

      expect(res.result.success).toBe(true);
      expect(res.result.onomatopoeia).toBe('POW!');
      // Spider-Man has ATK 2 -> 14 - 2 = 12
      expect(res.state.villain.health).toBe(initialVillainHealth - 2);
      expect(res.state.players[0].exhausted).toBe(true);
    });

    it('discards Stunned status card instead of dealing damage', () => {
      gameState.players[0].statusCards.push(StatusCard.STUNNED);
      const initialVillainHealth = gameState.villain.health;

      const res = dispatchAction(gameState, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'villain',
      });

      expect(res.result.success).toBe(true);
      expect(res.result.onomatopoeia).toBe('STUN CLEARED!');
      // Damage was cancelled, status removed
      expect(res.state.villain.health).toBe(initialVillainHealth);
      expect(res.state.players[0].statusCards).not.toContain(StatusCard.STUNNED);
    });

    it('discards Tough status card from target without dealing HP damage', () => {
      gameState.villain.statusCards.push(StatusCard.TOUGH);
      const initialVillainHealth = gameState.villain.health;

      const res = dispatchAction(gameState, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'villain',
      });

      expect(res.result.success).toBe(true);
      expect(res.result.onomatopoeia).toContain('TOUGH');
      expect(res.state.villain.health).toBe(initialVillainHealth);
      expect(res.state.villain.statusCards).not.toContain(StatusCard.TOUGH);
    });

    it('blocks attacking Villain when an engaged minion has Guard (RR v1.8 p. 15)', () => {
      // Create a mock Armored Guard minion with Guard keyword in text
      const guardMinionCard = catalog.getCard('01108')!; // Minion
      const guardMinionInstance = createCardInstance({
        ...guardMinionCard,
        keywords: [Keyword.GUARD],
        text: 'Guard. (Cannot attack villain).',
      });

      gameState.players[0].engagedMinions.push(guardMinionInstance);

      // Attempt attack on villain -> BLOCKED
      const res1 = dispatchAction(gameState, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'villain',
      });
      expect(res1.result.success).toBe(false);
      expect(res1.result.error).toContain('Guard');

      // Attack on the Guard minion itself -> ALLOWED
      const res2 = dispatchAction(gameState, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'minion',
        targetInstanceId: guardMinionInstance.instanceId,
      });
      expect(res2.result.success).toBe(true);
    });

    it('ally attacks minion, deals damage, and applies consequential damage', () => {
      const allyCard = catalog.getCard('01011')!; // Spider-Woman (ATK 2, HP 2, Consequential 1)
      const allyInstance = createCardInstance(allyCard);
      gameState.players[0].allies.push(allyInstance);

      const minionCard = catalog.getCard('01103')!; // Armored Guard (HP 3)
      const minionInstance = createCardInstance(minionCard);
      minionInstance.statusCards = []; // Remove Tough so it takes damage directly
      gameState.players[0].engagedMinions.push(minionInstance);

      const res = dispatchAction(gameState, {
        type: 'ALLY_ATTACK',
        playerId: 'p1',
        allyInstanceId: allyInstance.instanceId,
        targetType: 'minion',
        targetInstanceId: minionInstance.instanceId,
      });

      expect(res.result.success).toBe(true);
      // Minion took 2 damage (HP 3 -> remaining damage token = 2)
      const updatedMinion = res.state.players[0].engagedMinions.find(
        (m) => m.instanceId === minionInstance.instanceId,
      )!;
      expect(updatedMinion.tokens?.damage).toBe(2);
      // Ally took 1 consequential damage
      const updatedAlly = res.state.players[0].allies.find(
        (a) => a.instanceId === allyInstance.instanceId,
      )!;
      expect(updatedAlly.tokens?.damage).toBe(1);
      expect(updatedAlly.exhausted).toBe(true);
    });

    it('blocks ally attacking Villain when an engaged minion has Guard (RR v1.8 p. 15)', () => {
      const allyCard = catalog.getCard('01011')!;
      const allyInstance = createCardInstance(allyCard);
      gameState.players[0].allies.push(allyInstance);

      const guardMinionCard = catalog.getCard('01108')!;
      const guardMinionInstance = createCardInstance({
        ...guardMinionCard,
        keywords: [Keyword.GUARD],
        text: 'Guard.',
      });
      gameState.players[0].engagedMinions.push(guardMinionInstance);

      const res = dispatchAction(gameState, {
        type: 'ALLY_ATTACK',
        playerId: 'p1',
        allyInstanceId: allyInstance.instanceId,
        targetType: 'villain',
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toContain('Guard');
    });
  });

  describe('Basic Thwart & Crisis/Patrol Checks (RR v1.8 p. 29, 11, 10)', () => {
    beforeEach(() => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;
      gameState.mainScheme.threat = 3;
    });

    it('removes threat from the Main Scheme', () => {
      const res = dispatchAction(gameState, {
        type: 'BASIC_THWART',
        playerId: 'p1',
        targetType: 'main_scheme',
      });

      expect(res.result.success).toBe(true);
      expect(res.result.onomatopoeia).toBe('FOILED!');
      // Spider-Man has THW 1 -> 3 - 1 = 2
      expect(res.state.mainScheme.threat).toBe(2);
      expect(res.state.players[0].exhausted).toBe(true);
    });

    it('discards Confused status card instead of removing threat', () => {
      gameState.players[0].statusCards.push(StatusCard.CONFUSED);

      const res = dispatchAction(gameState, {
        type: 'BASIC_THWART',
        playerId: 'p1',
        targetType: 'main_scheme',
      });

      expect(res.result.success).toBe(true);
      expect(res.result.onomatopoeia).toBe('CONFUSION CLEARED!');
      expect(res.state.mainScheme.threat).toBe(3); // Threat unchanged
      expect(res.state.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
    });

    it('blocks thwarting Main Scheme when a Side Scheme with Crisis icon is in play (RR v1.8 p. 11)', () => {
      const crowdControlCard = catalog.getCard('01108') as SideSchemeCard; // Crowd Control with Crisis
      gameState.sideSchemes.push({
        instanceId: 'side_scheme_crisis',
        card: { ...crowdControlCard, hasCrisis: true },
        threat: 2,
      });

      const res = dispatchAction(gameState, {
        type: 'BASIC_THWART',
        playerId: 'p1',
        targetType: 'main_scheme',
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toContain('Crisis icon');
    });
  });

  describe('Play Card & Payment (RR v1.8 p. 16, 20)', () => {
    it('plays an Upgrade card by discarding payment resources from hand', () => {
      const player = gameState.players[0];
      const webShooterCard = catalog.getCard('01008')!; // Cost 1 Upgrade
      const resourceCard = catalog.getCard('01003')!; // Backflip (1 physical resource)

      const webShooterInstance = createCardInstance(webShooterCard);
      const resourceInstance = createCardInstance(resourceCard);

      player.hand = [webShooterInstance, resourceInstance];

      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: webShooterInstance.instanceId,
        paymentCardInstanceIds: [resourceInstance.instanceId],
      });

      expect(res.result.success).toBe(true);
      // Web-Shooter should be in tableau
      expect(res.state.players[0].tableau.some((c) => c.card.code === '01008')).toBe(true);
      // Payment card should be in discard pile
      expect(res.state.players[0].discard.some((c) => c.card.code === '01003')).toBe(true);
      // Hand should be empty
      expect(res.state.players[0].hand.length).toBe(0);
    });

    it('rejects playing a card with insufficient resources', () => {
      // Put in Hero form since Swinging Web Kick is a Hero Action
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;

      const player = gameState.players[0];
      const kickCard = catalog.getCard('01005')!; // Swinging Web Kick (Cost 3)
      const resourceCard = catalog.getCard('01003')!; // 1 resource

      const kickInstance = createCardInstance(kickCard);
      const resourceInstance = createCardInstance(resourceCard);

      player.hand = [kickInstance, resourceInstance];

      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: kickInstance.instanceId,
        paymentCardInstanceIds: [resourceInstance.instanceId], // Only 1 resource provided for cost 3
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toContain('Insufficient resources: Need 3');
    });

    it('plays an Event (Swinging Web Kick) dealing 8 damage to the villain', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;

      const player = gameState.players[0];
      const kickCard = catalog.getCard('01005')!; // Swinging Web Kick (Cost 3, 8 damage)
      const energyCard = catalog.getCard('01088')!; // Energy (2 resources)
      const backflipCard = catalog.getCard('01004')!; // Backflip (1 resource)

      const kickInstance = createCardInstance(kickCard);
      const energyInstance = createCardInstance(energyCard);
      const backflipInstance = createCardInstance(backflipCard);

      player.hand = [kickInstance, energyInstance, backflipInstance];

      const initialVillainHp = gameState.villain.health;

      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: kickInstance.instanceId,
        paymentCardInstanceIds: [energyInstance.instanceId, backflipInstance.instanceId],
      });

      expect(res.result.success).toBe(true);
      expect(res.result.onomatopoeia).toBe('POW!');
      expect(res.state.villain.health).toBe(initialVillainHp - 8);
      // Event goes to discard pile
      expect(res.state.players[0].discard.some((c) => c.card.code === '01005')).toBe(true);
      expect(res.state.players[0].hand.length).toBe(0);
    });

    it('plays an Ally (Black Cat) which enters play in the allies zone', () => {
      const player = gameState.players[0];
      const blackCatCard = catalog.getCard('01002')!; // Black Cat (Cost 2)
      const energyCard = catalog.getCard('01088')!; // Energy (2 resources)

      const blackCatInstance = createCardInstance(blackCatCard);
      const energyInstance = createCardInstance(energyCard);

      player.hand = [blackCatInstance, energyInstance];

      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: blackCatInstance.instanceId,
        paymentCardInstanceIds: [energyInstance.instanceId],
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].allies.some((a) => a.card.code === '01002')).toBe(true);
    });

    it('pays for a card using an in-play generator (Web-Shooter counters in Hero form)', () => {
      const player = gameState.players[0];
      player.currentForm = 'hero';
      player.activeFormCard = gameState.players[0].hero;

      const webShooterInPlay = createCardInstance(catalog.getCard('01008')!);
      webShooterInPlay.tokens = { counters: 3 };
      player.tableau.push(webShooterInPlay);
      const minionInstance = createCardInstance(catalog.getCard('01101')!);
      player.engagedMinions = [minionInstance];

      const spiderTracerCard = catalog.getCard('01007')!; // Spider-Tracer (Cost 1)
      const spiderTracerInstance = createCardInstance(spiderTracerCard);
      player.hand = [spiderTracerInstance];

      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: spiderTracerInstance.instanceId,
        paymentCardInstanceIds: [],
        generatorInstanceIds: [webShooterInPlay.instanceId],
      });

      expect(res.result.success).toBe(true);
      expect(
        res.state.players[0].engagedMinions[0].attachments?.some((c) => c.card.code === '01007'),
      ).toBe(true);
      // Web-Shooter should have 2 counters remaining
      const shooter = res.state.players[0].tableau.find((c) => c.card.code === '01008')!;
      expect(shooter.tokens?.counters).toBe(2);
      expect(shooter.exhausted).toBe(true);
    });

    it('doubles resources for aspect cards using The Power of Leadership', () => {
      const player = gameState.players[0];
      const mariaHillCard = catalog.getCard('01067')!; // Maria Hill (Leadership Ally, Cost 2)
      const powerOfLeadershipCard = catalog.getCard('01072')!; // The Power of Leadership

      const mariaInstance = createCardInstance(mariaHillCard);
      const powerInstance = createCardInstance(powerOfLeadershipCard);

      player.hand = [mariaInstance, powerInstance];

      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: mariaInstance.instanceId,
        paymentCardInstanceIds: [powerInstance.instanceId], // 1 card provides 2 resources because of matching aspect
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].allies.some((a) => a.card.code === '01067')).toBe(true);
    });

    it('enforces unicity and prevents duplicate unique allies in play (RR v1.8 p. 28)', () => {
      const player = gameState.players[0];
      const nickFury1 = createCardInstance(catalog.getCard('01084')!); // Unique Ally Nick Fury
      const nickFury2 = createCardInstance(catalog.getCard('01084')!);
      const energy1 = createCardInstance(catalog.getCard('01088')!);
      const energy2 = createCardInstance(catalog.getCard('01088')!);

      player.allies.push(nickFury1);
      player.hand = [nickFury2, energy1, energy2];

      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: nickFury2.instanceId,
        paymentCardInstanceIds: [energy1.instanceId, energy2.instanceId],
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toContain('unique copy');
    });

    it('enforces default ally limit of 3 (RR v1.8 p. 3)', () => {
      const player = gameState.players[0];
      // Put 3 allies in play
      player.allies = [
        createCardInstance(catalog.getCard('01002')!), // Black Cat
        createCardInstance(catalog.getCard('01053')!), // Hulk
        createCardInstance(catalog.getCard('01054')!), // Tigra
      ];

      const mockingbirdCard = catalog.getCard('01083')!; // Mockingbird (Ally)
      const mockingbirdInstance = createCardInstance(mockingbirdCard);
      const energyCard = createCardInstance(catalog.getCard('01088')!);
      const energyCard2 = createCardInstance(catalog.getCard('01088')!);

      player.hand = [mockingbirdInstance, energyCard, energyCard2];

      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: mockingbirdInstance.instanceId,
        paymentCardInstanceIds: [energyCard.instanceId, energyCard2.instanceId],
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toContain('Ally limit reached');
    });

    it('uses Alter-Ego identity resource ability (Peter Parker: Scientist) to pay for a 1-cost card', () => {
      // In Alter-Ego form (Peter Parker)
      gameState.players[0].currentForm = 'alter_ego';
      gameState.players[0].activeFormCard = gameState.players[0].alterEgo;

      const player = gameState.players[0];
      const webShooterCard = catalog.getCard('01008')!; // Cost 1 Upgrade

      const webShooterInstance = createCardInstance(webShooterCard);
      player.hand = [webShooterInstance]; // No extra cards in hand

      const res = dispatchAction(gameState, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: webShooterInstance.instanceId,
        paymentCardInstanceIds: [],
        generatorInstanceIds: ['identity_ability'],
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].tableau.some((c) => c.card.code === '01008')).toBe(true);
      expect(res.state.players[0].hand.length).toBe(0);

      // Attempting to use Scientist a 2nd time in the same round must be rejected
      const webShooter2 = createCardInstance(webShooterCard);
      res.state.players[0].hand = [webShooter2];

      const res2 = dispatchAction(res.state, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: webShooter2.instanceId,
        paymentCardInstanceIds: [],
        generatorInstanceIds: ['identity_ability'],
      });

      expect(res2.result.success).toBe(false);
      expect(res2.result.error).toContain('once per round');
    });

    describe('Declarative Card Playability Evaluation (Grayscale / Unplayable Checks)', () => {
      it('marks Hero Action events as unplayable in Alter-Ego form', () => {
        // In Alter-Ego form (Peter Parker)
        gameState.players[0].currentForm = 'alter_ego';
        gameState.players[0].activeFormCard = gameState.players[0].alterEgo;

        const kickCard = catalog.getCard('01005')!; // Swinging Web Kick (Hero Action)
        const kickInst = createCardInstance(kickCard);
        // Add 5 resource cards to hand so cost is easily met
        const resCard = catalog.getCard('01088')!;
        gameState.players[0].hand = [
          kickInst,
          createCardInstance(resCard),
          createCardInstance(resCard),
          createCardInstance(resCard),
          createCardInstance(resCard),
        ];

        const status = evaluateCardPlayability(gameState, 'p1', kickInst);
        expect(status.isPlayable).toBe(false);
        expect(status.reasons).toContain('Requires Hero form');
      });

      it('marks Events with Hero Action (e.g. Swinging Web Kick) as unplayable in Alter-Ego form', () => {
        // In Alter-Ego form (Peter Parker)
        gameState.players[0].currentForm = 'alter_ego';
        gameState.players[0].activeFormCard = gameState.players[0].alterEgo;

        const webKickCard = catalog.getCard('01005')!; // Swinging Web Kick (Cost 3 Event: Hero Action)
        const webKickInst = createCardInstance(webKickCard);
        const resCard = catalog.getCard('01088')!;
        // Provide 3 resources for cost 3
        gameState.players[0].hand = [
          webKickInst,
          createCardInstance(resCard),
          createCardInstance(resCard),
          createCardInstance(resCard),
        ];

        const statusAlterEgo = evaluateCardPlayability(gameState, 'p1', webKickInst);
        expect(statusAlterEgo.isPlayable).toBe(false);
        expect(statusAlterEgo.reasons).toContain('Requires Hero form');

        // Switch to Hero form (Spider-Man) -> Swinging Web Kick becomes playable
        gameState.players[0].currentForm = 'hero';
        gameState.players[0].activeFormCard = gameState.players[0].hero;

        const statusHero = evaluateCardPlayability(gameState, 'p1', webKickInst);
        expect(statusHero.isPlayable).toBe(true);
        expect(statusHero.reasons.length).toBe(0);
      });

      it('marks cards as unplayable when total potential resources are insufficient to pay cost', () => {
        gameState.players[0].currentForm = 'hero';
        gameState.players[0].activeFormCard = gameState.players[0].hero;

        const kickCard = catalog.getCard('01005')!; // Cost 3
        const kickInst = createCardInstance(kickCard);
        const resCard = catalog.getCard('01088')!; // 1 resource
        // Hand only has 1 extra card (1 resource), need 3
        gameState.players[0].hand = [kickInst, createCardInstance(resCard)];

        const status = evaluateCardPlayability(gameState, 'p1', kickInst);
        expect(status.isPlayable).toBe(false);
        expect(status.reasons.some((r) => r.includes('Cannot afford cost'))).toBe(true);
      });

      it('marks non-active player hand cards as unplayable during Player Phase', () => {
        // Add a 2nd player to gameState
        const p2Hero = catalog.getCard('01010a')!;
        const p2AlterEgo = catalog.getCard('01010b')!;
        gameState.players.push({
          id: 'p2',
          name: 'Captain Marvel',
          hero: p2Hero as any,
          alterEgo: p2AlterEgo as any,
          availableForms: [p2Hero, p2AlterEgo],
          activeFormCard: p2Hero,
          currentForm: 'hero',
          health: 9,
          maxHealth: 9,
          exhausted: false,
          statusCards: [],
          hand: [createCardInstance(catalog.getCard('01013')!)], // Crisis Intercursor
          deck: [],
          discard: [],
          tableau: [],
          allies: [],
          engagedMinions: [],
          basicChangeFormUsedThisRound: false,
          formChangedThisRound: false,
          recoveryUsedThisRound: false,
          dealtEncounterCards: [],
          setAsideCards: [],
        });

        // Set Player Phase and Player 0 (Spider-Man) as active player
        gameState.phase = 'PLAYER_PHASE' as any;
        gameState.activePlayerIndex = 0;

        // Evaluate card in Player 1's hand
        const p2Card = gameState.players[1].hand[0];
        const status = evaluateCardPlayability(gameState, 'p2', p2Card);

        expect(status.isPlayable).toBe(false);
        expect(status.reasons.some((r) => r.includes('Not your turn'))).toBe(true);
      });

      it('marks reactive Interrupt/Response events (e.g. Emergency, Backflip) as unplayable during standard action windows', () => {
        const p1 = gameState.players[0];
        p1.currentForm = 'hero';
        p1.activeFormCard = p1.hero;
        gameState.phase = 'PLAYER_PHASE' as any;
        gameState.activePlayerIndex = 0;

        // Emergency (01085) - Interrupt: when threat placed
        const emergencyCard = catalog.getCard('01085')!;
        const emergencyInst = createCardInstance(emergencyCard);

        // Backflip (01003) - Hero Interrupt: when take attack damage
        const backflipCard = catalog.getCard('01003')!;
        const backflipInst = createCardInstance(backflipCard);

        // First Aid (01086) - Action: Heal 2
        const firstAidCard = catalog.getCard('01086')!;
        const firstAidInst = createCardInstance(firstAidCard);

        const resCard = catalog.getCard('01088')!;
        p1.hand = [emergencyInst, backflipInst, firstAidInst, createCardInstance(resCard)];

        // Emergency (Blocked Interrupt) must be unplayable
        const emergencyStatus = evaluateCardPlayability(gameState, 'p1', emergencyInst);
        expect(emergencyStatus.isPlayable).toBe(false);
        expect(
          emergencyStatus.reasons.some(
            (r) => r.includes('blocked') || r.includes('Interrupt/Response'),
          ),
        ).toBe(true);

        // Backflip (Hero Interrupt) must be unplayable
        const backflipStatus = evaluateCardPlayability(gameState, 'p1', backflipInst);
        expect(backflipStatus.isPlayable).toBe(false);
        expect(backflipStatus.reasons.some((r) => r.includes('Interrupt/Response'))).toBe(true);

        // First Aid (Action) must be playable
        const firstAidStatus = evaluateCardPlayability(gameState, 'p1', firstAidInst);
        expect(firstAidStatus.isPlayable).toBe(true);
      });
    });

    describe('Dev Mode Actions (Tutor / Card Selection)', () => {
      it('adds selected card from player deck into player hand with DEV_ADD_CARD_TO_HAND', () => {
        const player = gameState.players[0];
        const targetDeckCard = player.deck[3];
        const initialDeckCount = player.deck.length;
        const initialHandCount = player.hand.length;

        const res = dispatchAction(gameState, {
          type: 'DEV_ADD_CARD_TO_HAND',
          playerId: 'p1',
          cardInstanceId: targetDeckCard.instanceId,
        });

        expect(res.result.success).toBe(true);
        expect(res.result.onomatopoeia).toBe('CARD ADDED!');
        expect(res.state.players[0].deck.length).toBe(initialDeckCount - 1);
        expect(res.state.players[0].hand.length).toBe(initialHandCount + 1);
        expect(
          res.state.players[0].hand.some((c) => c.instanceId === targetDeckCard.instanceId),
        ).toBe(true);
        expect(
          res.state.players[0].deck.some((c) => c.instanceId === targetDeckCard.instanceId),
        ).toBe(false);
      });

      it('executes Tony Stark Futurist ability: prompts player to choose 1 card among top 3, discards other 2', () => {
        const ironManIdentity = catalog.getHeroIdentity('iron_man')!;
        gameState.players[0].alterEgo = ironManIdentity.alterEgo;
        gameState.players[0].hero = ironManIdentity.hero;
        gameState.players[0].activeFormCard = ironManIdentity.alterEgo;
        gameState.players[0].currentForm = 'alter_ego';

        const player = gameState.players[0];
        // Prepare deck with Arc Reactor (01035) and 2 other cards
        const arcReactor = createCardInstance(catalog.getCard('01035')!);
        const nonTech1 = createCardInstance(catalog.getCard('01005')!);
        const nonTech2 = createCardInstance(catalog.getCard('01005')!);
        player.deck = [arcReactor, nonTech1, nonTech2, ...player.deck];

        const initialHandLength = player.hand.length;
        const initialDiscardLength = player.discard.length;

        // 1. Trigger Futurist
        const res1 = dispatchAction(gameState, {
          type: 'USE_CARD_ABILITY',
          playerId: 'p1',
          cardInstanceId: ironManIdentity.alterEgo.code,
          abilityId: 'futurist',
        });

        expect(res1.result.success).toBe(true);
        expect(res1.state.pendingDecisionPrompt).toBeDefined();
        expect(res1.state.pendingDecisionPrompt?.title).toMatch(/futurist/i);
        expect(res1.state.pendingDecisionPrompt?.options.length).toBe(3); // All 3 looked cards offered per printed card text

        // 2. Select the Arc Reactor card
        const techOptionId = arcReactor.instanceId;
        const res2 = dispatchAction(res1.state, {
          type: 'RESOLVE_DECISION_PROMPT',
          playerId: 'p1',
          selectedOptionId: techOptionId,
        });

        expect(res2.result.success).toBe(true);
        expect(res2.state.pendingDecisionPrompt).toBeUndefined();
        // Arc Reactor should now be in hand
        expect(res2.state.players[0].hand.length).toBe(initialHandLength + 1);
        expect(res2.state.players[0].hand.some((c) => c.card.code === '01035')).toBe(true);
        // The other 2 cards should be discarded
        expect(res2.state.players[0].discard.length).toBe(initialDiscardLength + 2);
      });

      it('executes Tony Stark Futurist ability and allows selecting any looked card, discarding remainder', () => {
        const ironManIdentity = catalog.getHeroIdentity('iron_man')!;
        gameState.players[0].alterEgo = ironManIdentity.alterEgo;
        gameState.players[0].hero = ironManIdentity.hero;
        gameState.players[0].activeFormCard = ironManIdentity.alterEgo;
        gameState.players[0].currentForm = 'alter_ego';

        const player = gameState.players[0];
        const arcReactor = createCardInstance(catalog.getCard('01035')!); // Tech
        const markVArmor = createCardInstance(catalog.getCard('01036')!); // Tech
        const nonTech2 = createCardInstance(catalog.getCard('01005')!); // Non-tech
        player.deck = [arcReactor, markVArmor, nonTech2, ...player.deck];

        const initialHandLength = player.hand.length;
        const initialDiscardLength = player.discard.length;

        const res1 = dispatchAction(gameState, {
          type: 'USE_CARD_ABILITY',
          playerId: 'p1',
          cardInstanceId: ironManIdentity.alterEgo.code,
          abilityId: 'futurist',
        });

        expect(res1.result.success).toBe(true);
        expect(res1.state.pendingDecisionPrompt).toBeDefined();
        expect(res1.state.pendingDecisionPrompt?.options.length).toBe(3); // All 3 looked cards offered

        // Select the second card (markVArmor)
        const secondOptionId = markVArmor.instanceId;
        const res2 = dispatchAction(res1.state, {
          type: 'RESOLVE_DECISION_PROMPT',
          playerId: 'p1',
          selectedOptionId: secondOptionId,
        });

        expect(res2.result.success).toBe(true);
        // Hand has 1 new card (Mark V Armor)
        expect(res2.state.players[0].hand.length).toBe(initialHandLength + 1);
        expect(res2.state.players[0].hand.some((c) => c.instanceId === markVArmor.instanceId)).toBe(
          true,
        );
        // The other 2 looked cards (arcReactor and nonTech2) are discarded
        expect(res2.state.players[0].discard.length).toBe(initialDiscardLength + 2);
        expect(
          res2.state.players[0].discard.some((c) => c.instanceId === arcReactor.instanceId),
        ).toBe(true);
        expect(
          res2.state.players[0].discard.some((c) => c.instanceId === nonTech2.instanceId),
        ).toBe(true);
      });
    });
  });
});
