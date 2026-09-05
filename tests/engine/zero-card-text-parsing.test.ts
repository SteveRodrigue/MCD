import { describe, it, expect } from 'vitest';
import {
  Keyword,
  CardType,
  FactionCode,
  CardInstance,
  NormalizedCard,
  GamePhase,
  GameState,
  PlayerState,
  hasKeyword,
  getKeywordValue,
} from '@engine/models';
import {
  canBasicAttack,
  canBasicThwart,
  canPlayCard,
  isCardRestricted,
  getCardRestrictedWeight,
} from '@engine/pipeline/legality-checker';
import { CardCatalog } from '@data/importer/card-loader';
import { getStarterDeck } from '@engine/decks/starter-decks';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Zero Card Text Parsing Contract (ADR-0019)', () => {
  function makeMockCard(overrides: Partial<NormalizedCard> = {}): NormalizedCard {
    return {
      code: 'mock_card',
      name: 'Mock Card',
      type: CardType.MINION,
      faction: FactionCode.ENCOUNTER,
      packCode: 'core',
      position: 1,
      quantity: 1,
      deckLimit: 1,
      isUnique: false,
      text: '', // Intentionally EMPTY per ADR-0019
      traits: [],
      keywords: [],
      resources: { physical: 0, energy: 0, mental: 0, wild: 0, total: 0 },
      isLandscape: false,
      orientation: 'portrait',
      raw: {} as any,
      ...overrides,
    };
  }

  function makeMockInstance(
    card: NormalizedCard,
    overrides: Partial<CardInstance> = {},
  ): CardInstance {
    return {
      instanceId: `inst_${Math.random().toString(36).substring(2, 9)}`,
      card,
      tokens: {},
      counters: {},
      attachments: [],
      ...overrides,
    };
  }

  describe('hasKeyword and getKeywordValue helpers', () => {
    it('correctly identifies keywords on NormalizedCard and CardInstance without reading text', () => {
      const cardWithGuard = makeMockCard({ keywords: [Keyword.GUARD], text: '' });
      const instWithGuard = makeMockInstance(cardWithGuard);

      expect(hasKeyword(cardWithGuard, Keyword.GUARD)).toBe(true);
      expect(hasKeyword(instWithGuard, Keyword.GUARD)).toBe(true);
      expect(hasKeyword(cardWithGuard, Keyword.OVERKILL)).toBe(false);
    });

    it('correctly identifies keywords declared via enrichment without reading text', () => {
      const cardWithEnrichment = makeMockCard({
        keywords: [],
        text: '',
        enrichment: {
          keywords: [Keyword.CRISIS],
        } as any,
      });
      const inst = makeMockInstance(cardWithEnrichment);

      expect(hasKeyword(cardWithEnrichment, Keyword.CRISIS)).toBe(true);
      expect(hasKeyword(inst, Keyword.CRISIS)).toBe(true);
    });

    it('resolves parameterized keyword values without reading text', () => {
      const cardWithRetaliate = makeMockCard({
        keywords: ['Retaliate 2' as any],
        text: '',
      });
      expect(hasKeyword(cardWithRetaliate, Keyword.RETALIATE)).toBe(true);
      expect(getKeywordValue(cardWithRetaliate, Keyword.RETALIATE)).toBe(2);

      const cardWithDefaultRetaliate = makeMockCard({
        keywords: [Keyword.RETALIATE],
        text: '',
      });
      expect(getKeywordValue(cardWithDefaultRetaliate, Keyword.RETALIATE)).toBe(1);
    });
  });

  describe('Legality Checker Guard, Patrol & Crisis without card.text', () => {
    it('blocks direct attack on villain when an engaged minion has Keyword.GUARD and empty card.text', () => {
      const guardMinionCard = makeMockCard({
        keywords: [Keyword.GUARD],
        text: '', // No 'Guard' in text!
      });
      const guardMinion = makeMockInstance(guardMinionCard);

      const player: Partial<PlayerState> = {
        id: 'p1',
        name: 'Hero',
        currentForm: 'hero',
        exhausted: false,
        engagedMinions: [guardMinion],
      };

      const state: Partial<GameState> = {
        phase: GamePhase.PLAYER_PHASE,
        activePlayerIndex: 0,
        players: [player as PlayerState],
      };

      const villainAttackCheck = canBasicAttack(state as GameState, 'p1', 'villain');
      expect(villainAttackCheck.allowed).toBe(false);
      expect(villainAttackCheck.reason).toContain('Guard');

      const minionAttackCheck = canBasicAttack(
        state as GameState,
        'p1',
        'minion',
        guardMinion.instanceId,
      );
      expect(minionAttackCheck.allowed).toBe(true);
    });

    it('blocks main scheme thwart when an engaged minion has Keyword.PATROL and empty card.text', () => {
      const patrolMinionCard = makeMockCard({
        keywords: [Keyword.PATROL],
        text: '', // No 'Patrol' in text!
      });
      const patrolMinion = makeMockInstance(patrolMinionCard);

      const mainSchemeCard = makeMockCard({ type: CardType.MAIN_SCHEME });
      const mainSchemeInst = makeMockInstance(mainSchemeCard);

      const player: Partial<PlayerState> = {
        id: 'p1',
        name: 'Hero',
        currentForm: 'hero',
        exhausted: false,
        engagedMinions: [patrolMinion],
      };

      const state: Partial<GameState> = {
        phase: GamePhase.PLAYER_PHASE,
        activePlayerIndex: 0,
        players: [player as PlayerState],
        sideSchemes: [],
        mainScheme: {
          ...mainSchemeInst,
          threat: 5,
        } as any,
      };

      const mainSchemeThwartCheck = canBasicThwart(state as GameState, 'p1', 'main_scheme');
      expect(mainSchemeThwartCheck.allowed).toBe(false);
      expect(mainSchemeThwartCheck.reason).toContain('Patrol');
    });

    it('blocks main scheme thwart when a side scheme has Keyword.CRISIS and empty card.text', () => {
      const crisisSchemeCard = makeMockCard({
        type: CardType.SIDE_SCHEME,
        keywords: [Keyword.CRISIS],
        text: '', // No 'Crisis' in text!
      });
      const crisisScheme = makeMockInstance(crisisSchemeCard);

      const mainSchemeCard = makeMockCard({ type: CardType.MAIN_SCHEME });
      const mainSchemeInst = makeMockInstance(mainSchemeCard);

      const player: Partial<PlayerState> = {
        id: 'p1',
        name: 'Hero',
        currentForm: 'hero',
        exhausted: false,
        engagedMinions: [],
      };

      const state: Partial<GameState> = {
        phase: GamePhase.PLAYER_PHASE,
        activePlayerIndex: 0,
        players: [player as PlayerState],
        sideSchemes: [{ ...crisisScheme, threat: 3 } as any],
        mainScheme: {
          ...mainSchemeInst,
          threat: 5,
        } as any,
      };

      const mainSchemeThwartCheck = canBasicThwart(state as GameState, 'p1', 'main_scheme');
      expect(mainSchemeThwartCheck.allowed).toBe(false);
      expect(mainSchemeThwartCheck.reason).toContain('Crisis');
    });
  });

  describe('Restricted Keyword without card.text', () => {
    it('identifies restricted cards and slot weight using Keyword enum with zero text parsing', () => {
      const restrictedCard = makeMockCard({
        keywords: [Keyword.RESTRICTED],
        text: '',
      });
      const regularCard = makeMockCard({
        keywords: [],
        text: '',
      });

      expect(isCardRestricted(restrictedCard)).toBe(true);
      expect(getCardRestrictedWeight(restrictedCard)).toBe(1);
      expect(isCardRestricted(regularCard)).toBe(false);
      expect(getCardRestrictedWeight(regularCard)).toBe(0);
    });
  });

  describe('Resource Generation and Legality without card.text', () => {
    it('verifies in-play resource generator legality in hero form via structured ability timing', () => {
      const generatorCard = makeMockCard({
        type: CardType.UPGRADE,
        text: '', // Intentionally EMPTY
        enrichment: {
          abilities: [
            {
              id: 'gen_1',
              timing: 'HERO_RESOURCE',
              steps: [{ effect: 'GENERATE_RESOURCE', params: { type: 'wild' } }],
            },
          ],
        } as any,
      });
      const generatorInst = makeMockInstance(generatorCard, { exhausted: false });

      const player: Partial<PlayerState> = {
        id: 'p1',
        name: 'Hero',
        currentForm: 'hero',
        activeFormCard: makeMockCard({ code: 'mock_hero', type: CardType.HERO }),
        hand: [],
        tableau: [generatorInst],
        engagedMinions: [],
      };

      const cardToPlay = makeMockCard({
        cost: 1,
        type: CardType.EVENT,
        text: '',
      });
      const cardInstToPlay = makeMockInstance(cardToPlay);
      player.hand = [cardInstToPlay];

      const state: Partial<GameState> = {
        phase: GamePhase.PLAYER_PHASE,
        activePlayerIndex: 0,
        players: [player as PlayerState],
      };

      const playCheck = canPlayCard(
        state as GameState,
        'p1',
        cardInstToPlay,
        [],
        [generatorInst.instanceId],
      );
      expect(playCheck.allowed).toBe(true);

      // Now flip to alter_ego: generator should NOT provide resources
      player.currentForm = 'alter_ego';
      const alterEgoPlayCheck = canPlayCard(
        state as GameState,
        'p1',
        cardInstToPlay,
        [],
        [generatorInst.instanceId],
      );
      expect(alterEgoPlayCheck.allowed).toBe(false);
      expect(alterEgoPlayCheck.reason).toContain('Hero form');
    });
  });

  describe('Starter Decks Obligation Resolution without card.text', () => {
    it('resolves Spider-Man obligation via setCode metadata with empty text', () => {
      const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
      const starter = getStarterDeck('spider_man_justice')!;
      const deck = starter.loadDeck(catalog);

      expect(deck.obligation.name).toBe('Eviction Notice');
      expect(deck.obligation.setCode).toBe('spider_man');
    });
  });
});
