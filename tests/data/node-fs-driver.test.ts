import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeFsDriver } from '../../src/data/content/drivers/node-fs';

let root: string;

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('NodeFsDriver.listDirs', () => {
  it('lists only the sub-directories, sorted, and nothing for a missing directory', async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-node-driver-'));
    fs.mkdirSync(path.join(root, 'packs', 'b'), { recursive: true });
    fs.mkdirSync(path.join(root, 'packs', 'a'), { recursive: true });
    fs.writeFileSync(path.join(root, 'packs', 'file.json'), '{}');
    const driver = new NodeFsDriver(root);
    expect(await driver.listDirs('packs')).toEqual(['a', 'b']);
    expect(await driver.listDirs('packs/missing')).toEqual([]);
  });
});
