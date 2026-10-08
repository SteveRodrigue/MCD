import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, CardInstance, CardType, StatusCard } from '../../src/engine/models';
import { executeEffect } from '../../src/engine/effects';

describe('Result Facts and Milestones Engine (ADR-0080, Issues #289, #290)', () => {
  let state: GameState;

  beforeEach(() => {
    state = {
      roundNumber: 1,
      phase: 'PLAYER',
      firstPlayerIndex: 0,
      activePlayerIndex: 0,
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          health: 8,
          maxHealth: 10,
          currentForm: 'hero',
          deck: [
            {
              instanceId: 'c1',
              card: { code: 'c1', name: 'Card 1', type: CardType.EVENT },
            } as CardInstance,
            {
              instanceId: 'c2',
              card: { code: 'c2', name: 'Card 2', type: CardType.EVENT },
            } as CardInstance,
          ],
          hand: [],
          discard: [],
          tableau: [],
          engagedMinions: [],
          statusCards: [],
          dealtEncounterCards: [],
          availableForms: [
            { code: '01001a', name: 'Spider-Man', type: CardType.HERO, handSize: 5 } as any,
            { code: '01001b', name: 'Peter Parker', type: CardType.ALTER_EGO, handSize: 6 } as any,
          ],
        } as any,
      ],
      villain: {
        instanceId: 'v1',
        name: 'Rhino',
        health: 14,
        maxHealth: 14,
        statusCards: [],
        attachments: [],
        card: { code: '01094', name: 'Rhino', type: CardType.VILLAIN } as any,
      } as any,
      mainScheme: {
        instanceId: 'ms1',
        threat: 4,
        targetThreat: 7,
        card: { code: '01097', name: 'The Break-In!' } as any,
      } as any,
      sideSchemes: [],
      encounterDeck: [],
      encounterDiscard: [],
      victoryDisplay: [],
      log: [],
    } as any;
  });

  describe('DEAL_DAMAGE Facts', () => {
    it('produces targetDefeated and excessDamage facts when minion is defeated with overkill', () => {
      const minion: CardInstance = {
        instanceId: 'minion_1',
        card: {
          code: 'm1',
          name: 'Hydra Soldier',
          type: CardType.MINION,
          health: 2,
        } as any,
        damage: 0,
      } as any;
      state.players[0].engagedMinions.push(minion);

      const ability = {
        id: 'overkill_attack',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'strike',
            effect: 'DEAL_DAMAGE',
            effectParams: { amount: 5, target: 'minion_1' },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.facts).toBeDefined();
      expect(res.facts?.targetDefeated).toBe(true);
      expect(res.facts?.defeated).toBe(true);
      expect(res.facts?.excessDamage).toBe(3);
      expect(res.facts?.amountZero).toBe(false);
      expect(state.players[0].engagedMinions.length).toBe(0);
    });

    it('produces amountZero fact when tough status prevents damage', () => {
      state.villain.statusCards = [StatusCard.TOUGH];

      const ability = {
        id: 'attack_tough',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'strike',
            effect: 'DEAL_DAMAGE',
            effectParams: { amount: 4, target: 'VILLAIN' },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.facts?.targetDefeated).toBe(false);
      expect(res.facts?.excessDamage).toBe(0);
      expect(res.facts?.amountZero).toBe(true); // 0 damage dealt
      expect(state.villain.health).toBe(14);
      expect(state.villain.statusCards).toEqual([]); // tough removed
    });
  });

  describe('HEAL_DAMAGE Facts', () => {
    it('produces fullyHealed: false on partial heal', () => {
      const ability = {
        id: 'partial_heal',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'heal',
            effect: 'HEAL_DAMAGE',
            effectParams: { amount: 1, target: 'SELF' },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.state.players[0].health).toBe(9);
      expect(res.facts?.fullyHealed).toBe(false);
    });

    it('produces fullyHealed: true when HP reaches maxHealth', () => {
      const ability = {
        id: 'full_heal',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'heal',
            effect: 'HEAL_DAMAGE',
            effectParams: { amount: 3, target: 'SELF' },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.state.players[0].health).toBe(10);
      expect(res.facts?.fullyHealed).toBe(true);
    });
  });

  describe('REMOVE_THREAT Facts', () => {
    it('produces schemeEmpty: true and threatZero: true when scheme threat reaches 0', () => {
      const ability = {
        id: 'thwart_full',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'thwart',
            effect: 'REMOVE_THREAT',
            effectParams: { amount: 4, target: 'MAIN_SCHEME' },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.state.mainScheme.threat).toBe(0);
      expect(res.facts?.schemeEmpty).toBe(true);
      expect(res.facts?.threatZero).toBe(true);
    });

    it('produces schemeEmpty: false when scheme still has threat', () => {
      const ability = {
        id: 'thwart_partial',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'thwart',
            effect: 'REMOVE_THREAT',
            effectParams: { amount: 2, target: 'MAIN_SCHEME' },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.state.mainScheme.threat).toBe(2);
      expect(res.facts?.schemeEmpty).toBe(false);
      expect(res.facts?.threatZero).toBe(false);
    });
  });

  describe('ADD_STATUS and REMOVE_STATUS Facts', () => {
    it('produces statusApplied: true and alreadyHadStatus: false on new status', () => {
      const ability = {
        id: 'stun_villain',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'stun',
            effect: 'ADD_STATUS',
            effectParams: { status: 'STUNNED', target: 'VILLAIN' },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.facts?.statusApplied).toBe(true);
      expect(res.facts?.statusAdded).toBe(true);
      expect(res.facts?.alreadyHadStatus).toBe(false);
    });

    it('produces statusApplied: false and alreadyHadStatus: true when status already present', () => {
      state.villain.statusCards = [StatusCard.STUNNED];

      const ability = {
        id: 'stun_again',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'stun',
            effect: 'ADD_STATUS',
            effectParams: { status: 'STUNNED', target: 'VILLAIN' },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.facts?.statusApplied).toBe(false);
      expect(res.facts?.alreadyHadStatus).toBe(true);
    });

    it('produces statusRemoved: true when removing present status', () => {
      state.villain.statusCards = [StatusCard.CONFUSED];

      const ability = {
        id: 'remove_confused',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'unconfuse',
            effect: 'REMOVE_STATUS',
            effectParams: { status: 'CONFUSED', target: 'VILLAIN' },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.facts?.statusRemoved).toBe(true);
      expect(state.villain.statusCards).toEqual([]);
    });
  });

  describe('PREVIOUS_EXCESS_DAMAGE Dynamic Value Source', () => {
    it('carries excess damage from overkill step to subsequent damage step', () => {
      const minion: CardInstance = {
        instanceId: 'minion_1',
        card: {
          code: 'm1',
          name: 'Hydra Soldier',
          type: CardType.MINION,
          health: 2,
        } as any,
        damage: 0,
      } as any;
      state.players[0].engagedMinions.push(minion);

      // Step 1: Strike minion for 5 (producing 3 excess damage)
      // Step 2: Deal excess damage to Villain using PREVIOUS_EXCESS_DAMAGE
      const ability = {
        id: 'relentless_overkill_combo',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'minion_strike',
            effect: 'DEAL_DAMAGE',
            effectParams: { amount: 5, target: 'minion_1' },
          },
          {
            id: 'villain_overkill',
            effect: 'DEAL_DAMAGE',
            gate: 'IF_RESULT',
            gateParams: { result: 'EXCESS_DAMAGE_DEALT' },
            effectParams: {
              target: 'VILLAIN',
              amount: { from: 'PREVIOUS_EXCESS_DAMAGE' },
            },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(state.players[0].engagedMinions.length).toBe(0);
      expect(state.villain.health).toBe(11); // 14 - 3 excess damage
    });
  });

  describe('D18 Context Continuity across Skipped Steps', () => {
    it('preserves lastExecutedResult context across skipped intermediate steps', () => {
      const minion: CardInstance = {
        instanceId: 'minion_1',
        card: {
          code: 'm1',
          name: 'Hydra Soldier',
          type: CardType.MINION,
          health: 2,
        } as any,
        damage: 0,
      } as any;
      state.players[0].engagedMinions.push(minion);

      // Step 1: Deals 5 damage to minion (3 excess damage)
      // Step 2: Gated step that SKIPS because player is in HERO form, not ALTER_EGO
      // Step 3: Gated on Step 1 excess damage, using PREVIOUS_EXCESS_DAMAGE
      const ability = {
        id: 'continuity_test',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'step_1_attack',
            effect: 'DEAL_DAMAGE',
            effectParams: { amount: 5, target: 'minion_1' },
          },
          {
            id: 'step_2_skipped',
            effect: 'HEAL_DAMAGE',
            gate: 'IF_FORM',
            gateParams: { form: 'ALTER_EGO' },
            effectParams: { amount: 2, target: 'SELF' },
          },
          {
            id: 'step_3_overkill',
            effect: 'DEAL_DAMAGE',
            gate: 'IF_RESULT',
            gateParams: { result: 'EXCESS_DAMAGE_DEALT', step: 'step_1_attack' },
            effectParams: {
              target: 'VILLAIN',
              amount: { from: 'PREVIOUS_EXCESS_DAMAGE' },
            },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      // Step 2 was skipped: health is still 8
      expect(res.state.players[0].health).toBe(8);
      // Step 3 executed using context from lastExecutedResult (Step 1): 14 - 3 = 11
      expect(res.state.villain.health).toBe(11);
    });
  });

  describe('Cumulative Facts returned by executeSequence', () => {
    it('aggregates facts produced across all executed steps in the sequence', () => {
      // Step 1: Remove all 4 threat from main scheme (produces schemeEmpty: true)
      // Step 2: THEN deal 2 damage to villain (produces targetDefeated: false, amountZero: false)
      const ability = {
        id: 'multi_step_facts',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'step_thwart',
            effect: 'REMOVE_THREAT',
            effectParams: { amount: 4, target: 'MAIN_SCHEME' },
          },
          {
            id: 'step_damage',
            effect: 'DEAL_DAMAGE',
            gate: 'THEN',
            effectParams: { amount: 2, target: 'VILLAIN' },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.facts?.schemeEmpty).toBe(true);
      expect(res.facts?.threatZero).toBe(true);
      expect(res.facts?.targetDefeated).toBe(false);
      expect(res.facts?.amountZero).toBe(false);
    });
  });
});
