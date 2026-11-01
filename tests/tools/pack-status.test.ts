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

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('packStatuses', () => {
  it('derives card and supplemental counts and the state per pack', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-pack-status-'));
    write('core/cards/core.json', [{ code: '01001' }, { code: '01002' }]);
    write('core/cards/core_encounter.json', [{ code: '01100' }]);
    write('core/supplemental/core.json', { cards: { '01001': {} } });
    write('aoa/cards/aoa.json', [{ code: '45001' }]);

    expect(packStatuses(root)).toEqual([
      { code: 'aoa', cards: 1, supplemental: 0, state: 'data only' },
      { code: 'core', cards: 3, supplemental: 1, state: 'with supplemental' },
    ]);
  });
});
