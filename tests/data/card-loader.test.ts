import { describe, it, expect } from 'vitest';
import {
  parseTraits,
  parseResources,
  CardCatalog,
  normalizeRawCard,
} from '@data/importer/card-loader';
import {
  CardType,
  FactionCode,
  HeroCard,
  AlterEgoCard,
  VillainCard,
  SideSchemeCard,
  MinionCard,
} from '@engine/models';
import { matchesCardFilter } from '@engine/effects';

// Import real upstream JSON datasets directly
import { loadedRawCards, rawCardsOf } from '../helpers/content';

const allCoreCards = loadedRawCards('core');
// core.json holds the player and hero cards; core_encounter.json holds the encounter-faction cards.
const corePack = allCoreCards.filter((c) => c.faction_code !== 'encounter');
const coreEncounterPack = allCoreCards.filter((c) => c.faction_code === 'encounter');
const ttEncounterPack = (await rawCardsOf('tt')).filter((c) => c.faction_code === 'encounter');
const aosEncounterPack = (await rawCardsOf('aos')).filter((c) => c.faction_code === 'encounter');

describe('Card Loader & Normalizer Unit Tests', () => {
  describe('Helper Parsers', () => {
    it('correctly parses compound and single traits', () => {
      expect(parseTraits('Avenger. Web-Warrior.')).toEqual(['Avenger', 'Web-Warrior']);
      expect(parseTraits('Genius.')).toEqual(['Genius']);
      expect(parseTraits('')).toEqual([]);
      expect(parseTraits(undefined)).toEqual([]);
    });

    it('preserves acronym traits with internal periods (e.g. S.H.I.E.L.D., A.I.M.) without decomposing into single letters (#72)', () => {
      expect(parseTraits('S.H.I.E.L.D. Soldier.')).toEqual(['S.H.I.E.L.D.', 'Soldier']);
      expect(parseTraits('Location. S.H.I.E.L.D.')).toEqual(['Location', 'S.H.I.E.L.D.']);
      expect(parseTraits('S.H.I.E.L.D.')).toEqual(['S.H.I.E.L.D.']);
      expect(parseTraits('A.I.M. Genius.')).toEqual(['A.I.M.', 'Genius']);
      expect(parseTraits("Batroc's Brigade. Mercenary.")).toEqual(["Batroc's Brigade", 'Mercenary']);
      expect(parseTraits('Trap!')).toEqual(['Trap!']);
    });

    it('matches S.H.I.E.L.D. cards case- and punctuation-insensitively via matchesCardFilter (#72)', () => {
      const card = {
        code: '01010b',
        name: 'Carol Danvers',
        traits: ['S.H.I.E.L.D.', 'Soldier'],
      } as any;

      expect(matchesCardFilter(card, { traits: ['S.H.I.E.L.D.'] })).toBe(true);
      expect(matchesCardFilter(card, { traits: ['SHIELD'] })).toBe(true);
      expect(matchesCardFilter(card, { traits: ['shield'] })).toBe(true);
      expect(matchesCardFilter(card, { traits: ['shield', 'avenger'] })).toBe(true);
      expect(matchesCardFilter(card, { traits: ['Hydra'] })).toBe(false);
    });

    it('correctly aggregates resource yields', () => {
      const singleMental = parseResources({
        code: '01001',
        name: 'Test',
        type_code: 'event',
        faction_code: 'basic',
        pack_code: 'core',
        position: 1,
        quantity: 1,
        resource_mental: 1,
      });
      expect(singleMental).toEqual({
        physical: 0,
        energy: 0,
        mental: 1,
        wild: 0,
        total: 1,
      });

      const doublePhysical = parseResources({
        code: '01002',
        name: 'Strength',
        type_code: 'resource',
        faction_code: 'basic',
        pack_code: 'core',
        position: 2,
        quantity: 1,
        resource_physical: 2,
      });
      expect(doublePhysical.total).toBe(2);
      expect(doublePhysical.physical).toBe(2);
    });
  });

  describe('Core Set Hero Ingestion (Spider-Man)', () => {
    const catalog = new CardCatalog(corePack);

    it('normalizes Spider-Man (Hero form 01001a) correctly', () => {
      const card = catalog.getCard('01001a') as HeroCard;
      expect(card).toBeDefined();
      expect(card.name).toBe('Spider-Man');
      expect(card.type).toBe(CardType.HERO);
      expect(card.faction).toBe(FactionCode.HERO);
      expect(card.handSize).toBe(5);
      expect(card.health).toBe(10);
      expect(card.thwart).toBe(1);
      expect(card.attack).toBe(2);
      expect(card.defense).toBe(3);
      expect(card.traits).toContain('Avenger');
      expect(card.text).toContain('Spider-Sense');
      expect(card.alterEgoCode).toBe('01001b');
    });

    it('normalizes Peter Parker (Alter-Ego form 01001b) correctly', () => {
      const card = catalog.getCard('01001b') as AlterEgoCard;
      expect(card).toBeDefined();
      expect(card.name).toBe('Peter Parker');
      expect(card.type).toBe(CardType.ALTER_EGO);
      expect(card.handSize).toBe(6);
      expect(card.health).toBe(10);
      expect(card.recover).toBe(3);
      expect(card.traits).toContain('Genius');
      expect(card.text).toContain('Scientist');
    });

    it('normalizes Carol Danvers (Alter-Ego form 01010b) with S.H.I.E.L.D. and Soldier traits intact (#72)', () => {
      const card = catalog.getCard('01010b') as AlterEgoCard;
      expect(card).toBeDefined();
      expect(card.name).toBe('Carol Danvers');
      expect(card.traits).toEqual(['S.H.I.E.L.D.', 'Soldier']);
      expect(card.traits).not.toContain('S');
      expect(card.traits).not.toContain('H');
      expect(card.traits).not.toContain('D');
    });

    it('normalizes Nick Fury (01084) with S.H.I.E.L.D. and Spy traits intact (#72)', () => {
      const card = catalog.getCard('01084');
      expect(card).toBeDefined();
      expect(card?.name).toBe('Nick Fury');
      expect(card?.traits).toEqual(['S.H.I.E.L.D.', 'Spy']);
    });

    it('retrieves the dual-sided identity via getHeroIdentity helper', () => {
      const identity = catalog.getHeroIdentity('spider_man');
      expect(identity).toBeDefined();
      expect(identity?.hero.code).toBe('01001a');
      expect(identity?.alterEgo.code).toBe('01001b');
    });

    it('loads signature cards for Spider-Man (10 unique cards, 15 total quantity)', () => {
      const spiderManCards = catalog.getCardsBySet('spider_man');
      expect(spiderManCards.length).toBe(10);

      const totalCardCount = spiderManCards.reduce((acc, c) => acc + c.quantity, 0);
      // Hero (1) + Alter-Ego (1) + 15 deck cards = 17 total cards
      expect(totalCardCount).toBe(17);

      // Web-Shooter Upgrade (01008, 2 copies)
      const webShooter = catalog.getCard('01008');
      expect(webShooter).toBeDefined();
      expect(webShooter?.type).toBe(CardType.UPGRADE);
      expect(webShooter?.cost).toBe(1);
      expect(webShooter?.quantity).toBe(2);

      // Backflip Event (01003, 2 copies)
      const backflip = catalog.getCard('01003');
      expect(backflip).toBeDefined();
      expect(backflip?.type).toBe(CardType.EVENT);
      expect(backflip?.cost).toBe(0);
      expect(backflip?.quantity).toBe(2);

      // Enhanced Spider-Sense (01004, 2 copies)
      const spiderSense = catalog.getCard('01004');
      expect(spiderSense).toBeDefined();
      expect(spiderSense?.type).toBe(CardType.EVENT);
      expect(spiderSense?.cost).toBe(1);
      expect(spiderSense?.quantity).toBe(2);

      // Swinging Web Kick (01005, 3 copies)
      const kick = catalog.getCard('01005');
      expect(kick).toBeDefined();
      expect(kick?.type).toBe(CardType.EVENT);
      expect(kick?.cost).toBe(3);
      expect(kick?.quantity).toBe(3);
      expect(kick?.traits).toContain('Attack');
    });
  });

  describe('Core Encounter Ingestion (Rhino & Bomb Scare)', () => {
    const catalog = new CardCatalog(coreEncounterPack);

    it('normalizes Rhino Stage I (01094) correctly', () => {
      const rhino1 = catalog.getCard('01094') as VillainCard;
      expect(rhino1).toBeDefined();
      expect(rhino1.name).toBe('Rhino');
      expect(rhino1.type).toBe(CardType.VILLAIN);
      expect(rhino1.stage).toBe('I');
      expect(rhino1.health).toBe(14);
      expect(rhino1.healthPerHero).toBe(true);
      expect(rhino1.scheme).toBe(1);
      expect(rhino1.attack).toBe(2);
      expect(rhino1.traits).toContain('Brute');
      expect(rhino1.traits).toContain('Criminal');
    });

    it('normalizes Rhino Stage II (01095) correctly', () => {
      const rhino2 = catalog.getCard('01095') as VillainCard;
      expect(rhino2).toBeDefined();
      expect(rhino2.stage).toBe('II');
      expect(rhino2.health).toBe(15);
      expect(rhino2.scheme).toBe(1);
      expect(rhino2.attack).toBe(3);
      expect(rhino2.text).toContain("Breakin' & Takin'");
    });

    it('retrieves main scheme and villain cards via stage lookup helper', () => {
      const mainScheme1A = catalog.getMainSchemeByStage('rhino', '1A');
      expect(mainScheme1A).toBeDefined();
      expect(mainScheme1A?.code).toBe('01097a');
      expect(mainScheme1A?.stage).toBe('1A');

      const mainScheme1B = catalog.getMainSchemeByStage('rhino', '1B');
      expect(mainScheme1B).toBeDefined();
      expect(mainScheme1B?.code).toBe('01097b');
      expect(mainScheme1B?.stage).toBe('1B');
      expect(mainScheme1B?.targetThreat).toBe(7);

      const rhinoStage1 = catalog.getVillainByStage('rhino', 'I');
      expect(rhinoStage1).toBeDefined();
      expect(rhinoStage1?.code).toBe('01094');
      expect(rhinoStage1?.stage).toBe('I');

      const rhinoStage2 = catalog.getVillainByStage('rhino', 'II');
      expect(rhinoStage2).toBeDefined();
      expect(rhinoStage2?.code).toBe('01095');
      expect(rhinoStage2?.stage).toBe('II');
    });

    it('normalizes Bomb Scare modular encounter set cards', () => {
      const bombScareCards = catalog.getCardsBySet('bomb_scare');
      expect(bombScareCards.length).toBeGreaterThan(0);

      // Bomb Scare Side Scheme (01109)
      const sideScheme = catalog.getCard('01109') as SideSchemeCard;
      expect(sideScheme).toBeDefined();
      expect(sideScheme?.type).toBe(CardType.SIDE_SCHEME);
      expect(sideScheme?.hasAcceleration).toBe(true);

      // Hydra Bomber Minion (01110)
      const bomber = catalog.getCard('01110');
      expect(bomber).toBeDefined();
      expect(bomber?.type).toBe(CardType.MINION);
      expect(bomber?.traits).toContain('Hydra');
    });

    it('normalizes Legions of Hydra modular encounter set cards', () => {
      const hydraCards = catalog.getCardsBySet('legions_of_hydra');
      expect(hydraCards.length).toBe(3);

      // Legions of Hydra Side Scheme (01180)
      const sideScheme = catalog.getCard('01180') as SideSchemeCard;
      expect(sideScheme).toBeDefined();
      expect(sideScheme?.type).toBe(CardType.SIDE_SCHEME);
      expect(sideScheme?.baseThreat).toBe(3);

      // Madame Hydra Minion (01181)
      const madame = catalog.getCard('01181') as MinionCard;
      expect(madame).toBeDefined();
      expect(madame?.type).toBe(CardType.MINION);
      expect(madame?.traits).toContain('Hydra');
      expect(madame?.traits).toContain('Elite');

      // Hydra Soldier Minion (01182)
      const soldier = catalog.getCard('01182') as MinionCard;
      expect(soldier).toBeDefined();
      expect(soldier?.type).toBe(CardType.MINION);
      expect(soldier?.traits).toEqual(['Hydra']);
      expect(soldier?.keywords).toContain('Guard');
    });
  });

  describe('Supplemental Rules Metadata Enrichment (ADR-0008)', () => {
    it('provides rich ability metadata for Spider-Man signature cards', async () => {
      const { getCardEnrichment } = await import('../../src/data/supplemental');
      const spiderMan = getCardEnrichment('01001a');
      expect(spiderMan).toBeDefined();
      expect(spiderMan?.abilities?.[0].id).toBe('spider_sense');
      expect(spiderMan?.abilities?.[0].timing).toBe('INTERRUPT');

      const webShooter = getCardEnrichment('01008');
      expect(webShooter?.uses?.count).toBe(3);
      expect(webShooter?.abilities?.[0].steps?.[0].effect).toBe('GENERATE_RESOURCE');
    });

    it('provides rich ability metadata for Captain Marvel & Leadership cards', async () => {
      const { getCardEnrichment } = await import('../../src/data/supplemental');
      const capMarvel = getCardEnrichment('01010a');
      expect(capMarvel).toBeDefined();
      expect(capMarvel?.abilities?.[0].id).toBe('rechannel');

      const mariaHill = getCardEnrichment('01067');
      expect(mariaHill?.abilities?.[0].id).toBe('maria_hill_enters_play');

      const makeTheCall = getCardEnrichment('01071');
      expect(makeTheCall?.abilities?.[0].id).toBe('make_the_call');

      const hawkeye = getCardEnrichment('01066');
      expect(hawkeye?.uses?.count).toBe(4);
    });

    it('provides rich ability metadata for Support cards and flags pure resources as noSupplementalNeeded', async () => {
      const { getCardEnrichment } = await import('../../src/data/supplemental');
      const energy = getCardEnrichment('01088');
      expect(energy?.noSupplementalNeeded).toBe(true);
      expect(energy?.abilities).toBeUndefined();

      const vibranium = getCardEnrichment('01044');
      expect(vibranium?.noSupplementalNeeded).toBe(true);

      const powerOfLeadership = getCardEnrichment('01072');
      expect(powerOfLeadership?.abilities?.[0].id).toBe('power_of_leadership');

      const mansion = getCardEnrichment('01091');
      expect(mansion?.abilities?.[0].id).toBe('avengers_mansion');

      const helicarrier = getCardEnrichment('01092');
      expect(helicarrier?.abilities?.[0].id).toBe('helicarrier_action');
    });

    it('ensures all scanned Core cards are registered with an explicit signal, while unscanned cards remain undefined', async () => {
      const { supplementalRegistry, getCardEnrichment } = await import('../../src/data/supplemental');

      // Check all 101 Scanned Player Cards
      corePack.forEach((card) => {
        const enrichment = supplementalRegistry[card.code];
        expect(enrichment, `Card ${card.code} (${card.name}) must have a supplemental entry`).toBeDefined();
        const hasAbilities = enrichment.abilities && enrichment.abilities.length > 0;
        const isMarkedNoSupplemental = enrichment.noSupplementalNeeded === true;
        const isBlockedAmbiguity = Boolean(enrichment.audit?.ambiguityFile);
        expect(
          hasAbilities || isMarkedNoSupplemental || isBlockedAmbiguity,
          `Card ${card.code} (${card.name}) must either define abilities, have "noSupplementalNeeded: true", or specify an "ambiguityFile"`
        ).toBe(true);
      });

      // Check Scanned Encounter Sets (Rhino, Modular Sets, Standard, Expert, All 5 Core Hero Nemesis sets)
      const scannedEncounterSets = new Set([
        'rhino',
        'bomb_scare',
        'masters_of_evil',
        'under_attack',
        'legions_of_hydra',
        'the_doomsday_chair',
        'standard',
        'expert',
        'spider_man',
        'spider_man_nemesis',
        'captain_marvel',
        'captain_marvel_nemesis',
        'she_hulk',
        'she_hulk_nemesis',
        'iron_man',
        'iron_man_nemesis',
        'black_panther',
        'black_panther_nemesis',
      ]);

      // Single cards modelled ahead of their set's scan (#244: Weapons Runner; Plan R9: Klaw II, Immortal Klaw)
      const scannedEncounterCards = new Set(['01114', '01121', '01127']);

      coreEncounterPack.forEach((card) => {
        const enrichment = supplementalRegistry[card.code];
        if (scannedEncounterSets.has(card.set_code as string) || scannedEncounterCards.has(card.code)) {
          expect(enrichment, `Scanned Encounter Card ${card.code} (${card.name}) must have a supplemental entry`).toBeDefined();
          const hasAbilities = enrichment.abilities && enrichment.abilities.length > 0;
          const isMarkedNoSupplemental = enrichment.noSupplementalNeeded === true;
          const isBlockedAmbiguity = Boolean(enrichment.audit?.ambiguityFile);
          expect(
            hasAbilities || isMarkedNoSupplemental || isBlockedAmbiguity,
            `Encounter Card ${card.code} (${card.name}) must either define abilities, have "noSupplementalNeeded: true", or specify an "ambiguityFile"`
          ).toBe(true);
        } else {
          // Unscanned cards (Klaw, Ultron) must NOT be in supplemental
          expect(
            enrichment,
            `Unscanned Card ${card.code} (${card.name}) must not be in supplemental registry until scanned`
          ).toBeUndefined();
        }
      });

      // Verify that unscanned card Klaw (01113) returns undefined from getCardEnrichment
      expect(getCardEnrichment('01113')).toBeUndefined();
    });
  });

  describe('Dash (–) basic power values (Issue #316, RR v1.8 "Dash (Value)")', () => {
    const catalog = new CardCatalog([...corePack, ...ttEncounterPack] as any);

    it('loads Hulk (01050) THW dash as an unusable 0, not the default 1', () => {
      const hulk = catalog.getCard('01050') as any;
      expect(hulk.thwart).toBe(0);
      expect(hulk.dashPowers).toEqual(['thwart']);
    });

    it('leaves dashPowers unset for an ally with numeric powers', () => {
      const spiderWoman = catalog.getCard('01011') as any;
      expect(spiderWoman.thwart).toBe(2);
      expect(spiderWoman.dashPowers).toBeUndefined();
    });

    it('records ATK and SCH dashes on villain 55027a (Loki)', () => {
      const loki = catalog.getCard('55027a') as any;
      expect(loki.attack).toBe(0);
      expect(loki.scheme).toBe(0);
      expect(loki.dashPowers).toEqual(['attack', 'scheme']);
    });

    it('does not treat an omitted (undefined) power as a dash', () => {
      const raw = JSON.parse(JSON.stringify(corePack.find((c: any) => c.code === '01011')));
      delete raw.thwart;
      const omitted = new CardCatalog([raw] as any).getCard('01011') as any;
      expect(omitted.thwart).toBe(1);
      expect(omitted.dashPowers).toBeUndefined();
    });
  });
  describe('Upstream-derived Victory X (RR v1.8 Victory X)', () => {
    const victoryRaw = (text: string) =>
      ({
        code: 'test-victory',
        name: 'Test Minion',
        type_code: 'minion',
        faction_code: 'encounter',
        pack_code: 'test',
        text,
      }) as any;

    it.each([
      ['Victory 0.', 'Victory 0'],
      ['Victory 1.', 'Victory 1'],
      ['Victory -1.\nDoes not count against your ally limit.', 'Victory -1'],
    ])('parses printed %j as keywords Victory and %s', (text, signed) => {
      const card = normalizeRawCard(victoryRaw(text), {});
      expect(card.keywords).toContain('Victory');
      expect(card.keywords).toContain(signed);
    });

    it('parses the negative Victory of Rescued Captive (50091) from upstream text', () => {
      const raw = (aosEncounterPack as any[]).find((c) => c.code === '50091');
      const card = normalizeRawCard(raw, {});
      expect(card.keywords).toContain('Victory');
      expect(card.keywords).toContain('Victory -1');
    });

    it('does not tag a card that does not print Victory', () => {
      const card = normalizeRawCard(victoryRaw('Guard.'), {});
      expect(card.keywords).not.toContain('Victory');
    });
  });

  describe('Ally consequential costs default to 0 when upstream omits them (RR v1.8 Consequential Damage)', () => {
    const allyRaw = (extra: Record<string, unknown>) =>
      ({
        code: 'test-ally',
        name: 'Test Ally',
        type_code: 'ally',
        faction_code: 'basic',
        pack_code: 'test',
        text: '',
        ...extra,
      }) as any;

    it('defaults a missing attack_cost and thwart_cost to 0', () => {
      const ally = normalizeRawCard(allyRaw({}), {}) as any;
      expect(ally.attackCost).toBe(0);
      expect(ally.thwartCost).toBe(0);
    });

    it('keeps printed consequential icons', () => {
      const ally = normalizeRawCard(allyRaw({ attack_cost: 2, thwart_cost: 1 }), {}) as any;
      expect(ally.attackCost).toBe(2);
      expect(ally.thwartCost).toBe(1);
    });

    it('gives Black Cat (01002) attackCost 0 without any supplemental override', () => {
      const raw = (corePack as any[]).find((c) => c.code === '01002');
      const blackCat = normalizeRawCard(raw, {}) as any;
      expect(blackCat.attackCost).toBe(0);
      expect(blackCat.thwartCost).toBe(1);
    });
  });
});
