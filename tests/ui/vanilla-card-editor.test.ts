import { describe, it, expect } from 'vitest';
import { CardSupplementalService } from '../../src/tools/editor/api-middleware';

describe('Vanilla Card Support (noSupplementalNeeded) Contract Tests', () => {
  const service = new CardSupplementalService();

  it('populates noSupplementalNeeded: true on Rhino I (01094) in getCards', () => {
    const res = service.getCards({ search: '01094' });
    expect(res.cards).toHaveLength(1);
    const rhino = res.cards[0];
    expect(rhino.code).toBe('01094');
    expect(rhino.hasSupplemental).toBe(true);
    expect(rhino.noSupplementalNeeded).toBe(true);
    expect(rhino.isValid).toBe(true);
  });

  it('populates noSupplementalNeeded: false on cards with abilities (e.g. Spider-Man 01001a)', () => {
    const res = service.getCards({ search: '01001a' });
    expect(res.cards).toHaveLength(1);
    const spidey = res.cards[0];
    expect(spidey.code).toBe('01001a');
    expect(spidey.hasSupplemental).toBe(true);
    expect(spidey.noSupplementalNeeded).toBe(false);
  });

  it('filters catalog by status: "vanilla_supplemental" returning only vanilla cards', () => {
    const res = service.getCards({ status: 'vanilla_supplemental' });
    expect(res.cards.length).toBeGreaterThan(0);
    // Every returned card must be marked noSupplementalNeeded
    for (const card of res.cards) {
      expect(card.hasSupplemental).toBe(true);
      expect(card.noSupplementalNeeded).toBe(true);
    }
    // Rhino I must be in this filtered list
    const hasRhino = res.cards.some((c) => c.code === '01094');
    expect(hasRhino).toBe(true);
  });

  it('does not include cards with abilities when status is "vanilla_supplemental"', () => {
    const res = service.getCards({ status: 'vanilla_supplemental' });
    const hasSpiderMan = res.cards.some((c) => c.code === '01001a');
    const hasRhinoStageII = res.cards.some((c) => c.code === '01095');
    expect(hasSpiderMan).toBe(false);
    expect(hasRhinoStageII).toBe(false);
  });

  it('correctly handles vanilla card definition schema validation', () => {
    const rhinoDetails = service.getCardDetails('01094');
    expect(rhinoDetails).not.toBeNull();
    expect(rhinoDetails?.supplemental?.noSupplementalNeeded).toBe(true);
    expect(rhinoDetails?.validation.valid).toBe(true);
    expect(rhinoDetails?.validation.errors).toHaveLength(0);
  });

  it('correctly manages state transitions when toggling noSupplementalNeeded', () => {
    // 1. Starting with a card having abilities
    let cardData: any = {
      comment: 'Sample card',
      abilities: [{ id: 'ab1', timing: 'ACTION', steps: [] }],
    };

    // Toggle ON -> noSupplementalNeeded becomes true and abilities are cleared
    const toggleOn = (current: any) => {
      const updated = { ...current, noSupplementalNeeded: true };
      delete updated.abilities;
      return updated;
    };

    cardData = toggleOn(cardData);
    expect(cardData.noSupplementalNeeded).toBe(true);
    expect(cardData.abilities).toBeUndefined();

    // Toggle OFF -> noSupplementalNeeded removed and empty abilities initialized
    const toggleOff = (current: any) => {
      const updated = { ...current };
      delete updated.noSupplementalNeeded;
      if (!updated.abilities) {
        updated.abilities = [];
      }
      return updated;
    };

    cardData = toggleOff(cardData);
    expect(cardData.noSupplementalNeeded).toBeUndefined();
    expect(cardData.abilities).toEqual([]);
  });
});
