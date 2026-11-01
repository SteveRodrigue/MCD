import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { packStatuses } from '../../scripts/pack-status';

let root: string;
const write = (rel: string, data: unknown) => {
  const file = path.join(root, 'content', 'packs', rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
};
const manifest = (id: string, dependsOn: string[] = []) => ({
  id,
  name: id.toUpperCase(),
  kind: 'hero',
  origin: 'user',
  apiVersion: 1,
  version: '1.0.0',
  dependsOn,
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('packStatuses', () => {
  it('reports counts and the state the game shows for each pack', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-pack-status-'));
    write('core/pack.json', manifest('core'));
    write('core/cards/core.json', [{ code: '01001' }, { code: '01002' }]);
    write('core/cards/core_encounter.json', [{ code: '01100' }]);
    write('core/supplemental/core.json', { cards: { '01001': {} } });
    write('aoa/pack.json', manifest('aoa'));
    write('aoa/cards/aoa.json', [{ code: '45001' }]);

    const rows = (await packStatuses(root)).map((r) => [
      r.id,
      r.cardCount,
      r.supplementalCount,
      r.state,
    ]);
    expect(rows).toEqual([
      ['aoa', 1, 0, 'data-only'],
      ['core', 3, 1, 'playable'],
    ]);
  });
});
