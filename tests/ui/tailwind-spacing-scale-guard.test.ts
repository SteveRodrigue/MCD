import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

/**
 * Issue #364: Tailwind only generates fractional spacing steps that are in its scale (0.5, 1.5, 2.5,
 * 3.5) and `tailwind.config.js` does not extend `spacing`. Any other step, like `py-0.2`, builds no
 * CSS, so the badge silently loses its padding. Use a scale step, `px`, or an arbitrary `[value]`.
 */
const SRC = path.resolve(__dirname, '../../src/ui');
const FRACTIONAL_SCALE = new Set(['0.5', '1.5', '2.5', '3.5']);

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });

const SPACING_PREFIX =
  '(?:p[xytblrse]?|m[xytblrse]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|bottom|left|right|start|end|' +
  'w|h|min-w|min-h|max-w|max-h|size|translate-[xy]|scroll-[mp][xytblrse]?|basis|indent)';
const FRACTIONAL_STEP = new RegExp(
  `(?<![\\w\\[-])-?${SPACING_PREFIX}-(\\d*\\.\\d+)(?![\\w.])`,
  'g',
);

describe('Tailwind spacing classes stay on the default scale', () => {
  it('no fractional spacing step outside 0.5, 1.5, 2.5 and 3.5', () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          [...line.matchAll(FRACTIONAL_STEP)]
            .filter((match) => !FRACTIONAL_SCALE.has(match[1]))
            .map((match) => `${path.relative(SRC, file)}:${index + 1} ${match[0]}`),
        ),
    );
    expect(offenders).toEqual([]);
  });
});
