import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { ContentScreen } from '../../src/ui/components/setup/ContentScreen';
import { FailedPacksNotice } from '../../src/ui/components/setup/FailedPacksNotice';
import { bootContent } from '../../src/data/content/apply';
import { getLoadedContent, setLoadedContent } from '../../src/data/content/store';
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
  write('packs/second/pack.json', manifest('second', 'Second Pack'));
  write('packs/second/cards/c.json', [
    { code: '99002', name: 'B', pack_code: 'second', position: 1, quantity: 1 },
  ]);
  write('packs/broken/pack.json', '{ not json');
  write('packs/gg/pack.json', manifest('gg', 'Green Goblin', { dependsOn: ['missing'] }));
  write('packs/gg/scenarios/goblin/definition.json', { id: 'goblin', name: 'Goblin Raid' });
  await bootContent(new NodeFsDriver(root));
});

afterAll(async () => {
  fs.rmSync(root, { recursive: true, force: true });
  await bootContent(contentDriver);
}, 30000);

describe('Content screen', () => {
  it('lists every pack with its state and the reason a pack did not load', () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    expect(screen.getByText('My Pack')).toBeTruthy();
    expect(screen.getAllByText('Data only').length).toBeGreaterThan(0);
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('Needs pack')).toBeTruthy();
    expect(screen.getByText(/needs "missing"/)).toBeTruthy();
  });

  it('colours each state tag: green playable, yellow data only, orange needs pack, red failed', () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    expect(screen.getAllByText('Data only')[0].className).toContain('bg-comic-yellow');
    expect(screen.getByText('Needs pack').className).toContain('bg-orange-500');
    expect(screen.getByText('Failed').className).toContain('bg-comic-red');
  });

  it('colours a playable pack green', () => {
    const loaded = getLoadedContent();
    setLoadedContent({
      ...loaded,
      descriptions: [{ ...loaded.descriptions[0], state: 'playable', reason: undefined }],
    });
    try {
      render(
        <GameSettingsProvider>
          <ContentScreen onBack={() => {}} />
        </GameSettingsProvider>,
      );
      expect(screen.getByText('Playable').className).toContain('bg-emerald-600');
    } finally {
      setLoadedContent(loaded);
    }
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

  it('disables the switch for packs with failed state or missing dependency', () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    const brokenSwitch = screen.getByRole('switch', { name: 'Enable broken' }) as HTMLButtonElement;
    expect(brokenSwitch.disabled).toBe(true);
    const ggSwitch = screen.getByRole('switch', {
      name: 'Enable Green Goblin',
    }) as HTMLButtonElement;
    expect(ggSwitch.disabled).toBe(true);
  });

  it('toggles an unenabled ready pack on, writing config.json and updating state', async () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    const secondSwitch = screen.getByRole('switch', {
      name: 'Enable Second Pack',
    }) as HTMLButtonElement;
    expect(secondSwitch.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(secondSwitch);

    await waitFor(() => {
      expect(secondSwitch.getAttribute('aria-checked')).toBe('true');
    });

    const savedConfig = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf-8'));
    expect(savedConfig.enabledPacks).toContain('second');
  });

  it('resets enabled packs to default core on Reset to Default button click', async () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    const resetButton = screen.getByRole('button', { name: 'Reset to Default' });
    fireEvent.click(resetButton);

    await waitFor(() => {
      const savedConfig = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf-8'));
      expect(savedConfig.enabledPacks).toEqual(['core']);
    });
  });
});
