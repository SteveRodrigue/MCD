import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  SideSchemeCard,
  MainSchemeCard,
  VillainCard,
  replaceActiveMainScheme,
} from '../../src/engine/models';
import {
  setupGame,
  resetInstanceCounter,
  createCardInstance,
} from '../../src/engine/state/game-setup';
import { step4_revealEncounterCards } from '../../src/engine/pipeline/villain-phase';
import { handleMainSchemeCompletion } from '../../src/engine/pipeline/scenario-helpers';

describe('Issue #605: Klaw schemes: Secret Rendezvous 2B, Defense Network, Illegal Arms Factory', () => {
  let state1P: GameState;
  let state2P: GameState;

  const make1PGame = () => {
    resetInstanceCounter();
    const hero1 = cardCatalog.getCard('01001a') as HeroCard;
    const alterEgo1 = cardCatalog.getCard('01001b') as AlterEgoCard;
    return setupGame({
      catalog: cardCatalog,
      scenarioId: 'klaw',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: hero1,
          alterEgo: alterEgo1,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01113') as VillainCard,
      mainScheme: cardCatalog.getCard('01116b') as never,
      encounterCards: cardCatalog.getCardsBySet('klaw'),
      skipMulligan: true,
    });
  };

  const make2PGame = () => {
    resetInstanceCounter();
    const hero1 = cardCatalog.getCard('01001a') as HeroCard;
    const alterEgo1 = cardCatalog.getCard('01001b') as AlterEgoCard;
    const hero2 = cardCatalog.getCard('01010a') as HeroCard;
    const alterEgo2 = cardCatalog.getCard('01010b') as AlterEgoCard;
    return setupGame({
      catalog: cardCatalog,
      scenarioId: 'klaw',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: hero1,
          alterEgo: alterEgo1,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Player 2',
          hero: hero2,
          alterEgo: alterEgo2,
          deckCards: Array(10).fill(cardCatalog.getCard('01014')!),
        },
      ],
      villain: cardCatalog.getCard('01113') as VillainCard,
      mainScheme: cardCatalog.getCard('01116b') as never,
      encounterCards: cardCatalog.getCardsBySet('klaw'),
      skipMulligan: true,
    });
  };

  beforeEach(() => {
    state1P = make1PGame();
    state2P = make2PGame();
  });

  describe('Defense Network (01125) When Revealed', () => {
    it('is placed during Klaw 1A setup with 1 threat per hero (1P: 3 threat, 2P: 4 threat)', () => {
      const sideScheme1P = state1P.sideSchemes.find((s) => s.card.code === '01125');
      expect(sideScheme1P).toBeDefined();
      expect(sideScheme1P!.threat).toBe(3); // 2 base + 1 per hero

      const sideScheme2P = state2P.sideSchemes.find((s) => s.card.code === '01125');
      expect(sideScheme2P).toBeDefined();
      expect(sideScheme2P!.threat).toBe(4); // 2 base + 2 per hero
    });

    it('places 1 threat per hero when revealed (1P: 2 base + 1 = 3 threat)', () => {
      state1P.sideSchemes = [];
      const card = cardCatalog.getCard('01125') as SideSchemeCard;
      expect(card).toBeDefined();
      expect(card.baseThreat).toBe(2);

      const inst = createCardInstance(card);
      state1P.players[0].dealtEncounterCards = [inst];

      step4_revealEncounterCards(state1P);

      const sideScheme = state1P.sideSchemes.find((s) => s.card.code === '01125');
      expect(sideScheme).toBeDefined();
      // 2 base threat + 1 per hero (1 player) = 3 total threat
      expect(sideScheme!.threat).toBe(3);
    });

    it('places 1 threat per hero when revealed (2P: 2 base + 2 = 4 threat)', () => {
      state2P.sideSchemes = [];
      const card = cardCatalog.getCard('01125') as SideSchemeCard;
      const inst = createCardInstance(card);
      state2P.players[0].dealtEncounterCards = [inst];

      step4_revealEncounterCards(state2P);

      const sideScheme = state2P.sideSchemes.find((s) => s.card.code === '01125');
      expect(sideScheme).toBeDefined();
      // 2 base threat + 2 per hero (2 players) = 4 total threat
      expect(sideScheme!.threat).toBe(4);
    });
  });

  describe('Illegal Arms Factory (01126) When Revealed', () => {
    it('places 1 threat per hero on reveal (1P: 3 base + 1 = 4 threat)', () => {
      const card = cardCatalog.getCard('01126') as SideSchemeCard;
      expect(card).toBeDefined();
      expect(card.baseThreat).toBe(3);

      const inst = createCardInstance(card);
      state1P.players[0].dealtEncounterCards = [inst];

      step4_revealEncounterCards(state1P);

      const sideScheme = state1P.sideSchemes.find((s) => s.card.code === '01126');
      expect(sideScheme).toBeDefined();
      // 3 base threat + 1 per hero (1 player) = 4 total threat
      expect(sideScheme!.threat).toBe(4);
    });

    it('places 1 threat per hero on reveal (2P: 3 base + 2 = 5 threat)', () => {
      const card = cardCatalog.getCard('01126') as SideSchemeCard;
      const inst = createCardInstance(card);
      state2P.players[0].dealtEncounterCards = [inst];

      step4_revealEncounterCards(state2P);

      const sideScheme = state2P.sideSchemes.find((s) => s.card.code === '01126');
      expect(sideScheme).toBeDefined();
      // 3 base threat + 2 per hero (2 players) = 5 total threat
      expect(sideScheme!.threat).toBe(5);
    });
  });

  describe('Secret Rendezvous 2B (01117b) Completion', () => {
    it('triggers game defeat when completed as the final stage', () => {
      const schemeCard2B = cardCatalog.getCard('01117b') as MainSchemeCard;
      expect(schemeCard2B).toBeDefined();

      replaceActiveMainScheme(state1P, {
        instanceId: 'inst_2b',
        card: schemeCard2B,
        threat: 8,
        targetThreat: 8,
        stage: '2B',
      });

      const afterDefeat = handleMainSchemeCompletion(state1P);
      expect(afterDefeat.winner).toBe('VILLAIN');
    });
  });
});
