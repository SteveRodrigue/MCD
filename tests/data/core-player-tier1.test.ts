import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';

/** Tier 1 data accuracy of the core player cards (#258). */
function ability(code: string, id: string) {
  const found = cardCatalog
    .getCard(code)!
    .enrichment!.abilities!.find((a) => a.id === id);
  expect(found, `${code} ${id}`).toBeDefined();
  return found!;
}

describe('core player cards Tier 1 data (#258)', () => {
  it('Indomitable 01082 is a Response that readies your hero', () => {
    const card = cardCatalog.getCard('01082')!;
    const a = card.enrichment!.abilities![0];
    expect(a.timing).toBe('RESPONSE');
    expect(a.trigger).toBe('ATTACK_DEFENDED');
    expect(a.cost?.discardSelf).toBe(true);
    expect(a.steps[0].effectParams?.target).toBe('SELF_HERO');
    expect(card.enrichment!.audit?.confidence).toBe(95);
  });

  it('Jennifer Walters 01019b ability id is i_object', () => {
    const ids = cardCatalog.getCard('01019b')!.enrichment!.abilities!.map((a) => a.id);
    expect(ids).toEqual(['i_object']);
  });

  it('Vision 01068 options use the canonical stats ATTACK and THWART', () => {
    const step = ability('01068', 'vision_boost').steps[0];
    const options = step.effectParams?.options as { id: string; params: { stat: string } }[];
    expect(options.map((o) => [o.id, o.params.stat])).toEqual([
      ['boost_thw', 'THWART'],
      ['boost_atk', 'ATTACK'],
    ]);
  });

  it('prompt strings match the printed text', () => {
    const futurist = ability('01029b', 'futurist').steps[0].effectParams;
    expect(futurist?.promptTitle).toBe('Futurist: Choose 1 card to add to your hand');
    const foresight = ability('01040b', 't_challa_foresight').steps[0].effectParams;
    expect(foresight?.promptTitle).toBe('Foresight: Choose 1 Black Panther upgrade');
    const fury = ability('01084', 'nick_fury_enters_play').steps[0].effectParams;
    const removeThreat = (fury?.options as { id: string; description: string }[]).find(
      (o) => o.id === 'remove_2_threat',
    )!;
    expect(removeThreat.description).toBe('Remove 2 threat from a scheme.');
  });

  it('Energy Channel 01018 has no counter cap', () => {
    expect(cardCatalog.getCard('01018')!.enrichment!.uses?.max).toBeUndefined();
  });
});
