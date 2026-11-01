import { describe, it, expect } from 'vitest';
import {
  artFileName,
  artPackId,
  cardBackUrl,
  localArtUrl,
  remoteArtUrl,
} from '../../src/data/content/card-art';
import { CardType } from '../../src/engine/models';

describe('card art naming and URLs', () => {
  describe('artFileName', () => {
    it('names a hero, an alter-ego and a villain by their code', () => {
      expect(artFileName({ code: '01001a', type: CardType.HERO })).toBe('01001a.png');
      expect(artFileName({ code: '01001b', type: CardType.ALTER_EGO })).toBe('01001b.png');
      expect(artFileName({ code: '01094', type: CardType.VILLAIN })).toBe('01094.png');
      expect(artFileName('01006')).toBe('01006.png');
    });

    it('maps main scheme sides in the standard order unless the pack declares them swapped', () => {
      const a = { code: '02004a', type: CardType.MAIN_SCHEME, stage: '1A' };
      const b = { code: '02004b', type: CardType.MAIN_SCHEME, stage: '1B' };
      expect(artFileName(a)).toBe('02004.png');
      expect(artFileName(b)).toBe('02004b.png');
      expect(artFileName(a, false)).toBe('02004.png');
    });

    it('swaps the two main scheme sides for a pack that declares it', () => {
      const a = { code: '01097a', type: CardType.MAIN_SCHEME, stage: '1A' };
      const b = { code: '01097b', type: CardType.MAIN_SCHEME, stage: '1B' };
      expect(artFileName(a, true)).toBe('01097b.png');
      expect(artFileName(b, true)).toBe('01097.png');
    });

    it('does not decide anything from the card code prefix', () => {
      const a = { code: '01097a', type: CardType.MAIN_SCHEME, stage: '1A' };
      expect(artFileName(a)).toBe('01097.png');
    });

    it('names a user pack card and tolerates an empty code', () => {
      expect(artFileName({ code: 'my-hero-pack-0001a' })).toBe('my-hero-pack-0001a.png');
      expect(artFileName({ code: '' })).toBe('');
    });
  });

  describe('with the Core pack loaded', () => {
    it('finds the owning pack of a card', () => {
      expect(artPackId('01001a')).toBe('core');
      expect(artPackId('nope-0001')).toBeUndefined();
    });

    it('builds pack-aware local and remote URLs, with the Core main scheme sides swapped', () => {
      expect(localArtUrl({ code: '01001a', type: CardType.HERO })).toBe('/card-art/core/01001a.png');
      expect(localArtUrl({ code: '01097a', type: CardType.MAIN_SCHEME, stage: '1A' })).toBe(
        '/card-art/core/01097b.png',
      );
      expect(localArtUrl({ code: '01097b', type: CardType.MAIN_SCHEME, stage: '1B' })).toBe(
        '/card-art/core/01097.png',
      );
      expect(remoteArtUrl({ code: '01097a', type: CardType.MAIN_SCHEME, stage: '1A' })).toBe(
        'https://marvelcdb.com/bundles/cards/01097b.png',
      );
      expect(remoteArtUrl('01006')).toBe('https://marvelcdb.com/bundles/cards/01006.png');
    });

    it('returns no URL for a card no loaded pack owns', () => {
      expect(localArtUrl('nope-0001')).toBe('');
      expect(remoteArtUrl('nope-0001')).toBe('');
    });
  });

  it('puts the generic card backs under the _backs pseudo pack', () => {
    expect(cardBackUrl('player')).toBe('/card-art/_backs/player.png');
    expect(cardBackUrl('villain')).toBe('/card-art/_backs/villain.png');
  });
});
