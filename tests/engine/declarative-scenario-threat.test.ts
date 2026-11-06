import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { bootContent } from '../../src/data/content/apply';
import { bootPacks, contentDriver } from '../helpers/content';
import { ScenarioRegistry } from '@engine/scenarios';
import { AlterEgoCard, HeroCard, getActiveMainScheme } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';

describe('Card-driven Main Scheme threat scaling', () => {
  beforeAll(async () => {
    await bootPacks('core', 'gob');
  });

  afterAll(async () => {
    await bootContent(contentDriver);
  });

  const makePlayer = (id: string, name: string, heroCode = '01001a', alterEgoCode = '01001b') => ({
    id,
    name,
    hero: cardCatalog.getCard(heroCode) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgoCode) as AlterEgoCard,
    deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
  });

  const createGame = (scenarioId: string, playerCount: 1 | 2) => {
    const players =
      playerCount === 1
        ? [makePlayer('p1', 'Spider-Man')]
        : [
            makePlayer('p1', 'Spider-Man', '01001a', '01001b'),
            makePlayer('p2', 'She-Hulk', '01019a', '01019b'),
          ];
    return setupGame({
      catalog: cardCatalog,
      scenarioId,
      difficulty: 'STANDARD',
      players,
      skipMulligan: true,
    });
  };

  it('calculates Klaw stage 1B threat and target threat correctly for 1 player and 2 players', () => {
    const state1P = createGame('klaw', 1);
    const ms1P = getActiveMainScheme(state1P);
    expect(ms1P.card.code).toBe('01116b');
    expect(ms1P.threat).toBe(0);
    expect(ms1P.targetThreat).toBe(6);

    const state2P = createGame('klaw', 2);
    const ms2P = getActiveMainScheme(state2P);
    expect(ms2P.card.code).toBe('01116b');
    expect(ms2P.threat).toBe(0);
    expect(ms2P.targetThreat).toBe(12);
  });

  it('calculates Klaw stage 2B threat and target threat from card metadata upon advancement', () => {
    const state2P = createGame('klaw', 2);
    const plugin = ScenarioRegistry.get('klaw')!;
    const result = plugin.onMainSchemeCompleted(state2P, getActiveMainScheme(state2P).instanceId!);

    expect(result.advancedStage).toBe(true);
    const ms2PStage2 = getActiveMainScheme(state2P);
    expect(ms2PStage2.card.code).toBe('01117b');
    expect(ms2PStage2.threat).toBe(0);
    expect(ms2PStage2.targetThreat).toBe(16); // 8 * 2 players
  });

  it('calculates Risky Business stage 1B starting threat with per-player scaling', () => {
    const state1P = createGame('risky_business', 1);
    const ms1P = getActiveMainScheme(state1P);
    expect(ms1P.card.code).toBe('02004b');
    expect(ms1P.threat).toBe(2); // 2 * 1 player
    expect(ms1P.targetThreat).toBe(7); // 7 * 1 player

    const state2P = createGame('risky_business', 2);
    const ms2P = getActiveMainScheme(state2P);
    expect(ms2P.card.code).toBe('02004b');
    expect(ms2P.threat).toBe(4); // 2 * 2 players
    expect(ms2P.targetThreat).toBe(14); // 7 * 2 players
  });

  it('calculates Risky Business stage 2B starting threat and target threat with per-player scaling upon advancement', () => {
    const state2P = createGame('risky_business', 2);
    const plugin = ScenarioRegistry.get('risky_business')!;
    const result = plugin.onMainSchemeCompleted(state2P, getActiveMainScheme(state2P).instanceId!);

    expect(result.advancedStage).toBe(true);
    const ms2PStage2 = getActiveMainScheme(state2P);
    expect(ms2PStage2.card.code).toBe('02005b');
    expect(ms2PStage2.threat).toBe(2); // 1 * 2 players
    expect(ms2PStage2.targetThreat).toBe(20); // 10 * 2 players
  });
});
