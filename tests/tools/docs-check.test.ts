import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runDocsCheck, type AllowEntry } from '../../tools/audit/docs-check';

const REPO_ROOT = path.resolve(__dirname, '../..');

function format(findings: ReturnType<typeof runDocsCheck>): string[] {
  return findings.map((f) => `${f.file}:${f.line} [${f.check}] ${f.message}`);
}

describe('docs:check on the repository', () => {
  it('reports no documentation finding', () => {
    const allow: AllowEntry[] = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, 'tools/audit/docs-check.allow.json'), 'utf8'),
    );
    expect(format(runDocsCheck(REPO_ROOT, { allow }))).toEqual([]);
  });
});

describe('docs:check rules (fixture tree)', () => {
  let root: string;
  const write = (rel: string, content: string) => {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  const checks = (allow: AllowEntry[] = []) => runDocsCheck(root, { allow }).map((f) => f.check);

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-docs-check-'));
    write('package.json', JSON.stringify({ scripts: { test: 'vitest' } }));
    write('src/engine/a.ts', 'export const REAL_SYMBOL = 1;\n');
    write('README.md', '# Title\n\nSee [guide](docs/guide.md).\n');
    write(
      'docs/guide.md',
      '# Guide\n\nUses `REAL_SYMBOL` in `src/engine/a.ts`; run `npm run test`.\n',
    );
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('passes a clean tree', () => {
    expect(runDocsCheck(root)).toEqual([]);
  });

  it('flags a dead link and a missing anchor', () => {
    write('docs/guide.md', '# Guide\n\n[a](missing.md) [b](#nope)\n');
    expect(checks().sort()).toEqual(
      ['anchor', 'link', 'orphan'].filter((c) => c !== 'orphan').sort(),
    );
  });

  it('flags a missing path', () => {
    write('docs/creators/s.md', '# S\n\n`src/engine/gone.ts`\n');
    write('README.md', '# T\n\n[g](docs/guide.md) [s](docs/creators/s.md)\n');
    expect(checks()).toEqual(['path']);
  });

  it('flags an unknown npm script, also inside a code block', () => {
    write('docs/guide.md', '# Guide\n\n```sh\nnpm run nope\n```\n');
    expect(checks()).toEqual(['script']);
  });

  it('flags a symbol that is not in src/ in a current-state doc only', () => {
    write('docs/creators/s.md', '# S\n\n`PHANTOM_SYMBOL` and `REAL_SYMBOL`\n');
    write('README.md', '# T\n\n[g](docs/guide.md) [s](docs/creators/s.md)\n');
    expect(checks()).toEqual(['symbol']);
    write('docs/creators/s.md', '# Status\n\n- **Status:** Backlogged\n\n`PHANTOM_SYMBOL`\n');
    expect(checks()).toEqual([]);
  });

  it('flags an orphan document', () => {
    write('docs/lonely.md', '# Lonely\n');
    expect(checks()).toEqual(['orphan']);
  });

  it('flags removed-feature wording and hard-coded counts', () => {
    write('docs/creators/s.md', '# S\n\nThis was removed in #12. Now 3,497 tests pass.\n');
    write('README.md', '# T\n\n[g](docs/guide.md) [s](docs/creators/s.md)\n');
    expect(checks().sort()).toEqual(['tombstone', 'volatile']);
  });

  it('flags an ADR index with a missing row, a wrong status and a missing back-reference', () => {
    write(
      'docs/decisions/0001-a.md',
      '# [ADR-0001] A\n\n- **Status:** Superseded by [ADR-0002](0002-b.md)\n- **Date:** 2026-01-01\n',
    );
    write(
      'docs/decisions/0002-b.md',
      '# [ADR-0002] B\n\n- **Status:** Accepted\n- **Date:** 2026-01-02\n',
    );
    write(
      'docs/decisions/0003-c.md',
      '# [ADR-0003] C\n\n- **Status:** Accepted\n- **Date:** 2026-01-03\n',
    );
    write(
      'docs/decisions/README.md',
      [
        '# ADRs',
        '| ADR | Date | Title | Status | Why |',
        '| --- | --- | --- | --- | --- |',
        '| [ADR-0001](0001-a.md) | 2026-01-01 | A | **Accepted** | x |',
        '| [ADR-0002](0002-b.md) | 2026-01-02 | B | **Accepted** | x |',
      ].join('\n'),
    );
    write('README.md', '# T\n\n[g](docs/guide.md) [d](docs/decisions/README.md)\n');
    const messages = runDocsCheck(root).map((f) => f.message);
    expect(messages.some((m) => m.includes('ADR-0003 has no row'))).toBe(true);
    expect(messages.some((m) => m.includes('ADR-0001 status differs'))).toBe(true);
  });

  it('honours an allowlist entry', () => {
    write('docs/creators/s.md', '# S\n\n`PHANTOM_SYMBOL`\n');
    write('README.md', '# T\n\n[g](docs/guide.md) [s](docs/creators/s.md)\n');
    expect(checks([{ check: 'symbol', value: 'PHANTOM_SYMBOL', reason: 'example' }])).toEqual([]);
  });

  it('flags a pack.json property that pack-format.md does not mention', () => {
    write('docs/creators/pack-format.md', '# Pack format\n\n`id` `name` `kind` `origin`\n');
    write('README.md', '# T\n\n[g](docs/guide.md) [p](docs/creators/pack-format.md)\n');
    const findings = runDocsCheck(root).filter((f) => f.check === 'creator-field');
    const messages = findings.map((f) => f.message);
    expect(messages).toContain('schema property not documented: apiVersion');
    expect(messages).not.toContain('schema property not documented: id');
  });
});
