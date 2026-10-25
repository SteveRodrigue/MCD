import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

/**
 * Board theming (docs/templates/modals/PLAN_board_theming.md): a migrated screen takes its panels,
 * borders, shadows, radii and surface text colours from the theme tokens. Colours that carry a game
 * meaning stay: a text colour is allowed next to a fixed background colour in the same class list
 * (a dark word on a yellow pill), but never alone on a theme surface.
 */
const REPO = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(REPO, file), 'utf8');

/** Each finished phase adds its files here. */
const MIGRATED = [
  'src/ui/components/board/VillainZone.tsx',
  'src/ui/components/board/ThreatZoneSubzone.tsx',
  'src/ui/components/board/HeroZone.tsx',
  'src/ui/components/board/PlayerHandTray.tsx',
  'src/ui/components/board/RemovedFromGameBox.tsx',
  'src/ui/components/board/PileViewerModal.tsx',
];

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/** The classes of one className piece: the text between quotes, backticks and template holes on a line. */
const runs = (source: string): string[] =>
  stripComments(source)
    .split('\n')
    .flatMap((line) => line.split(/["'`]|\$\{|\}/));

const LITERAL_LOOK =
  /(?<![\w-])(comic-panel|bg-white|border-comic-black|shadow-comic(?:-[a-z]+)?)(?![\w-])/;
const SURFACE_TEXT = /(?<![\w:-])text-(comic-black|slate-\d+|gray-\d+)(?![\w-])/;
const FIXED_BG = /(?<![\w:-])bg-(?!transparent)[\w-]+/;

describe('theme guard: migrated screens use the theme tokens', () => {
  it.each(MIGRATED)('%s writes no literal comic look', (file) => {
    const offenders = runs(read(file))
      .filter((run) => LITERAL_LOOK.test(run))
      .map((run) => run.trim().slice(0, 90));
    expect(offenders, `${file} writes a literal look; use the theme tokens`).toEqual([]);
  });

  it.each(MIGRATED)('%s sets no surface text colour: it follows the theme', (file) => {
    const offenders = runs(read(file))
      .filter((run) => SURFACE_TEXT.test(run) && !FIXED_BG.test(run))
      .map((run) => run.trim().slice(0, 90));
    expect(offenders, `${file} sets a text colour on a theme surface`).toEqual([]);
  });
});
