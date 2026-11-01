import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildContentIndex, handleContentRequest } from '../../src/tools/content-middleware';

let base: string;
const write = (rel: string, data: string) => {
  const file = path.join(base, 'content', rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
};

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-content-middleware-'));
  write('config.json', '{"enabledPacks":["core"]}');
  write('packs/core/pack.json', '{"id":"core"}');
  write('packs/core/cards/core.json', '[]');
  write('packs/core/translations/fr/core.json', '[]');
  write('packs/core/README.md', '# not json');
  write('.cache/images/x.json', '{}');
  fs.writeFileSync(path.join(base, 'secret.json'), '{"secret":true}');
});
afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

describe('content endpoint', () => {
  it('indexes only JSON files outside .cache and translations', () => {
    expect(buildContentIndex(base)).toEqual([
      'config.json',
      'packs/core/cards/core.json',
      'packs/core/pack.json',
    ]);
  });

  it('serves the index and an indexed file', () => {
    const index = handleContentRequest('/__content/index.json', base);
    expect(index?.status).toBe(200);
    expect(JSON.parse(index!.body).files).toContain('packs/core/pack.json');
    expect(handleContentRequest('/__content/packs/core/pack.json', base)?.body).toBe(
      '{"id":"core"}',
    );
  });

  it('ignores requests outside /content/', () => {
    expect(handleContentRequest('/api/stats', base)).toBeNull();
  });

  it.each([
    ['/__content/../secret.json'],
    ['/__content/packs/core/../../../secret.json'],
    ['/__content/%2e%2e/secret.json'],
    ['/__content/packs/core/README.md'],
    ['/__content/packs/core/translations/fr/core.json'],
    ['/__content/.cache/images/x.json'],
    ['/__content//etc/passwd'],
  ])('refuses %s', (url) => {
    expect(handleContentRequest(url, base)?.status).toBe(404);
  });

  it('answers 400 for an undecodable path', () => {
    expect(handleContentRequest('/__content/%E0%A4%A', base)?.status).toBe(400);
  });
});
