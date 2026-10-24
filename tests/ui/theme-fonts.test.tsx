import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModalScaffold } from '../../src/ui/theme/ModalScaffold';
import { ModalStyleProvider } from '../../src/ui/theme/ModalStyleContext';
import { ThemePreview } from '../../src/ui/theme/ThemePreview';
import { NewspaperSheet } from '../../src/ui/theme/kit/newspaper';
import { ThemedTable } from '../../src/ui/theme/kit/surfaces';
import {
  MODAL_STYLES,
  getModalStyle,
  newspaperFontVars,
  themeFontVars,
} from '../../src/ui/theme/modal-styles';

const storyboard = getModalStyle('storyboard')!;
const popArt = getModalStyle('pop-art')!;

describe('theme fonts: the default pair (headlines + body)', () => {
  it('every theme sets its headline font; the pair is Pop-Art Lilita One, Storyboard Kalam, Newsprint Merriweather, Night JetBrains Mono, Splash Boogaloo, Dossier Special Elite, HUD Lexend', () => {
    const headlineOf = (id: Parameters<typeof getModalStyle>[0]) => getModalStyle(id)!.fonts;
    expect(headlineOf('pop-art').headline).toMatch(/^'Lilita One'/);
    expect(headlineOf('storyboard').headline).toMatch(/^'Kalam'/);
    expect(headlineOf('newsprint').headline).toMatch(/^'Merriweather'/);
    expect(headlineOf('night').headline).toMatch(/^'JetBrains Mono'/);
    expect(headlineOf('splash').headline).toMatch(/^'Boogaloo'/);
    expect(headlineOf('dossier').headline).toMatch(/^'Special Elite'/);
    expect(headlineOf('hud').headline).toMatch(/^'Lexend'/);
    for (const style of MODAL_STYLES) expect(style.fonts.headline, style.label).toBeTruthy();
  });

  it('every theme sets a body font, and it is the same as its headlines (Pop-Art keeps Lilita One for small text)', () => {
    for (const style of MODAL_STYLES) expect(style.fonts.body, style.label).toBeTruthy();
    for (const style of MODAL_STYLES) {
      expect(style.fonts.body, style.label).toBe(style.fonts.headline);
    }
    expect(popArt.fonts.body).toMatch(/^'Lilita One'/);
    expect(themeFontVars(popArt)['--font-body' as keyof ReturnType<typeof themeFontVars>]).toMatch(
      /^'Lilita One'/,
    );
  });

  it('has no Serif role any more: the newspaper typeface is the Newspaper pair', () => {
    for (const style of MODAL_STYLES) {
      expect(Object.keys(style.fonts), style.label).not.toContain('serif');
      expect(Object.keys(style.fonts), style.label).not.toContain('mono');
      expect(themeFontVars(style)).not.toHaveProperty('--font-serif');
      expect(themeFontVars(style)).not.toHaveProperty('--font-mono');
    }
    const themeTokens = readFileSync('src/ui/theme/theme-extras.ts', 'utf8');
    const styleTokens = readFileSync('src/ui/theme/modal-styles.ts', 'utf8');
    expect(themeTokens).not.toMatch(/font-serif/);
    expect(styleTokens).not.toMatch(/font-serif/);
  });

  it('uses Nunito for Numbers & codes in every theme', () => {
    for (const style of MODAL_STYLES) {
      expect(style.fonts.numbers, style.label).toMatch(/^'Nunito'/);
      expect(themeFontVars(style), style.label).toHaveProperty(
        '--font-numbers',
        style.fonts.numbers,
      );
    }
  });

  it('turns the pair and the sizes into the CSS variables the font utilities read', () => {
    expect(themeFontVars(storyboard)).toEqual({
      '--font-comic': storyboard.fonts.headline,
      '--font-body': storyboard.fonts.body,
      '--font-numbers': storyboard.fonts.numbers,
      '--text-adjust': '2px',
      '--text-body-adjust': '2px',
      '--text-headline-adjust': '0px',
      '--text-numbers-adjust': '1px',
    });
  });

  it('sets the variables on a modal, a preview and the table, each theme with its own font', () => {
    const { unmount } = render(
      <ModalStyleProvider style={storyboard}>
        <ModalScaffold title="T" trigger={null} onClose={() => {}}>
          body
        </ModalScaffold>
        <ThemePreview style={storyboard} />
        <ThemedTable>table</ThemedTable>
      </ModalStyleProvider>,
    );
    const roots = [
      screen.getByRole('dialog'),
      screen.getByText('table').parentElement!,
      document.querySelector('[class*="previewPage"], .relative.h-52')!,
    ];
    for (const el of roots) {
      expect((el as HTMLElement).style.getPropertyValue('--font-comic')).toMatch(/Kalam/);
    }
    unmount();

    render(
      <ModalStyleProvider style={popArt}>
        <ModalScaffold title="T" trigger={null} onClose={() => {}}>
          body
        </ModalScaffold>
      </ModalStyleProvider>,
    );
    const popArtFont = screen.getByRole('dialog').style.getPropertyValue('--font-comic');
    expect(popArtFont).toMatch(/Lilita One/);
    expect(popArtFont).not.toMatch(/Kalam/);
    expect(screen.getByRole('dialog').style.getPropertyValue('--font-body')).toMatch(
      /^'Lilita One'/,
    );
  });
});

describe('theme fonts: the Newspaper exception', () => {
  it('follows the theme pair unless the theme sets a newspaper headline or body', () => {
    for (const style of MODAL_STYLES.filter((s) => s.id !== 'pop-art')) {
      expect(style.fonts.newspaper, style.label).toBeUndefined();
      const vars = newspaperFontVars(style) as Record<string, string>;
      expect(vars['--font-news-headline']).toBe(style.fonts.headline);
      expect(vars['--font-news-body']).toBe(style.fonts.body);
    }
  });

  it('lets a theme override only the newspaper headline, only its body, or both', () => {
    const base = { ...storyboard, fonts: { headline: 'H', body: 'B' } };
    const sizeless = {
      '--text-adjust': '0px',
      '--text-body-adjust': '0px',
      '--text-headline-adjust': '0px',
    };
    const headlineOnly = { ...base, fonts: { ...base.fonts, newspaper: { headline: 'NH' } } };
    expect(newspaperFontVars(headlineOnly)).toEqual({
      '--font-news-headline': 'NH',
      '--font-news-body': 'B',
      ...sizeless,
    });
    const bodyOnly = { ...base, fonts: { ...base.fonts, newspaper: { body: 'NB' } } };
    expect(newspaperFontVars(bodyOnly)).toEqual({
      '--font-news-headline': 'H',
      '--font-news-body': 'NB',
      ...sizeless,
    });
    const both = { ...base, fonts: { ...base.fonts, newspaper: { headline: 'NH', body: 'NB' } } };
    expect(newspaperFontVars(both)).toEqual({
      '--font-news-headline': 'NH',
      '--font-news-body': 'NB',
      ...sizeless,
    });
  });

  it('keeps the 1960s serif broadsheet in Pop-Art, whose theme font is Lilita One', () => {
    expect(popArt.fonts.newspaper?.headline).toMatch(/Georgia/);
    expect(popArt.fonts.newspaper?.body).toMatch(/Georgia/);
    const vars = newspaperFontVars(popArt) as Record<string, string>;
    expect(vars['--font-news-headline']).toMatch(/Georgia/);
    expect(vars['--font-comic' as string]).toBeUndefined();
  });

  it('sets the newspaper variables on the sheet and marks it, so the lab can target it', () => {
    render(
      <ModalStyleProvider style={popArt}>
        <NewspaperSheet edition="E">story</NewspaperSheet>
      </ModalStyleProvider>,
    );
    const sheet = document.querySelector('[data-newspaper]') as HTMLElement;
    expect(sheet).toBeTruthy();
    expect(sheet.style.getPropertyValue('--font-news-headline')).toMatch(/Georgia/);
    // The page text inside the sheet reads the newspaper roles, not the theme's headline font.
    expect(sheet.outerHTML).toContain('font-news-headline');
    expect(sheet.outerHTML).toContain('font-news-body');
    expect(sheet.outerHTML).not.toMatch(/font-(comic|serif|mono)\b/);
  });
});

describe('font roles in the game styles', () => {
  const css = readFileSync('src/ui/styles/index.css', 'utf8');
  const tailwind = readFileSync('tailwind.config.js', 'utf8');

  it('keep the game defaults and bundle the theme fonts', () => {
    expect(css).toMatch(/--font-comic:\s*'Body Digits', 'Bangers'/);
    expect(css).toMatch(/--font-body:\s*Inter/);
    expect(css).toContain("font-family: 'Kalam'");
    expect(css).toContain('@fontsource/kalam/files/kalam-latin-400-normal.woff2');
    expect(css).toContain('@fontsource/kalam/files/kalam-latin-700-normal.woff2');
    expect(css).not.toMatch(/--font-serif/);
    expect(css).toMatch(/--font-numbers:\s*ui-monospace/);
    expect(css).toContain('@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2');
    expect(css).toContain('@fontsource/boogaloo/files/boogaloo-latin-400-normal.woff2');
    expect(css).toContain('@fontsource/special-elite/files/special-elite-latin-400-normal.woff2');
    expect(css).toContain('@fontsource/lexend/files/lexend-latin-400-normal.woff2');
    expect(css).toContain('@fontsource/lexend/files/lexend-latin-700-normal.woff2');
    expect(css).toContain('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2');
    expect(css).toContain('@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2');
    for (const weight of ['400', '700']) {
      for (const style of ['normal', 'italic']) {
        expect(css).toContain(
          `@fontsource/merriweather/files/merriweather-latin-${weight}-${style}.woff2`,
        );
      }
    }
  });

  it('make the font utilities follow the variables, with newspaper roles that fall back to the theme', () => {
    expect(tailwind).toContain("comic: ['var(--font-comic)']");
    expect(tailwind).toContain("body: ['var(--font-body)']");
    expect(tailwind).not.toContain('--font-serif');
    expect(tailwind).toContain("mono: ['var(--font-numbers)']");
    expect(tailwind).toContain("'news-headline': ['var(--font-news-headline, var(--font-comic))']");
    expect(tailwind).toContain("'news-body': ['var(--font-news-body, var(--font-body))']");
  });
});

describe('theme text sizes: what was saved in the lab is each theme default', () => {
  const expected: Record<string, NonNullable<(typeof popArt)['fonts']['sizes']>> = {
    'pop-art': { body: 1, numbers: 1 },
    storyboard: { body: 2, numbers: 1 },
    newsprint: { body: 1, numbers: 1 },
    night: { body: 1, numbers: 1 },
    splash: { body: 3, numbers: 1, newspaper: { body: 4 } },
    dossier: { body: 2, numbers: 1, newspaper: { headline: -1 } },
    hud: { body: 1, numbers: 1 },
  };

  it.each(Object.entries(expected))('%s has the sizes chosen in the lab', (id, sizes) => {
    expect(getModalStyle(id)!.fonts.sizes).toEqual(sizes);
  });

  it('puts the body change on text-xs and up to text-sm, and the numbers change on font-mono text', () => {
    const vars = themeFontVars(getModalStyle('splash')!) as Record<string, string>;
    expect(vars['--text-adjust']).toBe('3px');
    expect(vars['--text-body-adjust']).toBe('3px');
    expect(vars['--text-numbers-adjust']).toBe('1px');
    expect(vars['--text-headline-adjust']).toBe('0px');
  });

  it('gives a newspaper its own change when the theme sets one, else the theme change', () => {
    const splash = newspaperFontVars(getModalStyle('splash')!) as Record<string, string>;
    expect(splash['--text-adjust']).toBe('4px');
    expect(splash['--text-headline-adjust']).toBe('0px');
    const dossier = newspaperFontVars(getModalStyle('dossier')!) as Record<string, string>;
    expect(dossier['--text-adjust']).toBe('2px');
    expect(dossier['--text-headline-adjust']).toBe('-1px');
    const night = newspaperFontVars(getModalStyle('night')!) as Record<string, string>;
    expect(night['--text-adjust']).toBe('1px');
  });

  it('sets the sizes on a modal, so its text follows the theme', () => {
    render(
      <ModalStyleProvider style={getModalStyle('splash')!}>
        <ModalScaffold title="T" trigger={null} onClose={() => {}}>
          body
        </ModalScaffold>
      </ModalStyleProvider>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.getPropertyValue('--text-adjust')).toBe('3px');
    expect(dialog.style.getPropertyValue('--text-numbers-adjust')).toBe('1px');
  });
});
