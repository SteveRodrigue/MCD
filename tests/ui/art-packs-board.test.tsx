import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HeroZone } from '../../src/ui/components/board/HeroZone';
import { CardArtThumbnail } from '../../src/ui/components/cards/CardArtThumbnail';
import { CardContextMenu } from '../../src/ui/components/cards/CardContextMenu';
import { CardView } from '../../src/ui/components/cards/CardView';
import { ArtPackSettings } from '../../src/ui/components/setup/ArtPackSettings';
import { ContentScreen } from '../../src/ui/components/setup/ContentScreen';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  getLoadedContent,
  setDisabledArtPacks,
  setLoadedContent,
} from '../../src/data/content/store';
import type { ArtPackManifest } from '../../src/data/packs/art-pack';
import {
  AlterEgoCard,
  CardInstance,
  GameState,
  HeroCard,
  createCardInstance,
  setupGame,
} from '../../src/engine';
import {
  clearCardArtCache,
  gameArtCodes,
  preloadArtPackImages,
} from '../../src/ui/services/card-cache-service';
import { TestSession } from '../support/render-with-session';

const UPGRADED_DRONES = '01142';
const ULTRON_III = '01136';

const art = (file: string) => `/card-art/_art-tokens/${file}`;
const mk = (n: number) => ({ file: `mk${n}.png`, attack: n, hitPoints: n });
const tokens: ArtPackManifest = {
  id: 'tokens',
  name: 'Ultron tokens',
  description: 'Tokens for the Ultron scenario.',
  credit: { author: 'A. Artist', sourceUrl: 'https://example.com/a', unofficial: true },
  cards: {
    ultron_drone: [mk(1), mk(2), mk(3), mk(4)],
    '01001a': [{ file: 'hero.png' }], // a hero
    '01137a': [{ file: 'scheme.png' }], // a main scheme side
    '01143': [{ file: 'minion.png' }], // a minion with a printed card
    '01002': [{ file: 'ally.png' }], // a player card with official art
    '01100': [{ file: 'boost.png' }], // an encounter card dealt facedown
  },
};

const loaded = getLoadedContent();

function game(): GameState {
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId: 'ultron',
    difficulty: 'STANDARD',
    seed: 'ultron-drone-board',
    skipMulligan: true,
    players: [
      {
        id: 'p1',
        name: 'Peter Parker',
        hero: cardCatalog.getCard('01001a') as HeroCard,
        alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
        deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
      },
    ],
  });
  state.players[0].hand = [];
  return state;
}

function renderZone(state: GameState) {
  return render(
    <GameSettingsProvider>
      <TestSession state={state}>
        <HeroZone player={state.players[0]} seatNumber={1} isFocused={true} isMultiHero={false} />
      </TestSession>
    </GameSettingsProvider>,
  );
}

const minionsZone = () => screen.getByTestId('threat-zone-minions');
const droneImage = () => minionsZone().querySelector('img[alt="Drone"]') as HTMLImageElement | null;

function attachUpgradedDrones(state: GameState, count: number) {
  const environment = state.environments.find((e) => e.card.code === '01140') as CardInstance;
  for (let i = 0; i < count; i++) {
    environment.attachments = [
      ...(environment.attachments ?? []),
      createCardInstance(cardCatalog.getCard(UPGRADED_DRONES)!),
    ];
  }
}

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollBy = vi.fn();
});

afterEach(() => {
  setLoadedContent(loaded);
  setDisabledArtPacks([]);
  localStorage.clear();
});

describe('S1: no art pack', () => {
  it('S1: a Drone shows the labelled card back and its SCH and ATK badges', async () => {
    renderZone(game());
    expect(screen.getByTestId('drone-shell-label').textContent).toBe('Drone');
    expect(minionsZone().querySelector('[data-testid="card-view-facedown"]')).not.toBeNull();
    expect(droneImage()).toBeNull();
    expect(minionsZone().textContent).toContain('SCH 1');
    expect(minionsZone().textContent).toContain('ATK 1');
  });
});

describe('S2: art pack found', () => {
  beforeEach(() => setLoadedContent({ ...loaded, artPacks: [tokens] }));

  it('S2: a Drone shows its token and badges, never the real card name', async () => {
    const state = game();
    const { container } = renderZone(state);
    await waitFor(() => expect(droneImage()?.getAttribute('src')).toBe(art('mk1.png')));
    expect(screen.queryByTestId('drone-shell-label')).toBeNull();
    expect(minionsZone().querySelector('[data-testid="card-view-facedown"]')).toBeNull();
    expect(minionsZone().textContent).toContain('SCH 1');
    expect(minionsZone().textContent).toContain('ATK 1');
    expect(state.players[0].engagedMinions[0].cardsUnderneath?.[0].card.name).toBe(
      'Swinging Web Kick',
    );
    expect(container.innerHTML).not.toContain('Swinging Web Kick');
  });

  it('S2: the hover zoom shows the same token', async () => {
    renderZone(game());
    await waitFor(() => expect(droneImage()).not.toBeNull());
    fireEvent.mouseEnter(minionsZone().querySelector('[data-card-view="ultron_drone"]')!);
    const images = document.querySelectorAll('img[alt="Drone"]');
    images.forEach((image) => expect(image.getAttribute('src')).toBe(art('mk1.png')));
  });

  it('S2: a thumbnail for a Drone shows its token instead of a placeholder', async () => {
    render(<CardArtThumbnail cardCode="ultron_drone" cardName="Drone" />);
    await waitFor(() =>
      expect(screen.getByAltText('Drone').getAttribute('src')).toBe(art('mk1.png')),
    );
  });

  it('S2: the card menu credits the artist and says the art is unofficial', () => {
    const card = { ...cardCatalog.getCard('01001a')! };
    render(
      <GameSettingsProvider>
        <CardContextMenu card={card} position={{ x: 0, y: 0 }} onClose={() => {}} />
      </GameSettingsProvider>,
    );
    expect(screen.getByTestId('art-pack-credit').textContent).toBe('Art by A. Artist (unofficial)');
  });

  it('S2: the Content screen lists the art pack and its credit', () => {
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    expect(screen.getByTestId('art-packs').textContent).toContain('Ultron tokens');
    expect(screen.getByTestId('art-packs').textContent).toContain('A. Artist');
  });

  it('S2: the scenario preloads every token image', async () => {
    const stored: string[] = [];
    vi.stubGlobal('caches', {
      open: async () => ({
        match: async () => null,
        put: async (url: string) => stored.push(url),
      }),
      delete: async () => true,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('png')),
    );
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:token');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    try {
      await clearCardArtCache();
      await preloadArtPackImages(['ultron_drone', 'a_card_with_no_art_pack']);
      expect(stored.sort()).toEqual([1, 2, 3, 4].map((n) => art(`mk${n}.png`)));
    } finally {
      await clearCardArtCache();
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});

describe('S3: the token upgrades with the Drone', () => {
  beforeEach(() => setLoadedContent({ ...loaded, artPacks: [tokens] }));

  async function expectMark(state: GameState, file: string) {
    renderZone(state);
    await waitFor(() => expect(droneImage()?.getAttribute('src')).toBe(art(file)));
  }

  it('S3: 1 Upgraded Drones shows Mk. II', async () => {
    const state = game();
    attachUpgradedDrones(state, 1);
    await expectMark(state, 'mk2.png');
    expect(minionsZone().textContent).toContain('ATK 2');
  });

  it('S3: 2 Upgraded Drones shows Mk. III', async () => {
    const state = game();
    attachUpgradedDrones(state, 2);
    await expectMark(state, 'mk3.png');
    expect(minionsZone().textContent).toContain('ATK 3');
  });

  it('S3: Ultron III plus 2 Upgraded Drones shows Mk. IV', async () => {
    const state = game();
    state.villains[0].card = cardCatalog.getCard(ULTRON_III) as (typeof state.villains)[0]['card'];
    attachUpgradedDrones(state, 2);
    await expectMark(state, 'mk4.png');
    expect(minionsZone().textContent).toContain('ATK 4');
  });

  it('S3: discarding Upgraded Drones returns to Mk. I', async () => {
    const state = game();
    attachUpgradedDrones(state, 1);
    const view = renderZone(state);
    await waitFor(() => expect(droneImage()?.getAttribute('src')).toBe(art('mk2.png')));
    const environment = state.environments.find((e) => e.card.code === '01140') as CardInstance;
    const next = structuredClone(state);
    next.environments.find((e) => e.instanceId === environment.instanceId)!.attachments = [];
    view.rerender(
      <GameSettingsProvider>
        <TestSession state={next}>
          <HeroZone player={next.players[0]} seatNumber={1} isFocused={true} isMultiHero={false} />
        </TestSession>
      </GameSettingsProvider>,
    );
    await waitFor(() => expect(droneImage()?.getAttribute('src')).toBe(art('mk1.png')));
  });

  it('S3: a prompt thumbnail for an attacking Drone shows its current mark', async () => {
    const state = game();
    attachUpgradedDrones(state, 2);
    render(
      <TestSession state={state}>
        <CardArtThumbnail cardCode="ultron_drone" cardName="Drone" />
      </TestSession>,
    );
    await waitFor(() =>
      expect(screen.getByAltText('Drone').getAttribute('src')).toBe(art('mk3.png')),
    );
  });
});

describe('S4: a broken art pack never breaks the game', () => {
  it('S4: a Drone whose image fails shows the labelled card back', async () => {
    setLoadedContent({ ...loaded, artPacks: [tokens] });
    renderZone(game());
    await waitFor(() => expect(droneImage()).not.toBeNull());
    fireEvent.error(droneImage()!);
    await waitFor(() => expect(screen.getByTestId('drone-shell-label').textContent).toBe('Drone'));
    expect(minionsZone().querySelector('[data-testid="card-view-facedown"]')).not.toBeNull();
  });

  it('S4: the Content screen lists a failure and a warning', () => {
    setLoadedContent({
      ...loaded,
      failures: [{ packId: 'art-pack:bad', reason: 'credit is required' }],
      artPackWarnings: [
        { packId: 'art-pack:tokens', reason: 'card 99999 is in no installed pack' },
      ],
    });
    render(
      <GameSettingsProvider>
        <ContentScreen onBack={() => {}} />
      </GameSettingsProvider>,
    );
    expect(screen.getByTestId('art-packs').textContent).toContain('bad: credit is required');
    expect(screen.getByTestId('art-packs').textContent).toContain(
      'card 99999 is in no installed pack',
    );
  });
});

describe('S6: alternate art on any card', () => {
  beforeEach(() => setLoadedContent({ ...loaded, artPacks: [tokens] }));

  it.each([
    ['a hero', '01001a', 'hero.png'],
    ['a main scheme side', '01137a', 'scheme.png'],
    ['a minion', '01143', 'minion.png'],
    ['a player card', '01002', 'ally.png'],
  ])('S6: %s shows its art pack image', async (_name, code, file) => {
    const card = cardCatalog.getCard(code)!;
    render(<CardView card={card} />);
    await waitFor(() => expect(screen.getByAltText(card.name).getAttribute('src')).toBe(art(file)));
  });

  it('S6: a main scheme stays landscape', async () => {
    const card = cardCatalog.getCard('01137a')!;
    const { container } = render(<CardView card={card} />);
    await waitFor(() => expect(screen.getByAltText(card.name)).toBeDefined());
    expect(container.querySelector('.w-64.h-44')).not.toBeNull();
  });

  it('S6: an image that fails falls back to the official art', async () => {
    const card = cardCatalog.getCard('01001a')!;
    render(<CardView card={card} />);
    await waitFor(() =>
      expect(screen.getByAltText(card.name).getAttribute('src')).toBe(art('hero.png')),
    );
    fireEvent.error(screen.getByAltText(card.name));
    await waitFor(() =>
      expect(screen.getByAltText(card.name).getAttribute('src')).toBe('/card-art/core/01001a.png'),
    );
  });

  it('the Card Editor shows official art for a card listed in an art pack', async () => {
    const card = cardCatalog.getCard('01001a')!;
    render(<CardView card={card} officialArtOnly />);
    await waitFor(() =>
      expect(screen.getByAltText(card.name).getAttribute('src')).toBe('/card-art/core/01001a.png'),
    );
  });
});

describe('S3: identity art on the hero zone', () => {
  const heroArt = (file: string) => `/card-art/_art-heroes/${file}`;
  const heroes: ArtPackManifest = {
    id: 'heroes',
    name: 'Alternate heroes',
    description: 'Alternate identity cards.',
    credit: tokens.credit,
    cards: Object.fromEntries(
      ['01001a', '01001b', '29002a', '29002b', '12001c', '42001c', '31001a'].map((code) => [
        code,
        [{ file: `${code}.png` }],
      ]),
    ),
  };
  const identityImage = (code: string) => document.querySelector(`[data-card-view="${code}"] img`);

  beforeEach(() => setLoadedContent({ ...loaded, artPacks: [heroes] }));

  it('S3: the hero zone swaps the image when the hero changes form, and back', async () => {
    const alterEgoState = game();
    const heroState = structuredClone(alterEgoState);
    heroState.players[0].activeFormCard = heroState.players[0].hero;
    heroState.players[0].currentForm = 'hero';
    const zone = (state: GameState) => (
      <GameSettingsProvider>
        <TestSession state={state}>
          <HeroZone player={state.players[0]} seatNumber={1} isFocused={true} isMultiHero={false} />
        </TestSession>
      </GameSettingsProvider>
    );
    const view = render(zone(alterEgoState));
    await waitFor(() =>
      expect(identityImage('01001b')?.getAttribute('src')).toBe(heroArt('01001b.png')),
    );
    view.rerender(zone(heroState));
    await waitFor(() =>
      expect(identityImage('01001a')?.getAttribute('src')).toBe(heroArt('01001a.png')),
    );
    view.rerender(zone(alterEgoState));
    await waitFor(() =>
      expect(identityImage('01001b')?.getAttribute('src')).toBe(heroArt('01001b.png')),
    );
  });

  // The heroes outside Core have no starter deck, so the board gets their code directly.
  it.each([
    ['29002a', '01001a'],
    ['29002b', '01001b'],
    ['12001c', '01001a'],
    ['42001c', '01001a'],
    ['31001a', '01001a'],
  ])('S3: the hero zone shows the own image of identity %s', async (code, printedAs) => {
    const state = game();
    state.players[0].activeFormCard = { ...cardCatalog.getCard(printedAs)!, code };
    renderZone(state);
    await waitFor(() =>
      expect(identityImage(code)?.getAttribute('src')).toBe(heroArt(`${code}.png`)),
    );
  });

  it('S3: a hero the pack does not list keeps official art', async () => {
    setLoadedContent({ ...loaded, artPacks: [{ ...heroes, cards: {} }] });
    renderZone(game());
    await waitFor(() =>
      expect(identityImage('01001b')?.getAttribute('src')).toBe('/card-art/core/01001b.png'),
    );
  });

  describe('starting a game', () => {
    async function preloaded(): Promise<string[]> {
      const stored: string[] = [];
      vi.stubGlobal('caches', {
        open: async () => ({
          match: async () => null,
          put: async (url: string) => stored.push(url),
        }),
        delete: async () => true,
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('png')),
      );
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:identity');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      try {
        await clearCardArtCache();
        await preloadArtPackImages(gameArtCodes(game(), []));
        return stored.sort();
      } finally {
        await clearCardArtCache();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
      }
    }

    it('S3: preloads both faces of each hero', async () => {
      expect(await preloaded()).toEqual([heroArt('01001a.png'), heroArt('01001b.png')]);
    });

    it('S3: preloads nothing for a pack that is off', async () => {
      setDisabledArtPacks(['heroes']);
      expect(await preloaded()).toEqual([]);
    });

    it('S3: keeps the scenario tokens in the list', () => {
      expect(gameArtCodes(game(), ['ultron_drone'])).toEqual(['ultron_drone', '01001a', '01001b']);
    });
  });
});

describe('S7: art packs never reveal hidden cards', () => {
  it('S7: a facedown card listed in an art pack still shows its back', async () => {
    setLoadedContent({ ...loaded, artPacks: [tokens] });
    const card = cardCatalog.getCard('01143')!;
    const { container } = render(<CardView card={card} isFacedown />);
    expect(screen.getByTestId('card-view-facedown')).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve));
    expect(container.innerHTML).not.toContain('minion.png');
    expect(screen.queryByAltText(card.name)).toBeNull();
  });
});

describe('S7: switching an art pack off and on in a running game', () => {
  beforeEach(() => setLoadedContent({ ...loaded, artPacks: [tokens] }));

  it('S7: the Drone goes back to the labelled card back, then to its token, without a restart', async () => {
    const state = game();
    render(
      <GameSettingsProvider>
        <ArtPackSettings />
        <TestSession state={state}>
          <HeroZone player={state.players[0]} seatNumber={1} isFocused={true} isMultiHero={false} />
        </TestSession>
      </GameSettingsProvider>,
    );
    await waitFor(() => expect(droneImage()?.getAttribute('src')).toBe(art('mk1.png')));

    fireEvent.click(screen.getByRole('switch', { name: 'Use Ultron tokens' }));
    await waitFor(() => expect(droneImage()).toBeNull());
    expect(screen.getByTestId('drone-shell-label').textContent).toBe('Drone');
    expect(minionsZone().textContent).toContain('ATK 1');

    fireEvent.click(screen.getByRole('switch', { name: 'Use Ultron tokens' }));
    await waitFor(() => expect(droneImage()?.getAttribute('src')).toBe(art('mk1.png')));
    expect(screen.queryByTestId('drone-shell-label')).toBeNull();
  });
});
