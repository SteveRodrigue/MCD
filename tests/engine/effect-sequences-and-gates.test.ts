import { describe, it, expect, beforeEach } from 'vitest';
import {
  GameState,
  CardInstance,
  CardType,
  StatusCard,
} from '../../src/engine/models';
import { executeEffect } from '../../src/engine/effects';

describe('Declarative Effect Sequences & Conditional Gates Engine (RR v1.8 p. 2, 24)', () => {
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
          name: 'She-Hulk',
          health: 10,
          maxHealth: 15,
          deck: [
            { instanceId: 'c1', card: { code: 'c1', name: 'Card 1', type: CardType.EVENT } } as CardInstance,
            { instanceId: 'c2', card: { code: 'c2', name: 'Card 2', type: CardType.EVENT } } as CardInstance,
            { instanceId: 'c3', card: { code: 'c3', name: 'Card 3', type: CardType.EVENT } } as CardInstance,
            { instanceId: 'c4', card: { code: 'c4', name: 'Card 4', type: CardType.EVENT } } as CardInstance,
            { instanceId: 'c5', card: { code: 'c5', name: 'Card 5', type: CardType.EVENT } } as CardInstance,
            { instanceId: 'c6', card: { code: 'c6', name: 'Card 6', type: CardType.EVENT } } as CardInstance,
          ],
          hand: [],
          discard: [],
          tableau: [],
          engagedMinions: [],
          statusCards: [],
          dealtEncounterCards: [],
          availableForms: [
            { code: '01019a', name: 'She-Hulk', type: CardType.HERO, handSize: 4 } as any,
            { code: '01019b', name: 'Jennifer Walters', type: CardType.ALTER_EGO, handSize: 6 } as any,
          ],
          activeFormCard: { code: '01019b', name: 'Jennifer Walters', type: CardType.ALTER_EGO, handSize: 6 } as any,
          currentForm: 'alter_ego',
          hero: { code: '01019a', name: 'She-Hulk', type: CardType.HERO, handSize: 4 } as any,
          alterEgo: { code: '01019b', name: 'Jennifer Walters', type: CardType.ALTER_EGO, handSize: 6 } as any,
        } as any,
      ],
      villain: {
        instanceId: 'v1',
        health: 10,
        maxHealth: 14,
        statusCards: [],
        attachments: [],
        card: { code: '01094', name: 'Rhino', type: CardType.VILLAIN } as any,
      } as any,
      mainScheme: {
        instanceId: 'ms1',
        threat: 2,
        targetThreat: 7,
        card: { code: '01097', name: 'The Break-In!' } as any,
      } as any,
      sideSchemes: [],
      encounterDeck: [
        { instanceId: 'enc1', card: { code: '01103', name: 'Shocker' } } as CardInstance,
        { instanceId: 'enc2', card: { code: '01104', name: 'Hard to Keep Down' } } as CardInstance,
        { instanceId: 'enc3', card: { code: '01105', name: "I'm Tough" } } as CardInstance,
      ],
      encounterDiscard: [],
      log: [],
    } as any;
  });

  it('Executes unconditional multi-step sequence (ALWAYS)', () => {
    const ability = {
      id: 'test_seq_always',
      timing: 'ACTION' as const,
      steps: [
        {
          id: 'step_1',
          effect: 'HEAL_DAMAGE',
          params: { amount: 3, target: 'SELF' },
        },
        {
          id: 'step_2',
          effect: 'DRAW_CARDS',
          params: { count: 2 },
        },
      ],
    };

    const res = executeEffect(state, ability as any, { playerId: 'p1' });
    expect(res.success).toBe(true);
    expect(res.state.players[0].health).toBe(13); // 10 + 3
    expect(res.state.players[0].hand.length).toBe(2);
  });

  describe('THEN Conditional Gate (RR v1.8 p. 24)', () => {
    it('Executes THEN step when preceding step successfully mutates state', () => {
      // Step 1: Remove threat from main scheme (threat is 2)
      // Step 2 (THEN): Draw 1 card
      const ability = {
        id: 'then_success_ability',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'remove_threat_step',
            effect: 'REMOVE_THREAT',
            params: { amount: 2, target: 'MAIN_SCHEME' },
          },
          {
            id: 'draw_card_step',
            effect: 'DRAW_CARDS',
            gate: 'THEN' as const,
            params: { count: 1 },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.state.mainScheme.threat).toBe(0);
      expect(res.state.players[0].hand.length).toBe(1); // THEN executed!
    });

    it('Skips THEN step when preceding step causes 0 state mutation', () => {
      // Threat is already 0
      state.mainScheme.threat = 0;

      const ability = {
        id: 'then_skipped_ability',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'remove_threat_step',
            effect: 'REMOVE_THREAT',
            params: { amount: 2, target: 'MAIN_SCHEME' },
          },
          {
            id: 'draw_card_step',
            effect: 'DRAW_CARDS',
            gate: 'THEN' as const,
            params: { count: 1 },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.state.mainScheme.threat).toBe(0);
      expect(res.state.players[0].hand.length).toBe(0); // THEN was skipped because 0 threat was removed!
    });
  });

  describe('IF_AMOUNT_ZERO Gate (*Hard to Keep Down* 01104)', () => {
    it('Heals villain when damaged and does NOT trigger surge', () => {
      state.villain.health = 8;
      state.villain.maxHealth = 14;
      const initialDealtCount = state.players[0].dealtEncounterCards.length;

      const ability = {
        id: 'hard_to_keep_down',
        timing: 'WHEN_REVEALED' as const,
        steps: [
          {
            id: 'heal_step',
            effect: 'HEAL_DAMAGE',
            params: { amount: 4, target: 'VILLAIN' },
          },
          {
            id: 'surge_step',
            effect: 'TRIGGER_SURGE',
            gate: 'IF_AMOUNT_ZERO' as const,
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.state.villain.health).toBe(12); // Healed 4
      expect(res.state.players[0].dealtEncounterCards.length).toBe(initialDealtCount); // No surge!
    });

    it('Triggers surge when villain is already at full health (0 healed)', () => {
      state.villain.health = 14;
      state.villain.maxHealth = 14;
      const initialDealtCount = state.players[0].dealtEncounterCards.length;

      const ability = {
        id: 'hard_to_keep_down',
        timing: 'WHEN_REVEALED' as const,
        steps: [
          {
            id: 'heal_step',
            effect: 'HEAL_DAMAGE',
            params: { amount: 4, target: 'VILLAIN' },
          },
          {
            id: 'surge_step',
            effect: 'TRIGGER_SURGE',
            gate: 'IF_AMOUNT_ZERO' as const,
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.state.villain.health).toBe(14); // 0 healed
      expect(res.state.players[0].dealtEncounterCards.length).toBe(initialDealtCount + 1); // Surge triggered!
    });
  });

  describe('IF_ALREADY_HAS_STATUS Gate (*"I\'m Tough"* 01105)', () => {
    it('Adds Tough status to villain when not tough (no surge)', () => {
      state.villain.statusCards = [];
      const initialDealtCount = state.players[0].dealtEncounterCards.length;

      const ability = {
        id: 'im_tough',
        timing: 'WHEN_REVEALED' as const,
        steps: [
          {
            id: 'status_step',
            effect: 'ADD_STATUS',
            params: { status: 'TOUGH', target: 'VILLAIN' },
          },
          {
            id: 'surge_step',
            effect: 'TRIGGER_SURGE',
            gate: 'IF_ALREADY_HAS_STATUS' as const,
            params: { status: 'TOUGH', target: 'VILLAIN' },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.state.villain.statusCards).toContain(StatusCard.TOUGH);
      expect(res.state.players[0].dealtEncounterCards.length).toBe(initialDealtCount); // No surge!
    });

    it('Triggers surge when villain already has Tough status card', () => {
      state.villain.statusCards = [StatusCard.TOUGH];
      const initialDealtCount = state.players[0].dealtEncounterCards.length;

      const ability = {
        id: 'im_tough',
        timing: 'WHEN_REVEALED' as const,
        steps: [
          {
            id: 'status_step',
            effect: 'ADD_STATUS',
            params: { status: 'TOUGH', target: 'VILLAIN' },
          },
          {
            id: 'surge_step',
            effect: 'TRIGGER_SURGE',
            gate: 'IF_ALREADY_HAS_STATUS' as const,
            params: { status: 'TOUGH', target: 'VILLAIN' },
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.state.players[0].dealtEncounterCards.length).toBe(initialDealtCount + 1); // Surge triggered!
    });
  });

  describe('Decomposed Core Set Card Abilities', () => {
    it('Executes Split Personality (01025) as FLIP_FORM + DRAW_UP_TO_HAND_SIZE sequence', () => {
      // Starts in Alter-Ego with hand of 1
      state.players[0].currentForm = 'alter_ego';
      state.players[0].hand = [state.players[0].deck.shift()!];
      expect(state.players[0].hand.length).toBe(1);

      const ability = {
        id: 'split_personality',
        timing: 'ACTION' as const,
        steps: [
          {
            id: 'flip_step',
            effect: 'FLIP_FORM',
          },
          {
            id: 'draw_step',
            effect: 'DRAW_UP_TO_HAND_SIZE',
            gate: 'THEN' as const,
          },
        ],
      };

      const res = executeEffect(state, ability as any, { playerId: 'p1' });
      expect(res.success).toBe(true);
      expect(res.state.players[0].currentForm).toBe('hero');
      expect(res.state.players[0].activeFormCard.code).toBe('01019a');
      // Hero printed hand size is 4, started with 1, drew 3 -> total 4 in hand
      expect(res.state.players[0].hand.length).toBe(4);
    });
  });
});
