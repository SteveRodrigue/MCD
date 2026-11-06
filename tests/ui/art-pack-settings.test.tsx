import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ArtPackSettings } from '../../src/ui/components/setup/ArtPackSettings';
import { ContentScreen } from '../../src/ui/components/setup/ContentScreen';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { STORAGE_KEY } from '../../src/ui/context/game-settings-context';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  getDisabledArtPacks,
  getLoadedContent,
  setDisabledArtPacks,
  setLoadedContent,
} from '../../src/data/content/store';
import type { ArtPackManifest } from '../../src/data/packs/art-pack';

const credit = { author: 'A. Artist', sourceUrl: 'https://example.com/a', unofficial: true };
const heroes: ArtPackManifest = {
  id: 'heroes',
  name: 'Alternate heroes',
  description: 'Alternate identity cards for the heroes.',
  credit,
  cards: {
    '01001a': [{ file: '01001a.png' }],
    '01001b': [{ file: '01001b.png' }],
    '99999': [{ file: 'unknown.png' }],
  },
};
const tokens: ArtPackManifest = {
  id: 'tokens',
  name: 'Ultron tokens',
  description: 'Drone tokens that grow with their stats.',
  credit,
  cards: { ultron_drone: [1, 2].map((n) => ({ file: `mk${n}.png`, attack: n, hitPoints: n })) },
};

const loaded = getLoadedContent();

function renderSettings() {
  return render(
    <GameSettingsProvider>
      <ArtPackSettings />
    </GameSettingsProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  setLoadedContent({
    ...loaded,
    artPacks: [heroes, tokens],
    artPackWarnings: [],
    artPackCardLabels: {
      '01001a': { name: cardCatalog.getCard('01001a')!.name, type: 'hero', source: 'card' },
      '01001b': { name: cardCatalog.getCard('01001b')!.name, type: 'alter_ego', source: 'card' },
      '12001a': { name: 'Ant-Man', type: 'hero', source: 'off-pack' },
      ultron_drone: { name: 'Drone', type: 'minion', source: 'token' },
    },
  });
});
afterEach(() => {
  setLoadedContent(loaded);
  setDisabledArtPacks([]);
  localStorage.clear();
});

describe('the art pack list', () => {
  it('shows name, description, credit and image count, with every pack on by default', () => {
    renderSettings();
    const row = screen.getByTestId('art-pack-row-heroes');
    expect(row.textContent).toContain('Alternate heroes');
    expect(row.textContent).toContain('Alternate identity cards for the heroes.');
    expect(row.textContent).toContain('Art by A. Artist (unofficial)');
    expect(row.textContent).toContain('3 images');
    expect(within(row).getByRole('switch').getAttribute('aria-checked')).toBe('true');
    expect(within(screen.getByTestId('art-pack-row-tokens')).getByRole('switch')).toBeTruthy();
  });

  it('says so, without an error, when no art pack is installed', () => {
    setLoadedContent({ ...loaded, artPacks: [] });
    renderSettings();
    expect(screen.getByTestId('art-packs-empty').textContent).toContain('No art packs installed');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('counts the problems of a pack', () => {
    setLoadedContent({
      ...loaded,
      artPacks: [heroes],
      artPackWarnings: [
        { packId: 'art-pack:heroes', reason: 'card 99999 is in no installed pack' },
      ],
    });
    renderSettings();
    expect(screen.getByTestId('art-pack-row-heroes').textContent).toContain('1 problem');
  });
});

describe('the switch', () => {
  it('turns a pack off for the art lookup, and on again', () => {
    renderSettings();
    const toggle = within(screen.getByTestId('art-pack-row-heroes')).getByRole('switch');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect([...getDisabledArtPacks()]).toEqual(['heroes']);
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect([...getDisabledArtPacks()]).toEqual([]);
  });

  it('is remembered across a reload, and a saved "off" applies before the first paint', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ disabledArtPacks: ['tokens'] }));
    renderSettings();
    expect([...getDisabledArtPacks()]).toEqual(['tokens']);
    expect(
      within(screen.getByTestId('art-pack-row-tokens'))
        .getByRole('switch')
        .getAttribute('aria-checked'),
    ).toBe('false');
    expect(
      within(screen.getByTestId('art-pack-row-heroes'))
        .getByRole('switch')
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('saves the choice in the browser', () => {
    renderSettings();
    fireEvent.click(within(screen.getByTestId('art-pack-row-heroes')).getByRole('switch'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string).disabledArtPacks).toEqual([
      'heroes',
    ]);
  });

  it.each([['not a list'], [42], [{ heroes: true }], [['heroes', 7, null]]])(
    'treats a damaged saved value (%j) as everything on, keeping valid ids',
    (value) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ disabledArtPacks: value }));
      renderSettings();
      const expected = Array.isArray(value) ? ['heroes'] : [];
      expect([...getDisabledArtPacks()]).toEqual(expected);
    },
  );

  it('still works when the browser refuses to store settings', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };
    try {
      renderSettings();
      fireEvent.click(within(screen.getByTestId('art-pack-row-heroes')).getByRole('switch'));
      expect([...getDisabledArtPacks()]).toEqual(['heroes']);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe('browsing a pack', () => {
  function browse(id: string) {
    fireEvent.click(within(screen.getByTestId(`art-pack-row-${id}`)).getByText('Browse'));
    return screen.getByTestId('art-pack-browser');
  }

  it('shows one tile per image with the card name, code and the pack text', () => {
    renderSettings();
    const modal = browse('heroes');
    const tiles = within(modal).getAllByTestId('art-pack-tile');
    expect(tiles).toHaveLength(3);
    const first = tiles.find((tile) => tile.textContent?.includes('01001a'))!;
    expect(first.textContent).toContain(cardCatalog.getCard('01001a')!.name);
    expect(first.textContent).toContain('Hero');
    expect(tiles.find((tile) => tile.textContent?.includes('01001b'))!.textContent).toContain(
      'Alter-ego',
    );
    expect(modal.textContent).toContain('Alternate identity cards for the heroes.');
    expect(modal.textContent).toContain('Art by A. Artist (unofficial)');
  });

  it('S2: an unknown code shows the code and "not in any installed pack"', () => {
    renderSettings();
    const unknown = within(browse('heroes'))
      .getAllByTestId('art-pack-tile')
      .find((tile) => tile.textContent?.includes('99999'))!;
    expect(unknown.textContent).toContain('not in any installed pack');
    expect(unknown.textContent).not.toContain('pack off');
  });

  it('shows a scenario token by name', () => {
    renderSettings();
    const [tile] = within(browse('tokens')).getAllByTestId('art-pack-tile');
    expect(tile.textContent).toContain('Drone');
    expect(tile.textContent).toContain('Token');
  });

  describe('a card of a pack that is off', () => {
    const offPackHeroes: ArtPackManifest = {
      ...heroes,
      cards: { '12001a': [{ file: '12001a.png' }], '01001a': [{ file: '01001a.png' }] },
    };

    beforeEach(() => {
      setLoadedContent({ ...getLoadedContent(), artPacks: [offPackHeroes] });
    });

    it('S2: shows its name and "pack off"', () => {
      renderSettings();
      const tile = within(browse('heroes'))
        .getAllByTestId('art-pack-tile')
        .find((candidate) => candidate.textContent?.includes('12001a'))!;
      expect(tile.textContent).toContain('Ant-Man');
      expect(tile.textContent).toContain('Hero');
      expect(tile.textContent).toContain('pack off');
    });

    it('S2: the filter finds it by name', () => {
      renderSettings();
      const modal = browse('heroes');
      fireEvent.change(within(modal).getByRole('searchbox'), { target: { value: 'ant-man' } });
      const tiles = within(modal).getAllByTestId('art-pack-tile');
      expect(tiles).toHaveLength(1);
      expect(tiles[0].textContent).toContain('12001a');
    });

    it('S2: a card of a loaded pack does not say "pack off"', () => {
      renderSettings();
      const tile = within(browse('heroes'))
        .getAllByTestId('art-pack-tile')
        .find((candidate) => candidate.textContent?.includes('01001a'))!;
      expect(tile.textContent).not.toContain('pack off');
    });
  });

  it('works for a pack that is switched off', () => {
    renderSettings();
    fireEvent.click(within(screen.getByTestId('art-pack-row-heroes')).getByRole('switch'));
    expect(within(browse('heroes')).getAllByTestId('art-pack-tile')).toHaveLength(3);
  });

  it('lists every stat image of a card with its printed stats', () => {
    renderSettings();
    const tiles = within(browse('tokens')).getAllByTestId('art-pack-tile');
    expect(tiles.map((tile) => tile.textContent)).toEqual([
      expect.stringContaining('ATK 1 / HP 1'),
      expect.stringContaining('ATK 2 / HP 2'),
    ]);
  });

  it('filters by card name or code', () => {
    renderSettings();
    const modal = browse('heroes');
    fireEvent.change(within(modal).getByRole('searchbox'), { target: { value: '01001b' } });
    expect(within(modal).getAllByTestId('art-pack-tile')).toHaveLength(1);
    fireEvent.change(within(modal).getByRole('searchbox'), { target: { value: 'zzz' } });
    expect(within(modal).queryAllByTestId('art-pack-tile')).toHaveLength(0);
    expect(within(modal).getByTestId('art-pack-no-match').textContent).toContain('No image');
  });

  it('enlarges a tile whole and unaltered, then goes back', () => {
    renderSettings();
    const modal = browse('heroes');
    fireEvent.click(within(modal).getAllByTestId('art-pack-tile')[0]);
    const enlarged = within(modal).getByTestId('art-pack-enlarged');
    const image = enlarged.querySelector('img')!;
    expect(image.getAttribute('src')).toBe('/card-art/_art-heroes/01001a.png');
    expect(image.className).not.toMatch(/object-cover|crop/);
    fireEvent.click(within(enlarged).getByText('Back to all'));
    expect(within(modal).queryByTestId('art-pack-enlarged')).toBeNull();
  });

  it('shows a placeholder, not an error, for an image that fails to load', () => {
    renderSettings();
    const modal = browse('heroes');
    const image = within(modal).getAllByRole('img')[0];
    fireEvent.error(image);
    expect(within(modal).getAllByTestId('art-pack-tile-missing')).toHaveLength(1);
  });

  it('closes', () => {
    renderSettings();
    browse('heroes');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('art-pack-browser')).toBeNull();
  });
});

describe('the Content screen', () => {
  it('lists art packs with the switch, and keeps the problem list', () => {
    setLoadedContent({
      ...loaded,
      artPacks: [heroes],
      artPackWarnings: [
        { packId: 'art-pack:heroes', reason: 'card 99999 is in no installed pack' },
      ],
    });
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    const section = screen.getByTestId('art-packs');
    expect(within(section).getByRole('switch')).toBeTruthy();
    expect(within(section).getByRole('alert').textContent).toContain(
      'card 99999 is in no installed pack',
    );
  });

  it('shows the empty state with no art pack installed', () => {
    setLoadedContent({ ...loaded, artPacks: [], artPackWarnings: [] });
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    expect(screen.getByTestId('art-packs-empty')).toBeTruthy();
  });
});
