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

    it('executes interleaved activations per player in player order (RR v1.8 p. 22)', () => {
      // Setup 2-player game: P1 (Hero) with Minion 1, P2 (Alter-Ego) with Minion 2
      const p1 = gameState.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = p1.hero;
      p1.hand = [];

      const captainMarvelIdentity = catalog.getHeroIdentity('captain_marvel')!;
      const p2 = {
        ...p1,
        id: 'p2',
        name: 'Carol Danvers',
        hero: captainMarvelIdentity.hero,
        alterEgo: captainMarvelIdentity.alterEgo,
        activeFormCard: captainMarvelIdentity.alterEgo,
        currentForm: 'alter_ego' as const,
        health: 12,
        maxHealth: 12,
        engagedMinions: [] as any[],
        hand: [],
        deck: [],
        discard: [],
        tableau: [],
        statusCards: [],
        dealtEncounterCards: [],
      };
      gameState.players.push(p2);

      const minion1 = createCardInstance(catalog.getCard('01108')!); // Hydra Mercenary (ATK 1, SCH 1)
      const minion2 = createCardInstance(catalog.getCard('01109')!); // Hydra Bomber (ATK 1, SCH 1)
      p1.engagedMinions.push(minion1);
      p2.engagedMinions.push(minion2);

      gameState.firstPlayerIndex = 0;
      gameState.log = [];

      step2_villainActivations(gameState);

      // Extract attack/scheme activation log keys
      const activationLogs = gameState.log.filter((l) =>
        ['villain.attack.hit', 'villain.scheme.threat', 'minion.attack.hit', 'minion.scheme.threat'].includes(l.key),
      );

      // Verify sequence:
      // 1. Villain attacks P1
      // 2. Minion 1 attacks P1
      // 3. Villain schemes against P2
      // 4. Minion 2 schemes against P2
      expect(activationLogs.length).toBe(4);
      expect(activationLogs[0].key).toBe('villain.attack.hit');
      expect(activationLogs[0].params?.player).toBe(p1.name);

      expect(activationLogs[1].key).toBe('minion.attack.hit');
      expect(activationLogs[1].params?.player).toBe(p1.name);

      expect(activationLogs[2].key).toBe('villain.scheme.threat');

      expect(activationLogs[3].key).toBe('minion.scheme.threat');
      expect(activationLogs[3].params?.player).toBe(p2.name);
    });

    it('respects first player rotation during interleaved activations', () => {
      // Setup 2-player game where P2 is First Player
      const p1 = gameState.players[0];
      p1.currentForm = 'hero';
      p1.activeFormCard = p1.hero;
      p1.hand = [];

      const captainMarvelIdentity = catalog.getHeroIdentity('captain_marvel')!;
      const p2 = {
        ...p1,
        id: 'p2',
        name: 'Carol Danvers',
        hero: captainMarvelIdentity.hero,
        alterEgo: captainMarvelIdentity.alterEgo,
        activeFormCard: captainMarvelIdentity.hero,
        currentForm: 'hero' as const,
        health: 12,
        maxHealth: 12,
        engagedMinions: [] as any[],
        hand: [],
        deck: [],
        discard: [],
        tableau: [],
        statusCards: [],
        dealtEncounterCards: [],
      };
      gameState.players.push(p2);

      const minion1 = createCardInstance(catalog.getCard('01108')!);
      const minion2 = createCardInstance(catalog.getCard('01109')!);
      p1.engagedMinions.push(minion1);
      p2.engagedMinions.push(minion2);

      gameState.firstPlayerIndex = 1; // P2 starts!
      gameState.log = [];

      step2_villainActivations(gameState);

      const activationLogs = gameState.log.filter((l) =>
        ['villain.attack.hit', 'minion.attack.hit'].includes(l.key),
      );

      // Verify sequence starts with P2:
      // 1. Villain attacks P2
      // 2. Minion 2 attacks P2
      // 3. Villain attacks P1
      // 4. Minion 1 attacks P1
      expect(activationLogs[0].params?.player).toBe(p2.name);
      expect(activationLogs[1].params?.player).toBe(p2.name);
      expect(activationLogs[2].params?.player).toBe(p1.name);
      expect(activationLogs[3].params?.player).toBe(p1.name);
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
      const minionCard = catalog.getCard('01101')!; // Hydra Mercenary (vanilla guard minion)
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

    it('triggers Shocker (01103) When Revealed ability to deal 1 damage to each hero in Step 5', () => {
      const shockerCard = catalog.getCard('01103')!;
      const shockerInstance = createCardInstance(shockerCard);
      gameState.players[0].dealtEncounterCards = [shockerInstance];
      const initialHealth = gameState.players[0].health;

      step5_revealEncounterCards(gameState);

      expect(gameState.players[0].engagedMinions.length).toBe(1);
      expect(gameState.players[0].engagedMinions[0].card.code).toBe('01103');
      expect(gameState.players[0].health).toBe(initialHealth - 1);
    });

    it('triggers Bomb Scare (01109) When Revealed ability to place additional threat on side scheme in Step 5', () => {
      const bombScareCard = catalog.getCard('01109')!;
      const bombScareInstance = createCardInstance(bombScareCard);
      gameState.players[0].dealtEncounterCards = [bombScareInstance];

      step5_revealEncounterCards(gameState);

      expect(gameState.sideSchemes.length).toBe(1);
      expect(gameState.sideSchemes[0].card.code).toBe('01109');
      // Base threat 2 + 1 per player = 3 total threat
      expect(gameState.sideSchemes[0].threat).toBe(3);
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

    it.skip('triggers Emergency (01085) Interrupt when villain schemes against Alter-Ego to reduce threat placed by 1 (pending Tier 3 prompt modal ADR-0020)', () => {
      const p1 = gameState.players[0];
      p1.currentForm = 'alter_ego';
      p1.activeFormCard = p1.alterEgo;

      const emergencyCard = catalog.getCard('01085')!;
      const emergencyInst = createCardInstance(emergencyCard);
      p1.hand = [emergencyInst];

      const initialDiscardCount = p1.discard.length;

      // Execute Step 2 activations
      step2_villainActivations(gameState);

      // Threat should be placed, but reduced by 1 via Emergency Interrupt
      expect(p1.hand.length).toBe(0); // Emergency was spent
      expect(p1.discard.length).toBe(initialDiscardCount + 1); // Discarded
      expect(p1.discard[p1.discard.length - 1].card.code).toBe('01085');
      expect(gameState.log.some((l) => l.onomatopoeia === 'EMERGENCY!')).toBe(true);
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
