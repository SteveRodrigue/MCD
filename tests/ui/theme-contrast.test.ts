import { describe, it, expect } from 'vitest';
import { MODAL_STYLES, VERB_COLORS, type ModalStyle } from '../../src/ui/theme/modal-styles';
import { THEME_EXTRAS } from '../../src/ui/theme/theme-extras';

/**
 * WCAG 2.x contrast guard for every theme. Colours are read from the Tailwind classes in the theme
 * tokens, so a token that sets a light background without a readable text colour fails here instead
 * of on screen. Translucent colours are blended over the surface they sit on.
 */

const MIN_RATIO = 4.5;
/** Bold display labels (titles, banners, buttons, stamps) count as WCAG large text. */
const MIN_RATIO_DISPLAY = 3;
const DISPLAY =
  /title|banner text|icon|finisher|fx|chip|step|btn|danger|newspaper (flash|section|ticker|pill)/;
const minRatio = (name: string): number => (DISPLAY.test(name) ? MIN_RATIO_DISPLAY : MIN_RATIO);

type Rgb = [number, number, number];

const SHADES = (spec: string): Record<string, string> =>
  Object.fromEntries(spec.split(' ').map((entry) => entry.split(':') as [string, string]));

const PALETTE: Record<string, Record<string, string>> = {
  slate: SHADES(
    '50:f8fafc 100:f1f5f9 200:e2e8f0 300:cbd5e1 400:94a3b8 500:64748b 600:475569 700:334155 800:1e293b 900:0f172a 950:020617',
  ),
  red: SHADES(
    '50:fef2f2 100:fee2e2 200:fecaca 300:fca5a5 400:f87171 500:ef4444 600:dc2626 700:b91c1c 800:991b1b 900:7f1d1d',
  ),
  green: SHADES('700:15803d'),
  amber: SHADES('50:fffbeb 100:fef3c7 200:fde68a 300:fcd34d 400:fbbf24'),
  yellow: SHADES('50:fefce8 100:fef9c3 200:fef08a 300:fde047'),
  sky: SHADES('100:e0f2fe 200:bae6fd 300:7dd3fc 400:38bdf8 700:0369a1'),
  emerald: SHADES(
    '100:d1fae5 200:a7f3d0 300:6ee7b7 400:34d399 500:10b981 600:059669 700:047857 800:065f46 900:064e3b',
  ),
  purple: SHADES('900:581c87'),
  blue: SHADES('800:1e40af 900:1e3a8a'),
  fuchsia: SHADES('200:f5d0fe 300:f0abfc 400:e879f9'),
  cyan: SHADES('50:ecfeff 100:cffafe 200:a5f3fc 300:67e8f9 400:22d3ee 500:06b6d4'),
  violet: SHADES('300:c4b5fd'),
};

const NAMED: Record<string, string> = {
  white: 'ffffff',
  black: '000000',
  'comic-yellow': 'FFDE00',
  'comic-red': 'ED1D24',
  'comic-blue': '0284C7',
  'comic-green': '16A34A',
  'comic-black': '111111',
  'comic-paper': 'FBF8EE',
};

const hexToRgb = (hex: string): Rgb =>
  [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

const blend = (fg: Rgb, bg: Rgb, alpha: number): Rgb =>
  fg.map((v, i) => v * alpha + bg[i] * (1 - alpha)) as Rgb;

const luminance = (rgb: Rgb): number => {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const COLOR_NAME = /^(?:\[#([0-9a-fA-F]{6})\]|([a-z]+(?:-[a-zA-Z]+)?(?:-\d+)?))(?:\/(\d+))?$/;

interface Paint {
  rgb: Rgb;
  alpha: number;
}

/** The colour a `text-*` or `bg-*` utility paints, or null when the string sets none. Variants are ignored. */
const paintOf = (classes: string, prefix: 'text' | 'bg'): Paint | null => {
  const tokens = classes.split(/\s+/);
  const opacity = tokens.find((t) => /^opacity-\d+$/.test(t));
  const textOpacity = prefix === 'text' && opacity ? Number(opacity.slice(8)) / 100 : 1;
  for (const token of tokens) {
    if (!token.startsWith(`${prefix}-`)) continue;
    const match = COLOR_NAME.exec(token.slice(prefix.length + 1));
    if (!match) continue;
    const [, hex, name, alpha] = match;
    const [hue, shade] = (name ?? '').split(/-(?=\d+$)/);
    const value = hex ?? NAMED[name ?? ''] ?? PALETTE[hue]?.[shade];
    if (value)
      return { rgb: hexToRgb(value), alpha: (alpha ? Number(alpha) / 100 : 1) * textOpacity };
  }
  return null;
};

const solid = (paint: Paint, under: Rgb): Rgb => blend(paint.rgb, under, paint.alpha);

const must = (classes: string, prefix: 'text' | 'bg', where: string): Paint => {
  const paint = paintOf(classes, prefix);
  if (!paint) throw new Error(`No ${prefix} colour in "${classes}" (${where})`);
  return paint;
};

const check = (
  name: string,
  fgClasses: string,
  bgClasses: string,
  underClasses: string,
): [string, Rgb, Rgb] => {
  const under = solid(must(underClasses, 'bg', `${name} surface`), [255, 255, 255]);
  const bg = solid(must(bgClasses, 'bg', `${name} background`), under);
  const fg = solid(must(fgClasses, 'text', `${name} text`), bg);
  return [name, fg, bg];
};

const pairsOf = (style: ModalStyle): Array<[string, Rgb, Rgb]> => {
  const extras = THEME_EXTRAS[style.id];
  const { table } = extras;
  const { frame } = style;
  const out: Array<[string, Rgb, Rgb]> = [];
  const on = (name: string, fg: string, bg: string, under = frame) =>
    out.push(check(name, fg, bg, under));

  // Page text on the surfaces of a modal.
  const modalSurfaces: Record<string, string> = {
    frame,
    footer: paintOf(style.footer, 'bg') ? style.footer : frame,
    panel: style.panel,
    inset: style.inset,
  };
  for (const [surface, bg] of Object.entries(modalSurfaces)) {
    for (const role of ['text', 'muted', 'emphasis'] as const) {
      on(`${role} on ${surface}`, style[role], bg);
    }
  }

  // Paper tokens carry their own text colour, or inherit the table's on the board and the modal's in a modal.
  const paper = {
    option: style.option,
    tile: style.tile,
    tileSelected: style.tileSelected,
    slot: style.slot,
    slotFinal: style.slotFinal,
  };
  for (const [token, classes] of Object.entries(paper)) {
    on(`${token} text in a modal`, paintOf(classes, 'text') ? classes : style.text, classes);
    on(
      `${token} text on the table`,
      paintOf(classes, 'text') ? classes : table.text,
      classes,
      table.bg,
    );
  }

  // The table.
  for (const role of ['text', 'muted', 'emphasis'] as const) {
    on(`table ${role}`, table[role], table.bg, table.bg);
  }

  // Tokens that carry both colours.
  const own: Record<string, string> = {
    chip: style.chip,
    step: style.step,
    stepFinal: style.stepFinal,
    btnGo: style.btnGo,
    btnMove: style.btnMove,
    caption: style.caption,
    bubble: style.bubble,
    danger: extras.danger,
    field: extras.field,
  };
  for (const [token, classes] of Object.entries(own)) on(token, classes, classes);
  for (const [token, classes] of [
    ['finisher', style.finisher.className],
    ['fx', style.fx.className],
  ] as const) {
    if (paintOf(classes, 'bg')) on(token, classes, classes);
    else on(`${token} on frame`, classes, frame);
  }

  // Verb headers.
  for (const verb of VERB_COLORS) {
    const tokens = style.verbs[verb];
    on(`${verb} title`, tokens.title, tokens.banner);
    on(`${verb} kicker`, tokens.kicker, tokens.banner);
    on(`${verb} banner text`, tokens.banner, tokens.banner);
    on(
      `${verb} icon`,
      tokens.iconBox,
      paintOf(tokens.iconBox, 'bg') ? tokens.iconBox : tokens.banner,
      tokens.banner,
    );
  }

  // Newspaper pieces draw on the sheet: a piece without its own colour takes the sheet's.
  const news = extras.newspaper;
  const sheet = news.sheet;
  on('newspaper sheet', sheet, sheet);
  for (const token of [
    'byline',
    'flash',
    'section',
    'ticker',
    'pill',
    'pillActive',
    'story',
    'quote',
    'classified',
  ] as const) {
    on(`newspaper ${token}`, `${news[token]} ${sheet}`, `${news[token]} ${sheet}`, sheet);
  }
  return out;
};

describe.each(MODAL_STYLES.map((style) => [style.id, style] as const))(
  '%s theme contrast',
  (_id, style) => {
    it.each(pairsOf(style).map(([name, fg, bg]) => [name, ratio(fg, bg), minRatio(name)] as const))(
      '%s meets its minimum contrast',
      (_name, contrast, min) => {
        expect(contrast).toBeGreaterThanOrEqual(min);
      },
    );
  },
);
