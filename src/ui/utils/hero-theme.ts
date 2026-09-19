import type { PlayerState } from '../../engine/models';

export interface HeroColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  neutral: string;
  light: string;
  isDefaultFallback: boolean;
  contrastText: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export const DEFAULT_HERO_PALETTE: HeroColorPalette = {
  primary: '#1d4ed8', // comic-blue
  secondary: '#d97706', // comic-yellow
  accent: '#dc2626', // comic-red
  neutral: '#0f172a',
  light: '#ffffff',
  isDefaultFallback: true,
  contrastText: {
    primary: '#ffffff',
    secondary: '#0f172a',
    accent: '#ffffff',
  },
};

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

export function isValidHexColor(color: unknown): color is string {
  return typeof color === 'string' && HEX_COLOR_REGEX.test(color.trim());
}

/**
 * Calculates whether black (#0f172a) or white (#ffffff) text provides optimal contrast
 * for a given background hex color based on the standard luminance YIQ formula.
 */
export function getContrastTextColor(hexColor?: string | null): string {
  if (!hexColor || !isValidHexColor(hexColor)) {
    return '#ffffff';
  }
  let hex = hexColor.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;

  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#0f172a' : '#ffffff';
}

/**
 * Extracts and normalizes the comic pop-art color palette for a player's hero.
 * Upstream cards typically define 4 colors: [primary, secondary, accent, light].
 * Falls back deterministically to DEFAULT_HERO_PALETTE if missing, partial, or malformed.
 */
export function getHeroColorPalette(player?: PlayerState | null): HeroColorPalette {
  if (!player) {
    return { ...DEFAULT_HERO_PALETTE, isDefaultFallback: true };
  }

  const rawMetaColors =
    (player.hero?.meta as { colors?: unknown } | undefined)?.colors ??
    (player.hero?.raw?.meta as { colors?: unknown } | undefined)?.colors ??
    (player.activeFormCard?.meta as { colors?: unknown } | undefined)?.colors ??
    (player.activeFormCard?.raw?.meta as { colors?: unknown } | undefined)?.colors;

  if (!rawMetaColors) {
    return { ...DEFAULT_HERO_PALETTE, isDefaultFallback: true };
  }

  // Support array format (upstream cards)
  if (Array.isArray(rawMetaColors)) {
    if (rawMetaColors.length === 0) {
      return { ...DEFAULT_HERO_PALETTE, isDefaultFallback: true };
    }

    const has0 = isValidHexColor(rawMetaColors[0]);
    const has1 = isValidHexColor(rawMetaColors[1]);
    const has2 = isValidHexColor(rawMetaColors[2]);
    const has3 = isValidHexColor(rawMetaColors[3]);
    const has4 = isValidHexColor(rawMetaColors[4]);

    const primary = has0 ? rawMetaColors[0].trim() : DEFAULT_HERO_PALETTE.primary;
    const secondary = has1 ? rawMetaColors[1].trim() : DEFAULT_HERO_PALETTE.secondary;
    const accent = has2 ? rawMetaColors[2].trim() : DEFAULT_HERO_PALETTE.accent;

    let neutral = DEFAULT_HERO_PALETTE.neutral;
    let light = DEFAULT_HERO_PALETTE.light;

    if (rawMetaColors.length >= 5) {
      neutral = has3 ? rawMetaColors[3].trim() : DEFAULT_HERO_PALETTE.neutral;
      light = has4 ? rawMetaColors[4].trim() : DEFAULT_HERO_PALETTE.light;
    } else if (rawMetaColors.length >= 4) {
      light = has3 ? rawMetaColors[3].trim() : DEFAULT_HERO_PALETTE.light;
    }

    // Upstream cards specify 4 colors [primary, secondary, accent, light].
    // If length < 4 or any required entry is invalid, it is a partial/invalid fallback.
    const isPartialOrInvalid =
      rawMetaColors.length < 4 ||
      !has0 ||
      !has1 ||
      !has2 ||
      !has3 ||
      (rawMetaColors.length >= 5 && !has4);

    const contrastText = {
      primary: getContrastTextColor(primary),
      secondary: getContrastTextColor(secondary),
      accent: getContrastTextColor(accent),
    };

    return {
      primary,
      secondary,
      accent,
      neutral,
      light,
      isDefaultFallback: isPartialOrInvalid,
      contrastText,
    };
  }

  // Support record/object format if passed directly
  if (typeof rawMetaColors === 'object') {
    const obj = rawMetaColors as Record<string, unknown>;
    const hasP = isValidHexColor(obj.primary);
    const hasS = isValidHexColor(obj.secondary);
    const hasA = isValidHexColor(obj.accent);
    const hasN = isValidHexColor(obj.neutral);
    const hasL = isValidHexColor(obj.light);

    const primary = hasP ? (obj.primary as string).trim() : DEFAULT_HERO_PALETTE.primary;
    const secondary = hasS ? (obj.secondary as string).trim() : DEFAULT_HERO_PALETTE.secondary;
    const accent = hasA ? (obj.accent as string).trim() : DEFAULT_HERO_PALETTE.accent;
    const neutral = hasN ? (obj.neutral as string).trim() : DEFAULT_HERO_PALETTE.neutral;
    const light = hasL ? (obj.light as string).trim() : DEFAULT_HERO_PALETTE.light;

    const isDefaultFallback = !hasP || !hasS || !hasA;

    const contrastText = {
      primary: getContrastTextColor(primary),
      secondary: getContrastTextColor(secondary),
      accent: getContrastTextColor(accent),
    };

    return {
      primary,
      secondary,
      accent,
      neutral,
      light,
      isDefaultFallback,
      contrastText,
    };
  }

  return { ...DEFAULT_HERO_PALETTE, isDefaultFallback: true };
}
