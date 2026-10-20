import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard, VillainCard, MainSchemeCard } from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { ScenarioRegistry, KlawScenarioPlugin } from '@engine/scenarios';
import { defeatSideScheme } from '@engine/effects';

describe('Plan R9: Klaw II setup reveal and The "Immortal" Klaw side scheme', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  const captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
  const carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;

  function buildKlawGame(difficulty: 'STANDARD' | 'EXPERT' = 'STANDARD', playerCount = 1) {
    const villainCard = cardCatalog.getCard(
      difficulty === 'EXPERT' ? '01114' : '01113',
    ) as VillainCard;
    const mainSchemeCard = cardCatalog.getCard('01116b') as MainSchemeCard;

    return setupGame({
      scenarioId: 'klaw',
      difficulty,
      players: Array.from({ length: playerCount }, (_, i) => ({
        id: `p${i + 1}`,
        name: i === 0 ? 'Spider-Man' : 'Captain Marvel',
        hero: i === 0 ? spiderManHero : captainMarvelHero,
        alterEgo: i === 0 ? peterParkerAlterEgo : carolDanversAlterEgo,
        deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
      })),
      villain: villainCard,
      mainScheme: mainSchemeCard,
      encounterCards: cardCatalog.getCardsBySet('klaw'),
      modularSetCodes: ['masters_of_evil'],
      skipMulligan: true,
    });
  }

  it('1. Klaw Expert setup: The "Immortal" Klaw is in play as a side scheme; Klaw\'s hit points include its bonus', () => {
    const state = buildKlawGame('EXPERT');

    // Klaw II is the starting villain
    expect(state.villain.card.code).toBe('01114');

    // The "Immortal" Klaw (01127) is revealed as a side scheme, not in attachments
    const immortalScheme = state.sideSchemes.find((s) => s.card.code === '01127');
    expect(immortalScheme).toBeDefined();
    expect(state.villain.attachments.some((a) => a.card.code === '01127')).toBe(false);

    // Klaw II base 18 + 10 bonus = 28 HP
    expect(state.villain.maxHealth).toBe(28);
    expect(state.villain.health).toBe(28);
  });

  it('2. Klaw Standard setup, Klaw I defeated: The "Immortal" Klaw is revealed as a side scheme on advance', () => {
    const state = buildKlawGame('STANDARD');

    // Klaw I is the starting villain (12 HP)
    expect(state.villain.card.code).toBe('01113');
    expect(state.villain.health).toBe(12);
    expect(state.sideSchemes.some((s) => s.card.code === '01127')).toBe(false);

    // Defeating Klaw I advances to Klaw II
    const plugin = ScenarioRegistry.get('klaw') as KlawScenarioPlugin;
    const result = plugin.onVillainDefeated(state, state.villain.instanceId!);
    expect(result.advancedStage).toBe(true);

    // Klaw II is active
    expect(state.villain.card.code).toBe('01114');

    // The "Immortal" Klaw is revealed as a side scheme, not an attachment
    const immortalScheme = state.sideSchemes.find((s) => s.card.code === '01127');
    expect(immortalScheme).toBeDefined();
    expect(state.villain.attachments.some((a) => a.card.code === '01127')).toBe(false);

    // Base 18 + 10 = 28 HP
    expect(state.villain.maxHealth).toBe(28);
    expect(state.villain.health).toBe(28);
  });

  it('3. The "Immortal" Klaw defeated: Klaw loses the bonus hit points', () => {
    const state = buildKlawGame('EXPERT');
    expect(state.villain.health).toBe(28);
    expect(state.villain.maxHealth).toBe(28);

    // Damage Klaw by 3 (remaining 25 HP)
    state.villain.health = 25;

    // Defeat The "Immortal" Klaw
    const immortalScheme = state.sideSchemes.find((s) => s.card.code === '01127')!;
    expect(immortalScheme).toBeDefined();
    defeatSideScheme(state, immortalScheme.instanceId, 'p1');

    // Scheme is removed from side schemes
    expect(state.sideSchemes.some((s) => s.card.code === '01127')).toBe(false);

    // Klaw loses 10 hit points (25 - 10 = 15 HP, maxHealth becomes 18)
    expect(state.villain.maxHealth).toBe(18);
    expect(state.villain.health).toBe(15);
  });

  it('3b. The "Immortal" Klaw defeated when Klaw has <= 10 HP: defeats Klaw II', () => {
    const state = buildKlawGame('EXPERT');

    // Klaw is damaged down to 5 HP
    state.villain.health = 5;

    // Defeat The "Immortal" Klaw
    const immortalScheme = state.sideSchemes.find((s) => s.card.code === '01127')!;
    defeatSideScheme(state, immortalScheme.instanceId, 'p1');

    // Losing 10 HP drops Klaw to <= 0 HP, triggering defeat (advances to Klaw III in Expert)
    expect(state.villain.card.code).toBe('01115');
  });

  it('4. The bonus is a flat +10 regardless of player count', () => {
    const state = buildKlawGame('EXPERT', 2);

    expect(state.sideSchemes.some((s) => s.card.code === '01127')).toBe(true);
    // Klaw II is 18 per player: 36 + a flat 10
    expect(state.villain.maxHealth).toBe(46);
    expect(state.villain.health).toBe(46);
  });

  it('5. The "Immortal" Klaw is found only once: not in the encounter deck or its discard afterwards', () => {
    const state = buildKlawGame('EXPERT');
    const copies = [...state.encounterDeck, ...state.encounterDiscard].filter(
      (c) => c.card.code === '01127',
    );
    expect(copies).toHaveLength(0);
    expect(state.encounterDeck.length).toBeGreaterThan(0);
  });
});
