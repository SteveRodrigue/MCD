import { describe, it, expect } from 'vitest';
import { evaluateDynamicAmount } from '../../src/engine/effects/dynamic-formula-evaluator';
import type { GameState, PlayerState, CardInstance, SideSchemeCard } from '../../src/engine/models';

describe('Dynamic Formula Evaluator (evaluateDynamicAmount) — RR v1.8 & ADR-0052', () => {
  const createMockPlayer = (overrides?: Partial<PlayerState>): PlayerState => ({
    id: 'player-1',
    name: 'Hero Player',
    hero: {
      code: '01021',
      name: 'She-Hulk',
      type: 'hero',
      health: 15,
      hitPoints: 15,
      attack: 3,
      thwart: 1,
      defense: 2,
    } as any,
    alterEgo: {
      code: '01021b',
      name: 'Jennifer Walters',
      type: 'alter_ego',
      health: 15,
      hitPoints: 15,
      recover: 5,
    } as any,
    currentForm: 'hero',
    health: 10,
    maxHealth: 15,
    deck: [],
    hand: [],
    discard: [],
    tableau: [],
    allies: [],
    engagedMinions: [],
    activeFormCard: {
      code: '01021',
      name: 'She-Hulk',
      type: 'hero',
    } as any,
    availableForms: [],
    exhausted: false,
    statusCards: [],
    basicChangeFormUsedThisRound: false,
    formChangedThisRound: false,
    recoveryUsedThisRound: false,
    dealtEncounterCards: [],
    setAsideCards: [],
    ...overrides,
  });

  const createMockState = (playerOverrides?: Partial<PlayerState>): GameState => {
    const player = createMockPlayer(playerOverrides);
    return {
      scenario: { id: 'rhino', name: 'Rhino' } as any,
      villain: {
        id: 'rhino-1',
        card: { code: '01094', name: 'Rhino', hitPoints: 14 } as any,
        health: 14,
        maxHealth: 14,
        tough: false,
        stunned: false,
        confused: false,
        attachments: [],
        damage: 4,
      } as any,
      mainScheme: {
        id: 'main-scheme',
        card: { code: '01097', name: 'The Break-In!' } as any,
        threat: 5,
        targetThreat: 7,
      } as any,
      sideSchemes: [],
      players: [player],
      activePlayerId: player.id,
      firstPlayerId: player.id,
      phase: 'player',
      turn: 1,
      round: 1,
      encounterDeck: [],
      encounterDiscard: [],
    } as any;
  };

  describe('Literal Values and Fallbacks', () => {
    it('returns a literal number directly', () => {
      expect(evaluateDynamicAmount(7)).toBe(7);
      expect(evaluateDynamicAmount(0)).toBe(0);
    });

    it('returns the fallback number when amountParam is undefined', () => {
      expect(evaluateDynamicAmount(undefined, {}, { fallback: 3 })).toBe(3);
      expect(evaluateDynamicAmount(undefined)).toBe(0);
    });
  });

  describe('Event Context & Interception (ADR-0049)', () => {
    it('resolves INTERCEPTED_VALUE from interceptedValue, threatAmount, or damageAmount', () => {
      expect(evaluateDynamicAmount({ from: 'INTERCEPTED_VALUE' }, { interceptedValue: 4 })).toBe(4);

      expect(evaluateDynamicAmount({ from: 'INTERCEPTED_VALUE' }, { threatAmount: 3 })).toBe(3);

      expect(evaluateDynamicAmount({ from: 'INTERCEPTED_VALUE' }, { damageAmount: 2 })).toBe(2);
    });

    it('resolves PREVIOUS_RESULT and DISCARDED_COUNT from execution context', () => {
      expect(
        evaluateDynamicAmount({ from: 'PREVIOUS_RESULT' }, { previousResult: { value: 6 } as any }),
      ).toBe(6);

      expect(
        evaluateDynamicAmount({ from: 'DISCARDED_COUNT' }, { previousResult: { value: 5 } as any }),
      ).toBe(5);
    });
  });

  describe('STAT_VALUE Archetype', () => {
    it('resolves SUFFERED_DAMAGE based on max health minus current health (Gamma Slam 01021)', () => {
      const state = createMockState({ health: 8 });
      const player = state.players[0];

      // 15 max HP - 8 HP = 7 suffered damage
      const amount = evaluateDynamicAmount(
        { from: 'STAT_VALUE', stat: 'SUFFERED_DAMAGE' },
        {},
        { state, player },
      );
      expect(amount).toBe(7);
    });

    it('clamps SUFFERED_DAMAGE ceiling with clamp.max (Gamma Slam 01021 up to 15)', () => {
      const state = createMockState({ health: 1 });
      // Suppose effective max health is 20, 20 - 1 = 19, capped to 15
      const player = state.players[0];
      (player.hero as any).health = 20;
      (player.hero as any).hitPoints = 20;

      const amount = evaluateDynamicAmount(
        {
          from: 'STAT_VALUE',
          stat: 'SUFFERED_DAMAGE',
          clamp: { max: 15 },
        },
        {},
        { state, player },
      );
      expect(amount).toBe(15);
    });

    it('resolves ATTACK from hero effective stats (Counter-Punch 01077)', () => {
      const state = createMockState();
      const player = state.players[0];

      const amount = evaluateDynamicAmount(
        { from: 'STAT_VALUE', stat: 'ATTACK' },
        {},
        { state, player },
      );
      expect(amount).toBe(3);
    });

    it('resolves THWART, DEFENSE, and RECOVERY from identity stats', () => {
      const state = createMockState();
      const player = state.players[0];

      expect(
        evaluateDynamicAmount({ from: 'STAT_VALUE', stat: 'THWART' }, {}, { state, player }),
      ).toBe(1);

      expect(
        evaluateDynamicAmount({ from: 'STAT_VALUE', stat: 'DEFENSE' }, {}, { state, player }),
      ).toBe(2);

      player.currentForm = 'alter_ego';
      expect(
        evaluateDynamicAmount({ from: 'STAT_VALUE', stat: 'RECOVERY' }, {}, { state, player }),
      ).toBe(5);
    });

    it('resolves THREAT on main scheme or target side scheme', () => {
      const state = createMockState();
      const amount = evaluateDynamicAmount({ from: 'STAT_VALUE', stat: 'THREAT' }, {}, { state });
      expect(amount).toBe(5);
    });

    it('resolves DAMAGE on villain or target enemy', () => {
      const state = createMockState();
      const amount = evaluateDynamicAmount({ from: 'STAT_VALUE', stat: 'DAMAGE' }, {}, { state });
      expect(amount).toBe(4);
    });
  });

  describe('COUNTERS Archetype (Energy Channel 01019)', () => {
    it('reads counters from source card instance and applies multiplier and clamp', () => {
      const sourceCardInstance: CardInstance = {
        instanceId: 'energy-channel-1',
        card: { code: '01019', name: 'Energy Channel' } as any,
        counters: { energy: 3 },
      };

      // 3 energy counters * 2 = 6, clamped to max 10
      const amount = evaluateDynamicAmount(
        {
          from: 'COUNTERS',
          counterType: 'energy',
          multiplier: 2,
          clamp: { max: 10 },
        },
        {},
        { sourceCardInstance },
      );
      expect(amount).toBe(6);
    });

    it('clamps counters damage when exceeding clamp.max', () => {
      const sourceCardInstance: CardInstance = {
        instanceId: 'energy-channel-1',
        card: { code: '01019', name: 'Energy Channel' } as any,
        counters: { energy: 7 },
      };

      // 7 energy counters * 2 = 14, clamped to 10
      const amount = evaluateDynamicAmount(
        {
          from: 'COUNTERS',
          counterType: 'energy',
          multiplier: 2,
          clamp: { max: 10 },
        },
        {},
        { sourceCardInstance },
      );
      expect(amount).toBe(10);
    });
  });

  describe('ENTITY_COUNT Archetype (UniversalCardFilter)', () => {
    it('counts side schemes in play (Jessica Jones 01059)', () => {
      const state = createMockState();
      state.sideSchemes = [
        {
          instanceId: 'bomb-scare',
          card: { code: '01107', type: 'side_scheme' } as SideSchemeCard,
          threat: 2,
        },
        {
          instanceId: 'crowd-control',
          card: { code: '01108', type: 'side_scheme' } as SideSchemeCard,
          threat: 3,
        },
      ];

      const amount = evaluateDynamicAmount(
        {
          from: 'ENTITY_COUNT',
          filter: { types: ['side_scheme'] },
        },
        {},
        { state },
      );
      expect(amount).toBe(2);
    });

    it('counts matching cards in player tableau (Iron Man 01029a Tech Upgrades)', () => {
      const state = createMockState();
      const player = state.players[0];
      player.tableau = [
        {
          instanceId: 'armor',
          card: {
            code: '01033',
            name: 'Mark V Armor',
            type: 'upgrade',
            traits: ['Tech', 'Item'],
          } as any,
        },
        {
          instanceId: 'helmet',
          card: {
            code: '01034',
            name: 'Mark V Helmet',
            type: 'upgrade',
            traits: ['Tech', 'Armor'],
          } as any,
        },
        {
          instanceId: 'mansion',
          card: {
            code: '01017',
            name: 'Avenger Mansion',
            type: 'support',
            traits: ['Location'],
          } as any,
        },
      ];

      const amount = evaluateDynamicAmount(
        {
          from: 'ENTITY_COUNT',
          filter: { traits: ['Tech'], types: ['upgrade'] },
        },
        {},
        { state, player },
      );
      expect(amount).toBe(2);
    });
  });

  describe('Mathematical Invariants (RR v1.8 p. 11)', () => {
    it('rounds down fractions (Math.floor)', () => {
      // Base value = 5, multiplier = 0.5 -> 2.5 -> rounded down to 2
      expect(
        evaluateDynamicAmount(
          {
            from: 'PREVIOUS_RESULT',
            multiplier: 0.5,
          },
          { previousResult: { value: 5 } as any },
        ),
      ).toBe(2);
    });

    it('never produces negative values (RR v1.8 p. 11: cannot be reduced below 0)', () => {
      // Base value = 3, offset = -10 -> -7 -> clamped to 0
      expect(
        evaluateDynamicAmount(
          {
            from: 'PREVIOUS_RESULT',
            offset: -10,
          },
          { previousResult: { value: 3 } as any },
        ),
      ).toBe(0);
    });

    it('respects clamp.min and clamp.max bounds', () => {
      // Base = 10, offset = -9 -> 1, clamp.min = 2 -> 2
      expect(
        evaluateDynamicAmount(
          {
            from: 'PREVIOUS_RESULT',
            offset: -9,
            clamp: { min: 2, max: 8 },
          },
          { previousResult: { value: 10 } as any },
        ),
      ).toBe(2);

      // Base = 10, offset = 5 -> 15, clamp.max = 8 -> 8
      expect(
        evaluateDynamicAmount(
          {
            from: 'PREVIOUS_RESULT',
            offset: 5,
            clamp: { min: 2, max: 8 },
          },
          { previousResult: { value: 10 } as any },
        ),
      ).toBe(8);
    });
  });
});
