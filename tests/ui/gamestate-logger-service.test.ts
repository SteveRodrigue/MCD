import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logGameStateSnapshot } from '../../src/ui/services/gamestate-logger-service';
import { GameState, GamePhase } from '../../src/engine/models';

describe('GameState Logger Service', () => {
  const mockGameState: GameState = {
    id: 'test_game_1',
    roundNumber: 2,
    phase: GamePhase.PLAYER_PHASE,
    firstPlayerIndex: 0,
    activePlayerIndex: 0,
    players: [],
    villains: [],
    activeVillainIndex: 0,
    mainSchemes: [],
    activeMainSchemeIndex: 0,
    villain: {} as any,
    mainScheme: {} as any,
    sideSchemes: [],
    environments: [],
    encounterDeck: [],
    encounterDiscard: [],
    victoryDisplay: [],
    auxiliaryDecks: {},
    auxiliaryDiscards: {},
    removedFromGame: [],
    accelerationTokens: 0,
    winner: null,
    log: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts snapshot to /api/logs/gamestate endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock as any;

    await logGameStateSnapshot(mockGameState, { type: 'END_TURN' } as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/logs/gamestate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.state.roundNumber).toBe(2);
    expect(body.action.type).toBe('END_TURN');
    expect(body.label).toBe('Action: END_TURN');
  });

  it('gracefully catches fetch errors without throwing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    await expect(
      logGameStateSnapshot(mockGameState, undefined, 'Offline Test'),
    ).resolves.not.toThrow();
  });
});
