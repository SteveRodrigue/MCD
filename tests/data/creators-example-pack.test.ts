import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadContent } from '../../src/data/content/loader';
import { NodeFsDriver } from '../../src/data/content/drivers/node-fs';
import {
  readCardSchema,
  readOfficialPackCodes,
  validatePackSet,
} from '../../scripts/pack-validate';

const REPO_ROOT = path.resolve(__dirname, '../..');
const EXAMPLE = path.join(REPO_ROOT, 'docs/creators/examples/first-pack');

let root: string;

/** Follows the tutorial: copy the pack into content/packs/ and enable it in config.json. */
function install(withSupplemental: boolean) {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-creators-example-'));
  const dest = path.join(root, 'packs/first-pack');
  fs.cpSync(EXAMPLE, dest, { recursive: true });
  fs.rmSync(path.join(dest, 'supplemental.sample.json'));
  if (withSupplemental) {
    fs.mkdirSync(path.join(dest, 'supplemental'));
    fs.copyFileSync(
      path.join(EXAMPLE, 'supplemental.sample.json'),
      path.join(dest, 'supplemental/first_pack.json'),
    );
  }
  fs.writeFileSync(path.join(root, 'config.json'), JSON.stringify({ enabledPacks: ['first-pack'] }));
  return path.join(root, 'packs');
}

afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

describe('creators example pack (docs/creators/examples/first-pack)', () => {
  it('passes pack:validate, with and without the supplemental step', () => {
    for (const withSupplemental of [false, true]) {
      const findings = validatePackSet(install(withSupplemental), {
        officialPackCodes: readOfficialPackCodes(REPO_ROOT),
        cardSchema: readCardSchema(REPO_ROOT),
      });
      expect(findings).toEqual([]);
    }
  });

  it('loads as Data only, then becomes Playable once it has supplemental data', async () => {
    install(false);
    let content = await loadContent(new NodeFsDriver(root));
    expect(content.failures).toEqual([]);
    expect(content.descriptions).toMatchObject([{ id: 'first-pack', state: 'data-only' }]);
    expect(content.packs[0].cards.map((c) => c.code)).toContain('first-pack-0001a');

    fs.rmSync(root, { recursive: true, force: true });
    install(true);
    content = await loadContent(new NodeFsDriver(root));
    expect(content.failures).toEqual([]);
    expect(content.descriptions).toMatchObject([{ id: 'first-pack', state: 'playable' }]);
  });
});
