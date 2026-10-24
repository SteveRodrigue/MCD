/**
 * Fonts the lab can swap in to test how text reads on screen. Downloaded from Google Fonts (SIL Open Font
 * License or Apache 2.0), latin subset, into `fonts/`; the `@font-face` rules are in `lab-fonts.css`.
 * The themes keep their own fonts; a choice here only overrides them while the lab is open.
 */

/** The kinds of font, in the order the picker lists them. Every kind must have at least one font. */
export const FONT_CATEGORIES = [
  'display',
  'typewriter',
  'sans',
  'rounded',
  'comic',
  'serif',
  'mono',
] as const;

export type FontCategory = (typeof FONT_CATEGORIES)[number];

export interface FontChoice {
  id: string;
  label: string;
  /** CSS family name declared in `lab-fonts.css`. */
  family: string;
  category: FontCategory;
  note: string;
  /** Full CSS font-family value, when the font needs fallbacks (default: the family alone). */
  stack?: string;
}

export const FONT_CHOICES: readonly FontChoice[] = [
  {
    id: 'bangers',
    label: 'Bangers',
    family: 'Lab Bangers',
    category: 'display',
    note: 'The original comic headline font (digits in the body font, as in the game)',
    stack: "'Body Digits', 'Lab Bangers', Impact, system-ui, sans-serif",
  },
  {
    id: 'atkinson-hyperlegible',
    label: 'Atkinson Hyperlegible',
    family: 'Lab Atkinson Hyperlegible',
    category: 'sans',
    note: 'Made for low vision',
  },
  {
    id: 'lexend',
    label: 'Lexend',
    family: 'Lab Lexend',
    category: 'sans',
    note: 'Tuned for reading speed',
  },
  {
    id: 'nunito',
    label: 'Nunito',
    family: 'Lab Nunito',
    category: 'rounded',
    note: 'Soft and friendly',
  },
  {
    id: 'fredoka',
    label: 'Fredoka',
    family: 'Lab Fredoka',
    category: 'rounded',
    note: 'Rounded, playful',
  },
  {
    id: 'baloo-2',
    label: 'Baloo 2',
    family: 'Lab Baloo 2',
    category: 'rounded',
    note: 'Rounded, comic feel',
  },
  {
    id: 'comic-neue',
    label: 'Comic Neue',
    family: 'Lab Comic Neue',
    category: 'comic',
    note: 'Cleaner Comic Sans',
  },
  {
    id: 'patrick-hand',
    label: 'Patrick Hand',
    family: 'Lab Patrick Hand',
    category: 'comic',
    note: 'Hand lettered',
  },
  { id: 'kalam', label: 'Kalam', family: 'Lab Kalam', category: 'comic', note: 'Handwriting' },
  { id: 'inter', label: 'Inter', family: 'Lab Inter', category: 'sans', note: 'Current body font' },
  {
    id: 'open-sans',
    label: 'Open Sans',
    family: 'Lab Open Sans',
    category: 'sans',
    note: 'Neutral workhorse',
  },
  {
    id: 'roboto',
    label: 'Roboto',
    family: 'Lab Roboto',
    category: 'sans',
    note: 'Familiar UI font',
  },
  {
    id: 'source-sans-3',
    label: 'Source Sans 3',
    family: 'Lab Source Sans 3',
    category: 'sans',
    note: 'Compact, clear',
  },
  {
    id: 'ibm-plex-sans',
    label: 'IBM Plex Sans',
    family: 'Lab IBM Plex Sans',
    category: 'sans',
    note: 'Engineered, crisp',
  },
  {
    id: 'fira-sans',
    label: 'Fira Sans',
    family: 'Lab Fira Sans',
    category: 'sans',
    note: 'Open, sturdy',
  },
  {
    id: 'work-sans',
    label: 'Work Sans',
    family: 'Lab Work Sans',
    category: 'sans',
    note: 'Wide, screen tuned',
  },
  { id: 'lato', label: 'Lato', family: 'Lab Lato', category: 'sans', note: 'Warm and clear' },
  {
    id: 'poppins',
    label: 'Poppins',
    family: 'Lab Poppins',
    category: 'sans',
    note: 'Geometric, bold',
  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    family: 'Lab Merriweather',
    category: 'serif',
    note: 'Sturdy screen serif',
  },
  {
    id: 'literata',
    label: 'Literata',
    family: 'Lab Literata',
    category: 'serif',
    note: 'Made for long reading',
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    family: 'Lab JetBrains Mono',
    category: 'mono',
    note: 'Clear monospace',
  },
  {
    id: 'lilita-one',
    label: 'Lilita One',
    family: 'Lab Lilita One',
    category: 'display',
    note: 'Bold comic, rounder and clearer than Bangers',
  },
  {
    id: 'luckiest-guy',
    label: 'Luckiest Guy',
    family: 'Lab Luckiest Guy',
    category: 'display',
    note: 'Wide comic caps, very readable',
  },
  {
    id: 'boogaloo',
    label: 'Boogaloo',
    family: 'Lab Boogaloo',
    category: 'display',
    note: 'Friendly comic, lowercase works',
  },
  {
    id: 'passion-one',
    label: 'Passion One',
    family: 'Lab Passion One',
    category: 'display',
    note: 'Heavy condensed, like Bangers',
  },
  {
    id: 'titan-one',
    label: 'Titan One',
    family: 'Lab Titan One',
    category: 'display',
    note: 'Chunky rounded display',
  },
  {
    id: 'sigmar-one',
    label: 'Sigmar One',
    family: 'Lab Sigmar One',
    category: 'display',
    note: 'Bold, punchy, open shapes',
  },
  {
    id: 'special-elite',
    label: 'Special Elite',
    family: 'Lab Special Elite',
    category: 'typewriter',
    note: 'Distressed ink-ribbon typewriter',
  },
  {
    id: 'courier-prime',
    label: 'Courier Prime',
    family: 'Lab Courier Prime',
    category: 'typewriter',
    note: 'Clean Courier, built for reading',
  },
  {
    id: 'cutive-mono',
    label: 'Cutive Mono',
    family: 'Lab Cutive Mono',
    category: 'typewriter',
    note: 'Light, elegant typewriter',
  },
  {
    id: 'xanh-mono',
    label: 'Xanh Mono',
    family: 'Lab Xanh Mono',
    category: 'typewriter',
    note: 'Old-style typewriter serifs',
  },
  {
    id: 'anonymous-pro',
    label: 'Anonymous Pro',
    family: 'Lab Anonymous Pro',
    category: 'typewriter',
    note: 'Sturdy teletype-like mono',
  },
  {
    id: 'bowlby-one',
    label: 'Bowlby One',
    family: 'Lab Bowlby One',
    category: 'display',
    note: 'Fat poster face, classic pop-art feel',
  },
  {
    id: 'bungee',
    label: 'Bungee',
    family: 'Lab Bungee',
    category: 'display',
    note: 'Blocky signage caps',
  },
];
