import { describe, it, expect } from 'vitest';
import { cardCatalog, normalizeRawCard } from '../../src/data/importer/card-loader';
import { CardType, RawUpstreamCard } from '@engine/models';

describe('Automatic Ability Labels Derivation (Issue #270)', () => {
  it('derives printed labels for single-ability cards in the catalog', () => {
    // Backflip (01003): <b>Interrupt</b> <i>(defense)</i>:
    const backflip = cardCatalog.getCard('01003')!;
    expect(backflip.enrichment?.abilities?.[0].labels).toEqual(['DEFENSE']);

    // For Justice! (01060): <b>Hero Action</b> <i>(thwart)</i>:
    const forJustice = cardCatalog.getCard('01060')!;
    expect(forJustice.enrichment?.abilities?.[0].labels).toEqual(['THWART']);

    // Legal Practice (01023): <b>Alter-Ego Action</b> <i>(thwart)</i>:
    const legalPractice = cardCatalog.getCard('01023')!;
    expect(legalPractice.enrichment?.abilities?.[0].labels).toEqual(['THWART']);

    // Uppercut (01054): <b>Hero Action</b> <i>(attack)</i>:
    const uppercut = cardCatalog.getCard('01054')!;
    expect(uppercut.enrichment?.abilities?.[0].labels).toEqual(['ATTACK']);
  });

  it('maps multi-ability cards by timing (Energy Channel 01018)', () => {
    const energyChannel = cardCatalog.getCard('01018')!;
    const abilities = energyChannel.enrichment?.abilities || [];
    const addCounterAbility = abilities.find((a) => a.id === 'energy_channel_add');
    const blastAbility = abilities.find((a) => a.id === 'energy_channel_blast');

    expect(addCounterAbility?.labels).toBeUndefined();
    expect(blastAbility?.labels).toEqual(['ATTACK']);
  });

  it('parses composite labels (attack/defense, attack/thwart, defense/thwart, attack/defense/thwart)', () => {
    const testCard = (text: string, timing: any = 'HERO_ACTION') => {
      const raw: RawUpstreamCard = {
        code: 'test_composite',
        name: 'Test Composite',
        type_code: CardType.EVENT,
        text,
      } as any;
      const enrichment = {
        abilities: [
          {
            id: 'test_ab',
            timing,
            steps: [],
          },
        ],
      };
      return normalizeRawCard(raw, { test_composite: enrichment });
    };

    const cardAtkDef = testCard('<b>Hero Action</b> <i>(attack/defense)</i>: Do something.');
    expect(cardAtkDef.enrichment?.abilities?.[0].labels).toEqual(['ATTACK', 'DEFENSE']);

    const cardDefThw = testCard('<b>Hero Action</b> <i>(defense/thwart)</i>: Do something.');
    expect(cardDefThw.enrichment?.abilities?.[0].labels).toEqual(['DEFENSE', 'THWART']);

    const cardAtkThw = testCard('<b>Hero Action</b> <i>(attack/thwart)</i>: Do something.');
    expect(cardAtkThw.enrichment?.abilities?.[0].labels).toEqual(['ATTACK', 'THWART']);

    const cardTri = testCard('<b>Hero Action</b> <i>(attack/defense/thwart)</i>: Do something.');
    expect(cardTri.enrichment?.abilities?.[0].labels).toEqual(['ATTACK', 'DEFENSE', 'THWART']);
  });
});
