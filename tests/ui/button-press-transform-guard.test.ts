import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

/**
 * Issue #390: the theme buttons (`style.btn*`) move on press (`active:translate-y-*`). Tailwind
 * translate utilities share one `--tw-translate-y` variable, so a button that is also centred with
 * `-translate-y-1/2` jumps away from the pointer on mouse-down and the click is lost. A button that
 * takes a theme button class must be positioned by a wrapper, never by its own translate.
 */
const SRC = path.resolve(__dirname, '../../src/ui');

const tsxFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(full);
    return entry.name.endsWith('.tsx') ? [full] : [];
  });

const THEME_BUTTON = /\bstyle\.btn[A-Z]\w*/;
const OWN_TRANSLATE = /(?<![\w:-])-?translate-[xy]-/;

describe('theme buttons are not positioned by their own translate', () => {
  it('no className mixes style.btn* with a translate utility', () => {
    const offenders = tsxFiles(SRC).flatMap((file) =>
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => THEME_BUTTON.test(line) && OWN_TRANSLATE.test(line))
        .map(({ index }) => `${path.relative(SRC, file)}:${index + 1}`),
    );
    expect(offenders).toEqual([]);
  });
});
