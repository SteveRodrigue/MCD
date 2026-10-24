import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error plain JS config has no type declarations
import tailwindConfig from '../../tailwind.config.js';

const css = readFileSync(join(__dirname, '..', '..', 'src', 'ui', 'styles', 'index.css'), 'utf8');

// Bangers' 1 and 7 are hard to tell apart at small sizes: digits render in the body font (Inter Bold).
describe('Body Digits font (Issue #312 follow-up, D7-A)', () => {
  it('declares an Inter Bold face, the body font, limited to the digits 0-9', () => {
    const face = /@font-face\s*\{[^}]*font-family:\s*'Body Digits'[^}]*\}/.exec(css)?.[0];
    expect(face).toBeDefined();
    expect(face).toContain('@fontsource/inter/files/inter-latin-700-normal.woff2');
    expect(face).toContain('unicode-range: U+0030-0039');
    expect(face).toContain('font-weight: 100 900');
  });

  it('no longer uses Comic Relief for digits', () => {
    expect(css).not.toContain('Comic Digits');
    expect(css).not.toMatch(/font-family:\s*'Body Digits';[^}]*comic-relief/);
  });

  it('puts Body Digits first in the default comic (Bangers) font stack', () => {
    // font-comic reads --font-comic, so a theme can swap it; the default stack is in index.css.
    expect(tailwindConfig.theme.extend.fontFamily.comic).toEqual(['var(--font-comic)']);
    expect(css).toMatch(/--font-comic:\s*'Body Digits',\s*'Bangers'/);
  });

  it('puts Body Digits first in the .font-bangers preset', () => {
    expect(css).toMatch(/\.font-bangers\s*\{\s*font-family:\s*'Body Digits',\s*'Bangers'/);
  });
});
