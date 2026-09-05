import { describe, it, expect } from 'vitest';
import {
  normalizeRawCard,
  applyTranslationOverlay,
  CardCatalog,
} from '../../src/data/importer/card-loader';
import { CardType, Keyword, VillainCard, AllyCard, HeroCard } from '../../src/engine/models';
import { hasKeyword, getKeywordValue } from '../../src/engine/models';
import coreCards from '../../data/upstream/pack/core.json';
import frenchCoreCards from '../../data/upstream/translations/fr/pack/core.json';

describe('i18n Normalization and Canonical Ingestion Protocol', () => {
  it('preserves canonical English rules traits and keywords while displaying French translated text', () => {
    // 1. Ingest Spider-Man (01001a) from canonical English dataset
    const rawEnglishSpiderMan = coreCards.find((c: any) => c.code === '01001a') as any;
    expect(rawEnglishSpiderMan).toBeDefined();

    const normalized = normalizeRawCard(rawEnglishSpiderMan) as HeroCard;
    expect(normalized.traits).toEqual(['Avenger']);
    expect(normalized.printedTraits).toBe('Avenger.');
    expect(normalized.name).toBe('Spider-Man');
    expect(normalized.text).toContain('Spider-Sense');

    // 2. Fetch French translation overlay
    const frenchSpiderMan = frenchCoreCards.find((c: any) => c.code === '01001a') as any;
    expect(frenchSpiderMan).toBeDefined();
    expect(frenchSpiderMan.text).toContain("Sens d'Araignée");

    // 3. Apply translation overlay
    const translated = applyTranslationOverlay(normalized, frenchSpiderMan);

    // Presentation fields must be French
    expect(translated.name).toBe('Spider-Man');
    expect(translated.text).toContain("Sens d'Araignée");
    expect(translated.printedTraits).toBe('Avenger.');

    // Engine rules fields MUST remain canonical English
    expect(translated.traits).toEqual(['Avenger']);
    expect(translated.traits.includes('Avenger')).toBe(true);
    expect(translated.type).toBe(CardType.HERO);
    expect(translated.attack).toBe(2);
    expect(translated.defense).toBe(3);
    expect(translated.thwart).toBe(1);
    expect(translated.health).toBe(10);
    expect(translated.handSize).toBe(5);
  });

  it('preserves canonical traits when French traits differ in translation', () => {
    // Peter Parker (01001b): English 'Genius.', French 'Génie.'
    const rawEnglishPeter = coreCards.find((c: any) => c.code === '01001b') as any;
    const normalized = normalizeRawCard(rawEnglishPeter);
    expect(normalized.traits).toEqual(['Genius']);

    const frenchPeter = frenchCoreCards.find((c: any) => c.code === '01001b') as any;
    expect(frenchPeter.traits).toBe('Génie.');

    const translated = applyTranslationOverlay(normalized, frenchPeter);

    // Localized display trait is French
    expect(translated.printedTraits).toBe('Génie.');
    expect(translated.text).toContain('Scientifique');

    // Engine rules trait remains English 'Genius'
    expect(translated.traits).toEqual(['Genius']);
    expect(translated.traits.includes('Genius')).toBe(true);
  });

  it('guarantees Black Cat consequential damage is 0 via supplemental data', () => {
    const rawBlackCat = coreCards.find((c: any) => c.code === '01002') as any;
    const normalized = normalizeRawCard(rawBlackCat) as AllyCard;

    expect(normalized.attackCost).toBe(0);

    // Applying French translation keeps attackCost at 0
    const frenchBlackCat = frenchCoreCards.find((c: any) => c.code === '01002') as any;
    const translated = applyTranslationOverlay(normalized, frenchBlackCat) as AllyCard;

    expect(translated.attackCost).toBe(0);
    expect(translated.text).toContain('Réponse forcée');
  });

  it('parses and resolves Retaliate X values without raw text inspection', () => {
    const mockRetaliateCard: any = {
      code: 'test_retaliate',
      name: 'Retaliate Minion',
      type_code: 'minion',
      faction_code: 'encounter',
      pack_code: 'core',
      position: 1,
      text: '<b>Retaliate 2.</b> Guard.',
      traits: 'Brute.',
    };

    const card = normalizeRawCard(mockRetaliateCard);
    expect(hasKeyword(card, Keyword.RETALIATE)).toBe(true);
    expect(hasKeyword(card, Keyword.GUARD)).toBe(true);
    expect(getKeywordValue(card, Keyword.RETALIATE)).toBe(2);

    // French translation overlay does not wipe keywords or retaliate value
    const translated = applyTranslationOverlay(card, {
      code: 'test_retaliate',
      text: '<b>Riposte 2.</b> Garde.',
      traits: 'Brute.',
    });

    expect(hasKeyword(translated, Keyword.RETALIATE)).toBe(true);
    expect(hasKeyword(translated, Keyword.GUARD)).toBe(true);
    expect(getKeywordValue(translated, Keyword.RETALIATE)).toBe(2);
    expect(translated.text).toBe('<b>Riposte 2.</b> Garde.');
  });

  it('prioritizes supplemental enrichment for restrictedSlots and additionalBoostCards', () => {
    const rawVillain: any = {
      code: 'test_villain',
      name: 'Custom Villain',
      type_code: 'villain',
      faction_code: 'encounter',
      pack_code: 'core',
      position: 1,
      text: 'Some villain text.',
    };

    const enrichment = {
      additionalBoostCards: 2,
      restrictedSlots: 2,
      keywords: [Keyword.OVERKILL],
      traits: ['CustomTrait'],
    };

    const normalized = normalizeRawCard(rawVillain, {
      test_villain: enrichment as any,
    }) as VillainCard;

    expect(normalized.additionalBoostCards).toBe(2);
    expect(normalized.restrictedSlots).toBe(2);
    expect(hasKeyword(normalized, Keyword.OVERKILL)).toBe(true);
    expect(normalized.traits).toEqual(['CustomTrait']);
  });

  it('updates CardCatalog cards in bulk with applyTranslations', () => {
    const catalog = new CardCatalog(coreCards as any);

    const initialSpiderMan = catalog.getCard('01001a');
    expect(initialSpiderMan?.text).toContain('Spider-Sense');

    catalog.applyTranslations(frenchCoreCards as any);

    const updatedSpiderMan = catalog.getCard('01001a');
    expect(updatedSpiderMan).toBeDefined();
    expect(updatedSpiderMan?.text).toContain("Sens d'Araignée");
    expect(updatedSpiderMan?.printedTraits).toBe('Avenger.');
    expect(updatedSpiderMan?.traits).toEqual(['Avenger']);
  });
});
