import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import type { AddressInfo } from 'net';
import { handleCardArtRequest } from '../../src/tools/card-art-middleware';
import { hasCardImage, resolveCardImage } from '../../src/tools/image-cache';

function writePack(base: string, id: string, origin: 'official-sync' | 'user'): void {
  const dir = path.join(base, 'content', 'packs', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'pack.json'),
    JSON.stringify({
      id,
      name: id,
      kind: 'hero',
      origin,
      apiVersion: 1,
      version: '1.0.0',
      dependsOn: [],
    }),
  );
}

describe('image cache (shipped asset, disk cache, MarvelCDB)', () => {
  let base: string;
  let server: http.Server;
  let remoteBase: string;
  const requests: string[] = [];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      requests.push(req.url ?? '');
      if (req.url?.endsWith('missing.png')) {
        res.statusCode = 404;
        return res.end('no');
      }
      setTimeout(() => res.end(`png:${req.url}`), 5);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    remoteBase = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-image-cache-'));
    requests.length = 0;
    writePack(base, 'gob', 'official-sync');
    writePack(base, 'my-hero-pack', 'user');
  });

  const options = () => ({
    base,
    remoteUrl: (pack: string, file: string) => `${remoteBase}/${pack}/${file}`,
  });

  const cachePath = (pack: string, file: string) =>
    path.join(base, 'content', '.cache', 'images', pack, file);

  it('downloads a missing official image once into the pack cache folder (Scenario 1)', async () => {
    const found = await resolveCardImage('gob', '02001.png', options());
    expect(found).toBe(cachePath('gob', '02001.png'));
    expect(fs.readFileSync(found!, 'utf8')).toBe('png:/gob/02001.png');
    expect(fs.readdirSync(path.dirname(found!))).toEqual(['02001.png']);

    await resolveCardImage('gob', '02001.png', options());
    expect(requests).toHaveLength(1);
  });

  it('serves a cache hit without any request (Scenario 3)', async () => {
    fs.mkdirSync(path.dirname(cachePath('gob', '02002.png')), { recursive: true });
    fs.writeFileSync(cachePath('gob', '02002.png'), 'cached');
    expect(hasCardImage('gob', '02002.png', base)).toBe(true);

    const found = await resolveCardImage('gob', '02002.png', options());
    expect(fs.readFileSync(found!, 'utf8')).toBe('cached');
    expect(requests).toHaveLength(0);
  });

  it('downloads concurrent requests for the same file only once', async () => {
    const [a, b] = await Promise.all([
      resolveCardImage('gob', '02003.png', options()),
      resolveCardImage('gob', '02003.png', options()),
    ]);
    expect(a).toBe(b);
    expect(requests).toHaveLength(1);
  });

  it('leaves no file behind when the remote answers 404', async () => {
    expect(await resolveCardImage('gob', 'missing.png', options())).toBeNull();
    expect(fs.existsSync(cachePath('gob', 'missing.png'))).toBe(false);
    const dir = path.dirname(cachePath('gob', 'missing.png'));
    expect(fs.existsSync(dir) ? fs.readdirSync(dir) : []).toEqual([]);
  });

  it('prefers the art a pack ships over the cache and the remote (Scenario 2)', async () => {
    const assets = path.join(base, 'content', 'packs', 'gob', 'assets', 'cards');
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, '02004.png'), 'shipped');

    const found = await resolveCardImage('gob', '02004.png', options());
    expect(found).toBe(path.join(assets, '02004.png'));
    expect(requests).toHaveLength(0);
  });

  it('serves a user pack asset and never contacts the remote for a user pack', async () => {
    const assets = path.join(base, 'content', 'packs', 'my-hero-pack', 'assets', 'cards');
    fs.mkdirSync(assets, { recursive: true });
    fs.writeFileSync(path.join(assets, 'my-hero-pack-0001a.png'), 'fan art');

    const art = await resolveCardImage('my-hero-pack', 'my-hero-pack-0001a.png', options());
    expect(fs.readFileSync(art!, 'utf8')).toBe('fan art');

    expect(await resolveCardImage('my-hero-pack', 'my-hero-pack-0002a.png', options())).toBeNull();
    expect(requests).toHaveLength(0);
  });

  it('rejects an unknown pack, a bad pack id and a bad file name', async () => {
    expect(await resolveCardImage('nope', '02001.png', options())).toBeNull();
    expect(await resolveCardImage('..', '02001.png', options())).toBeNull();
    expect(await resolveCardImage('gob', '../secret.png', options())).toBeNull();
    expect(await resolveCardImage('gob', '02001.jpg', options())).toBeNull();
    expect(requests).toHaveLength(0);
  });

  it('answers null for a card back name that is not one of the three', async () => {
    expect(await resolveCardImage('_backs', 'other.png', options())).toBeNull();
  });
});

describe('card art route', () => {
  it('answers 400 for a bad file name and null for a URL that is not card art', async () => {
    expect(await handleCardArtRequest('/card-art/core/..%2Fsecret.png')).toMatchObject({
      status: 400,
    });
    expect(await handleCardArtRequest('/card-art/core/01001a.jpg')).toMatchObject({ status: 400 });
    expect(await handleCardArtRequest('/cards/01001a.png')).toBeNull();
    expect(await handleCardArtRequest('/__content/index.json')).toBeNull();
  });

  it('answers 404 for an unknown pack and 200 with a path for cached art', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-card-art-route-'));
    writePack(base, 'gob', 'official-sync');
    const cached = path.join(base, 'content', '.cache', 'images', 'gob');
    fs.mkdirSync(cached, { recursive: true });
    fs.writeFileSync(path.join(cached, '02001.png'), 'x');

    expect(await handleCardArtRequest('/card-art/nope/02001.png?v=1', { base })).toMatchObject({
      status: 404,
    });
    expect(await handleCardArtRequest('/card-art/gob/02001.png?v=1', { base })).toEqual({
      status: 200,
      filePath: path.join(cached, '02001.png'),
    });
  });
});
