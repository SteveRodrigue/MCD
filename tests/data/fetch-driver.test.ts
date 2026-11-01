import { describe, it, expect, vi } from 'vitest';
import { FetchDriver } from '../../src/data/content/drivers/fetch';

const files = [
  'config.json',
  'packs/core/pack.json',
  'packs/core/cards/core.json',
  'packs/core/cards/core_encounter.json',
  'packs/core/decks/a.json',
];

function stubFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/content/index.json') return Response.json({ files });
    if (url === '/content/config.json') return Response.json({ enabledPacks: ['core'] });
    return new Response(null, { status: 404 });
  });
}

describe('FetchDriver', () => {
  it('lists the files directly inside a directory from the index', async () => {
    const driver = new FetchDriver('/content', stubFetch() as never);
    expect(await driver.listFiles('packs/core/cards')).toEqual([
      'core.json',
      'core_encounter.json',
    ]);
    expect(await driver.listFiles('packs/core')).toEqual(['pack.json']);
    expect(await driver.listFiles('packs/missing')).toEqual([]);
  });

  it('lists the sub-directories directly inside a directory from the index', async () => {
    const driver = new FetchDriver('/content', stubFetch() as never);
    expect(await driver.listDirs('packs')).toEqual(['core']);
    expect(await driver.listDirs('packs/core')).toEqual(['cards', 'decks']);
    expect(await driver.listDirs('packs/missing')).toEqual([]);
  });

  it('answers exists from the index and reads files over HTTP', async () => {
    const driver = new FetchDriver('/content', stubFetch() as never);
    expect(await driver.exists('config.json')).toBe(true);
    expect(await driver.exists('nope.json')).toBe(false);
    expect(await driver.readJson('config.json')).toEqual({ enabledPacks: ['core'] });
  });

  it('fetches the index once', async () => {
    const fetchMock = stubFetch();
    const driver = new FetchDriver('/content', fetchMock as never);
    await driver.listFiles('packs/core');
    await driver.exists('config.json');
    const indexCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('index.json'));
    expect(indexCalls).toHaveLength(1);
  });

  it('throws on an unreadable file and on a missing index', async () => {
    const driver = new FetchDriver('/content', stubFetch() as never);
    await expect(driver.readJson('packs/core/nope.json')).rejects.toThrow('HTTP 404');
    const noIndex = new FetchDriver(
      '/content',
      (async () => new Response(null, { status: 500 })) as never,
    );
    await expect(noIndex.listFiles('packs')).rejects.toThrow('index');
  });
});
