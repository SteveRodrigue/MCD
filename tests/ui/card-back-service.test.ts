import { describe, it, expect } from 'vitest';
import {
  getCardBackUrl,
  getCardBackFallbackColor,
  getCardBackTypeForCard,
} from '../../src/ui/services/card-cache-service';
import { CardType, FactionCode, NormalizedCard } from '../../src/engine/models';

describe('card-cache-service - Card Backs', () => {
  it('returns correct URLs for all 3 card back types', () => {
    expect(getCardBackUrl('player')).toBe('/back/player.png');
    expect(getCardBackUrl('encounter')).toBe('/back/encounter.png');
    expect(getCardBackUrl('villain')).toBe('/back/villain.png');
  });

  it('returns correct fallback colors for all 3 card back types', () => {
    expect(getCardBackFallbackColor('player')).toBe('#0284c7');
    expect(getCardBackFallbackColor('encounter')).toBe('#ea580c');
    expect(getCardBackFallbackColor('villain')).toBe('#7c3aed');
  });

  it('resolves correct card back type for different card varieties', () => {
    // Player card
    const heroCard = {
      type: CardType.HERO,
      faction: FactionCode.HERO,
    } as NormalizedCard;
    expect(getCardBackTypeForCard(heroCard)).toBe('player');

    const allyCard = {
      type: CardType.ALLY,
      faction: FactionCode.AGGRESSION,
    } as NormalizedCard;
    expect(getCardBackTypeForCard(allyCard)).toBe('player');

    // Encounter cards
    const minionCard = {
      type: CardType.MINION,
      faction: FactionCode.ENCOUNTER,
    } as NormalizedCard;
    expect(getCardBackTypeForCard(minionCard)).toBe('encounter');

    const treacheryCard = {
      type: CardType.TREACHERY,
      faction: FactionCode.ENCOUNTER,
    } as NormalizedCard;
    expect(getCardBackTypeForCard(treacheryCard)).toBe('encounter');

    const sideSchemeCard = {
      type: CardType.SIDE_SCHEME,
      faction: FactionCode.ENCOUNTER,
    } as NormalizedCard;
    expect(getCardBackTypeForCard(sideSchemeCard)).toBe('encounter');

    // Villain / Main Scheme cards
    const villainCard = {
      type: CardType.VILLAIN,
      faction: FactionCode.ENCOUNTER,
    } as NormalizedCard;
    expect(getCardBackTypeForCard(villainCard)).toBe('villain');

    const mainSchemeCard = {
      type: CardType.MAIN_SCHEME,
      faction: FactionCode.ENCOUNTER,
    } as NormalizedCard;
    expect(getCardBackTypeForCard(mainSchemeCard)).toBe('villain');

    // Null/undefined card fallback
    expect(getCardBackTypeForCard(null)).toBe('player');
    expect(getCardBackTypeForCard(undefined)).toBe('player');
  });
});
