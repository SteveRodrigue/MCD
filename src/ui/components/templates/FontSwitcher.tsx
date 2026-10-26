import React, { useState } from 'react';
import { Newspaper, RotateCcw, Save } from 'lucide-react';
import { CyclePicker, type CycleGroup } from './CyclePicker';
import { FONT_CHOICES_FILE, fontChoicesEntry, saveFontChoices } from './font-save';
import { FONT_CATEGORIES, FONT_CHOICES, type FontCategory } from './lab-font-list';
import {
  DEFAULT_FONT_INDEX,
  SIZE_MAX,
  SIZE_MIN,
  TEXT_ROLES,
  cycleFontIndex,
  formatSize,
  type FontPair,
  type FontSizes,
  type FontSlot,
} from './font-test';

const CATEGORY_LABEL: Record<FontCategory, string> = {
  display: 'Comic display (headlines)',
  typewriter: 'Typewriter',
  sans: 'Sans',
  rounded: 'Rounded',
  comic: 'Comic and handwriting',
  serif: 'Serif',
  mono: 'Mono',
};

const kbd = 'px-1 border border-slate-500 rounded-sm';

/** The list of fonts, starting with the default entry, grouped by kind. Values are `FONT_CHOICES` indexes. */
const fontGroups = (defaultLabel: string): CycleGroup[] => [
  { options: [{ value: String(DEFAULT_FONT_INDEX), label: defaultLabel }] },
  ...FONT_CATEGORIES.map((category) => ({
    label: CATEGORY_LABEL[category],
    options: FONT_CHOICES.flatMap((f, i) =>
      f.category === category ? [{ value: String(i), label: f.label }] : [],
    ),
  })),
];

export interface FontSwitcherProps {
  pair: FontPair;
  sizes: FontSizes;
  /** The style being viewed, whose fonts the Save button writes; null on the gallery. */
  style: { id: string; label: string } | null;
  onSelect: (slot: FontSlot, index: number) => void;
  onStepSize: (slot: FontSlot, direction: 1 | -1) => void;
  onClearSize: (slot: FontSlot) => void;
  onReset: () => void;
}

/**
 * The lab's font test: a font for headlines and one for body, for every surface; then the newspaper
 * exception, its own headlines and body, which win over the first pair inside a newspaper. F cycles
 * the default pair, H headlines, B body, N the newspaper pair, M numbers and codes (Shift goes back).
 */
export const FontSwitcher: React.FC<FontSwitcherProps> = ({
  pair,
  sizes,
  style,
  onSelect,
  onStepSize,
  onClearSize,
  onReset,
}) => {
  const [saved, setSaved] = useState<{ ok: boolean; text: string } | null>(null);

  const save = () => {
    if (!style) return;
    saveFontChoices(fontChoicesEntry(style, pair, sizes)).then(
      () => setSaved({ ok: true, text: `Saved ${style.label} to ${FONT_CHOICES_FILE}` }),
      (error: Error) => setSaved({ ok: false, text: `Not saved: ${error.message}` }),
    );
  };

  const picker = (
    slot: FontSlot,
    name: string,
    label: string,
    hint: string,
    defaultLabel: string,
    shortcut: string,
  ) => (
    <CyclePicker
      key={slot}
      name={`${name} font`}
      label={label}
      hint={hint}
      shortcut={shortcut}
      value={String(pair[slot])}
      groups={fontGroups(defaultLabel)}
      onChange={(value) => onSelect(slot, Number(value))}
      onStep={(direction) => onSelect(slot, cycleFontIndex(pair[slot], direction))}
      size={{
        value: formatSize(sizes[slot]),
        isChanged: sizes[slot] !== 0,
        atMin: sizes[slot] <= SIZE_MIN,
        atMax: sizes[slot] >= SIZE_MAX,
        onStep: (direction) => onStepSize(slot, direction),
        onClear: () => onClearSize(slot),
      }}
    />
  );

  return (
    <section aria-label="Font test" className="space-y-2.5">
      {TEXT_ROLES.map((r) =>
        picker(
          r.id,
          r.label,
          r.label,
          r.hint,
          'Theme font (default)',
          r.id === 'headline' ? 'H' : 'B',
        ),
      )}
      <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1 pt-1">
        <Newspaper className="w-3.5 h-3.5" />
        Newspaper
      </h3>
      {picker(
        'newsHeadline',
        'Newspaper headlines',
        'Headlines',
        'Headlines of the Daily Bugle only. Unset: follows the headlines above, then the theme.',
        'Follow default',
        'N',
      )}
      {picker(
        'newsBody',
        'Newspaper body',
        'Body',
        'Body text of the Daily Bugle only. Unset: follows the body above, then the theme.',
        'Follow default',
        'N',
      )}
      <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 pt-1">
        Numbers &amp; codes
      </h3>
      {picker(
        'numbers',
        'Numbers and codes',
        'Counters, badges, keys',
        'Counters, badges, key caps and card codes: every element that names font-mono.',
        'Theme font (default)',
        'M',
      )}
      <button
        type="button"
        title="Back to the theme fonts and sizes, newspaper included"
        onClick={onReset}
        className="w-full px-2 py-1.5 rounded-lg border-2 border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Theme fonts</span>
      </button>
      <button
        type="button"
        disabled={!style}
        title={`Writes the fonts and sizes chosen above for this style to ${FONT_CHOICES_FILE}, so they can be read later`}
        onClick={save}
        className="w-full px-2 py-1.5 rounded-lg border-2 border-comic-yellow bg-slate-800 text-comic-yellow hover:bg-slate-700 font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Save className="w-3.5 h-3.5" />
        <span>Save font choices</span>
      </button>
      {saved && (
        <p
          role="status"
          className={`text-[10px] font-bold leading-snug ${saved.ok ? 'text-emerald-300' : 'text-red-300'}`}
        >
          {saved.text}
        </p>
      )}
      <p className="text-[10px] text-slate-400 leading-relaxed">
        <kbd className={kbd}>F</kbd> headlines and body <kbd className={kbd}>H</kbd> headlines{' '}
        <kbd className={kbd}>B</kbd> body <kbd className={kbd}>N</kbd> both newspaper fonts, which
        win over the default pair inside a newspaper. <kbd className={kbd}>M</kbd> numbers and
        codes. <kbd className={kbd}>Shift</kbd> goes back. The - and + at the right of each list
        change the size of that text, 1px at a time; click the size to clear it.
      </p>
    </section>
  );
};
