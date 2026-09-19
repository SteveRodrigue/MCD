import { describe, it, expect } from 'vitest';
import {
  getHeroColorPalette,
  DEFAULT_HERO_PALETTE,
  isValidHexColor,
  getContrastTextColor,
} from '../../src/ui/utils/hero-theme';
import { cardCatalog } from '../../src/data/importer/card-loader';
import type { PlayerState, HeroCard } from '../../src/engine/models';

describe('Hero Color Palette Extraction & Fallback Utility (Issue #110)', () => {
  describe('isValidHexColor', () => {
    it('accepts valid 3-digit and 6-digit hex codes', () => {
      expect(isValidHexColor('#fff')).toBe(true);
      expect(isValidHexColor('#FFFFFF')).toBe(true);
      expect(isValidHexColor('#982828')).toBe(true);
      expect(isValidHexColor(' #2a377b ')).toBe(true);
    });

    it('rejects invalid hex formats', () => {
      expect(isValidHexColor(null)).toBe(false);
      expect(isValidHexColor(undefined)).toBe(false);
      expect(isValidHexColor('')).toBe(false);
      expect(isValidHexColor('red')).toBe(false);
      expect(isValidHexColor('#12345')).toBe(false);
      expect(isValidHexColor('#gggggg')).toBe(false);
      expect(isValidHexColor(123456)).toBe(false);
    });
  });

  describe('Core 5 Heroes Palette Extraction', () => {
    function createMockPlayerForCard(cardCode: string): PlayerState {
      const heroCard = cardCatalog.getCard(cardCode) as HeroCard;
      return {
        id: `p-${cardCode}`,
        name: heroCard.name,
        hero: heroCard,
        alterEgo: {} as any,
        availableForms: [heroCard],
        activeFormCard: heroCard,
        currentForm: 'hero',
        health: heroCard.health || 10,
        maxHealth: heroCard.health || 10,
        exhausted: false,
        statusCards: [],
        hand: [],
        deck: [],
        discard: [],
        tableau: [],
        allies: [],
        engagedMinions: [],
        basicChangeFormUsedThisRound: false,
        formChangedThisRound: false,
        recoveryUsedThisRound: false,
        dealtEncounterCards: [],
        setAsideCards: [],
      };
    }

    it('extracts Spider-Man signature color palette (web-red & costume-blue)', () => {
      const player = createMockPlayerForCard('01001a');
      const palette = getHeroColorPalette(player);

      expect(palette.isDefaultFallback).toBe(false);
      expect(palette.primary).toBe('#982828');
      expect(palette.secondary).toBe('#2b3681');
      expect(palette.accent).toBe('#010101');
      expect(palette.light).toBe('#fffffd');
    });

    it('extracts Captain Marvel signature color palette (navy & red & yellow)', () => {
      const player = createMockPlayerForCard('01010a');
      const palette = getHeroColorPalette(player);

      expect(palette.isDefaultFallback).toBe(false);
      expect(palette.primary).toBe('#2a377b');
      expect(palette.secondary).toBe('#902b26');
      expect(palette.accent).toBe('#f3ee25');
      expect(palette.light).toBe('#fffffd');
    });

    it('extracts She-Hulk signature color palette (gamma-purple & green)', () => {
      const player = createMockPlayerForCard('01019a');
      const palette = getHeroColorPalette(player);

      expect(palette.isDefaultFallback).toBe(false);
      expect(palette.primary).toBe('#572d79');
      expect(palette.secondary).toBe('#1b8b45');
      expect(palette.accent).toBe('#fefaf8');
      expect(palette.light).toBe('#fffffd');
    });

    it('extracts Iron Man signature color palette (hot-rod red & armor-gold)', () => {
      const player = createMockPlayerForCard('01029a');
      const palette = getHeroColorPalette(player);

      expect(palette.isDefaultFallback).toBe(false);
      expect(palette.primary).toBe('#8f2928');
      expect(palette.secondary).toBe('#8c2d23');
      expect(palette.accent).toBe('#f5eb29');
      expect(palette.light).toBe('#fffffd');
    });

    it('extracts Black Panther signature color palette (wakandan purple & gold)', () => {
      const player = createMockPlayerForCard('01040a');
      const palette = getHeroColorPalette(player);

      expect(palette.isDefaultFallback).toBe(false);
      expect(palette.primary).toBe('#492b5f');
      expect(palette.secondary).toBe('#492b5f');
      expect(palette.accent).toBe('#f1f017');
      expect(palette.light).toBe('#fffffd');
    });

    it('extracts colors from player.hero.raw.meta.colors when meta is only on raw', () => {
      const player = {
        id: 'p-raw',
        name: 'Raw Hero',
        hero: {
          raw: {
            meta: {
              colors: ['#112233', '#445566', '#778899', '#aabbcc'],
            },
          },
        } as any,
      } as PlayerState;

      const palette = getHeroColorPalette(player);
      expect(palette.isDefaultFallback).toBe(false);
      expect(palette.primary).toBe('#112233');
      expect(palette.secondary).toBe('#445566');
      expect(palette.accent).toBe('#778899');
      expect(palette.light).toBe('#aabbcc');
    });
  });

  describe('Fallback Behavior', () => {
    it('returns DEFAULT_HERO_PALETTE when player is null or undefined', () => {
      const paletteNull = getHeroColorPalette(null);
      expect(paletteNull.isDefaultFallback).toBe(true);
      expect(paletteNull.primary).toBe(DEFAULT_HERO_PALETTE.primary);
      expect(paletteNull.secondary).toBe(DEFAULT_HERO_PALETTE.secondary);
      expect(paletteNull.accent).toBe(DEFAULT_HERO_PALETTE.accent);
      expect(paletteNull.neutral).toBe(DEFAULT_HERO_PALETTE.neutral);
      expect(paletteNull.light).toBe(DEFAULT_HERO_PALETTE.light);

      const paletteUndefined = getHeroColorPalette(undefined);
      expect(paletteUndefined.isDefaultFallback).toBe(true);
      expect(paletteUndefined.primary).toBe(DEFAULT_HERO_PALETTE.primary);
    });

    it('returns DEFAULT_HERO_PALETTE when meta is undefined', () => {
      const player = {
        id: 'p-no-meta',
        name: 'Custom Hero',
        hero: {} as any,
      } as PlayerState;

      const palette = getHeroColorPalette(player);
      expect(palette.isDefaultFallback).toBe(true);
      expect(palette.primary).toBe(DEFAULT_HERO_PALETTE.primary);
      expect(palette.secondary).toBe(DEFAULT_HERO_PALETTE.secondary);
      expect(palette.accent).toBe(DEFAULT_HERO_PALETTE.accent);
    });

    it('returns DEFAULT_HERO_PALETTE when meta.colors is empty array', () => {
      const player = {
        id: 'p-empty',
        name: 'Empty Colors Hero',
        hero: { meta: { colors: [] } } as any,
      } as PlayerState;

      const palette = getHeroColorPalette(player);
      expect(palette.isDefaultFallback).toBe(true);
      expect(palette.primary).toBe(DEFAULT_HERO_PALETTE.primary);
      expect(palette.secondary).toBe(DEFAULT_HERO_PALETTE.secondary);
    });

    it('returns DEFAULT_HERO_PALETTE when meta.colors is non-array', () => {
      const player = {
        id: 'p-string-colors',
        name: 'Non Array Colors Hero',
        hero: { meta: { colors: 'comic-blue' } } as any,
      } as PlayerState;

      const palette = getHeroColorPalette(player);
      expect(palette.isDefaultFallback).toBe(true);
      expect(palette.primary).toBe(DEFAULT_HERO_PALETTE.primary);
    });

    it('handles partial arrays by filling missing entries with DEFAULT_HERO_PALETTE and setting isDefaultFallback: true', () => {
      const player = {
        id: 'p-partial',
        name: 'Partial Hero',
        hero: { meta: { colors: ['#443322'] } } as any,
      } as PlayerState;

      const palette = getHeroColorPalette(player);
      expect(palette.isDefaultFallback).toBe(true);
      expect(palette.primary).toBe('#443322');
      expect(palette.secondary).toBe(DEFAULT_HERO_PALETTE.secondary);
      expect(palette.accent).toBe(DEFAULT_HERO_PALETTE.accent);
      expect(palette.neutral).toBe(DEFAULT_HERO_PALETTE.neutral);
      expect(palette.light).toBe(DEFAULT_HERO_PALETTE.light);
    });

    it('handles invalid hex values by substituting DEFAULT_HERO_PALETTE values and setting isDefaultFallback: true', () => {
      const player = {
        id: 'p-invalid',
        name: 'Invalid Hex Hero',
        hero: { meta: { colors: ['#112233', 'not-a-hex', '#223344', '#556677'] } } as any,
      } as PlayerState;

      const palette = getHeroColorPalette(player);
      expect(palette.isDefaultFallback).toBe(true);
      expect(palette.primary).toBe('#112233');
      expect(palette.secondary).toBe(DEFAULT_HERO_PALETTE.secondary); // fell back
      expect(palette.accent).toBe('#223344');
      expect(palette.light).toBe('#556677');
    });

    it('handles all invalid hex entries by falling back entirely with isDefaultFallback: true', () => {
      const player = {
        id: 'p-all-invalid',
        name: 'All Invalid Hero',
        hero: { meta: { colors: ['#bad', 'rgb(0,0,0)', 'xyz', ''] } } as any,
      } as PlayerState;

      const palette = getHeroColorPalette(player);
      expect(palette.isDefaultFallback).toBe(true);
      // Notice: #bad is actually 3-character hex! #b, #a, #d is valid hex.
      // But rgb(0,0,0) is not.
      expect(palette.secondary).toBe(DEFAULT_HERO_PALETTE.secondary);
      expect(palette.accent).toBe(DEFAULT_HERO_PALETTE.accent);
      expect(palette.light).toBe(DEFAULT_HERO_PALETTE.light);
    });
  });

  describe('getContrastTextColor & Dynamic Text Contrast', () => {
    it('returns white text (#ffffff) for dark backgrounds including Spider-Man black accent (#010101)', () => {
      expect(getContrastTextColor('#010101')).toBe('#ffffff'); // Spider-Man accent (fixes black-on-black bug)
      expect(getContrastTextColor('#000000')).toBe('#ffffff');
      expect(getContrastTextColor('#982828')).toBe('#ffffff'); // Spider-Man red
      expect(getContrastTextColor('#2a377b')).toBe('#ffffff'); // Captain Marvel navy
      expect(getContrastTextColor('#572d79')).toBe('#ffffff'); // She-Hulk purple
      expect(getContrastTextColor('#492b5f')).toBe('#ffffff'); // Black Panther purple
    });

    it('returns dark text (#0f172a) for bright/light backgrounds (gold, yellow, white)', () => {
      expect(getContrastTextColor('#ffffff')).toBe('#0f172a');
      expect(getContrastTextColor('#f3ee25')).toBe('#0f172a'); // Captain Marvel gold
      expect(getContrastTextColor('#f5eb29')).toBe('#0f172a'); // Iron Man gold
      expect(getContrastTextColor('#f1f017')).toBe('#0f172a'); // Black Panther gold
      expect(getContrastTextColor('#fefaf8')).toBe('#0f172a'); // She-Hulk off-white
    });

    it('populates contrastText correctly on extracted palettes', () => {
      const spideyHero = cardCatalog.getCard('01001a') as HeroCard;
      const palette = getHeroColorPalette({ hero: spideyHero } as any);

      expect(palette.contrastText.primary).toBe('#ffffff'); // white on red
      expect(palette.contrastText.accent).toBe('#ffffff'); // white on black (Spider-Man)
    });
  });
});
