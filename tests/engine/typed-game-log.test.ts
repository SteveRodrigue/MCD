import { describe, it, expect } from 'vitest';
import { appendLog } from '../../src/engine/state/game-log';
import { GamePhase, GameState, TypedGameLogEntry } from '../../src/engine/models';

function createMockState(): GameState {
  return {
    gameId: 'test-game',
    roundNumber: 1,
    firstPlayerIndex: 0,
    activePlayerIndex: 0,
    players: [],
    villains: [{} as any],
    mainSchemes: [{} as any],
    sideSchemes: [],
    encounterDeck: [],
    encounterDiscard: [],
    log: [],
  } as unknown as GameState;
}

describe('Typed Game Log (Plan R7: Typed log catalog)', () => {
  it('appends a correctly typed log entry to GameState', () => {
    const state = createMockState();
    const entry = appendLog(state, {
      category: 'combat',
      key: 'BASIC_ATTACK',
      params: {
        actor: 'Spider-Man',
        target: 'Rhino',
        amount: 2,
      },
      onomatopoeia: 'POW!',
    });

    expect(state.log).toHaveLength(1);
    expect(state.log[0].key).toBe('BASIC_ATTACK');
    expect(state.log[0].params).toEqual({
      actor: 'Spider-Man',
      target: 'Rhino',
      amount: 2,
    });
    expect(entry.onomatopoeia).toBe('POW!');
  });

  it('correctly narrows TypedGameLogEntry return type', () => {
    const state = createMockState();
    const entry: TypedGameLogEntry<'player.deck.exhausted'> = appendLog(state, {
      category: 'phase',
      key: 'player.deck.exhausted',
      params: { actor: 'Spider-Man' },
    });

    expect(entry.key).toBe('player.deck.exhausted');
    expect(entry.params.actor).toBe('Spider-Man');
  });

  it('supports open template literal index signatures for ability triggers', () => {
    const state = createMockState();
    const entry = appendLog(state, {
      category: 'ability',
      key: 'ability.spider_tracer.triggered',
      params: {
        actor: 'Spider-Man',
        card: 'Spider-Tracer',
        target: 'Rhino',
      },
    });

    expect(entry.key).toBe('ability.spider_tracer.triggered');
    expect(entry.params.card).toBe('Spider-Tracer');
  });

  it('verifies compile-time type enforcement via ts-expect-error', () => {
    const state = createMockState();

    // 1. Invalid log key
    appendLog(state, {
      // @ts-expect-error - Invalid key not in LogEvents
      key: 'invalid.nonexistent.key',
      params: {},
    });

    // 2. Missing required property ('amount' is required for BASIC_ATTACK)
    appendLog(state, {
      key: 'BASIC_ATTACK',
      // @ts-expect-error - Missing required 'amount'
      params: {
        actor: 'Spider-Man',
        target: 'Rhino',
      },
    });

    // 3. Extraneous property not declared in LogEvents
    appendLog(state, {
      key: 'first_player.passed',
      params: {
        actor: 'Spider-Man',
        // @ts-expect-error - 'extraField' does not exist in '{ actor: string }'
        extraField: 123,
      },
    });

    // 4. Incorrect property type (amount must be number, not string)
    appendLog(state, {
      key: 'BASIC_ATTACK',
      params: {
        actor: 'Spider-Man',
        target: 'Rhino',
        // @ts-expect-error - Type 'string' is not assignable to type 'number'
        amount: 'two',
      },
    });
  });

  it('records whose turn it is on a player-phase entry only (#515)', () => {
    const state = createMockState();
    state.players = [{ id: 'p1' }, { id: 'p2' }] as unknown as GameState['players'];
    state.activePlayerIndex = 1;

    state.phase = GamePhase.PLAYER_PHASE;
    appendLog(state, { key: 'phase.player_phase.start', params: { round: 1 } });
    state.phase = GamePhase.VILLAIN_PHASE;
    appendLog(state, { key: 'phase.villain_phase.start', params: { round: 1 } });

    expect(state.log[0].turnPlayerId).toBe('p2');
    expect(state.log[1].turnPlayerId).toBeUndefined();
  });
});
