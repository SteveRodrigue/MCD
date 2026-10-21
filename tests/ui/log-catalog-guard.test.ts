import { describe, it, expect } from 'vitest';
import { ALL_LOG_EVENT_KEYS } from '../../src/engine/models/log-events';
import { formatComicLogEntry } from '../../src/ui/utils/comic-log-formatter';
import { GameLogEntry, GameState } from '../../src/engine/models';

const mockGameState = {
  gameId: 'guard-test-game',
  roundNumber: 1,
  firstPlayerIndex: 0,
  activePlayerIndex: 0,
  players: [
    {
      id: 'p1',
      name: 'Spider-Man',
      currentForm: 'hero',
      hero: { name: 'Spider-Man' },
      alterEgo: { name: 'Peter Parker' },
      health: 10,
      hand: [],
      deck: [],
      discard: [],
      tableau: [],
      allies: [],
      engagedMinions: [],
      statusCards: [],
    },
  ],
  villains: [
    {
      instanceId: 'v1',
      card: { name: 'Rhino', code: '01094' },
      health: 14,
      stage: 1,
      attachments: [],
      statusCards: [],
    },
  ],
  mainSchemes: [
    {
      instanceId: 'ms1',
      card: { name: 'The Break-In', code: '01097' },
      threat: 3,
      targetThreat: 7,
    },
  ],
  sideSchemes: [],
  encounterDeck: [],
  encounterDiscard: [],
  log: [],
} as unknown as GameState;

const canonicalMockParams: Record<string, any> = {
  actor: 'Hero',
  target: 'Villain',
  card: 'Card Name',
  amount: 3,
  source: 'Source Entity',
  stage: 1,
  health: 12,
  currentHealth: 10,
  remainingHealth: 8,
  remainingHp: 8,
  remaining: 1,
  currentThreat: 2,
  targetThreat: 6,
  remainingThreat: 1,
  totalDamage: 4,
  threshold: 5,
  discardedCount: 1,
  drawnCount: 2,
  handSize: 5,
  status: 'Stunned',
  trait: 'Avenger',
  duration: 'ROUND',
  form: 'Hero',
  message: 'Loop detected',
  cycle: '1',
  effect: 'Step error',
  option: 'Option A',
  promptId: 'prompt-123',
  cards: 'Card A, Card B',
  destination: 'HAND',
  scenario: 'Rhino',
  difficulty: 'Standard',
  basePerPlayer: 1,
  round: 1,
  boost: 1,
  baseAtk: 2,
  baseSch: 2,
  totalThreat: 3,
};

describe('Log Catalog Coverage Guard Test (Plan R7)', () => {
  it('covers all static log event keys in ALL_LOG_EVENT_KEYS', () => {
    expect(ALL_LOG_EVENT_KEYS.length).toBeGreaterThan(120);
  });

  describe.each(ALL_LOG_EVENT_KEYS)('Event key: %s', (key) => {
    it(`formats ${key} into non-empty narrativeAction without raw {{placeholders}} in English`, () => {
      const entry: GameLogEntry = {
        id: `guard-${key}`,
        timestamp: 1,
        round: 1,
        key,
        actor: { name: 'Hero', type: 'hero' },
        params: canonicalMockParams,
      };

      const result = formatComicLogEntry(entry, 'en', mockGameState);
      expect(result.narrativeAction).toBeDefined();
      expect(result.narrativeAction.trim().length).toBeGreaterThan(0);
      expect(result.narrativeAction).not.toMatch(/\{\{.*?\}\}/);
    });

    it(`formats ${key} into non-empty narrativeAction without raw {{placeholders}} in French`, () => {
      const entry: GameLogEntry = {
        id: `guard-${key}`,
        timestamp: 1,
        round: 1,
        key,
        actor: { name: 'Hero', type: 'hero' },
        params: canonicalMockParams,
      };

      const result = formatComicLogEntry(entry, 'fr', mockGameState);
      expect(result.narrativeAction).toBeDefined();
      expect(result.narrativeAction.trim().length).toBeGreaterThan(0);
      expect(result.narrativeAction).not.toMatch(/\{\{.*?\}\}/);
    });
  });
});
