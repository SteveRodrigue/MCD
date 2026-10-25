import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
// @ts-expect-error plain JS config has no type declarations
import tailwindConfig from '../../tailwind.config.js';
import { MODAL_STYLES, newspaperFontVars, themeFontVars } from '../../src/ui/theme/modal-styles';
import { FONT_CATEGORIES, FONT_CHOICES } from '../../src/ui/components/templates/lab-font-list';
import { familyName } from '../../tools/audit/fonts-record';

/**
 * Phase 4 of the fonts plan: guards that keep the font system from drifting. They fail when a theme
 * names a font family or a font utility outside the roles, when the lab's font list, stylesheet and
 * files fall out of step, or when the CSS variables, Tailwind and the defaults stop agreeing.
 */

const REPO = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(REPO, file), 'utf8');

const listFiles = (dir: string, extensions: readonly string[]): string[] =>
  fs
    .readdirSync(path.join(REPO, dir), { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && extensions.some((x) => e.name.endsWith(x)))
    .map((e) => path.relative(REPO, path.join(e.parentPath, e.name)).replace(/\\/g, '/'));

/** Source without comments, so a font utility named in prose is not counted. */
const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const WEIGHTS = new Set([
  'thin',
  'extralight',
  'light',
  'normal',
  'medium',
  'semibold',
  'bold',
  'extrabold',
  'black',
]);

/** The only font-family utilities a theme may name: the roles. Weights (`font-black`) are not families. */
const ROLE_UTILITIES = new Set(['comic', 'body', 'mono', 'news-headline', 'news-body']);

/** Font utilities in a source, not counting CSS variables (`--font-comic`) or weights. */
const fontUtilities = (source: string): string[] =>
  [...stripComments(source).matchAll(/(?<![-\w])font-(\[[^\]]+\]|[a-z][a-z0-9-]*)/g)]
    .map((m) => m[1])
    .filter((name) => !WEIGHTS.has(name));

describe('font guard: themes name only the font roles', () => {
  const themeFiles = [
    ...listFiles('src/ui/theme', ['.ts', '.tsx']),
    ...listFiles('src/ui/components/templates/kits', ['.tsx']),
  ];

  it('scans the theme layer and the lab kits', () => {
    expect(themeFiles).toContain('src/ui/theme/modal-styles.ts');
    expect(themeFiles).toContain('src/ui/theme/theme-extras.ts');
    expect(themeFiles.some((f) => f.includes('/kits/'))).toBe(true);
  });

  it.each(themeFiles)('%s uses only role utilities, never a family or font-serif', (file) => {
    const offenders = fontUtilities(read(file)).filter((name) => !ROLE_UTILITIES.has(name));
    expect(offenders, `${file} names a font outside the roles`).toEqual([]);
  });

  it('never sets a font family inline in the theme layer', () => {
    for (const file of themeFiles) {
      const code = stripComments(read(file));
      expect(code, `${file} sets fontFamily inline`).not.toMatch(/fontFamily\s*:/);
    }
  });

  it('sizes text only with the size tokens: no arbitrary pixel size under 17px, so the theme size change reaches it', () => {
    const themedFiles = [
      ...themeFiles,
      ...listFiles('src/ui/components/board', ['Modal.tsx']).filter(
        (f) => !f.endsWith('ReportProblemModal.tsx'),
      ),
      'src/ui/components/board/OptionsMenu.tsx',
      'src/ui/components/board/ActionRow.tsx',
      'src/ui/components/board/PromptCardPanel.tsx',
      'src/ui/components/board/GameOverScreen.tsx',
      'src/ui/components/board/RemovedFromGameBox.tsx',
      'src/ui/components/cards/CardStatsModal.tsx',
      'src/ui/components/board/DailyBugleActionNewspaper.tsx',
      'src/ui/components/board/TopBar.tsx',
      'src/ui/components/board/GameBoard.tsx',
    ];
    for (const file of themedFiles) {
      const tiny = [...stripComments(read(file)).matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)]
        .map((m) => ({ match: m[0], px: Number(m[1]) }))
        .filter((m) => m.px < 17)
        .map((m) => m.match);
      expect(
        tiny,
        `${file} uses a fixed pixel size; use text-nano, text-micro or text-mini`,
      ).toEqual([]);
    }
  });

  it('keeps the Newspaper roles inside the newspaper tokens and components', () => {
    const allowed = new Set([
      'src/ui/theme/theme-extras.ts',
      'src/ui/theme/kit/newspaper.tsx',
      'src/ui/components/templates/kits/NewspaperKit.tsx',
    ]);
    for (const file of themeFiles) {
      const usesNews = fontUtilities(read(file)).some((n) => n.startsWith('news-'));
      if (usesNews) expect(allowed.has(file), `${file} uses a newspaper font role`).toBe(true);
    }
  });
});

describe('font guard: small text is Body, not Headlines (fonts plan N2)', () => {
  /** The themed modals, newspapers, theme layer, kits and setup screens (batches 1 to 3). Each batch adds its files here; the last one covers the whole UI. */
  const BATCH_FILES = [
    ...listFiles('src/ui/components/board', ['Modal.tsx', 'Screen.tsx']),
    'src/ui/components/board/ActionRow.tsx',
    'src/ui/components/board/OptionsMenu.tsx',
    'src/ui/components/board/PromptCardPanel.tsx',
    'src/ui/components/board/RemovedFromGameBox.tsx',
    'src/ui/components/board/DailyBugleActionNewspaper.tsx',
    'src/ui/components/cards/CardStatsModal.tsx',
    'src/ui/components/cards/ResetCardStatsConfirmModal.tsx',
    ...listFiles('src/ui/theme', ['.ts', '.tsx']),
    ...listFiles('src/ui/components/templates/kits', ['.tsx']),
    ...listFiles('src/ui/components/setup', ['.tsx']),
  ];

  const SMALL = /(?<![\w:-])text-(xs|sm|nano|micro|mini)(?![\w-])/;
  const BIG = /(?<![\w-])(?:[a-z]+:)?text-(base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)(?![\w-])/;

  /** The run of classes around each font-comic: the text between the quotes, backticks and template holes. */
  const runsAroundFontComic = (source: string): string[] =>
    stripComments(source)
      .split('\n')
      .flatMap((line) =>
        line.split(/["'`]|\$\{|\}/).filter((part) => /(?<![-\w])font-comic(?![-\w])/.test(part)),
      );

  const BIG_PLAIN = /(?<![\w:-])text-(base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)(?![\w-])/;
  const FAMILY = /(?<![-\w])font-(comic|body|mono|news-headline|news-body|bangers|sans)(?![-\w])/;

  /** Classes of a className, split at quotes, backticks and template holes, one run per piece. */
  const runs = (source: string): string[] =>
    stripComments(source)
      .split('\n')
      .flatMap((line) => (line.includes('titleEl(') ? [] : line.split(/["'`]|\$\{|\}/)));

  it('scans the themed modals and the newspapers', () => {
    expect(BATCH_FILES.length).toBeGreaterThan(20);
    expect(BATCH_FILES).toContain('src/ui/components/board/DecisionPromptModal.tsx');
  });

  it.each(BATCH_FILES)('%s keeps Headlines (font-comic) for headline-size text only', (file) => {
    const offenders = runsAroundFontComic(read(file)).filter(
      (run) => SMALL.test(run) && !BIG.test(run),
    );
    expect(offenders, `${file} uses the Headlines font on small text; use the Body font`).toEqual(
      [],
    );
  });

  it.each(BATCH_FILES)(
    '%s names the Headlines font on its headline-size text (text-base and up)',
    (file) => {
      const offenders = runs(read(file)).filter((run) => BIG_PLAIN.test(run) && !FAMILY.test(run));
      expect(
        offenders.map((run) => run.trim().slice(0, 80)),
        `${file} has headline-size text with no font role; add font-comic (or font-body for prose)`,
      ).toEqual([]);
    },
  );

  it('uses the Newspaper roles, not the theme Headlines, inside the two newspaper surfaces', () => {
    for (const file of [
      'src/ui/components/board/DailyBugleActionNewspaper.tsx',
      'src/ui/components/board/EndTurnConfirmationModal.tsx',
    ]) {
      expect(stripComments(read(file)), file).not.toMatch(/(?<![-\w])font-comic(?![-\w])/);
    }
  });
});

describe('font guard: no direct serif font', () => {
  it('names no font-serif anywhere in the UI: a newspaper uses the Newspaper roles', () => {
    for (const file of listFiles('src/ui', ['.ts', '.tsx', '.css'])) {
      expect(stripComments(read(file)).match(/(?<![-\w])font-serif(?![-\w])/), file).toBeNull();
    }
  });
});

describe('font guard: the combat log follows the theme, with no font setting of its own', () => {
  const LOG_FONTS =
    /(?<![-\w])font-(komika|comic-relief|comic-neue|clean|dialogue)(?![-\w])|Komika/g;

  it('names no combat log font family, preset or storage key anywhere in the UI', () => {
    for (const file of listFiles('src/ui', ['.ts', '.tsx', '.css'])) {
      const code = stripComments(read(file));
      expect(code.match(LOG_FONTS), `${file} names a combat log font`).toBeNull();
      expect(code, `${file} reads the old log font setting`).not.toContain('mcd_combat_log_font');
      expect(code, `${file} reads the old log presets`).not.toContain('combat-log-presets');
    }
    expect(fs.existsSync(path.join(REPO, 'src/ui/components/board/combat-log-presets.ts'))).toBe(
      false,
    );
  });

  it('has no Komika font file or face left, and no dialogue family in Tailwind', () => {
    expect(fs.existsSync(path.join(REPO, 'public/fonts'))).toBe(false);
    expect(Object.keys(tailwindConfig.theme.extend.fontFamily)).not.toContain('dialogue');
  });
});

describe('font guard: the card editor stays out of the themes', () => {
  const editorFiles = listFiles('src/ui/components/editor', ['.ts', '.tsx']);

  it('scans the editor', () => {
    expect(editorFiles.length).toBeGreaterThan(10);
  });

  it('names no theme-only font role or text size, which exist only inside a themed screen', () => {
    for (const file of editorFiles) {
      const code = stripComments(read(file));
      const themeOnly = [
        ...code.matchAll(/(?<![-\w])(font-body|font-news-[a-z]+|text-(?:nano|micro|mini))\b/g),
      ].map((m) => m[1]);
      expect(themeOnly, `${file} uses a theme-only role`).toEqual([]);
    }
  });

  it('is not inside the themed root: App passes the stage, and only game stages are themed', () => {
    expect(read('src/ui/App.tsx')).toContain('active={isGameStage(stage)}');
  });
});

describe('font guard: the lab font list, stylesheet and files stay in step', () => {
  const css = read('src/ui/components/templates/lab-fonts.css');
  const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => {
    const body = m[1];
    return {
      family: /font-family:\s*'([^']+)'/.exec(body)![1],
      src: /url\('([^']+)'\)/.exec(body)![1],
      weight: /font-weight:\s*([^;]+);/.exec(body)![1].trim(),
    };
  });

  it('has unique ids, labels and families, all in the Lab namespace', () => {
    for (const key of ['id', 'label', 'family'] as const) {
      const values = FONT_CHOICES.map((f) => f[key]);
      expect(new Set(values).size, `duplicate ${key}`).toBe(values.length);
    }
    expect(FONT_CHOICES.every((f) => f.family.startsWith('Lab '))).toBe(true);
  });

  it('puts every font in a known kind, and every kind has at least one font', () => {
    for (const font of FONT_CHOICES) {
      expect(FONT_CATEGORIES as readonly string[], font.label).toContain(font.category);
    }
    for (const category of FONT_CATEGORIES) {
      expect(
        FONT_CHOICES.some((f) => f.category === category),
        `no font of kind ${category}`,
      ).toBe(true);
    }
  });

  it('declares a font-face for every font, and no font-face without a font', () => {
    const declared = new Set(faces.map((f) => f.family));
    for (const font of FONT_CHOICES) expect(declared.has(font.family), font.label).toBe(true);
    const known = new Set(FONT_CHOICES.map((f) => f.family));
    for (const family of declared)
      expect(known.has(family), `orphan font-face ${family}`).toBe(true);
  });

  it('gives every font a regular weight', () => {
    for (const font of FONT_CHOICES) {
      const mine = faces.filter((f) => f.family === font.family);
      const regular = mine.some((f) => {
        const [low, high = low] = f.weight.split(/\s+/).map(Number);
        return low <= 400 && high >= 400;
      });
      expect(regular, `${font.label} has no regular face`).toBe(true);
    }
  });

  it('points every font-face at a file that exists, and leaves no unused file in fonts/', () => {
    const localFiles = faces.filter((f) => f.src.startsWith('./fonts/')).map((f) => f.src.slice(8));
    for (const file of localFiles) {
      expect(
        fs.existsSync(path.join(REPO, 'src/ui/components/templates/fonts', file)),
        `${file} is missing`,
      ).toBe(true);
    }
    const onDisk = fs.readdirSync(path.join(REPO, 'src/ui/components/templates/fonts'));
    for (const file of onDisk) {
      expect(localFiles, `${file} is not used by lab-fonts.css`).toContain(file);
    }
    for (const face of faces.filter((f) => f.src.startsWith('@fontsource/'))) {
      expect(
        fs.existsSync(path.join(REPO, 'node_modules', face.src)),
        `${face.src} is not installed`,
      ).toBe(true);
    }
  });

  it('keeps a given stack on its own font, as the first family it names', () => {
    for (const font of FONT_CHOICES.filter((f) => f.stack)) {
      expect(font.stack, font.label).toContain(`'${font.family}'`);
    }
  });

  it('can test every font the themes use', () => {
    const labFamilies = new Set(FONT_CHOICES.map((f) => f.label));
    const system = new Set(['system serif', 'system monospace', 'system sans']);
    for (const style of MODAL_STYLES) {
      const stacks = [
        style.fonts.headline,
        style.fonts.body,
        style.fonts.newspaper?.headline,
        style.fonts.newspaper?.body,
        style.fonts.numbers,
      ].filter((s): s is string => Boolean(s));
      for (const stack of stacks) {
        const name = familyName(stack);
        if (system.has(name)) continue;
        expect(labFamilies.has(name), `${style.label}: ${name} is not in the lab font list`).toBe(
          true,
        );
      }
    }
  });
});

describe('font guard: the variables, Tailwind and the CSS defaults agree', () => {
  const css = read('src/ui/styles/index.css');
  const families = tailwindConfig.theme.extend.fontFamily as Record<string, string[]>;
  const root = /:root\s*\{([^}]*)\}/.exec(css)![1];
  const sizes = tailwindConfig.theme.extend.fontSize as Record<string, string | [string, object]>;

  /** Variables a Tailwind family reads without a fallback: the CSS must define them at :root. */
  const required = Object.values(families)
    .flat()
    .map((v) => /^var\((--[a-z-]+)\)$/.exec(v)?.[1])
    .filter((v): v is string => Boolean(v));

  it('defines at :root every variable a font utility reads without a fallback', () => {
    expect(required.length).toBeGreaterThan(0);
    for (const variable of required) {
      expect(root, `${variable} has no default at :root`).toContain(`${variable}:`);
    }
  });

  it('gives each newspaper role a fallback to the theme role, so it follows the theme when unset', () => {
    expect(families['news-headline']).toEqual(['var(--font-news-headline, var(--font-comic))']);
    expect(families['news-body']).toEqual(['var(--font-news-body, var(--font-body))']);
  });

  it('only sets variables that Tailwind or the stylesheet read', () => {
    const readByTailwind = new Set([
      ...Object.values(families)
        .flat()
        .flatMap((v) => [...v.matchAll(/var\((--[a-z-]+)/g)].map((m) => m[1])),
      ...[...JSON.stringify(sizes).matchAll(/var\((--[a-z-]+)/g)].map((m) => m[1]),
      ...[...css.matchAll(/var\((--text-[a-z-]+)/g)].map((m) => m[1]),
    ]);
    for (const style of MODAL_STYLES) {
      const vars = [...Object.keys(themeFontVars(style)), ...Object.keys(newspaperFontVars(style))];
      for (const variable of vars) {
        expect(
          readByTailwind.has(variable),
          `${style.label} sets ${variable}, nothing reads it`,
        ).toBe(true);
      }
    }
  });

  it('only defines font variables at :root that something uses', () => {
    const defined = [...root.matchAll(/(--font-[a-z-]+):/g)].map((m) => m[1]);
    const readByTailwind = new Set(
      Object.values(families)
        .flat()
        .flatMap((v) => [...v.matchAll(/var\((--[a-z-]+)/g)].map((m) => m[1])),
    );
    for (const variable of defined) {
      expect(readByTailwind.has(variable), `${variable} is defined and never read`).toBe(true);
    }
  });

  it('names exactly the role utilities in Tailwind that the themes are allowed to use', () => {
    const roleFamilies = Object.keys(families).filter((k) => ROLE_UTILITIES.has(k));
    expect(roleFamilies.sort()).toEqual([...ROLE_UTILITIES].sort());
  });
});
