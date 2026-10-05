import { describe, it, expect } from 'vitest';
import { cardCatalog, hasPrintedKeyword } from '../../src/data/importer/card-loader';
import { Keyword } from '../../src/engine/models';

describe('hasPrintedKeyword: a keyword counts only when the card prints it as its own sentence (#218)', () => {
  it.each([
    ['Surge.\n<b>When Revealed</b>: Exhaust your identity card.', 'surge'],
    ['Surge. <i>(After this card is revealed, reveal 1 additional encounter card.)</i>\n<hr />\n[star] <b>Boost</b>: x', 'surge'],
    ['Surge <i>(After this card resolves, reveal 1 additional encounter card)</i>\n<b>When Revealed</b>: x', 'surge'],
    ['Surge .\nAttach to the villain.', 'surge'],
    ['Surge\n<hr />\n[star] <b>Boost</b>: x', 'surge'],
    ['<b>Surge</b>.\nWhen Revealed: x', 'surge'],
    ['Guard. <i>(reminder)</i>\nToughness. <i>(reminder)</i>', 'toughness'],
    ['Guard. <i>(reminder)</i>\nToughness. <i>(reminder)</i>', 'guard'],
    ['Surge. Guard.', 'guard'],
  ])('prints %j as keyword %s', (text, keyword) => {
    expect(hasPrintedKeyword(text, keyword)).toBe(true);
  });

  it.each([
    ['<b>When Revealed</b>: Rhino heals 4 damage. If no damage was healed this way, this card gains surge.', 'surge'],
    ['<b>When Revealed (Alter-Ego)</b>: This card gains surge.', 'surge'],
    ['Attach to the minion with the highest printed hit points. If there are no minions in play, this card gains surge.', 'surge'],
    ['<b>When Revealed</b>: Surge happens when you discard.', 'surge'],
    ['Guard. <i>(reminder)</i>', 'surge'],
    ['', 'surge'],
  ])('does not treat %j as printing %s', (text, keyword) => {
    expect(hasPrintedKeyword(text, keyword)).toBe(false);
  });
});

describe('Surge tag in the catalog (core encounter set)', () => {
  const PRINTED = ['01121', '01158', '01178', '01185', '01191', '01193'];
  const GAINS_SURGE_ONLY = [
    '01104', '01105', '01106', '01111', '01112', '01124', '01146', '01163', '01164',
    '01165', '01168', '01175', '01179', '01187', '01188', '01189', '01190',
  ];

  it.each(PRINTED)('%s is tagged Surge', (code) => {
    expect(cardCatalog.getCard(code)!.keywords).toContain(Keyword.SURGE);
  });

  it.each(GAINS_SURGE_ONLY)('%s only mentions "gains surge" and is not tagged Surge', (code) => {
    expect(cardCatalog.getCard(code)!.keywords).not.toContain(Keyword.SURGE);
  });
});
