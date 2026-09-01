import { describe, it, expect } from 'vitest';
import {
  parseTraits,
  parseResources,
  CardCatalog,
} from '@data/importer/card-loader';
import {
  CardType,
  FactionCode,
  HeroCard,
  AlterEgoCard,
  VillainCard,
  SideSchemeCard,
} from '@engine/models';

// Import real upstream JSON datasets directly
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Card Loader & Normalizer Unit Tests', () => {
  describe('Helper Parsers', () => {
    it('correctly parses compound and single traits', () => {
      expect(parseTraits('Avenger. Web-Warrior.')).toEqual(['Avenger', 'Web-Warrior']);
      expect(parseTraits('Genius.')).toEqual(['Genius']);
      expect(parseTraits('')).toEqual([]);
      expect(parseTraits(undefined)).toEqual([]);
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

      // Check Scanned Encounter Sets (Rhino, Bomb Scare, Standard, Expert, All 5 Core Hero Nemesis sets)
      const scannedEncounterSets = new Set([
        'rhino',
        'bomb_scare',
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

      coreEncounterPack.forEach((card) => {
        const enrichment = supplementalRegistry[card.code];
        if (scannedEncounterSets.has(card.set_code)) {
          expect(enrichment, `Scanned Encounter Card ${card.code} (${card.name}) must have a supplemental entry`).toBeDefined();
          const hasAbilities = enrichment.abilities && enrichment.abilities.length > 0;
          const isMarkedNoSupplemental = enrichment.noSupplementalNeeded === true;
          const isBlockedAmbiguity = Boolean(enrichment.audit?.ambiguityFile);
          expect(
            hasAbilities || isMarkedNoSupplemental || isBlockedAmbiguity,
            `Encounter Card ${card.code} (${card.name}) must either define abilities, have "noSupplementalNeeded: true", or specify an "ambiguityFile"`
          ).toBe(true);
        } else {
          // Unscanned cards (Klaw, Ultron, Masters of Evil) must NOT be in supplemental
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
});
