import { describe, it, expect } from 'vitest';
import {
  normalizeCardCodeForArt,
  getRemoteMarvelCdbUrl,
  getCardArtUrl,
} from '../../src/ui/services/card-cache-service';

describe('Card Art Caching & Multi-Sided Asset Resolution Service', () => {
  it('correctly normalizes single-sided and multi-sided card codes', () => {
    expect(normalizeCardCodeForArt('01001a')).toBe('01001a');
    expect(normalizeCardCodeForArt('01001b')).toBe('01001b');
    expect(normalizeCardCodeForArt('01097A')).toBe('01097a');
    expect(normalizeCardCodeForArt('01097B')).toBe('01097b');
    expect(normalizeCardCodeForArt(' 01006 ')).toBe('01006');
    expect(normalizeCardCodeForArt('')).toBe('');
  });

  it('constructs correct MarvelCDB CDN endpoints for multi-sided identity and scheme cards', () => {
    // Spider-Man Hero side (A)
    expect(getRemoteMarvelCdbUrl('01001a')).toBe('https://marvelcdb.com/bundles/cards/01001a.png');

    // Peter Parker Alter-Ego side (B)
    expect(getRemoteMarvelCdbUrl('01001b')).toBe('https://marvelcdb.com/bundles/cards/01001b.png');

    // Rhino Villain Stage I
    expect(getRemoteMarvelCdbUrl('01094')).toBe('https://marvelcdb.com/bundles/cards/01094.png');

    // The Break-In! Main Scheme 1B
    expect(getRemoteMarvelCdbUrl('01097b')).toBe('https://marvelcdb.com/bundles/cards/01097b.png');

    // Swinging Web Kick Player Event
    expect(getRemoteMarvelCdbUrl('01006')).toBe('https://marvelcdb.com/bundles/cards/01006.png');
  });

  it('returns valid URL string from getCardArtUrl', async () => {
    const url = await getCardArtUrl('01001a');
    expect(url).toBeDefined();
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });
});
