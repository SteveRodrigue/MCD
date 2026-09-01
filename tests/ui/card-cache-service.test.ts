import { describe, it, expect } from 'vitest';
import {
  getCardArtFileName,
  normalizeCardCodeForArt,
  getLocalCardArtUrl,
  getRemoteMarvelCdbUrl,
  getCardArtUrl,
} from '../../src/ui/services/card-cache-service';
import { CardType } from '../../src/engine/models';

describe('Card Art Caching & Multi-Sided Asset Resolution Service', () => {
  it('correctly normalizes card codes for legacy callers', () => {
    expect(normalizeCardCodeForArt({ code: '01097a', type: CardType.MAIN_SCHEME, stage: '1A' })).toBe('01097');
    expect(normalizeCardCodeForArt({ code: '01097b', type: CardType.MAIN_SCHEME, stage: '1B' })).toBe('01097b');
    expect(normalizeCardCodeForArt({ code: '01001a', type: CardType.HERO })).toBe('01001a');
  });

  it('correctly resolves card image file names using type_code and stage', () => {
    // Main Scheme Stage 1A (Side A -> 01097.png)
    expect(
      getCardArtFileName({
        code: '01097a',
        type: CardType.MAIN_SCHEME,
        stage: '1A',
      })
    ).toBe('01097.png');

    // Main Scheme Stage 1B (Side B -> 01097b.png)
    expect(
      getCardArtFileName({
        code: '01097b',
        type: CardType.MAIN_SCHEME,
        stage: '1B',
      })
    ).toBe('01097b.png');

    // Main Scheme Stage 2A (Side A -> 01117.png)
    expect(
      getCardArtFileName({
        code: '01117a',
        type: 'main_scheme',
        stage: '2A',
      })
    ).toBe('01117.png');

    // Hero identity (01001a.png)
    expect(
      getCardArtFileName({
        code: '01001a',
        type: CardType.HERO,
      })
    ).toBe('01001a.png');

    // Alter-Ego identity (01001b.png)
    expect(
      getCardArtFileName({
        code: '01001b',
        type: CardType.ALTER_EGO,
      })
    ).toBe('01001b.png');

    // Villain (01094.png)
    expect(
      getCardArtFileName({
        code: '01094',
        type: CardType.VILLAIN,
        stage: 'I',
      })
    ).toBe('01094.png');

    // Event card (01006.png)
    expect(
      getCardArtFileName({
        code: '01006',
        type: CardType.EVENT,
      })
    ).toBe('01006.png');
  });

  it('constructs correct MarvelCDB CDN endpoints for multi-sided identity and scheme cards', () => {
    // Spider-Man Hero side (A -> 01001a.png)
    expect(getRemoteMarvelCdbUrl({ code: '01001a', type: CardType.HERO })).toBe(
      'https://marvelcdb.com/bundles/cards/01001a.png'
    );

    // Peter Parker Alter-Ego side (B -> 01001b.png)
    expect(getRemoteMarvelCdbUrl({ code: '01001b', type: CardType.ALTER_EGO })).toBe(
      'https://marvelcdb.com/bundles/cards/01001b.png'
    );

    // Rhino Villain Stage I
    expect(getRemoteMarvelCdbUrl({ code: '01094', type: CardType.VILLAIN })).toBe(
      'https://marvelcdb.com/bundles/cards/01094.png'
    );

    // The Break-In! Main Scheme 1A
    expect(getRemoteMarvelCdbUrl({ code: '01097a', type: CardType.MAIN_SCHEME, stage: '1A' })).toBe(
      'https://marvelcdb.com/bundles/cards/01097.png'
    );

    // The Break-In! Main Scheme 1B
    expect(getRemoteMarvelCdbUrl({ code: '01097b', type: CardType.MAIN_SCHEME, stage: '1B' })).toBe(
      'https://marvelcdb.com/bundles/cards/01097b.png'
    );

    // Swinging Web Kick Player Event
    expect(getRemoteMarvelCdbUrl('01006')).toBe('https://marvelcdb.com/bundles/cards/01006.png');
  });

  it('constructs correct local static paths for offline card assets', () => {
    expect(getLocalCardArtUrl({ code: '01001a', type: CardType.HERO })).toBe('/cards/01001a.png');
    expect(getLocalCardArtUrl({ code: '01001b', type: CardType.ALTER_EGO })).toBe('/cards/01001b.png');
    expect(getLocalCardArtUrl({ code: '01097a', type: CardType.MAIN_SCHEME, stage: '1A' })).toBe('/cards/01097.png');
    expect(getLocalCardArtUrl({ code: '01097b', type: CardType.MAIN_SCHEME, stage: '1B' })).toBe('/cards/01097b.png');
  });

  it('returns valid local-first URL string from getCardArtUrl', async () => {
    const url = await getCardArtUrl({ code: '01001a', type: CardType.HERO });
    expect(url).toBe('/cards/01001a.png');
  });
});
