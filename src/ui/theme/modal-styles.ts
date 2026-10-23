import type { CSSProperties } from 'react';

/**
 * Modal style registry (design tokens).
 *
 * Three independent axes keep the game readable whichever style wins:
 *   style     = how the modal is drawn (this file)
 *   archetype = what the modal does (Decision, Sequence, Select templates)
 *   verb      = what the header colour means in gameplay terms (same in every style)
 *
 * To add a style: add one `ModalStyle` object to `MODAL_STYLES`. No new component is needed.
 */

export type VerbColor = 'yellow' | 'red' | 'blue' | 'purple' | 'green';

export const VERB_COLORS: readonly VerbColor[] = ['yellow', 'red', 'blue', 'purple', 'green'];

export const VERB_MEANING: Record<VerbColor, string> = {
  yellow: 'Decide',
  red: 'Attack / Forced',
  blue: 'Thwart / Info',
  purple: 'Hero special',
  green: 'Defend / Heal',
};

/** Flat swatch per verb, for lab chrome and gallery previews. */
export const VERB_SWATCH: Record<VerbColor, string> = {
  yellow: '#FFDE00',
  red: '#ED1D24',
  blue: '#0284C7',
  purple: '#581C87',
  green: '#16A34A',
};

/** How a card accent is drawn on a row, tile or slot. Each theme picks the one that belongs to it. */
export type AccentEdge = 'stripe' | 'flag' | 'rule' | 'glow' | 'dot' | 'tab' | 'bracket';
/** How a card accent marks a card name in prose. */
export type AccentName = 'underline' | 'marker' | 'dot';

export type HeaderLayout = 'bar' | 'caption' | 'burst' | 'masthead' | 'tab';

export type ModalStyleId =
  'pop-art' | 'storyboard' | 'newsprint' | 'night' | 'splash' | 'dossier' | 'hud';

export interface VerbTokens {
  /** Header background and default text colour. */
  banner: string;
  /** Box that frames the header icon. */
  iconBox: string;
  kicker: string;
  title: string;
  /** Border colour of the header rule. */
  rule: string;
  /** Sticker / stamp word for layouts that show one (burst, tab). */
  word: string;
}

export interface ModalStyle {
  id: ModalStyleId;
  label: string;
  tagline: string;
  traits: readonly string[];
  bestFor: string;
  headerLayout: HeaderLayout;
  /** Extra masthead text (newsprint only). */
  flavor?: string;

  overlay: string;
  frame: string;
  texture: CSSProperties;
  textureClass: string;
  header: string;
  body: string;
  footer: string;
  verbs: Record<VerbColor, VerbTokens>;

  text: string;
  muted: string;
  emphasis: string;
  /** Framed content block. */
  panel: string;
  panelHead: string;
  /** Small callout inside a panel (rules reminders). */
  inset: string;
  /** Counter / badge. */
  chip: string;
  /** Clickable option row. */
  option: string;
  optionTitleHover: string;
  /** Selected tile in a multi-select grid. */
  tile: string;
  tileSelected: string;
  /** Sequence slot. */
  slot: string;
  slotFinal: string;
  slotOver: string;
  step: string;
  stepFinal: string;
  /** Primary confirm / execute button. */
  btnGo: string;
  /** Secondary move left / right button. */
  btnMove: string;

  /** Page backdrop colour class for the gallery preview of this style. */
  previewPage: string;

  /** Sound-effect burst shown when the player acts (rotates through `words`). */
  fx: {
    words: readonly string[];
    shape: 'star' | 'rect';
    className: string;
  };
  /** Narrator caption box ("MEANWHILE...") shown above a modal body. */
  caption: string;
  /** Speech / thought bubble; carries its own tail. */
  bubble: string;
  /** Card accent presentation for this theme. */
  accent: { edge: AccentEdge; name: AccentName };
  /** Tag pinned on the finisher slot of a sequence. */
  finisher: { label: string; star: boolean; className: string };
}

const DOTS = (size: number, color = '#000'): CSSProperties => ({
  backgroundImage: `radial-gradient(${color} 2px, transparent 2px)`,
  backgroundSize: `${size}px ${size}px`,
});

const popArt: ModalStyle = {
  id: 'pop-art',
  label: 'Pop-Art Action-Coded',
  tagline: 'Lichtenstein dots, bold colour bars, 4px black ink.',
  traits: ['Ben-Day halftone', 'Colour-coded header bar', 'Hard black shadows'],
  bestFor: 'Everything: the safe baseline',
  headerLayout: 'bar',
  overlay: 'bg-comic-black/80 backdrop-blur-xs',
  frame: 'bg-comic-paper border-4 border-comic-black rounded-xl shadow-comic-xl font-comic',
  texture: DOTS(12),
  textureClass: 'opacity-10',
  header: 'border-b-4',
  body: 'p-5 sm:p-6 space-y-4',
  footer: 'bg-amber-50/90 border-t-4 border-comic-black',
  verbs: {
    yellow: {
      banner: 'bg-comic-yellow text-comic-black',
      iconBox: 'bg-comic-black text-comic-yellow rounded-lg shadow-comic-sm p-2',
      kicker: 'text-slate-800',
      title: 'text-comic-black',
      rule: 'border-comic-black',
      word: 'DECIDE!',
    },
    red: {
      banner: 'bg-comic-red text-white',
      iconBox: 'bg-comic-black text-comic-yellow rounded-lg shadow-comic-sm p-2',
      kicker: 'text-comic-yellow',
      title: 'text-white',
      rule: 'border-comic-black',
      word: 'POW!',
    },
    blue: {
      banner: 'bg-comic-blue text-white',
      iconBox: 'bg-comic-black text-comic-yellow rounded-lg shadow-comic-sm p-2',
      kicker: 'text-sky-100',
      title: 'text-white',
      rule: 'border-comic-black',
      word: 'THWIP!',
    },
    purple: {
      banner: 'bg-purple-900 text-amber-300',
      iconBox: 'bg-comic-black text-amber-300 rounded-lg shadow-comic-sm p-2',
      kicker: 'text-amber-200',
      title: 'text-amber-300',
      rule: 'border-comic-black',
      word: 'KRAKOOM!',
    },
    green: {
      banner: 'bg-comic-green text-white',
      iconBox: 'bg-comic-black text-comic-yellow rounded-lg shadow-comic-sm p-2',
      kicker: 'text-emerald-100',
      title: 'text-white',
      rule: 'border-comic-black',
      word: 'SHIELD UP!',
    },
  },
  text: 'text-comic-black',
  muted: 'text-slate-600',
  emphasis: 'text-comic-red',
  panel: 'bg-white border-[3px] border-comic-black rounded-xl shadow-comic-sm',
  panelHead: 'border-b-2 border-comic-black',
  inset: 'bg-amber-50 border-2 border-comic-black rounded-lg',
  chip: 'bg-comic-black text-comic-yellow border-2 border-comic-black rounded-lg shadow-comic-sm',
  option:
    'bg-white hover:bg-amber-50 active:bg-amber-100 border-[3px] border-comic-black rounded-xl shadow-comic-sm hover:shadow-comic-md',
  optionTitleHover: 'group-hover:text-comic-red',
  tile: 'border-[3px] border-comic-black bg-white hover:bg-amber-50 rounded-xl shadow-comic-sm',
  tileSelected:
    'border-[3px] border-comic-red bg-comic-yellow rounded-xl shadow-comic-sm scale-[1.03]',
  slot: 'border-[3px] border-comic-black bg-white rounded-xl shadow-comic-sm',
  slotFinal: 'border-[3px] border-comic-red ring-2 ring-comic-red/40 bg-red-50/30 rounded-xl',
  slotOver: 'border-comic-blue ring-4 ring-sky-300 scale-[1.02]',
  step: 'bg-comic-yellow text-comic-black border border-comic-black rounded shadow-comic-xs',
  stepFinal: 'bg-comic-red text-white border border-comic-black rounded shadow-comic-xs',
  btnGo:
    'bg-comic-red hover:bg-red-700 text-white border-[3px] border-comic-black rounded-xl shadow-comic hover:shadow-comic-md active:translate-y-0.5 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none',
  btnMove:
    'bg-comic-yellow hover:bg-amber-400 text-comic-black border-2 border-comic-black rounded-lg shadow-comic-xs disabled:opacity-30',
  previewPage: 'bg-comic-black/80',
  fx: {
    words: ['POW!', 'BAM!', 'ZAP!', 'WHAM!'],
    shape: 'star',
    className: 'bg-comic-yellow text-comic-black',
  },
  caption:
    'bg-comic-yellow text-comic-black border-2 border-comic-black shadow-comic-xs px-3 py-1.5 text-xs font-black uppercase tracking-wide',
  bubble:
    "relative bg-white text-comic-black border-[3px] border-comic-black rounded-2xl px-3 py-2 text-sm font-bold before:content-[''] before:absolute before:-left-[12px] before:top-4 before:border-[9px] before:border-transparent before:border-r-comic-black",
  finisher: {
    label: 'FINISHER!',
    star: true,
    className: 'bg-comic-yellow text-comic-red border-2 border-comic-black',
  },
  accent: { edge: 'stripe', name: 'underline' },
};

const storyboard: ModalStyle = {
  id: 'storyboard',
  label: 'Storyboard Panels',
  tagline: 'A comic page: tilted caption box, framed panels, gutters.',
  traits: ['Tilted caption sticker', 'White framed panels', 'Tight square-ish corners'],
  bestFor: 'Multi-step prompts and sequences',
  headerLayout: 'caption',
  overlay: 'bg-comic-black/85 backdrop-blur-sm',
  frame:
    'bg-comic-paper border-4 border-comic-black rounded-lg shadow-[8px_8px_0_0_rgba(0,0,0,1)] font-comic',
  texture: DOTS(14),
  textureClass: 'opacity-15',
  header: '',
  body: 'p-5 space-y-4',
  footer: 'border-t-2 border-comic-black mx-5',
  verbs: {
    yellow: {
      banner: 'bg-comic-yellow text-comic-black',
      iconBox: 'text-comic-black',
      kicker: 'text-comic-red',
      title: 'text-comic-black',
      rule: 'border-comic-black',
      word: 'DECIDE!',
    },
    red: {
      banner: 'bg-comic-red text-white',
      iconBox: 'text-white',
      kicker: 'text-comic-yellow',
      title: 'text-white',
      rule: 'border-comic-black',
      word: 'POW!',
    },
    blue: {
      banner: 'bg-comic-blue text-white',
      iconBox: 'text-white',
      kicker: 'text-comic-yellow',
      title: 'text-white',
      rule: 'border-comic-black',
      word: 'THWIP!',
    },
    purple: {
      banner: 'bg-purple-900 text-amber-300',
      iconBox: 'text-amber-300',
      kicker: 'text-amber-200',
      title: 'text-amber-300',
      rule: 'border-comic-black',
      word: 'KRAKOOM!',
    },
    green: {
      banner: 'bg-comic-green text-white',
      iconBox: 'text-white',
      kicker: 'text-comic-yellow',
      title: 'text-white',
      rule: 'border-comic-black',
      word: 'SHIELD UP!',
    },
  },
  text: 'text-comic-black',
  muted: 'text-slate-700',
  emphasis: 'text-comic-red',
  panel: 'bg-white border-[3px] border-comic-black rounded-md shadow-comic-xs',
  panelHead: 'border-b-2 border-comic-black',
  inset: 'bg-amber-50 border-2 border-comic-black rounded',
  chip: 'bg-comic-black text-comic-yellow border-2 border-comic-black rounded shadow-comic-sm',
  option:
    'bg-white hover:bg-amber-50 border-[3px] border-comic-black rounded-md shadow-comic-xs hover:shadow-comic-sm',
  optionTitleHover: 'group-hover:text-comic-red',
  tile: 'border-[3px] border-comic-black bg-white hover:bg-amber-50 rounded-md shadow-comic-xs',
  tileSelected: 'border-[3px] border-comic-red bg-comic-yellow rounded-md shadow-comic-xs',
  slot: 'border-2 border-comic-black bg-white rounded',
  slotFinal: 'border-2 border-comic-red bg-red-50/30 rounded shadow-comic-xs',
  slotOver: 'border-comic-blue ring-4 ring-sky-300 scale-[1.02]',
  step: 'bg-comic-yellow text-comic-black border border-comic-black rounded',
  stepFinal: 'bg-comic-red text-white border border-comic-black rounded',
  btnGo:
    'bg-comic-red hover:bg-red-700 text-white border-[3px] border-comic-black rounded shadow-comic-sm active:translate-y-0.5 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none',
  btnMove:
    'bg-comic-yellow hover:bg-amber-400 text-comic-black border border-comic-black rounded shadow-xs disabled:opacity-30',
  previewPage: 'bg-comic-black/85',
  fx: {
    words: ['BAM!', 'KAPOW!', 'THWIP!'],
    shape: 'star',
    className: 'bg-white text-comic-red',
  },
  caption:
    'bg-white text-comic-black border-2 border-comic-black shadow-comic-xs px-3 py-1.5 text-xs font-black uppercase tracking-wide -rotate-1',
  bubble:
    "relative bg-white text-comic-black border-2 border-comic-black rounded-[2rem] px-4 py-2.5 text-sm font-bold before:content-[''] before:absolute before:-left-[10px] before:bottom-3 before:border-[8px] before:border-transparent before:border-r-comic-black",
  finisher: {
    label: 'FINISHER!',
    star: true,
    className: 'bg-comic-red text-white border-2 border-comic-black',
  },
  accent: { edge: 'flag', name: 'underline' },
};

const newsprint: ModalStyle = {
  id: 'newsprint',
  label: 'Golden Age Newsprint',
  tagline: 'Aged paper, ink-black print, a masthead for every moment.',
  traits: ['Aged paper + ink brown', 'Hard ink shadow', 'Serif masthead header'],
  bestFor: 'Story beats, information, confirmations',
  headerLayout: 'masthead',
  flavor: 'Vol. 1 · No. 1 · 10¢',
  overlay: 'bg-[#2b2118]/85 backdrop-blur-xs',
  frame:
    'bg-[#f3e7c4] border-[3px] border-[#2b2118] rounded-none shadow-[8px_8px_0_0_#2b2118] font-serif',
  texture: {
    backgroundImage:
      'repeating-linear-gradient(0deg, rgba(43,33,24,0.5) 0 1px, transparent 1px 3px)',
  },
  textureClass: 'opacity-[0.07]',
  header: '',
  body: 'p-5 sm:p-6 space-y-4',
  footer: 'bg-[#ead9a8] border-t-[3px] border-double border-[#2b2118]',
  verbs: {
    yellow: {
      banner: 'bg-[#f3e7c4] text-[#2b2118]',
      iconBox: 'bg-[#2b2118] text-[#f3e7c4] p-1.5',
      kicker: 'text-[#6b5a45]',
      title: 'text-[#2b2118] [text-shadow:2px_2px_0_#f5c518]',
      rule: 'border-[#2b2118]',
      word: 'EXTRA!',
    },
    red: {
      banner: 'bg-[#f3e7c4] text-[#2b2118]',
      iconBox: 'bg-red-700 text-[#f3e7c4] p-1.5',
      kicker: 'text-red-800',
      title: 'text-red-700',
      rule: 'border-red-700',
      word: 'ALARM!',
    },
    blue: {
      banner: 'bg-[#f3e7c4] text-[#2b2118]',
      iconBox: 'bg-blue-800 text-[#f3e7c4] p-1.5',
      kicker: 'text-blue-900',
      title: 'text-blue-800',
      rule: 'border-blue-800',
      word: 'REPORT',
    },
    purple: {
      banner: 'bg-[#f3e7c4] text-[#2b2118]',
      iconBox: 'bg-purple-900 text-[#f3e7c4] p-1.5',
      kicker: 'text-purple-900',
      title: 'text-purple-900',
      rule: 'border-purple-900',
      word: 'SPECIAL',
    },
    green: {
      banner: 'bg-[#f3e7c4] text-[#2b2118]',
      iconBox: 'bg-emerald-800 text-[#f3e7c4] p-1.5',
      kicker: 'text-emerald-900',
      title: 'text-emerald-800',
      rule: 'border-emerald-800',
      word: 'SAFE',
    },
  },
  text: 'text-[#2b2118]',
  muted: 'text-[#6b5a45]',
  emphasis: 'text-red-700',
  panel:
    'bg-[#fbf3d9] border-2 border-[#2b2118] rounded-none shadow-[3px_3px_0_0_rgba(43,33,24,0.85)]',
  panelHead: 'border-b-2 border-double border-[#2b2118]',
  inset: 'bg-[#f3e7c4] border border-dashed border-[#2b2118] rounded-none',
  chip: 'bg-[#2b2118] text-[#f3e7c4] border-2 border-[#2b2118] rounded-none',
  option:
    'bg-[#fbf3d9] hover:bg-[#f7e9b8] border-2 border-[#2b2118] rounded-none shadow-[3px_3px_0_0_rgba(43,33,24,0.85)] hover:shadow-[5px_5px_0_0_rgba(43,33,24,0.85)]',
  optionTitleHover: 'group-hover:text-red-700',
  tile: 'border-2 border-[#2b2118] bg-[#fbf3d9] hover:bg-[#f7e9b8] rounded-none shadow-[3px_3px_0_0_rgba(43,33,24,0.85)]',
  tileSelected:
    'border-2 border-red-700 bg-[#f5c518]/50 rounded-none shadow-[3px_3px_0_0_rgba(43,33,24,0.85)]',
  slot: 'border-2 border-[#2b2118] bg-[#fbf3d9] rounded-none shadow-[3px_3px_0_0_rgba(43,33,24,0.85)]',
  slotFinal:
    'border-2 border-red-700 bg-[#fbf3d9] rounded-none shadow-[3px_3px_0_0_rgba(43,33,24,0.85)] ring-2 ring-red-700/30',
  slotOver: 'border-blue-800 ring-4 ring-blue-300 scale-[1.02]',
  step: 'bg-[#2b2118] text-[#f3e7c4] rounded-none',
  stepFinal: 'bg-red-700 text-[#f3e7c4] rounded-none',
  btnGo:
    'bg-red-700 hover:bg-red-800 text-[#fbf3d9] border-2 border-[#2b2118] rounded-none shadow-[3px_3px_0_0_rgba(43,33,24,0.85)] active:translate-y-0.5 disabled:bg-[#c9bb94] disabled:text-[#6b5a45] disabled:shadow-none uppercase tracking-widest',
  btnMove:
    'bg-[#f3e7c4] hover:bg-[#f7e9b8] text-[#2b2118] border-2 border-[#2b2118] rounded-none disabled:opacity-30',
  previewPage: 'bg-[#2b2118]/85',
  fx: {
    words: ['EXTRA!', 'STOP THE PRESSES!', 'HOT OFF THE PRESS!'],
    shape: 'rect',
    className:
      'bg-[#fbf3d9] text-red-700 border-[3px] border-double border-red-700 shadow-[4px_4px_0_0_rgba(43,33,24,0.85)] uppercase',
  },
  caption: 'bg-[#2b2118] text-[#f3e7c4] px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em]',
  bubble:
    "relative bg-[#fbf3d9] text-[#2b2118] border-2 border-[#2b2118] rounded-none italic px-3 py-2 text-sm before:content-[''] before:absolute before:-left-[12px] before:top-4 before:border-[9px] before:border-transparent before:border-r-[#2b2118]",
  finisher: {
    label: 'FINAL EDITION',
    star: false,
    className: 'bg-red-700 text-[#fbf3d9] border-2 border-[#2b2118] tracking-widest',
  },
  accent: { edge: 'rule', name: 'dot' },
};

const night: ModalStyle = {
  id: 'night',
  label: 'Night Edition',
  tagline: 'Dark ink, neon rule: the cards glow against the black.',
  traits: ['Dark slate frame', 'Neon verb-colour rule + glow', 'Easy on the eyes'],
  bestFor: 'Long sessions, dark-table feel',
  headerLayout: 'bar',
  overlay: 'bg-black/85 backdrop-blur-sm',
  frame:
    'bg-slate-900 border-4 border-yellow-300 rounded-xl shadow-[0_0_0_4px_#000,0_0_44px_rgba(255,222,0,0.28)] font-comic',
  texture: DOTS(14, '#fff'),
  textureClass: 'opacity-[0.04]',
  header: 'border-b-4',
  body: 'p-5 sm:p-6 space-y-4',
  footer: 'bg-slate-950 border-t-4 border-yellow-300/70',
  verbs: {
    yellow: {
      banner: 'bg-slate-950 text-yellow-300',
      iconBox: 'bg-yellow-300 text-black rounded-lg p-2 shadow-[0_0_14px_rgba(255,222,0,0.6)]',
      kicker: 'text-yellow-200/80',
      title: 'text-yellow-300 [text-shadow:0_0_14px_rgba(255,222,0,0.55)]',
      rule: 'border-yellow-300',
      word: 'DECIDE',
    },
    red: {
      banner: 'bg-slate-950 text-red-400',
      iconBox: 'bg-red-500 text-black rounded-lg p-2 shadow-[0_0_14px_rgba(239,68,68,0.7)]',
      kicker: 'text-red-300/80',
      title: 'text-red-400 [text-shadow:0_0_14px_rgba(239,68,68,0.6)]',
      rule: 'border-red-500',
      word: 'THREAT',
    },
    blue: {
      banner: 'bg-slate-950 text-sky-300',
      iconBox: 'bg-sky-400 text-black rounded-lg p-2 shadow-[0_0_14px_rgba(56,189,248,0.7)]',
      kicker: 'text-sky-200/80',
      title: 'text-sky-300 [text-shadow:0_0_14px_rgba(56,189,248,0.6)]',
      rule: 'border-sky-400',
      word: 'INTEL',
    },
    purple: {
      banner: 'bg-slate-950 text-fuchsia-300',
      iconBox: 'bg-fuchsia-400 text-black rounded-lg p-2 shadow-[0_0_14px_rgba(232,121,249,0.7)]',
      kicker: 'text-fuchsia-200/80',
      title: 'text-fuchsia-300 [text-shadow:0_0_14px_rgba(232,121,249,0.6)]',
      rule: 'border-fuchsia-400',
      word: 'SPECIAL',
    },
    green: {
      banner: 'bg-slate-950 text-emerald-300',
      iconBox: 'bg-emerald-400 text-black rounded-lg p-2 shadow-[0_0_14px_rgba(52,211,153,0.7)]',
      kicker: 'text-emerald-200/80',
      title: 'text-emerald-300 [text-shadow:0_0_14px_rgba(52,211,153,0.6)]',
      rule: 'border-emerald-400',
      word: 'SECURE',
    },
  },
  text: 'text-slate-100',
  muted: 'text-slate-400',
  emphasis: 'text-yellow-300',
  panel: 'bg-slate-800 border-[3px] border-slate-600 rounded-xl',
  panelHead: 'border-b-2 border-slate-600',
  inset: 'bg-slate-900 border-2 border-slate-600 rounded-lg',
  chip: 'bg-yellow-300 text-black border-2 border-black rounded-lg',
  option:
    'bg-slate-800 hover:bg-slate-700 border-[3px] border-slate-600 hover:border-yellow-300 rounded-xl hover:shadow-[0_0_16px_rgba(255,222,0,0.3)]',
  optionTitleHover: 'group-hover:text-yellow-300',
  tile: 'border-[3px] border-slate-600 bg-slate-800 hover:bg-slate-700 rounded-xl',
  tileSelected:
    'border-[3px] border-yellow-300 bg-slate-700 rounded-xl shadow-[0_0_20px_rgba(255,222,0,0.45)] scale-[1.03]',
  slot: 'border-[3px] border-slate-600 bg-slate-800 rounded-xl',
  slotFinal:
    'border-[3px] border-red-500 bg-slate-800 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.45)]',
  slotOver: 'border-sky-400 ring-4 ring-sky-400/40 scale-[1.02]',
  step: 'bg-yellow-300 text-black rounded',
  stepFinal: 'bg-red-500 text-black rounded',
  btnGo:
    'bg-yellow-300 hover:bg-yellow-200 text-black border-[3px] border-black rounded-xl shadow-[0_0_18px_rgba(255,222,0,0.5)] active:translate-y-0.5 disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none',
  btnMove:
    'bg-slate-700 hover:bg-slate-600 text-yellow-300 border-2 border-slate-500 rounded-lg disabled:opacity-30',
  previewPage: 'bg-black/85',
  fx: {
    words: ['WHAM!', 'ZAP!', 'BOOM!'],
    shape: 'star',
    className: 'bg-yellow-300 text-black',
  },
  caption:
    'bg-slate-950 text-yellow-300 border-2 border-yellow-300/70 px-3 py-1.5 text-xs font-black uppercase tracking-wide shadow-[0_0_12px_rgba(255,222,0,0.25)]',
  bubble:
    "relative bg-slate-800 text-slate-100 border-[3px] border-yellow-300 rounded-2xl px-3 py-2 text-sm font-bold before:content-[''] before:absolute before:-left-[12px] before:top-4 before:border-[9px] before:border-transparent before:border-r-yellow-300",
  finisher: {
    label: 'FINISHER!',
    star: true,
    className:
      'bg-yellow-300 text-red-600 border-2 border-black shadow-[0_0_14px_rgba(255,222,0,0.7)]',
  },
  accent: { edge: 'glow', name: 'underline' },
};

const splash: ModalStyle = {
  id: 'splash',
  label: 'Splash Page',
  tagline: 'Full-page action: torn-edge banner, speed lines, sound-effect stickers.',
  traits: ['Jagged explosion header', 'Speed-line texture', 'POW / THWIP stickers'],
  bestFor: 'Combat and big moments',
  headerLayout: 'burst',
  overlay: 'bg-comic-black/85 backdrop-blur-sm',
  frame:
    'bg-yellow-50 border-[6px] border-comic-black rounded-3xl shadow-[10px_10px_0_0_#ED1D24,14px_14px_0_0_#111111] font-comic',
  texture: {
    backgroundImage:
      'repeating-conic-gradient(from 0deg at 50% 38%, rgba(237,29,36,0.9) 0deg 4deg, transparent 4deg 12deg)',
  },
  textureClass: 'opacity-[0.07]',
  header: '',
  body: 'p-5 sm:p-6 space-y-4',
  footer: 'bg-white/80 border-t-[6px] border-comic-black',
  verbs: {
    yellow: {
      banner: 'bg-comic-yellow text-comic-black',
      iconBox: 'bg-comic-black text-comic-yellow rounded-full p-2.5 -rotate-6',
      kicker: 'text-comic-red',
      title: 'text-comic-black [text-shadow:3px_3px_0_#fff]',
      rule: 'border-comic-black',
      word: 'DECIDE!',
    },
    red: {
      banner: 'bg-comic-red text-white',
      iconBox: 'bg-comic-yellow text-comic-black rounded-full p-2.5 -rotate-6',
      kicker: 'text-comic-yellow',
      title: 'text-white [text-shadow:3px_3px_0_#111]',
      rule: 'border-comic-black',
      word: 'POW!',
    },
    blue: {
      banner: 'bg-comic-blue text-white',
      iconBox: 'bg-comic-yellow text-comic-black rounded-full p-2.5 -rotate-6',
      kicker: 'text-comic-yellow',
      title: 'text-white [text-shadow:3px_3px_0_#111]',
      rule: 'border-comic-black',
      word: 'THWIP!',
    },
    purple: {
      banner: 'bg-purple-900 text-amber-300',
      iconBox: 'bg-comic-yellow text-comic-black rounded-full p-2.5 -rotate-6',
      kicker: 'text-amber-200',
      title: 'text-amber-300 [text-shadow:3px_3px_0_#111]',
      rule: 'border-comic-black',
      word: 'KRAKOOM!',
    },
    green: {
      banner: 'bg-comic-green text-white',
      iconBox: 'bg-comic-yellow text-comic-black rounded-full p-2.5 -rotate-6',
      kicker: 'text-comic-yellow',
      title: 'text-white [text-shadow:3px_3px_0_#111]',
      rule: 'border-comic-black',
      word: 'SHIELD UP!',
    },
  },
  text: 'text-comic-black',
  muted: 'text-slate-700',
  emphasis: 'text-comic-red',
  panel: 'bg-white border-[4px] border-comic-black rounded-2xl shadow-comic',
  panelHead: 'border-b-[3px] border-comic-black',
  inset: 'bg-yellow-100 border-[3px] border-comic-black rounded-xl',
  chip: 'bg-comic-red text-white border-[3px] border-comic-black rounded-full shadow-comic-sm -rotate-2',
  option:
    'bg-white hover:bg-yellow-100 border-[4px] border-comic-black rounded-2xl shadow-comic hover:shadow-comic-lg hover:-rotate-[0.5deg]',
  optionTitleHover: 'group-hover:text-comic-red',
  tile: 'border-[4px] border-comic-black bg-white hover:bg-yellow-100 rounded-2xl shadow-comic',
  tileSelected:
    'border-[4px] border-comic-red bg-comic-yellow rounded-2xl shadow-comic scale-[1.05] -rotate-1',
  slot: 'border-[4px] border-comic-black bg-white rounded-2xl shadow-comic',
  slotFinal:
    'border-[4px] border-comic-red bg-yellow-50 rounded-2xl shadow-comic ring-4 ring-comic-yellow',
  slotOver: 'border-comic-blue ring-4 ring-sky-300 scale-[1.04]',
  step: 'bg-comic-yellow text-comic-black border-2 border-comic-black rounded-full',
  stepFinal: 'bg-comic-red text-white border-2 border-comic-black rounded-full',
  btnGo:
    'bg-comic-red hover:bg-red-700 text-white border-[4px] border-comic-black rounded-2xl shadow-comic-lg hover:-rotate-1 active:translate-y-1 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none uppercase tracking-wide',
  btnMove:
    'bg-comic-yellow hover:bg-amber-400 text-comic-black border-[3px] border-comic-black rounded-full shadow-comic-sm disabled:opacity-30',
  previewPage: 'bg-comic-black/85',
  fx: {
    words: ['KA-POW!', 'KRAKOOM!', 'BAAAM!', 'SKRAKK!'],
    shape: 'star',
    className: 'bg-comic-red text-white [text-shadow:3px_3px_0_#111]',
  },
  caption:
    'bg-comic-black text-comic-yellow px-4 py-1.5 text-sm font-black uppercase tracking-wide -rotate-1 shadow-[4px_4px_0_0_#ED1D24]',
  bubble:
    "relative bg-white text-comic-black border-[4px] border-comic-black rounded-3xl px-4 py-2.5 text-base font-black before:content-[''] before:absolute before:-left-[16px] before:top-5 before:border-[12px] before:border-transparent before:border-r-comic-black",
  finisher: {
    label: 'FINISHER!',
    star: true,
    className: 'bg-comic-yellow text-comic-red border-[3px] border-comic-black',
  },
  accent: { edge: 'dot', name: 'underline' },
};

const dossier: ModalStyle = {
  id: 'dossier',
  label: 'S.H.I.E.L.D. Dossier',
  tagline: 'A manila case file: typewriter text, rubber stamp, tape corners.',
  traits: ['Manila folder + tab', 'Typewriter type', 'Verb-coloured rubber stamp'],
  bestFor: 'Decisions, searches, rules text',
  headerLayout: 'tab',
  overlay: 'bg-slate-950/85 backdrop-blur-sm',
  frame:
    'bg-[#e9d29a] border-2 border-[#8a6d3b] rounded-md shadow-[6px_8px_0_0_rgba(0,0,0,0.55)] font-mono',
  texture: {
    backgroundImage:
      'repeating-linear-gradient(0deg, rgba(138,109,59,0.8) 0 1px, transparent 1px 22px)',
  },
  textureClass: 'opacity-[0.12]',
  header: '',
  body: 'p-5 sm:p-6 space-y-4',
  footer: 'bg-[#dcc17f] border-t-2 border-dashed border-[#8a6d3b]',
  verbs: {
    yellow: {
      banner: 'bg-[#f1cf5b] text-black',
      iconBox: 'bg-black/85 text-[#f1cf5b] rounded-sm p-1.5',
      kicker: 'text-black/80',
      title: 'text-black',
      rule: 'border-black/60',
      word: 'DECISION',
    },
    red: {
      banner: 'bg-[#b91c1c] text-white',
      iconBox: 'bg-black/85 text-red-200 rounded-sm p-1.5',
      kicker: 'text-red-100',
      title: 'text-white',
      rule: 'border-black/60',
      word: 'THREAT',
    },
    blue: {
      banner: 'bg-[#2b6cb0] text-white',
      iconBox: 'bg-black/85 text-sky-200 rounded-sm p-1.5',
      kicker: 'text-sky-100',
      title: 'text-white',
      rule: 'border-black/60',
      word: 'INTEL',
    },
    purple: {
      banner: 'bg-[#553c9a] text-white',
      iconBox: 'bg-black/85 text-amber-200 rounded-sm p-1.5',
      kicker: 'text-amber-100',
      title: 'text-white',
      rule: 'border-black/60',
      word: 'CLASSIFIED',
    },
    green: {
      banner: 'bg-[#2f855a] text-white',
      iconBox: 'bg-black/85 text-emerald-200 rounded-sm p-1.5',
      kicker: 'text-emerald-100',
      title: 'text-white',
      rule: 'border-black/60',
      word: 'SECURED',
    },
  },
  text: 'text-[#2a2110]',
  muted: 'text-[#6a5628]',
  emphasis: 'text-red-700',
  panel: 'bg-[#fffdf5] border border-[#8a6d3b] rounded-sm shadow-[2px_3px_0_0_rgba(0,0,0,0.25)]',
  panelHead: 'border-b border-dashed border-[#8a6d3b]',
  inset: 'bg-[#f6ecc8] border border-dashed border-[#8a6d3b] rounded-sm',
  chip: 'bg-black text-[#f1cf5b] border border-black rounded-sm tracking-widest',
  option:
    'bg-[#fffdf5] hover:bg-[#fff6d6] border border-[#8a6d3b] rounded-sm shadow-[2px_3px_0_0_rgba(0,0,0,0.25)] hover:shadow-[3px_4px_0_0_rgba(0,0,0,0.35)]',
  optionTitleHover: 'group-hover:text-red-700',
  tile: 'border border-[#8a6d3b] bg-[#fffdf5] hover:bg-[#fff6d6] rounded-sm shadow-[2px_3px_0_0_rgba(0,0,0,0.25)]',
  tileSelected:
    'border-2 border-red-700 bg-[#fff1b8] rounded-sm shadow-[3px_4px_0_0_rgba(0,0,0,0.35)]',
  slot: 'border border-[#8a6d3b] bg-[#fffdf5] rounded-sm shadow-[2px_3px_0_0_rgba(0,0,0,0.25)]',
  slotFinal:
    'border-2 border-red-700 bg-[#fffdf5] rounded-sm shadow-[3px_4px_0_0_rgba(185,28,28,0.45)]',
  slotOver: 'border-[#2b6cb0] ring-4 ring-sky-300 scale-[1.02]',
  step: 'bg-black text-[#f1cf5b] rounded-sm tracking-widest',
  stepFinal: 'bg-red-700 text-white rounded-sm tracking-widest',
  btnGo:
    'bg-red-700 hover:bg-red-800 text-white border-2 border-black rounded-sm uppercase tracking-widest shadow-[3px_3px_0_0_rgba(0,0,0,0.6)] active:translate-y-0.5 disabled:bg-[#c9b57a] disabled:text-[#6a5628] disabled:shadow-none',
  btnMove:
    'bg-[#f1cf5b] hover:bg-[#e6bf3c] text-black border border-black rounded-sm disabled:opacity-30',
  previewPage: 'bg-slate-950/85',
  fx: {
    words: ['APPROVED', 'FILED', 'CONFIRMED'],
    shape: 'rect',
    className:
      'bg-transparent text-red-700 border-[5px] border-double border-red-700 uppercase tracking-[0.25em] opacity-90',
  },
  caption:
    'bg-[#fff3a8] text-[#2a2110] border border-[#8a6d3b] shadow-[2px_3px_0_0_rgba(0,0,0,0.3)] rotate-1 px-3 py-1.5 text-xs font-bold',
  bubble:
    "relative bg-[#fff3a8] text-[#2a2110] border border-[#8a6d3b] rounded-sm shadow-[2px_3px_0_0_rgba(0,0,0,0.3)] rotate-[-0.5deg] px-3 py-2 text-sm before:content-[''] before:absolute before:-left-[10px] before:top-4 before:border-[8px] before:border-transparent before:border-r-[#8a6d3b]",
  finisher: {
    label: 'PRIORITY',
    star: false,
    className:
      'bg-transparent text-red-700 border-[3px] border-double border-red-700 tracking-[0.25em] -rotate-6',
  },
  accent: { edge: 'tab', name: 'marker' },
};

const hudVerb = (hue: string, glow: string, word: string, text: string): VerbTokens => ({
  banner: `bg-[#04101c] ${text}`,
  iconBox: `border border-current rounded-sm p-1.5 ${text}`,
  kicker: `${text} opacity-70`,
  title: `${text} ${glow}`,
  rule: hue,
  word,
});

const hud: ModalStyle = {
  id: 'hud',
  label: 'Hero HUD',
  tagline: 'A holographic heads-up display: scanlines, cyan glow, targeting readouts.',
  traits: ['Scanline hologram', 'Cyan glow + monospace readouts', 'Sharp, square, techy'],
  bestFor: 'Tech heroes, targeting, combat readouts',
  headerLayout: 'bar',
  overlay: 'bg-[#020a14]/90 backdrop-blur-sm',
  frame:
    'bg-[#061726] border-2 border-cyan-400 rounded-sm shadow-[0_0_0_1px_#000,0_0_36px_rgba(34,211,238,0.35),inset_0_0_40px_rgba(34,211,238,0.08)] font-mono',
  texture: {
    backgroundImage:
      'repeating-linear-gradient(0deg, rgba(34,211,238,0.9) 0 1px, transparent 1px 4px)',
  },
  textureClass: 'opacity-[0.06]',
  header: 'border-b-2',
  body: 'p-5 sm:p-6 space-y-4',
  footer: 'bg-[#04101c] border-t-2 border-cyan-400/60',
  verbs: {
    yellow: hudVerb(
      'border-amber-300',
      '[text-shadow:0_0_12px_rgba(252,211,77,0.6)]',
      'ENGAGED',
      'text-amber-300',
    ),
    red: hudVerb(
      'border-red-400',
      '[text-shadow:0_0_12px_rgba(248,113,113,0.6)]',
      'HOSTILE',
      'text-red-400',
    ),
    blue: hudVerb(
      'border-cyan-300',
      '[text-shadow:0_0_12px_rgba(103,232,249,0.6)]',
      'SCANNING',
      'text-cyan-300',
    ),
    purple: hudVerb(
      'border-violet-300',
      '[text-shadow:0_0_12px_rgba(196,181,253,0.6)]',
      'OVERRIDE',
      'text-violet-300',
    ),
    green: hudVerb(
      'border-emerald-300',
      '[text-shadow:0_0_12px_rgba(110,231,183,0.6)]',
      'SHIELDED',
      'text-emerald-300',
    ),
  },
  text: 'text-cyan-50',
  muted: 'text-cyan-200/60',
  emphasis: 'text-amber-300',
  panel: 'bg-[#0a2036]/90 border border-cyan-500/60 rounded-sm',
  panelHead: 'border-b border-cyan-500/40',
  inset: 'bg-[#04101c] border border-dashed border-cyan-500/50 rounded-sm',
  chip: 'bg-cyan-400 text-[#021018] border border-cyan-200 rounded-sm tracking-widest',
  option:
    'bg-[#0a2036]/90 hover:bg-[#0d2a47] border border-cyan-500/60 hover:border-cyan-300 rounded-sm hover:shadow-[0_0_16px_rgba(34,211,238,0.4)]',
  optionTitleHover: 'group-hover:text-cyan-300',
  tile: 'border border-cyan-500/60 bg-[#0a2036]/90 hover:bg-[#0d2a47] rounded-sm',
  tileSelected:
    'border-2 border-cyan-300 bg-[#0d2a47] rounded-sm shadow-[0_0_22px_rgba(34,211,238,0.5)]',
  slot: 'border border-cyan-500/60 bg-[#0a2036]/90 rounded-sm',
  slotFinal:
    'border-2 border-amber-300 bg-[#0a2036]/90 rounded-sm shadow-[0_0_22px_rgba(252,211,77,0.45)]',
  slotOver: 'border-cyan-300 ring-4 ring-cyan-300/40 scale-[1.02]',
  step: 'bg-cyan-400 text-[#021018] rounded-sm tracking-widest',
  stepFinal: 'bg-amber-300 text-[#021018] rounded-sm tracking-widest',
  btnGo:
    'bg-cyan-400 hover:bg-cyan-300 text-[#021018] border border-cyan-100 rounded-sm uppercase tracking-widest shadow-[0_0_18px_rgba(34,211,238,0.6)] active:translate-y-0.5 disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none',
  btnMove:
    'bg-[#0d2a47] hover:bg-[#12385f] text-cyan-300 border border-cyan-500/70 rounded-sm disabled:opacity-30',
  previewPage: 'bg-[#020a14]/90',
  fx: {
    words: ['TARGET LOCKED', 'ENGAGED', 'ACKNOWLEDGED'],
    shape: 'rect',
    className:
      'bg-[#04101c] text-cyan-300 border-2 border-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.7)] uppercase tracking-[0.2em]',
  },
  caption:
    'bg-[#04101c] text-cyan-300 border border-cyan-400/70 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] shadow-[0_0_12px_rgba(34,211,238,0.25)]',
  bubble:
    "relative bg-[#04101c] text-cyan-100 border border-cyan-400 rounded-sm px-3 py-2 text-sm shadow-[0_0_14px_rgba(34,211,238,0.3)] before:content-[''] before:absolute before:-left-[10px] before:top-4 before:border-[8px] before:border-transparent before:border-r-cyan-400",
  finisher: {
    label: 'OVERRIDE',
    star: false,
    className:
      'bg-amber-300 text-[#021018] border border-amber-100 tracking-widest shadow-[0_0_14px_rgba(252,211,77,0.7)] rotate-3',
  },
  accent: { edge: 'bracket', name: 'dot' },
};

export const MODAL_STYLES: readonly ModalStyle[] = [
  popArt,
  storyboard,
  newsprint,
  night,
  splash,
  dossier,
  hud,
];

export const DEFAULT_MODAL_STYLE: ModalStyle = popArt;

export const ALL_THEME_IDS: readonly ModalStyleId[] = MODAL_STYLES.map((s) => s.id);

export const isThemeId = (value: unknown): value is ModalStyleId =>
  typeof value === 'string' && MODAL_STYLES.some((s) => s.id === value);

export const getModalStyle = (id: string | null | undefined): ModalStyle | null =>
  MODAL_STYLES.find((s) => s.id === id) ?? null;
