import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '@data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  StatusCard,
  SideSchemeCard,
  VillainCard,
  MainSchemeCard,
  createCardInstance,
  executeVillainPhase,
  step1_placeThreat,
  step2_villainActivations,
  step3_minionActivations,
  step4_dealEncounterCards,
  step5_revealEncounterCards,
  step6_passFirstPlayerAndRoundUpkeep,
  GamePhase,
} from '@engine/index';

import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Villain Phase Automation (Rules Reference v1.8 p. 31-32)', () => {
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

    const villain = catalog.getCard('01094') as VillainCard; // Rhino I (ATK 2, SCH 1, HP 14)
    const mainScheme = catalog.getCard('01097b') as MainSchemeCard; // The Break-In! (Threat 0, Target 7)

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

  describe('Step 1: Place Threat on Main Scheme (RR v1.8 p. 31)', () => {
    it('places 1 threat per player on the Main Scheme', () => {
      expect(gameState.mainScheme.threat).toBe(0);

      step1_placeThreat(gameState);
      // 1 player * 1 escalation threat = +1 threat
      expect(gameState.mainScheme.threat).toBe(1);
    });

    it('adds extra threat for acceleration tokens and side scheme acceleration icons', () => {
      gameState.accelerationTokens = 1;
      const bombScareCard = catalog.getCard('01109') as SideSchemeCard;
      gameState.sideSchemes.push({
        instanceId: 'side_acc',
        card: { ...bombScareCard, hasAcceleration: true },
        threat: 2,
      });

      step1_placeThreat(gameState);
      // 1 base + 1 token + 1 side scheme icon = +3 threat
      expect(gameState.mainScheme.threat).toBe(3);
    });
  });

  describe('Step 2: Villain Activations (RR v1.8 p. 31, p. 7, 8, 25)', () => {
    it('Villain Schemes against player in Alter-Ego form (drawing boost card)', () => {
      // Put a known boost card (2 boost icons) on top of encounter deck
      const boostCard = createCardInstance({
        ...catalog.getCard('01107')!,
        boostIcons: 2,
      });
      gameState.encounterDeck.unshift(boostCard);

      const initialThreat = gameState.mainScheme.threat;

      step2_villainActivations(gameState);

      // Rhino base scheme (1) + Boost (2) = +3 threat
      expect(gameState.mainScheme.threat).toBe(initialThreat + 3);
      // Boost card should be discarded
      expect(gameState.encounterDiscard.some((c) => c.instanceId === boostCard.instanceId)).toBe(true);
    });

    it('Villain Attacks player in Hero form (drawing boost card)', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;
      gameState.players[0].hand = []; // Empty hand so no Backflip triggers

      const boostCard = createCardInstance({
        ...catalog.getCard('01107')!,
        boostIcons: 2,
      });
      gameState.encounterDeck.unshift(boostCard);

      const initialHealth = gameState.players[0].health; // 10

      step2_villainActivations(gameState);

      // Rhino base attack (2) + Boost (2) = 4 damage -> 10 - 4 = 6 HP
      expect(gameState.players[0].health).toBe(initialHealth - 4);
    });

    it('cancels attack when Villain has Stunned status card', () => {
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;
      gameState.villain.statusCards.push(StatusCard.STUNNED);

      const initialHealth = gameState.players[0].health;

      step2_villainActivations(gameState);

      // Stun is discarded, 0 damage dealt
      expect(gameState.players[0].health).toBe(initialHealth);
      expect(gameState.villain.statusCards).not.toContain(StatusCard.STUNNED);
    });

    it('cancels scheme when Villain has Confused status card', () => {
      gameState.villain.statusCards.push(StatusCard.CONFUSED);
      const initialThreat = gameState.mainScheme.threat;

      step2_villainActivations(gameState);

      // Confused is discarded, 0 threat added
      expect(gameState.mainScheme.threat).toBe(initialThreat);
      expect(gameState.villain.statusCards).not.toContain(StatusCard.CONFUSED);
    });
  });

  describe('Step 3: Minion Activations (RR v1.8 p. 31)', () => {
    it('engaged minion attacks Hero or schemes Alter-Ego', () => {
      const minionCard = catalog.getCard('01110')!; // Hydra Bomber (ATK 1, SCH 1)
      const minionInstance = createCardInstance(minionCard);
      gameState.players[0].engagedMinions.push(minionInstance);

      // In Alter-Ego -> Schemes (+1 threat)
      const initialThreat = gameState.mainScheme.threat;
      step3_minionActivations(gameState);
      expect(gameState.mainScheme.threat).toBe(initialThreat + 1);

      // In Hero -> Attacks (1 damage)
      gameState.players[0].currentForm = 'hero';
      gameState.players[0].activeFormCard = gameState.players[0].hero;
      const initialHealth = gameState.players[0].health;

      step3_minionActivations(gameState);
      expect(gameState.players[0].health).toBe(initialHealth - 1);
    });
  });

  describe('Step 4 & 5: Deal & Reveal Encounter Cards (RR v1.8 p. 32)', () => {
    it('deals 1 encounter card to player and reveals it in Step 5', () => {
      const minionCard = catalog.getCard('01110')!;
      const minionInstance = createCardInstance(minionCard);
      gameState.encounterDeck.unshift(minionInstance);

      expect(gameState.players[0].dealtEncounterCards.length).toBe(0);

      // Step 4 deals card
      step4_dealEncounterCards(gameState);
      expect(gameState.players[0].dealtEncounterCards.length).toBe(1);

      // Step 5 reveals card into play
      step5_revealEncounterCards(gameState);
      expect(gameState.players[0].dealtEncounterCards.length).toBe(0);
      expect(gameState.players[0].engagedMinions.length).toBe(1);
    });
  });

  describe('Step 6: Round Upkeep & Full Phase Execution (RR v1.8 p. 32)', () => {
    it('readies exhausted player, resets round flags, draws up to hand size, and advances round', () => {
      // Set player as exhausted, with 3 cards in hand (spent 3 cards during turn)
      gameState.players[0].exhausted = true;
      gameState.players[0].formChangedThisRound = true;
      gameState.players[0].recoveryUsedThisRound = true;
      gameState.players[0].hand = gameState.players[0].hand.slice(0, 3); // 3 cards left

      step6_passFirstPlayerAndRoundUpkeep(gameState);

      // Verified ready & flags reset
      expect(gameState.players[0].exhausted).toBe(false);
      expect(gameState.players[0].formChangedThisRound).toBe(false);
      expect(gameState.players[0].recoveryUsedThisRound).toBe(false);

      // Peter Parker draws back up to hand size 6
      expect(gameState.players[0].hand.length).toBe(6);

      // Round advances to 2, returns to Player Phase
      expect(gameState.roundNumber).toBe(2);
      expect(gameState.phase).toBe(GamePhase.PLAYER_PHASE);
    });

    it('executes complete Villain Phase runner cleanly', () => {
      const nextState = executeVillainPhase(gameState);

      expect(nextState.roundNumber).toBe(2);
      expect(nextState.phase).toBe(GamePhase.PLAYER_PHASE);
      expect(nextState.mainScheme.threat).toBeGreaterThan(0); // Threat was placed
      expect(nextState.players[0].hand.length).toBe(6); // Hand refilled
      expect(nextState.players[0].exhausted).toBe(false); // Player readied
    });
  });
});
