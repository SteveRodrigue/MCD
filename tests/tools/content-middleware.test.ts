import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildContentIndex,
  contentMiddleware,
  handleContentRequest,
  handleContentWrite,
} from '../../src/tools/content-middleware';

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
  write('art-packs/fan/art-pack.json', '{}');
  write('art-packs/fan/hero.png', 'not really a png');
  write('art-packs/fan/notes.txt', 'text');
  write('packs/core/cards/x.png', 'a png outside an art pack');
  fs.writeFileSync(path.join(base, 'secret.json'), '{"secret":true}');
});
afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

describe('content endpoint', () => {
  it('indexes JSON files outside .cache and translations, and the PNG files of art packs', () => {
    expect(buildContentIndex(base)).toEqual([
      'art-packs/fan/art-pack.json',
      'art-packs/fan/hero.png',
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

  it('lists art pack images so the loader can check them, but never serves them here', () => {
    expect(handleContentRequest('/__content/art-packs/fan/hero.png', base)?.status).toBe(404);
    expect(handleContentRequest('/__content/art-packs/fan/art-pack.json', base)?.body).toBe('{}');
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

describe('content endpoint writes (editor Save, M9)', () => {
  const supplemental = JSON.stringify({ cards: {} });
  const manifest = (origin: string) => JSON.stringify({ id: 'x', origin });
  const put = (relative: string, body = supplemental) =>
    handleContentWrite(`/__content/${relative}`, body, base);

  it('writes the supplemental file of a user or bundled pack', () => {
    write('packs/mine/pack.json', manifest('user'));
    write('packs/bundled/pack.json', manifest('official-bundled'));
    expect(put('packs/mine/supplemental/mine.json')?.status).toBe(200);
    expect(put('packs/bundled/supplemental/b.json')?.status).toBe(200);
    expect(
      fs.readFileSync(path.join(base, 'content/packs/mine/supplemental/mine.json'), 'utf-8'),
    ).toContain('"cards"');
  });

  it('writes config.json when the payload is valid ContentConfig', () => {
    const valid = JSON.stringify({
      $schema: '../src/data/packs/content-config.schema.json',
      enabledPacks: ['core', 'gob'],
    });
    expect(put('config.json', valid)?.status).toBe(200);
    expect(fs.readFileSync(path.join(base, 'content/config.json'), 'utf-8')).toContain('"gob"');
  });

  it('refuses config.json with invalid JSON or schema', () => {
    expect(put('config.json', '{ bad json')?.status).toBe(400);
    expect(put('config.json', JSON.stringify({ enabledPacks: 'not-an-array' }))?.status).toBe(400);
    expect(put('config.json', JSON.stringify({ enabledPacks: [''] }))?.status).toBe(400);
    expect(
      put('config.json', JSON.stringify({ enabledPacks: ['core'], extraField: 123 }))?.status,
    ).toBe(400);
  });

  it('refuses a synced pack, a pack without pack.json and any other path', () => {
    write('packs/synced/pack.json', manifest('official-sync'));
    expect(put('packs/synced/supplemental/s.json')?.status).toBe(403);
    expect(put('packs/ghost/supplemental/g.json')?.status).toBe(403);
    expect(put('packs/mine/pack.json')?.status).toBe(403);
    expect(put('packs/mine/cards/c.json')?.status).toBe(403);
    expect(put('packs/mine/other.json')?.status).toBe(403);
    expect(put('packs/mine/supplemental/%2e%2e%2fpack.json')?.status).toBe(403);
    expect(put('packs/../supplemental/x.json')?.status).toBe(403);
  });

  it('refuses a body that is not valid supplemental data and leaves no file behind', () => {
    expect(put('packs/mine/supplemental/bad.json', '{ nope')?.status).toBe(400);
    expect(
      put('packs/mine/supplemental/bad.json', JSON.stringify({ cards: { c: { abilities: 5 } } }))
        ?.status,
    ).toBe(400);
    expect(fs.existsSync(path.join(base, 'content/packs/mine/supplemental/bad.json'))).toBe(false);
  });

  it('ignores requests outside /__content/', () => {
    expect(handleContentWrite('/api/stats', supplemental, base)).toBeNull();
  });

  it('only the dev server middleware accepts PUT; preview does not', () => {
    const run = (allowWrite: boolean) => {
      let status = 0;
      let nextCalled = false;
      const handlers: Record<string, (c?: unknown) => void> = {};
      contentMiddleware(base, { allowWrite })(
        {
          url: '/__content/packs/mine/supplemental/viaput.json',
          method: 'PUT',
          on: (e, cb) => (handlers[e] = cb),
        },
        {
          statusCode: 0,
          setHeader: () => {},
          end() {
            status = this.statusCode;
          },
        },
        () => (nextCalled = true),
      );
      handlers.data?.(supplemental);
      handlers.end?.();
      return { status, nextCalled };
    };
    expect(run(true)).toEqual({ status: 200, nextCalled: false });
    expect(run(false)).toEqual({ status: 0, nextCalled: true });
  });
});

describe('content index through links', () => {
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  let root: string;
  let linksSupported = false;
  let hasFileLink = false;
  const put = (file: string, data = '{}') => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
  };

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-content-links-'));
    // The "private" store holds the art packs (generated stand-in files, not real images).
    const store = path.join(root, 'private', 'art-packs');
    put(path.join(store, 'fan', 'art-pack.json'));
    put(path.join(store, 'fan', 'hero.png'), 'generated');
    put(path.join(store, 'fan', 'notes.txt'), 'text');
    put(path.join(root, 'ws', 'content', 'config.json'));
    try {
      // A loop back to the store itself must not hang the walk.
      fs.symlinkSync(store, path.join(store, 'fan', 'loop'), linkType);
      fs.symlinkSync(store, path.join(root, 'ws', 'content', 'art-packs'), linkType);
      linksSupported = true;
      try {
        fs.symlinkSync(
          path.join(store, 'fan', 'art-pack.json'),
          path.join(store, 'fan', 'alias.json'),
          'file',
        );
        hasFileLink = true;
      } catch {
        // Windows unprivileged environments without Developer Mode throw EPERM on file symlinks.
      }
    } catch {
      // Environment does not support symlinks/junctions (e.g. sandbox or restricted Windows).
    }
  });
  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('lists the files of an art-packs folder that is a link', () => {
    if (!linksSupported) return;
    const expected = [
      ...(hasFileLink ? ['art-packs/fan/alias.json'] : []),
      'art-packs/fan/art-pack.json',
      'art-packs/fan/hero.png',
      'config.json',
    ];
    expect(buildContentIndex(path.join(root, 'ws'))).toEqual(expected);
  });
});
