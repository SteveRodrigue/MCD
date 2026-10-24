import { fontAt, type FontPair, type FontSizes, type FontSlot } from './font-test';

/** The dev server route that writes the file, and the file it writes (in the repository, git-ignored). */
export const FONT_CHOICES_ENDPOINT = '/api/lab/font-choices';
export const FONT_CHOICES_FILE = 'logs/lab/font-choices.json';

export interface SavedFont {
  id: string;
  label: string;
  family: string;
}

/** What the lab font test shows for one theme: the test font of each slot (null: the theme's own font) and the size change. */
export interface FontChoicesEntry {
  style: string;
  label: string;
  savedAt: string;
  fonts: Record<FontSlot, SavedFont | null>;
  sizes: FontSizes;
}

export interface FontChoicesFile {
  /** What the values mean, for whoever reads the file later. */
  about: string;
  themes: Record<string, FontChoicesEntry>;
}

const SLOTS: readonly FontSlot[] = ['headline', 'body', 'newsHeadline', 'newsBody', 'numbers'];

const ABOUT =
  'Saved from the lab font test. fonts: the test font chosen for each slot, null when the theme keeps its own font. ' +
  'sizes: px added to the size the game gives that text (0: unchanged). Newspaper slots apply inside a newspaper only and win over headline and body there; numbers applies to font-mono text.';

export const fontChoicesEntry = (
  style: { id: string; label: string },
  pair: FontPair,
  sizes: FontSizes,
  savedAt: Date = new Date(),
): FontChoicesEntry => {
  const fonts = Object.fromEntries(
    SLOTS.map((slot) => {
      const font = fontAt(pair[slot]);
      return [slot, font ? { id: font.id, label: font.label, family: font.family } : null];
    }),
  ) as Record<FontSlot, SavedFont | null>;
  return {
    style: style.id,
    label: style.label,
    savedAt: savedAt.toISOString(),
    fonts,
    sizes: { ...sizes },
  };
};

const isEntry = (value: unknown): value is FontChoicesEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<FontChoicesEntry>;
  return (
    typeof entry.style === 'string' &&
    /^[a-z0-9-]+$/.test(entry.style) &&
    typeof entry.label === 'string' &&
    typeof entry.fonts === 'object' &&
    entry.fonts !== null &&
    typeof entry.sizes === 'object' &&
    entry.sizes !== null
  );
};

/** Puts a theme's entry in the file, replacing that theme's earlier one and keeping the others. Throws on a malformed entry. */
export const mergeFontChoices = (existing: unknown, entry: unknown): FontChoicesFile => {
  if (!isEntry(entry)) throw new Error('Not a font choices entry');
  const previous =
    typeof existing === 'object' && existing !== null && 'themes' in existing
      ? ((existing as FontChoicesFile).themes ?? {})
      : {};
  return { about: ABOUT, themes: { ...previous, [entry.style]: entry } };
};

/** Asks the dev server to write the entry to `FONT_CHOICES_FILE`. */
export const saveFontChoices = async (entry: FontChoicesEntry): Promise<void> => {
  const response = await fetch(FONT_CHOICES_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  const result = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(result.error ?? `The server answered ${response.status}`);
};
