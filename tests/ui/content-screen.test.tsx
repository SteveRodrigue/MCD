import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
  write('packs/second/supplemental/c.json', { cards: { '99002': {} } });
  write('packs/partial/pack.json', manifest('partial', 'Partial Pack'));
  write('packs/partial/cards/c.json', [
    { code: '99003', name: 'C', pack_code: 'partial', position: 1, quantity: 1 },
    { code: '99004', name: 'D', pack_code: 'partial', position: 2, quantity: 1 },
  ]);
  write('packs/partial/supplemental/c.json', { cards: { '99003': {} } });
  write('packs/thor/pack.json', manifest('thor', 'Thor', { origin: 'official-bundled' }));
  write('packs/thor/cards/c.json', [
    { code: '99005', name: 'E', pack_code: 'thor', position: 1, quantity: 1 },
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
    expect(screen.getAllByText('Error').length).toBeGreaterThan(0);
    expect(screen.getByText('Incomplete')).toBeTruthy();
    expect(screen.getByText('1 of 2 cards have supplemental data')).toBeTruthy();
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('Needs pack')).toBeTruthy();
    expect(screen.getByText(/needs "missing"/)).toBeTruthy();
  });

  it('colours each state tag: yellow incomplete, orange needs pack, red error and failed', () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    expect(screen.getByText('Incomplete').className).toContain('bg-comic-yellow');
    expect(screen.getAllByText('Error')[0].className).toContain('bg-comic-red');
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

  it('refuses to switch on a pack with no supplemental data', () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    const thorSwitch = screen.getByRole('switch', { name: 'Enable Thor' }) as HTMLButtonElement;
    expect(thorSwitch.disabled).toBe(true);
  });

  it('shows the image line beside the supplemental reason on an Error pack', () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    const row = within(screen.getByTestId('pack-row-thor'));
    expect(row.getByText('Error')).toBeTruthy();
    expect(row.getByText('no supplemental data')).toBeTruthy();
    expect(row.getByText('no images downloaded yet')).toBeTruthy();
  });

  it('keeps the switch at the right of a pack row when the text is long', () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    const row = screen.getByTestId('pack-row-partial');
    const [text, toggle] = Array.from(row.children);
    expect(row.className).not.toContain('flex-wrap');
    expect(text.className).toContain('flex-1');
    expect(text.className).toContain('min-w-0');
    expect(toggle).toBe(screen.getByRole('switch', { name: 'Enable Partial Pack' }));
  });

  it('lets a partial pack be switched on and tags it Incomplete', async () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    const partialSwitch = screen.getByRole('switch', {
      name: 'Enable Partial Pack',
    }) as HTMLButtonElement;
    fireEvent.click(partialSwitch);
    await waitFor(() => {
      expect(partialSwitch.getAttribute('aria-checked')).toBe('true');
    });
    expect(within(screen.getByTestId('pack-row-partial')).getByText('Incomplete')).toBeTruthy();
  });

  it('a Playable pack with no images can still be switched on', async () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    const row = within(screen.getByTestId('pack-row-second'));
    expect(row.getByText('Playable')).toBeTruthy();
    expect(row.getByText('no images')).toBeTruthy();
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

  it('lets a Failed, Needs pack or Error pack that is on be switched off', async () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    for (const [packId, label] of [
      ['broken', 'Enable broken'],
      ['gg', 'Enable Green Goblin'],
      ['mine', 'Enable My Pack'],
    ]) {
      const packSwitch = screen.getByRole('switch', { name: label }) as HTMLButtonElement;
      expect(packSwitch.disabled).toBe(false);
      fireEvent.click(packSwitch);
      await waitFor(() => {
        const saved = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf-8'));
        expect(saved.enabledPacks).not.toContain(packId);
      });
      await waitFor(() => {
        expect(packSwitch.getAttribute('aria-checked')).toBe('false');
      });
    }
    // Off again: broken and without supplemental data, so neither can be switched back on.
    expect(
      (screen.getByRole('switch', { name: 'Enable broken' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('switch', { name: 'Enable My Pack' }) as HTMLButtonElement).disabled,
    ).toBe(true);
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
