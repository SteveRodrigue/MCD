import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import {
  END_MARKER,
  FONT_RECORD_FILE,
  START_MARKER,
  buildThemeFontsBlock,
  familyName,
  renderFontRecord,
} from '../../tools/audit/fonts-record';
import { MODAL_STYLES } from '../../src/ui/theme/modal-styles';

const REPO_ROOT = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
const STALE_HINT = 'Run `npm run docs:fonts` and commit the regenerated record.';

describe('font record: the generated table', () => {
  it('is up to date with the theme tokens', () => {
    const current = read(FONT_RECORD_FILE);
    expect(renderFontRecord(current), `${FONT_RECORD_FILE} is stale. ${STALE_HINT}`).toBe(current);
  });

  it('has one row per theme, with the fonts of that theme', () => {
    const block = buildThemeFontsBlock();
    const rows = block.split('\n').filter((l) => /^\| (?!Theme)/.test(l));
    expect(rows).toHaveLength(MODAL_STYLES.length);
    for (const style of MODAL_STYLES) {
      const line = rows.find((r) => r.startsWith(`| ${style.label} |`))!;
      expect(line, style.label).toBeTruthy();
      const cells = line.split('|').map((c) => c.trim());
      expect(cells[2]).toBe(familyName(style.fonts.headline));
      expect(cells[3]).toBe(familyName(style.fonts.body));
    }
  });

  it('says which themes set a Newspaper font, and marks the set cells', () => {
    const block = buildThemeFontsBlock();
    const withNewspaper = MODAL_STYLES.filter((s) => s.fonts.newspaper);
    expect(withNewspaper.length).toBeGreaterThan(0);
    for (const style of withNewspaper) expect(block).toContain(style.label);
    expect(block).toMatch(/\(set\)/);
    for (const style of MODAL_STYLES.filter((s) => !s.fonts.newspaper)) {
      const line = block.split('\n').find((l) => l.startsWith(`| ${style.label} |`))!;
      expect(line).toContain('follows (');
    }
  });

  it('names a font the way a person would', () => {
    expect(familyName("'Lilita One', 'Comic Relief', Impact, system-ui, sans-serif")).toBe(
      'Lilita One',
    );
    expect(familyName('Inter, system-ui, sans-serif')).toBe('Inter');
    expect(familyName("ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif")).toBe(
      'system serif',
    );
    expect(familyName('ui-monospace, Menlo, monospace')).toBe('system monospace');
  });

  it('rewrites only what is between the markers, and keeps the line endings', () => {
    const source = `before\n${START_MARKER}\nold table\n${END_MARKER}\nafter\n`;
    const out = renderFontRecord(source);
    expect(out.startsWith(`before\n${START_MARKER}\n`)).toBe(true);
    expect(out.endsWith(`\n${END_MARKER}\nafter\n`)).toBe(true);
    expect(out).not.toContain('old table');
    const crlf = renderFontRecord(source.replace(/\n/g, '\r\n'));
    expect(crlf).toContain('\r\n');
    expect(crlf.replace(/\r\n/g, '\n')).toBe(out);
  });

  it('refuses a record without the markers', () => {
    expect(() => renderFontRecord('no markers here')).toThrow(/markers/);
  });
});

describe('font record: the hand-written part stays true', () => {
  const record = read(FONT_RECORD_FILE);

  it('lists every font slot a theme can set in the "what can be set" table', () => {
    const keys = new Set<string>();
    for (const style of MODAL_STYLES) {
      for (const [key, value] of Object.entries(style.fonts)) {
        if (key === 'newspaper' && value && typeof value === 'object') {
          for (const inner of Object.keys(value)) keys.add(`fonts.newspaper.${inner}`);
        } else {
          keys.add(`fonts.${key}`);
        }
      }
    }
    // The newspaper pair is optional per theme, so make sure both halves are checked even if no theme sets one.
    keys.add('fonts.newspaper.headline');
    keys.add('fonts.newspaper.body');
    for (const key of keys) {
      expect(record, `${key} is missing from the record's slot table`).toContain(`\`${key}\``);
    }
  });

  it('does not mention slots that were removed', () => {
    expect(record).not.toContain('`fonts.serif`');
    expect(record).not.toContain('`fonts.mono`');
  });

  it('only names fonts that are bundled or system fonts', () => {
    const css = read('src/ui/styles/index.css');
    const system = new Set(['Inter', 'system serif', 'system monospace', 'system sans']);
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
        expect(css, `${style.label}: ${name} has no @font-face in index.css`).toContain(
          `font-family: '${name}'`,
        );
      }
    }
  });
});

describe('font record: the script is wired', () => {
  it('has an npm script and a pre-commit step', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['docs:fonts']).toBe('tsx tools/audit/fonts-record.ts');
    const hook = read('.githooks/pre-commit');
    expect(hook).toContain('docs:fonts');
    expect(hook).toContain('src/ui/theme/modal-styles');
    expect(hook).toContain('git add docs/templates/modals/FONT_RECORD.md');
  });
});
