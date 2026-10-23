import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const UI_ROOT = path.resolve(__dirname, '../../src/ui');

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });

const importsOf = (file: string): string[] =>
  [...fs.readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(
    (m) => m[1],
  );

const rel = (file: string) => path.relative(UI_ROOT, file).replace(/\\/g, '/');

describe('theme architecture (game and lab both depend on theme/, never the reverse)', () => {
  const files = sourceFiles(UI_ROOT);

  it('keeps the game from importing the template lab', () => {
    const offenders = files
      .filter((f) => !rel(f).startsWith('components/templates/') && rel(f) !== 'App.tsx')
      .filter((f) => importsOf(f).some((spec) => /components\/templates\//.test(spec)))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it('lets only App.tsx lazy-load the lab screen', () => {
    const lab = importsOf(path.join(UI_ROOT, 'App.tsx')).filter((s) => /templates\//.test(s));
    expect(lab).toEqual(['./components/templates/ModalTemplatesScreen']);
  });

  it('keeps theme/ free of board and lab dependencies', () => {
    const offenders = files
      .filter((f) => rel(f).startsWith('theme/'))
      .flatMap((f) =>
        importsOf(f)
          .filter((spec) => /components\/(templates|board|setup)\//.test(spec))
          .map((spec) => `${rel(f)} -> ${spec}`),
      );
    expect(offenders).toEqual([]);
  });
});
