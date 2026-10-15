import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error plain JS config has no type declarations
import tailwindConfig from '../../tailwind.config.js';

const css = readFileSync(join(__dirname, '..', '..', 'src', 'ui', 'styles', 'index.css'), 'utf8');

// Bangers' 1 and 7 are hard to tell apart at small sizes: digits render in Comic Relief Bold.
describe('Comic Digits font (Issue #312 follow-up, D7-A)', () => {
  it('declares a Comic Relief Bold face limited to the digits 0-9', () => {
    const face = /@font-face\s*\{[^}]*font-family:\s*'Comic Digits'[^}]*\}/.exec(css)?.[0];
    expect(face).toBeDefined();
    expect(face).toContain('comic-relief-latin-700-normal.woff2');
    expect(face).toContain('unicode-range: U+0030-0039');
    expect(face).toContain('font-weight: 100 900');
  });

  it('puts Comic Digits first in the comic (Bangers) font stack', () => {
    expect(tailwindConfig.theme.extend.fontFamily.comic[0]).toBe('"Comic Digits"');
    expect(tailwindConfig.theme.extend.fontFamily.comic[1]).toBe('"Bangers"');
  });

  it('puts Comic Digits first in the .font-bangers preset', () => {
    expect(css).toMatch(/\.font-bangers\s*\{\s*font-family:\s*'Comic Digits',\s*'Bangers'/);
  });
});
