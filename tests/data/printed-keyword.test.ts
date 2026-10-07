import { describe, it, expect } from 'vitest';
import { cardCatalog, hasPrintedKeyword, getPrintedKeywordValue } from '../../src/data/importer/card-loader';
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

describe('hasPrintedKeyword on the text of other packs: granting a keyword is not printing it (#243)', () => {
  const BISHOPS_RIFLE =
    "Restricted.\n<b>Hero Action</b> <i>(attack)</i>: Exhaust Bishop's Rifle and choose an enemy → deal 1 damage to that enemy for each resource card in your hand. This attack gains ranged.";
  const SOULSWORD =
    "Restricted.\nMagik's basic attacks gain piercing.\nWhile the top card of your deck has a [physical] or [wild] resource icon, Magik gets +1 ATK.";
  const FULL_BODY_CHARGE =
    "<b>Hero Action</b> <i>(attack)</i>: Deal 8 damage to an enemy. If your hero's remaining hit points are less than half, this attack gains overkill.";
  const UNUS =
    'Toughness.\nIf the amount of threat on Gene Pool is at least:\n• 3 — Unus gains retaliate 1.\n• 6 — Unus also gains stalwart.';
  const NATURAL_FLIGHT =
    'Remove 4 threat from a scheme. If you are Angel, this thwart ignores the crisis icon ([crisis]) and the patrol keyword.';

  it.each([
    ['Bishop’s Rifle 45004', BISHOPS_RIFLE, 'ranged'],
    ['Soulsword 45034', SOULSWORD, 'piercing'],
    ['Full-Body Charge 45045', FULL_BODY_CHARGE, 'overkill'],
    ['Unus 45059', UNUS, 'stalwart'],
    ['Unus 45059', UNUS, 'retaliate'],
    ['Natural Flight 42006', NATURAL_FLIGHT, 'patrol'],
  ])('%s does not print %s', (_card, text, keyword) => {
    expect(hasPrintedKeyword(text, keyword)).toBe(false);
  });

  it.each([
    ['Bishop’s Rifle 45004', BISHOPS_RIFLE, 'restricted'],
    ['Soulsword 45034', SOULSWORD, 'restricted'],
    ['Unus 45059', UNUS, 'toughness'],
    ['two keywords in one line', 'Steady. Toughness.\nForced Interrupt: x', 'steady'],
    ['reminder text', 'Piercing. <i>(Damage dealt by this attack ignores Toughness.)</i>', 'piercing'],
    ['reminder without period', 'Quickstrike <i>(This minion attacks first.)</i>', 'quickstrike'],
    ['bold tags', '<b>Ranged</b>.\nx', 'ranged'],
  ])('%s prints %s', (_card, text, keyword) => {
    expect(hasPrintedKeyword(text, keyword)).toBe(true);
  });
});

describe('getPrintedKeywordValue: the number of Retaliate N / Incite N, only when printed (#243)', () => {
  it.each([
    ['Retaliate 2. <i>(After this character is attacked, deal 2 damage to the attacker.)</i>', 'retaliate', 2],
    ['Retaliate 1 <i>(After this character is attacked, deal 1 damage to the attacking character.)</i>', 'retaliate', 1],
    ['Toughness.\nRetaliate 3.', 'retaliate', 3],
    ['Incite 1. <i>(reminder)</i>', 'incite', 1],
    ['<b>Incite</b> 2', 'incite', 2],
  ])('%j gives %s %d', (text, keyword, value) => {
    expect(getPrintedKeywordValue(text, keyword)).toBe(value);
  });

  it.each([
    ['• 3 — Unus gains retaliate 1.', 'retaliate'],
    ['This minion gains Retaliate 2 until the end of the round.', 'retaliate'],
    ['Retaliate. <i>(reminder)</i>', 'retaliate'],
    ['', 'retaliate'],
    [undefined, 'incite'],
  ])('%j gives no value for %s', (text, keyword) => {
    expect(getPrintedKeywordValue(text as string | undefined, keyword)).toBeUndefined();
  });
});

describe('Keyword tags in the catalog (core sets, #243)', () => {
  // Reviewed list of the cards the old substring rule tagged without printing the keyword.
  const GRANTS_ONLY: [string, string, Keyword | string][] = [
    ['01053', 'Relentless Assault', Keyword.OVERKILL],
    ['01099', 'Charge', Keyword.OVERKILL],
    ['01119', 'Solid-Sound Body', Keyword.RETALIATE],
    ['01153', 'Concussion Blasters', Keyword.RETALIATE],
  ];

  it.each(GRANTS_ONLY)('%s %s only grants the keyword and is not tagged %s', (code, _name, keyword) => {
    const card = cardCatalog.getCard(code)!;
    expect(card.keywords.map(String).some((k) => k === keyword || k.startsWith(`${keyword} `))).toBe(false);
  });

  it('every text keyword of a core card is printed on it', () => {
    const textKeywords = [
      Keyword.GUARD,
      Keyword.PATROL,
      Keyword.OVERKILL,
      Keyword.PIERCING,
      Keyword.QUICKSTRIKE,
      Keyword.RANGED,
      Keyword.RETALIATE,
      Keyword.SURGE,
      Keyword.STALWART,
      Keyword.STEADY,
    ];
    const coreCards = cardCatalog
      .getAllCards()
      .filter((c) => c.packCode === 'core' || c.packCode === 'core_encounter');
    expect(coreCards.length).toBeGreaterThan(100);
    for (const card of coreCards) {
      for (const tag of card.keywords.map(String)) {
        const name = tag.replace(/ \d+$/, '');
        if (!(textKeywords as string[]).includes(name)) continue;
        expect(hasPrintedKeyword(card.text, name), `${card.code} ${card.name} tagged ${tag}`).toBe(true);
      }
    }
  });

  it.each([['01040a', 'Retaliate 1'], ['01172', 'Retaliate 1'], ['01184', 'Retaliate 2']])('%s keeps its printed %s', (code, tag) => {
    expect(cardCatalog.getCard(code)!.keywords.map(String)).toContain(tag);
  });
});
