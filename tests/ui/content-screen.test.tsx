import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { ContentScreen } from '../../src/ui/components/setup/ContentScreen';
import { FailedPacksNotice } from '../../src/ui/components/setup/FailedPacksNotice';
import { bootContent } from '../../src/data/content/apply';
import { NodeFsDriver } from '../../src/data/content/drivers/node-fs';
import { contentDriver } from '../helpers/content';

let root: string;
const write = (rel: string, data: unknown) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
};
const manifest = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  kind: 'hero',
  origin: 'user',
  apiVersion: 1,
  version: '1.0.0',
  dependsOn: [],
  ...extra,
});

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-content-screen-'));
  write('config.json', { enabledPacks: ['mine', 'broken', 'gg'] });
  write('packs/mine/pack.json', manifest('mine', 'My Pack'));
  write('packs/mine/cards/c.json', [
    { code: '99001', name: 'A', pack_code: 'mine', position: 1, quantity: 1 },
  ]);
  write('packs/broken/pack.json', '{ not json');
  write('packs/gg/pack.json', manifest('gg', 'Green Goblin', { dependsOn: ['missing'] }));
  write('packs/gg/scenarios/goblin/definition.json', { id: 'goblin', name: 'Goblin Raid' });
  await bootContent(new NodeFsDriver(root));
});

afterAll(async () => {
  fs.rmSync(root, { recursive: true, force: true });
  await bootContent(contentDriver);
});

describe('Content screen', () => {
  it('lists every pack with its state and the reason a pack did not load', () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    expect(screen.getByText('My Pack')).toBeTruthy();
    expect(screen.getByText('Data only')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('Needs pack')).toBeTruthy();
    expect(screen.getByText(/needs "missing"/)).toBeTruthy();
  });

  it('names a pack that did not load on the setup screens', () => {
    render(
      <GameSettingsProvider>
        <FailedPacksNotice />
      </GameSettingsProvider>,
    );
    expect(screen.getByText('Green Goblin')).toBeTruthy();
    expect(screen.getByText(/was not loaded: .*missing/)).toBeTruthy();
  });
});
