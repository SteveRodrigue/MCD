import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildGithubIssueUrl,
  mapReportToLabels,
  mapReportTypeToLabels,
  submitProblemReport,
} from '../../src/ui/services/problem-report-service';
import { GameState, GamePhase } from '../../src/engine/models';

describe('Problem Report Service', () => {
  const mockGameState: GameState = {
    id: 'test_game_1',
    roundNumber: 3,
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
    removedFromGame: [],
    accelerationTokens: 0,
    winner: null,
    log: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('mapReportTypeToLabels', () => {
    it('maps bug to bug/triage labels', () => {
      expect(mapReportTypeToLabels('bug')).toEqual(['bug', 'triage']);
    });

    it('maps improvement to enhancement label', () => {
      expect(mapReportTypeToLabels('improvement')).toEqual(['enhancement']);
    });

    it('maps feature to enhancement/feature labels', () => {
      expect(mapReportTypeToLabels('feature')).toEqual(['enhancement', 'feature']);
    });
  });

  describe('mapReportToLabels', () => {
    it('appends the priority label to the type labels', () => {
      expect(mapReportToLabels('bug', 'P0-critical')).toEqual([
        'bug',
        'triage',
        'priority:P0-critical',
      ]);
      expect(mapReportToLabels('feature', 'P3-low')).toEqual([
        'enhancement',
        'feature',
        'priority:P3-low',
      ]);
    });
  });

  describe('buildGithubIssueUrl', () => {
    it('builds a well-formed, URL-encoded prefilled issue URL', () => {
      const url = buildGithubIssueUrl({
        title: 'Test Title',
        description: 'Line with spaces & symbols',
        labels: ['bug', 'triage', 'priority:P1-high'],
      });

      expect(url.startsWith('https://github.com/SteveRodrigue/MCD/issues/new?')).toBe(true);
      const parsed = new URL(url);
      expect(parsed.searchParams.get('title')).toBe('Test Title');
      expect(parsed.searchParams.get('body')).toBe('Line with spaces & symbols');
      expect(parsed.searchParams.get('labels')).toBe('bug,triage,priority:P1-high');
    });
  });

  describe('submitProblemReport', () => {
    it('posts a well-formed payload to /api/logs/report', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, file: 'report_123_bug.json' }),
      });
      global.fetch = fetchMock as any;

      const result = await submitProblemReport({
        type: 'bug',
        priority: 'P1-high',
        title: 'Something broke',
        description: 'Steps to reproduce...',
        gameState: mockGameState,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/logs/report',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.type).toBe('bug');
      expect(body.priority).toBe('P1-high');
      expect(body.labels).toEqual(['bug', 'triage', 'priority:P1-high']);
      expect(body.gameState.roundNumber).toBe(3);
      expect(typeof body.timestamp).toBe('number');
      expect(result).toEqual({ success: true, file: 'report_123_bug.json' });
    });

    it('gracefully catches fetch errors without throwing', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const result = await submitProblemReport({
        type: 'improvement',
        priority: 'P2-medium',
        title: 'Suggestion',
        description: 'Would be nice...',
        gameState: mockGameState,
      });

      expect(result).toEqual({ success: false });
    });
  });
});
