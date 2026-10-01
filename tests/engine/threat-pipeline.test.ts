import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, CardType, StatusCard, HeroCard, AlterEgoCard } from '@engine/models';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '@engine/state/game-setup';
import { applyThreatPlacement, applyThwart } from '@engine/pipeline/threat-pipeline';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { executeEffect } from '@engine/effects';
import { step1_placeThreat } from '@engine/pipeline/villain-phase';

describe('Threat & Thwart Pipeline (RR v1.8)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'player1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [cardCatalog.getCard('01005')!],
        },
      ],
    });
    // Ensure initial state has active player and standard main scheme
    state.activePlayerIndex = 0;
    const player = state.players[0];
    player.currentForm = 'hero';
    player.exhausted = false;
    state.accelerationTokens = 0;
    state.mainScheme = {
      instanceId: 'main_scheme_1',
      stage: '1A',
      threat: 4,
      targetThreat: 7,
      card: {
        id: '01097',
        code: '01097',
        name: 'The Break-In!',
        type: CardType.MAIN_SCHEME,
        baseThreat: 0,
        escalationThreat: 1,
        targetThreat: 7,
      } as any,
    };
    state.sideSchemes = [];
  });

  describe('Basic Thwart & Confused Status Replacement (RR v1.8 p. 28)', () => {
    it('hero basic thwart removes threat equal to THW stat and exhausts hero', () => {
      const player = state.players[0];
      const initialThreat = state.mainScheme.threat;
      const thwStat = (player.hero as any)?.thw ?? (player.hero as any)?.thwart ?? 1;

      const { state: nextState, result } = dispatchAction(state, {
        type: 'BASIC_THWART',
        playerId: player.id,
        targetType: 'main_scheme',
      });
      state = nextState;

      expect(result.success).toBe(true);
      expect(state.players[0].exhausted).toBe(true);
      expect(state.mainScheme.threat).toBe(initialThreat - thwStat);
    });

    it('confused status on hero replaces basic thwart, clearing confused without removing threat', () => {
      const player = state.players[0];
      player.statusCards.push(StatusCard.CONFUSED);
      const initialThreat = state.mainScheme.threat;

      const { state: nextState, result } = dispatchAction(state, {
        type: 'BASIC_THWART',
        playerId: player.id,
        targetType: 'main_scheme',
      });
      state = nextState;

      expect(result.success).toBe(true);
      expect(state.players[0].exhausted).toBe(true);
      expect(state.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
      expect(state.mainScheme.threat).toBe(initialThreat);
    });

    it('ally basic thwart removes threat and applies consequential damage', () => {
      const player = state.players[0];
      const ally = {
        instanceId: 'ally_daredevil',
        card: {
          id: '01058',
          code: '01058',
          name: 'Daredevil',
          type: CardType.ALLY,
          thw: 2,
          health: 3,
          consequentialDamage: { thw: 1, atk: 1 },
        },
        exhausted: false,
        tokens: { damage: 0, threat: 0, counters: 0 },
        statusCards: [],
      } as any;
      player.allies.push(ally);

      const initialThreat = state.mainScheme.threat;
      const { state: nextState, result } = dispatchAction(state, {
        type: 'ALLY_THWART',
        playerId: player.id,
        allyInstanceId: ally.instanceId,
        targetType: 'main_scheme',
      });
      state = nextState;

      expect(result.success).toBe(true);
      const updatedAlly = state.players[0].allies.find((a) => a.instanceId === ally.instanceId)!;
      expect(updatedAlly.exhausted).toBe(true);
      expect(updatedAlly.tokens?.damage).toBe(1);
      expect(state.mainScheme.threat).toBe(initialThreat - 2);
    });

    it('confused ally clears confusion, does not remove threat, but still takes consequential damage and exhausts', () => {
      const player = state.players[0];
      const ally = {
        instanceId: 'ally_daredevil',
        card: {
          id: '01058',
          code: '01058',
          name: 'Daredevil',
          type: CardType.ALLY,
          thw: 2,
          health: 3,
          consequentialDamage: { thw: 1, atk: 1 },
        },
        exhausted: false,
        tokens: { damage: 0, threat: 0, counters: 0 },
        statusCards: [StatusCard.CONFUSED],
      } as any;
      player.allies.push(ally);

      const initialThreat = state.mainScheme.threat;
      const { state: nextState, result } = dispatchAction(state, {
        type: 'ALLY_THWART',
        playerId: player.id,
        allyInstanceId: ally.instanceId,
        targetType: 'main_scheme',
      });
      state = nextState;

      expect(result.success).toBe(true);
      const updatedAlly = state.players[0].allies.find((a) => a.instanceId === ally.instanceId)!;
      expect(updatedAlly.exhausted).toBe(true);
      expect(updatedAlly.tokens?.damage).toBe(1);
      expect(updatedAlly.statusCards).not.toContain(StatusCard.CONFUSED);
      expect(state.mainScheme.threat).toBe(initialThreat);
    });
  });

  describe('Crisis Icons & Scheme Defeat (RR v1.8 p. 11, 28)', () => {
    it('crisis icon on a side scheme blocks thwarting the main scheme', () => {
      const player = state.players[0];
      state.sideSchemes.push({
        instanceId: 'crisis_scheme',
        threat: 3,
        card: {
          id: '01109',
          code: '01109',
          name: 'Bomb Scare',
          type: CardType.SIDE_SCHEME,
          hasCrisis: true,
        } as any,
      });

      const initialThreat = state.mainScheme.threat;
      const { result } = applyThwart(state, {
        thwarterType: 'HERO',
        thwarterEntity: player,
        playerId: player.id,
        targetType: 'main_scheme',
        thwartValue: 2,
      });

      expect(result.thwartAttempted).toBe(false);
      expect(result.threatRemoved).toBe(0);
      expect(state.mainScheme.threat).toBe(initialThreat);
    });

    it('side scheme is defeated and removed when threat reaches 0', () => {
      const player = state.players[0];
      state.sideSchemes.push({
        instanceId: 'side_scheme_1',
        threat: 2,
        card: {
          id: '01109',
          code: '01109',
          name: 'Bomb Scare',
          type: CardType.SIDE_SCHEME,
        } as any,
      });

      const { result } = applyThwart(state, {
        thwarterType: 'HERO',
        thwarterEntity: player,
        playerId: player.id,
        targetType: 'side_scheme',
        targetInstanceId: 'side_scheme_1',
        thwartValue: 2,
      });

      expect(result.threatRemoved).toBe(2);
      expect(result.schemeDefeated).toBe(true);
      expect(state.sideSchemes.find((s) => s.instanceId === 'side_scheme_1')).toBeUndefined();
    });
  });

  describe('Villain Phase Threat & Main Scheme Progression', () => {
    it('step1_placeThreat delegates to applyThreatPlacement', () => {
      state.mainScheme.threat = 2;
      step1_placeThreat(state);
      // 1 player = +1 threat
      expect(state.mainScheme.threat).toBe(3);
    });

    it('threat placement triggers main scheme stage completion when targetThreat is reached', () => {
      state.mainScheme.threat = 6;
      state.mainScheme.targetThreat = 7;

      const { result } = applyThreatPlacement(state, {
        targetType: 'main_scheme',
        amount: 2,
        sourceType: 'VILLAIN_PHASE_STEP_1',
      });

      expect(result.threatPlaced).toBe(2);
      expect(result.stageCompleted).toBe(true);
    });
  });

  describe('Supplemental Cards Scenarios', () => {
    it('For Justice! (01060): removes 3 threat from scheme (or 4 if mental paid)', () => {
      const player = state.players[0];
      state.mainScheme.threat = 5;

      const ability = {
        effect: 'REMOVE_THREAT',
        effectParams: {
          amount: 3,
          bonusWithMental: 1,
        },
      };

      // Case 1: Without mental resource
      executeEffect(state, ability as any, {
        playerId: player.id,
        resourcesSpent: ['physical'],
      });
      expect(state.mainScheme.threat).toBe(2);

      // Case 2: With mental resource
      state.mainScheme.threat = 5;
      executeEffect(state, ability as any, {
        playerId: player.id,
        resourcesSpent: ['mental'],
      });
      expect(state.mainScheme.threat).toBe(1);
    });

    it('Emergency (01085): prevents 1 threat when threat would be placed on a scheme', () => {
      const player = state.players[0];
      state.mainScheme.threat = 2;

      // Register Emergency-like intercept trigger
      player.tableau.push({
        instanceId: 'emergency_card',
        card: {
          id: '01085',
          code: '01085',
          name: 'Emergency',
          type: CardType.EVENT,
          enrichment: {
            abilities: [
              {
                id: 'emergency_prevent',
                timing: 'FORCED_INTERRUPT',
                trigger: 'THREAT_WOULD_BE_PLACED',
                steps: [
                  {
                    effect: 'PREVENT_THREAT',
                    effectParams: { amount: 1 },
                  },
                ],
              },
            ],
          },
        },
      } as any);

      const { result } = applyThreatPlacement(state, {
        targetType: 'main_scheme',
        amount: 3,
        sourceType: 'CARD_EFFECT',
        sourcePlayerId: player.id,
      });

      expect(result.preventedAmount).toBe(1);
      expect(result.threatPlaced).toBe(2);
      expect(state.mainScheme.threat).toBe(4);
    });

    it('Spider-Tracer (01007): attached to minion; when defeated, removes 3 threat', () => {
      const player = state.players[0];
      state.mainScheme.threat = 5;

      // Minion with Spider-Tracer attached
      const minion = {
        instanceId: 'minion_shocker',
        card: {
          id: '01110',
          code: '01110',
          name: 'Shocker',
          type: CardType.MINION,
          health: 3,
        },
        tokens: { damage: 0, threat: 0, counters: 0 },
        attachments: [
          {
            instanceId: 'tracer_inst',
            ownerId: player.id,
            card: {
              id: '01007',
              code: '01007',
              name: 'Spider-Tracer',
              type: CardType.UPGRADE,
              enrichment: {
                abilities: [
                  {
                    id: 'spider_tracer_response',
                    timing: 'RESPONSE',
                    trigger: 'CHARACTER_DEFEATED',
                    steps: [
                      {
                        effect: 'REMOVE_THREAT',
                        effectParams: { amount: 3, target: 'MAIN_SCHEME' },
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      } as any;
      player.engagedMinions.push(minion);

      // Defeat minion via DEAL_DAMAGE
      executeEffect(
        state,
        {
          effect: 'DEAL_DAMAGE',
          effectParams: { amount: 3, targetInstanceId: minion.instanceId },
        } as any,
        { playerId: player.id },
      );

      // Spider-Tracer triggers on defeat to remove 3 threat
      expect(state.mainScheme.threat).toBe(2);
    });

    it('Advance (01186): Treachery causes villain to scheme and applies threat via threat pipeline', () => {
      const player = state.players[0];
      state.mainScheme.threat = 2;
      state.villain = {
        instanceId: 'rhino_villain',
        health: 14,
        maxHealth: 14,
        exhausted: false,
        attachments: [],
        statusCards: [],
        card: {
          id: '01094',
          code: '01094',
          name: 'Rhino',
          type: CardType.VILLAIN,
          sch: 1,
        } as any,
      };
      // Boost card on encounter deck
      state.encounterDeck = [
        {
          instanceId: 'boost_card',
          card: {
            id: 'boost_1',
            code: 'boost_1',
            name: 'Boost Card',
            type: CardType.TREACHERY,
            boost: 1,
          } as any,
        },
      ];

      // Execute VILLAIN_SCHEMES effect (Advance)
      executeEffect(
        state,
        {
          effect: 'VILLAIN_SCHEMES',
        } as any,
        { playerId: player.id },
      );

      // Rhino SCH (1) + Boost (1) = 2 threat added to Main Scheme
      expect(state.mainScheme.threat).toBe(4);
    });
  });
});
