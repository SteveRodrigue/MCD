import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameState,
  CardInstance,
  CardType,
  StatusCard,
  MinionCard,
  SideSchemeCard,
  GamePhase,
} from '../../src/engine/models';
import { executeEffect } from '../../src/engine/effects';

describe('Explicit Condition Evaluation & IF_CONDITION_MET Sequential Gating (ADR-0049, Issue #91)', () => {
  let state: GameState;

  beforeEach(() => {
    state = {
      roundNumber: 1,
      phase: GamePhase.PLAYER_PHASE,
      firstPlayerIndex: 0,
      activePlayerIndex: 0,
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          health: 10,
          maxHealth: 10,
          deck: [
            {
              instanceId: 'c1',
              card: { code: 'c1', name: 'Card 1', type: CardType.EVENT },
            } as CardInstance,
            {
              instanceId: 'c2',
              card: { code: 'c2', name: 'Card 2', type: CardType.EVENT },
            } as CardInstance,
            {
              instanceId: 'c3',
              card: { code: 'c3', name: 'Card 3', type: CardType.EVENT },
            } as CardInstance,
          ],
          hand: [],
          discard: [],
          tableau: [],
          allies: [],
          attachments: [],
          engagedMinions: [],
          statusCards: [],
          dealtEncounterCards: [],
          currentForm: 'hero',
          hero: { code: '01001a', name: 'Spider-Man', type: CardType.HERO, handSize: 5 } as any,
          alterEgo: { code: '01001b', name: 'Peter Parker', type: CardType.ALTER_EGO, handSize: 6 } as any,
          availableForms: [
            { code: '01001a', name: 'Spider-Man', type: CardType.HERO, handSize: 5 } as any,
            { code: '01001b', name: 'Peter Parker', type: CardType.ALTER_EGO, handSize: 6 } as any,
          ],
          activeFormCard: {
            code: '01001a',
            name: 'Spider-Man',
            type: CardType.HERO,
            handSize: 5,
          } as any,
          exhausted: false,
          basicChangeFormUsedThisRound: false,
          formChangedThisRound: false,
          recoveryUsedThisRound: false,
          setAsideCards: [],
        },
      ],
      villain: {
        instanceId: 'v1',
        health: 14,
        maxHealth: 14,
        stage: 1,
        statusCards: [],
        card: { code: '01094', name: 'Rhino', type: CardType.VILLAIN, health: 14 },
        attachments: [],
      } as any,
      mainScheme: {
        instanceId: 'ms1',
        threat: 2,
        targetThreat: 7,
        card: { code: '01097b', name: 'The Break-In!', type: CardType.MAIN_SCHEME },
      } as any,
      sideSchemes: [],
      encounterDeck: [],
      encounterDiscard: [],
      log: [],
      victoryDisplay: [],
    } as any;
  });

  describe('SCHEME_EMPTY & Clear the Area Pattern (REMOVE_THREAT -> IF_CONDITION_MET -> DRAW_CARDS)', () => {
    const clearTheAreaAbility = {
      id: 'clear_the_area',
      timing: 'ACTION' as const,
      steps: [
        {
          id: 'remove_threat_step',
          effect: 'REMOVE_THREAT' as const,
          condition: 'SCHEME_EMPTY' as const,
          params: {
            target: 'MAIN_SCHEME',
            amount: 2,
          },
        },
        {
          id: 'draw_card_if_empty',
          effect: 'DRAW_CARDS' as const,
          gate: 'IF_CONDITION_MET' as const,
          params: {
            targetStepId: 'remove_threat_step',
            count: 1,
          },
        },
      ],
    };

    it('Executes DRAW_CARDS when REMOVE_THREAT removes the last threat on the scheme (remainingThreat === 0)', () => {
      state.mainScheme.threat = 2;
      expect(state.players[0].hand.length).toBe(0);

      const res = executeEffect(state, clearTheAreaAbility as any, { playerId: 'p1' });

      expect(res.success).toBe(true);
      expect(state.mainScheme.threat).toBe(0);
      expect(state.players[0].hand.length).toBe(1); // Drew 1 card because scheme became empty!
    });

    it('Skips DRAW_CARDS when REMOVE_THREAT leaves threat on the scheme (remainingThreat > 0)', () => {
      state.mainScheme.threat = 4;
      expect(state.players[0].hand.length).toBe(0);

      const res = executeEffect(state, clearTheAreaAbility as any, { playerId: 'p1' });

      expect(res.success).toBe(true);
      expect(state.mainScheme.threat).toBe(2);
      expect(state.players[0].hand.length).toBe(0); // Did not draw because scheme still had 2 threat!
    });

    it('Dispatches SCHEME_THREAT_REDUCED_TO_ZERO trigger when threat reaches 0', () => {
      const sideScheme: SideSchemeCard = {
        code: '01109',
        name: 'Bomb Scare',
        type: CardType.SIDE_SCHEME,
        startingThreat: 2,
      } as any;
      state.sideSchemes = [
        {
          instanceId: 'ss1',
          card: sideScheme,
          threat: 1,
        } as any,
      ];

      const removeSideThreat = {
        id: 'remove_side',
        timing: 'ACTION' as const,
        steps: [
          {
            effect: 'REMOVE_THREAT' as const,
            condition: 'SCHEME_EMPTY' as const,
            params: {
              target: 'SIDE_SCHEME',
              targetInstanceId: 'ss1',
              amount: 1,
            },
          },
        ],
      };

      const res = executeEffect(state, removeSideThreat as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(state.sideSchemes[0].threat).toBe(0);

      const zeroThreatLog = state.log.find(
        (l) => l.key === 'card.effect.removeThreat' && l.params?.remainingThreat === 0,
      );
      expect(zeroThreatLog).toBeDefined();
    });
  });

  describe('EXCESS_DAMAGE_DEALT Condition & Scalar Value Passthrough', () => {
    beforeEach(() => {
      const minionCard: MinionCard = {
        code: '01110',
        name: 'Hydra Soldier',
        type: CardType.MINION,
        health: 2,
        attack: 1,
        scheme: 1,
      } as any;
      state.players[0].engagedMinions = [
        {
          instanceId: 'm1',
          card: minionCard,
          tokens: { damage: 0 },
        } as any,
      ];
    });

    it('Sets value to excess damage (> 0) and conditionMet to true when damage exceeds minion HP', () => {
      const strikeAbility = {
        id: 'strike_overkill',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'deal_dmg',
            effect: 'DEAL_DAMAGE' as const,
            condition: 'EXCESS_DAMAGE_DEALT' as const,
            params: {
              amount: 5,
              target: 'MINION',
            },
          },
          {
            id: 'draw_on_excess',
            effect: 'DRAW_CARDS' as const,
            gate: 'IF_CONDITION_MET' as const,
            params: {
              targetStepId: 'deal_dmg',
              count: 1,
            },
          },
        ],
      };

      const res = executeEffect(state, strikeAbility as any, {
        playerId: 'p1',
        targetInstanceId: 'm1',
        targetType: 'minion',
      });

      expect(res.success).toBe(true);
      expect(state.players[0].engagedMinions.length).toBe(0);
      expect(state.players[0].hand.length).toBe(1);
    });

    it('Sets value to 0 and conditionMet to false when damage exactly equals minion HP', () => {
      const strikeAbility = {
        id: 'strike_exact',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'deal_dmg',
            effect: 'DEAL_DAMAGE' as const,
            condition: 'EXCESS_DAMAGE_DEALT' as const,
            params: {
              amount: 2,
              target: 'MINION',
            },
          },
          {
            id: 'draw_on_excess',
            effect: 'DRAW_CARDS' as const,
            gate: 'IF_CONDITION_MET' as const,
            params: {
              targetStepId: 'deal_dmg',
              count: 1,
            },
          },
        ],
      };

      const res = executeEffect(state, strikeAbility as any, {
        playerId: 'p1',
        targetInstanceId: 'm1',
        targetType: 'minion',
      });

      expect(res.success).toBe(true);
      expect(state.players[0].engagedMinions.length).toBe(0);
      expect(state.players[0].hand.length).toBe(0);
    });
  });

  describe('TARGET_DEFEATED & FULLY_HEALED Conditions', () => {
    it('Evaluates TARGET_DEFEATED as true when target is defeated', () => {
      const minionCard: MinionCard = {
        code: '01110',
        name: 'Hydra Soldier',
        type: CardType.MINION,
        health: 2,
      } as any;
      state.players[0].engagedMinions = [
        {
          instanceId: 'm1',
          card: minionCard,
          tokens: { damage: 0 },
        } as any,
      ];

      const ability = {
        id: 'defeat_and_remove_threat',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'attack',
            effect: 'DEAL_DAMAGE' as const,
            condition: 'TARGET_DEFEATED' as const,
            params: { amount: 2, target: 'MINION' },
          },
          {
            id: 'remove_threat_step',
            effect: 'REMOVE_THREAT' as const,
            gate: 'IF_CONDITION_MET' as const,
            params: { amount: 1, target: 'MAIN_SCHEME' },
          },
        ],
      };

      const res = executeEffect(state, ability as any, {
        playerId: 'p1',
        targetInstanceId: 'm1',
        targetType: 'minion',
      });

      expect(res.success).toBe(true);
      expect(state.players[0].engagedMinions.length).toBe(0);
      expect(state.mainScheme.threat).toBe(1);
    });

    it('Evaluates FULLY_HEALED as true when health reaches maxHealth and false otherwise', () => {
      state.players[0].health = 8;
      state.players[0].maxHealth = 10;

      const healAbility = {
        id: 'heal_check',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'heal_step',
            effect: 'HEAL_DAMAGE' as const,
            condition: 'FULLY_HEALED' as const,
            params: { amount: 2, target: 'SELF' },
          },
          {
            id: 'draw_if_full',
            effect: 'DRAW_CARDS' as const,
            gate: 'IF_CONDITION_MET' as const,
            params: { count: 1 },
          },
        ],
      };

      const res = executeEffect(state, healAbility as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(state.players[0].health).toBe(10);
      expect(state.players[0].hand.length).toBe(1);
    });
  });

  describe('STATUS_APPLIED & ALREADY_HAS_STATUS Conditions', () => {
    it('STATUS_APPLIED is true when status placed; false when already possessed', () => {
      state.villain.statusCards = [];

      const statusAbility = {
        id: 'stun_enemy',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'apply_status',
            effect: 'ADD_STATUS' as const,
            condition: 'STATUS_APPLIED' as const,
            params: { status: 'STUNNED', target: 'VILLAIN' },
          },
          {
            id: 'draw_on_applied',
            effect: 'DRAW_CARDS' as const,
            gate: 'IF_CONDITION_MET' as const,
            params: { count: 1 },
          },
        ],
      };

      const res1 = executeEffect(state, statusAbility as any, { playerId: 'p1' });
      expect(res1.success).toBe(true);
      expect(state.villain.statusCards).toEqual([StatusCard.STUNNED]);
      expect(state.players[0].hand.length).toBe(1);

      const res2 = executeEffect(state, statusAbility as any, { playerId: 'p1' });
      expect(res2.success).toBe(true);
      expect(state.players[0].hand.length).toBe(1);
    });
  });
});
