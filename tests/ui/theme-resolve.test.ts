import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../../src/ui/theme/resolve-theme';
import { ALL_THEME_IDS, type ModalStyleId } from '../../src/ui/theme/modal-styles';
import { DEFAULT_THEME_SETTINGS, sanitizeThemeSettings } from '../../src/ui/theme/theme-settings';

describe('resolveTheme', () => {
  it('returns the fixed theme whatever the pool or RNG', () => {
    expect(
      resolveTheme({ mode: 'fixed', themeId: 'night', pool: ['splash'], random: () => 0 }),
    ).toBe('night');
  });

  it('picks uniformly from the pool using the injected RNG', () => {
    const pool: ModalStyleId[] = ['pop-art', 'night', 'hud'];
    const pick = (r: number) =>
      resolveTheme({ mode: 'random', themeId: 'pop-art', pool, random: () => r });
    expect(pick(0)).toBe('pop-art');
    expect(pick(0.5)).toBe('night');
    expect(pick(0.99)).toBe('hud');
    expect(pick(1)).toBe('hud');
  });

  it('never repeats the previous theme when another is available', () => {
    const pool: ModalStyleId[] = ['pop-art', 'night'];
    for (const r of [0, 0.4, 0.6, 0.99]) {
      expect(
        resolveTheme({
          mode: 'random',
          themeId: 'pop-art',
          pool,
          previousId: 'night',
          random: () => r,
        }),
      ).toBe('pop-art');
    }
  });

  it('allows a repeat when the pool has a single theme', () => {
    expect(
      resolveTheme({ mode: 'random', themeId: 'hud', pool: ['night'], previousId: 'night' }),
    ).toBe('night');
  });

  it('treats an empty pool as every theme', () => {
    const seen = new Set(
      ALL_THEME_IDS.map((_, i) =>
        resolveTheme({
          mode: 'random',
          themeId: 'pop-art',
          pool: [],
          random: () => i / ALL_THEME_IDS.length,
        }),
      ),
    );
    expect(seen.size).toBe(ALL_THEME_IDS.length);
  });

  it('reaches every theme over many random rolls', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const seen = new Set<ModalStyleId>();
    let previousId: ModalStyleId | null = null;
    for (let i = 0; i < 200; i++) {
      previousId = resolveTheme({
        mode: 'random',
        themeId: 'pop-art',
        pool: ALL_THEME_IDS,
        previousId,
        random,
      });
      seen.add(previousId);
    }
    expect(seen.size).toBe(ALL_THEME_IDS.length);
  });
});

describe('sanitizeThemeSettings', () => {
  it('fills defaults when theme keys are missing (old saved settings)', () => {
    expect(sanitizeThemeSettings({ devMode: false })).toEqual({
      devMode: false,
      ...DEFAULT_THEME_SETTINGS,
    });
  });

  it('keeps valid values', () => {
    const valid = {
      themeMode: 'random' as const,
      themeId: 'hud' as const,
      randomThemePool: ['night' as const, 'hud' as const],
      cardAccents: false,
    };
    expect(sanitizeThemeSettings(valid)).toEqual(valid);
  });

  it('repairs unknown modes, theme ids and pool entries', () => {
    const repaired = sanitizeThemeSettings({
      themeMode: 'shuffle',
      themeId: 'removed-theme',
      randomThemePool: ['night', 'removed-theme', 'night', 42],
      cardAccents: 'yes',
    });
    expect(repaired).toMatchObject({
      themeMode: 'fixed',
      themeId: 'pop-art',
      randomThemePool: ['night'],
      cardAccents: true,
    });
  });

  it('turns an empty or invalid pool into every theme', () => {
    expect(sanitizeThemeSettings({ randomThemePool: [] }).randomThemePool).toEqual([
      ...ALL_THEME_IDS,
    ]);
    expect(sanitizeThemeSettings({ randomThemePool: 'night' }).randomThemePool).toEqual([
      ...ALL_THEME_IDS,
    ]);
  });
});
