import { FONT_CHOICES, type FontChoice } from './lab-font-list.ts';

/** The two kinds of text the lab tests separately. */
export type TextRole = 'headline' | 'body';

export const TEXT_ROLES: readonly { id: TextRole; label: string; hint: string }[] = [
  {
    id: 'headline',
    label: 'Headlines',
    hint: 'Headings and larger text (17px or more: text-base and up)',
  },
  { id: 'body', label: 'Body', hint: 'Smaller text: descriptions, small labels, chips, captions' },
];

/** Text this size or larger (px) counts as a headline: the root is 17.6px, so text-base and up. */
export const HEADLINE_MIN_PX = 17;

/** A headline is a heading element or large text; everything else is body text. */
export const textRole = (tagName: string, fontSizePx: number, role?: string | null): TextRole =>
  /^H[1-6]$/i.test(tagName) || role === 'heading' || fontSizePx >= HEADLINE_MIN_PX
    ? 'headline'
    : 'body';

/** `-1` is the themes' own fonts; `0..n-1` index `FONT_CHOICES`. */
export const DEFAULT_FONT_INDEX = -1;

/**
 * The five test fonts. `headline` and `body` apply everywhere; `newsHeadline` and `newsBody` apply
 * to newspaper surfaces only and, when set, win over the first two there; `numbers` is the font of
 * numbers and codes (every element that names `font-mono`).
 */
export interface FontPair {
  headline: number;
  body: number;
  newsHeadline: number;
  newsBody: number;
  numbers: number;
}

export type FontSlot = keyof FontPair;

export const DEFAULT_PAIR: FontPair = {
  headline: DEFAULT_FONT_INDEX,
  body: DEFAULT_FONT_INDEX,
  newsHeadline: DEFAULT_FONT_INDEX,
  newsBody: DEFAULT_FONT_INDEX,
  numbers: DEFAULT_FONT_INDEX,
};

/** Size change in px of each slot's text, on top of the size the game gives it. 0 is untouched. */
export type FontSizes = Record<FontSlot, number>;

export const DEFAULT_SIZES: FontSizes = {
  headline: 0,
  body: 0,
  newsHeadline: 0,
  newsBody: 0,
  numbers: 0,
};

export const SIZE_MIN = -4;
export const SIZE_MAX = 8;

export const clampSize = (size: number): number => Math.min(SIZE_MAX, Math.max(SIZE_MIN, size));

/** One step of the size buttons, kept inside the lab's range. */
export const stepSize = (size: number, direction: 1 | -1): number => clampSize(size + direction);

/** "0", "+2", "-1": the size change as the buttons show it. */
export const formatSize = (size: number): string => (size > 0 ? `+${size}` : String(size));

/** Next or previous index, wrapping through the default (`-1`) between the last and the first font. */
export const cycleFontIndex = (index: number, direction: 1 | -1): number => {
  const count = FONT_CHOICES.length;
  const next = index + direction;
  if (next >= count) return DEFAULT_FONT_INDEX;
  if (next < DEFAULT_FONT_INDEX) return count - 1;
  return next;
};

export const fontAt = (index: number): FontChoice | null => FONT_CHOICES[index] ?? null;

/** CSS font-family value of a choice. */
export const fontStack = (font: FontChoice): string => font.stack ?? `'${font.family}'`;

export type ShortcutTarget = 'both' | TextRole | 'newspaper' | 'numbers';

/**
 * The font shortcuts: F cycles headlines and body together, H the headlines alone, B the body alone,
 * N the newspaper headlines and body together, M the numbers and codes font; Shift reverses. Returns null for any other key or
 * when a modifier is held.
 */
export const fontShortcut = (
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>,
): { target: ShortcutTarget; direction: 1 | -1 } | null => {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = event.key.toLowerCase();
  const target: ShortcutTarget | null =
    key === 'f'
      ? 'both'
      : key === 'h'
        ? 'headline'
        : key === 'b'
          ? 'body'
          : key === 'n'
            ? 'newspaper'
            : key === 'm'
              ? 'numbers'
              : null;
  if (!target) return null;
  return { target, direction: event.shiftKey ? -1 : 1 };
};

/** Applies a shortcut: "both" moves the headline font one step and gives the body the same font; "newspaper" does the same for the newspaper pair. */
export const applyShortcut = (
  pair: FontPair,
  target: ShortcutTarget,
  direction: 1 | -1,
): FontPair => {
  if (target === 'both') {
    const next = cycleFontIndex(pair.headline, direction);
    return { ...pair, headline: next, body: next };
  }
  if (target === 'newspaper') {
    const next = cycleFontIndex(pair.newsHeadline, direction);
    return { ...pair, newsHeadline: next, newsBody: next };
  }
  return { ...pair, [target]: cycleFontIndex(pair[target], direction) };
};

/** Typing in a field must never change the font. */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
};
