import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardType, Keyword, NormalizedCard, StatusCard } from '@engine/models';
import { executeEffect } from '@engine/effects';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { executeVillainPhase } from '@engine/pipeline/villain-phase';

describe('Advanced Status Dynamics & Minion Modifiers (ADR-0036, RR v1.8 p. 14, 16, 18, 28, 30)', () => {
  let spiderManHero: any;
  let peterParkerAlterEgo: any;
  let rhinoVillain: any;
  let mainScheme: any;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a')!;
    peterParkerAlterEgo = cardCatalog.getCard('01001b')!;
    rhinoVillain = cardCatalog.getCard('01094')!;
    mainScheme = cardCatalog.getCard('01097')!;
  });

  describe('Subgoal 1: Stalwart (Immunity to Stun & Confuse - RR v1.8 p. 28)', () => {
    it('prevents gaining STUNNED or CONFUSED status cards when target has Stalwart keyword', () => {
      const stalwartMinion: NormalizedCard = {
        ...cardCatalog.getCard('01096')!,
        code: 'stalwart_minion',
        name: 'Stalwart Guard',
        type: CardType.MINION,
        keywords: [Keyword.STALWART],
      };

      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [cardCatalog.getCard('01005')!],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const player = state.players[0];
      const minionInst = createCardInstance(stalwartMinion);
      minionInst.statusCards = [];
      player.engagedMinions = [minionInst];

      // Attempt to apply STUNNED
      const stunRes = executeEffect(
        state,
        {
          id: 'test_stun',
          timing: 'ACTION',
          steps: [
            {
              effect: 'ADD_STATUS',
              params: {
                status: StatusCard.STUNNED,
                target: 'MINION',
              },
            },
          ],
        },
        { playerId: 'p1', targetInstanceId: minionInst.instanceId },
      );

      expect(stunRes.success).toBe(true);
      expect(minionInst.statusCards).toEqual([]);

      // Attempt to apply CONFUSED
      const confuseRes = executeEffect(
        stunRes.state,
        {
          id: 'test_confuse',
          timing: 'ACTION',
          steps: [
            {
              effect: 'ADD_STATUS',
              params: {
                status: StatusCard.CONFUSED,
                target: 'MINION',
              },
            },
          ],
        },
        { playerId: 'p1', targetInstanceId: minionInst.instanceId },
      );

      expect(confuseRes.success).toBe(true);
      expect(minionInst.statusCards).toEqual([]);
    });
  });

  describe('Subgoal 2: Steady (Count-Based 2-Status Threshold - RR v1.8 p. 28)', () => {
    it('allows a Steady character with 1 STUNNED status card to attack without status consumption', () => {
      const steadyHero: NormalizedCard = {
        ...spiderManHero,
        keywords: [Keyword.STEADY],
      };

      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: steadyHero as any,
            alterEgo: peterParkerAlterEgo,
            deckCards: [cardCatalog.getCard('01005')!],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const player = state.players[0];
      player.currentForm = 'hero';
      player.activeFormCard = steadyHero as any;
      player.exhausted = false;
      player.statusCards = [StatusCard.STUNNED];
      const initialVillainHp = state.villain.health;

      // Player performs basic attack on villain
      const res = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'villain',
      });

      expect(res.result.success).toBe(true);
      // Hero attacks for 2 damage
      expect(res.state.villain.health).toBe(initialVillainHp - 2);
      // Status card remains on hero (Steady requires 2 to incapacitate)
      expect(res.state.players[0].statusCards).toEqual([StatusCard.STUNNED]);
    });

    it('cancels attack and discards BOTH status cards when Steady character has 2 STUNNED status cards', () => {
      const steadyHero: NormalizedCard = {
        ...spiderManHero,
        keywords: [Keyword.STEADY],
      };

      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: steadyHero as any,
            alterEgo: peterParkerAlterEgo,
            deckCards: [cardCatalog.getCard('01005')!],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const player = state.players[0];
      player.currentForm = 'hero';
      player.activeFormCard = steadyHero as any;
      player.exhausted = false;
      player.statusCards = [StatusCard.STUNNED, StatusCard.STUNNED];
      const initialVillainHp = state.villain.health;

      // Player performs basic attack on villain
      const res = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'villain',
      });

      expect(res.result.success).toBe(true);
      // Attack was cancelled -> 0 damage dealt
      expect(res.state.villain.health).toBe(initialVillainHp);
      // Both Stun cards discarded
      expect(res.state.players[0].statusCards).toEqual([]);
      expect(res.state.players[0].exhausted).toBe(true);
    });
  });

  describe('Subgoal 3: Minion Modifiers (Villainous & Quickstrike - RR v1.8 p. 18, 30)', () => {
    it('deals and resolves facedown boost card for Villainous minion activation', () => {
      const villainousMinion: any = {
        ...cardCatalog.getCard('01096')!,
        code: 'villainous_minion',
        name: 'Elite Hydra Brute',
        type: CardType.MINION,
        attack: 2,
        scheme: 1,
        keywords: [Keyword.VILLAINOUS],
      };

      const boostCard: NormalizedCard = {
        ...cardCatalog.getCard('01005')!,
        code: 'boost_card_2_icons',
        name: 'Hard Shock',
        type: CardType.TREACHERY,
        boostIcons: 2,
      };

      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [cardCatalog.getCard('01005')!],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: [
          boostCard,
          boostCard,
          boostCard,
          boostCard,
          boostCard,
          boostCard,
          boostCard,
          boostCard,
        ],
        skipMulligan: true,
      });

      const player = state.players[0];
      const minionInst = createCardInstance(villainousMinion);
      player.engagedMinions = [minionInst];
      player.currentForm = 'hero';
      player.activeFormCard = spiderManHero;
      player.health = 10;
      state.encounterDeck = [
        createCardInstance(boostCard),
        createCardInstance(boostCard),
        createCardInstance(boostCard),
        createCardInstance(boostCard),
        createCardInstance(boostCard),
        createCardInstance(boostCard),
      ];
      state.encounterDiscard = [];

      // Step 2 minion attack during villain phase
      const afterPhase = executeVillainPhase(state, { synchronousPolicy: 'TAKE_UNDEFENDED' });
      // Boost revealed log events generated for both villain and minion
      const boostLogs = afterPhase.log.filter((l) => l.key === 'villain.boost.revealed');
      expect(boostLogs.length).toBeGreaterThanOrEqual(2);
      expect(afterPhase.players[0].health).toBeLessThan(10);
    });

    it('triggers immediate attack when Quickstrike minion engages a hero upon entering play', () => {
      const quickstrikeMinion: any = {
        ...cardCatalog.getCard('01096')!,
        code: 'quickstrike_vulture',
        name: 'Vulture',
        type: CardType.MINION,
        attack: 2,
        keywords: [Keyword.QUICKSTRIKE],
      };

      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [cardCatalog.getCard('01005')!],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const player = state.players[0];
      player.currentForm = 'hero';
      player.activeFormCard = spiderManHero;
      player.health = 10;

      // Reveal / put quickstrike minion into play
      const minionInst = createCardInstance(quickstrikeMinion);
      const res = dispatchAction(state, {
        type: 'MINION_ENGAGES_PLAYER' as any,
        playerId: 'p1',
        minionInstance: minionInst,
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].health).toBe(8); // 10 - 2 ATK
    });
  });

  describe('Subgoal 4: Threat Modifiers (Incite & Hinder - RR v1.8 p. 14, 16)', () => {
    it('places X threat on main scheme when card with Incite X is revealed', () => {
      const inciteCard: NormalizedCard = {
        ...cardCatalog.getCard('01005')!,
        code: 'incite_treachery',
        name: 'Incite Riot',
        type: CardType.TREACHERY,
        enrichment: {
          incite: 2,
        } as any,
      };

      const state = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: spiderManHero,
            alterEgo: peterParkerAlterEgo,
            deckCards: [cardCatalog.getCard('01005')!],
          },
        ],
        villain: rhinoVillain,
        mainScheme,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      const initialThreat = state.mainScheme.threat;

      const res = dispatchAction(state, {
        type: 'REVEAL_ENCOUNTER_CARD' as any,
        encounterCard: createCardInstance(inciteCard),
        targetPlayerId: 'p1',
      });

      expect(res.result.success).toBe(true);
      expect(res.state.mainScheme.threat).toBe(initialThreat + 2);
    });
  });
});
