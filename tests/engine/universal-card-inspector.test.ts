import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { locateCard, readCardAttribute, readCardResources } from '@engine/queries/card-inspector';

describe('Universal Card Inspector Subsystem (Issue #13, ADR-0046)', () => {
  let state: GameState;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;

  beforeEach(() => {
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = ironManHero;
  });

  describe('locateCard', () => {
    it('locates TOP card of PLAYER_DISCARD', () => {
      const cardBottom = createCardInstance(cardCatalog.getCard('01005')!);
      const cardTop = createCardInstance(cardCatalog.getCard('01088')!); // Energy

      state.players[0].discard = [cardBottom, cardTop];

      const located = locateCard(state, { zone: 'PLAYER_DISCARD', position: 'TOP' });
      expect(located).toBe(cardTop);
    });

    it('locates BOTTOM card of PLAYER_DISCARD', () => {
      const cardBottom = createCardInstance(cardCatalog.getCard('01005')!);
      const cardTop = createCardInstance(cardCatalog.getCard('01088')!);

      state.players[0].discard = [cardBottom, cardTop];

      const located = locateCard(state, { zone: 'PLAYER_DISCARD', position: 'BOTTOM' });
      expect(located).toBe(cardBottom);
    });

    it('locates TOPMOST_MATCHING card by filter in PLAYER_DISCARD', () => {
      const techUpgrade = createCardInstance(cardCatalog.getCard('01036')!); // Mark V Armor (Tech Upgrade)
      const eventCard = createCardInstance(cardCatalog.getCard('01005')!); // Non-tech
      const energyCard = createCardInstance(cardCatalog.getCard('01088')!); // Resource

      state.players[0].discard = [techUpgrade, eventCard, energyCard];

      const located = locateCard(state, {
        zone: 'PLAYER_DISCARD',
        position: 'TOPMOST_MATCHING',
        filter: { traits: ['Tech'], types: ['upgrade'] },
      });
      expect(located).toBe(techUpgrade);
    });

    it('locates card in PLAYER_DECK and ENCOUNTER_DECK', () => {
      const topPlayerCard = createCardInstance(cardCatalog.getCard('01089')!); // Genius
      state.players[0].deck = [createCardInstance(cardCatalog.getCard('01005')!), topPlayerCard];

      const locatedPlayer = locateCard(state, { zone: 'PLAYER_DECK', position: 'TOP' });
      expect(locatedPlayer).toBe(topPlayerCard);

      const topEncounter = createCardInstance(cardCatalog.getCard('01111')!); // Explosion
      state.encounterDeck = [topEncounter];

      const locatedEncounter = locateCard(state, { zone: 'ENCOUNTER_DECK', position: 'TOP' });
      expect(locatedEncounter).toBe(topEncounter);
    });

    it('locates SIDE_SCHEMES by cardCode with threat tokens preserved', () => {
      const bombScareCard = cardCatalog.getCard('01109')!;
      state.sideSchemes = [
        {
          instanceId: 'bomb-scare-1',
          card: bombScareCard as any,
          threat: 5,
        },
      ];

      const located = locateCard(state, { zone: 'SIDE_SCHEMES', cardCode: '01109' });
      expect(located).toBeDefined();
      expect(readCardAttribute(located, 'THREAT')).toBe(5);
    });

    it('locates IN_PLAY entity across schemes, minions, or tableau', () => {
      const bombScareCard = cardCatalog.getCard('01109')!;
      state.sideSchemes = [
        {
          instanceId: 'bomb-scare-1',
          card: bombScareCard as any,
          threat: 4,
        },
      ];

      const located = locateCard(state, { zone: 'IN_PLAY', cardCode: '01109' });
      expect(located).toBeDefined();
      expect(readCardAttribute(located, 'THREAT')).toBe(4);
    });

    it('supports selector.target: SELF, TARGET_CARD, ATTACHED_CARD', () => {
      const selfCard = createCardInstance(cardCatalog.getCard('01033')!); // Pepper Potts
      const targetCard = createCardInstance(cardCatalog.getCard('01034')!); // Stark Tower
      const attachment = createCardInstance(cardCatalog.getCard('01098')!); // Armored Rhino Suit
      selfCard.attachments = [attachment];

      const locatedSelf = locateCard(
        state,
        { target: 'SELF' },
        { sourceCardInstance: selfCard, targetCardInstance: targetCard },
      );
      expect(locatedSelf).toBe(selfCard);

      const locatedTarget = locateCard(
        state,
        { target: 'TARGET_CARD' },
        { sourceCardInstance: selfCard, targetCardInstance: targetCard },
      );
      expect(locatedTarget).toBe(targetCard);

      const locatedAttached = locateCard(
        state,
        { target: 'ATTACHED_CARD' },
        { sourceCardInstance: selfCard },
      );
      expect(locatedAttached).toBe(attachment);
    });
  });

  describe('readCardAttribute & readCardResources', () => {
    it('extracts printed resources and counts for double resource cards', () => {
      const energyCard = cardCatalog.getCard('01088')!; // Energy: 2 energy resources
      const resources = readCardResources(energyCard);
      expect(resources).toEqual(['energy', 'energy']);
      expect(readCardAttribute(energyCard, 'PRINTED_RESOURCES')).toBe(2);
      expect(readCardAttribute(energyCard, 'ENERGY_RESOURCES')).toBe(2);
      expect(readCardAttribute(energyCard, 'PHYSICAL_RESOURCES')).toBe(0);
      expect(readCardAttribute(energyCard, 'MENTAL_RESOURCES')).toBe(0);
      expect(readCardAttribute(energyCard, 'WILD_RESOURCES')).toBe(0);
    });

    it('extracts printed cost and boost icons', () => {
      const warMachine = cardCatalog.getCard('01030')!; // War Machine: cost 4
      expect(readCardAttribute(warMachine, 'PRINTED_COST')).toBe(4);

      const explosion = cardCatalog.getCard('01111')!; // Explosion: 2 boost icons
      expect(readCardAttribute(explosion, 'BOOST_ICONS')).toBe(2);
    });

    it('extracts threat on side schemes and damage on entities', () => {
      const schemeInstance = {
        threat: 7,
        tokens: { threat: 7 },
      };
      expect(readCardAttribute(schemeInstance, 'THREAT')).toBe(7);

      const damagedCard = {
        damage: 3,
        tokens: { damage: 3 },
      };
      expect(readCardAttribute(damagedCard, 'DAMAGE')).toBe(3);
    });

    it('extracts counters on cards', () => {
      const cardWithTokens = {
        tokens: { counters: 4 },
      };
      expect(readCardAttribute(cardWithTokens, 'COUNTERS')).toBe(4);

      const cardWithNamedCounters = {
        counters: { all_purpose: 2, charge: 3 },
      };
      expect(readCardAttribute(cardWithNamedCounters, 'COUNTERS')).toBe(5);
    });
  });
});
