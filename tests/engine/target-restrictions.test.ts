import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  Keyword,
  getActiveMainScheme,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  getMainSchemeThreatBlock,
  isVillainAttackBlockedByGuard,
} from '@engine/pipeline/target-restrictions';

// RR v1.8 "Crisis Icon", "Patrol", "Guard": the one place that says why a player's cards cannot
// remove threat from the main scheme or attack the villain (#331, ADR-0090).
describe('target restrictions (Crisis, Patrol, Guard)', () => {
  let state: GameState;

  const withKeyword = (keyword: Keyword) =>
    createCardInstance({
      ...(cardCatalog.getCard('01101') as MinionCard),
      keywords: [keyword],
      text: '',
      enrichment: undefined,
    } as MinionCard);

  const crisisCard = (code: string) => ({
    ...cardCatalog.getCard(code)!,
    scheme_crisis: 1,
  });

  beforeEach(() => {
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'She-Hulk',
          hero: cardCatalog.getCard('01019a') as HeroCard,
          alterEgo: cardCatalog.getCard('01019b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Black Panther',
          hero: cardCatalog.getCard('01029a') as HeroCard,
          alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as never,
      mainScheme: cardCatalog.getCard('01097b') as never,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.sideSchemes = [];
    getActiveMainScheme(state).threat = 4;
  });

  describe('getMainSchemeThreatBlock', () => {
    it('is undefined on a clear board', () => {
      expect(getMainSchemeThreatBlock(state, state.players[0], {})).toBeUndefined();
    });

    it('is CRISIS while a Crisis side scheme is in play', () => {
      state.sideSchemes = [
        { instanceId: 'cc', card: cardCatalog.getCard('01108')!, threat: 2 } as never,
      ];
      expect(getMainSchemeThreatBlock(state, state.players[0], {})).toBe('CRISIS');
      expect(getMainSchemeThreatBlock(state, state.players[1], {})).toBe('CRISIS');
    });

    it.each([
      [
        'an attachment on the main scheme',
        (s: GameState) => {
          getActiveMainScheme(s).attachments = [createCardInstance(crisisCard('01005') as never)];
        },
      ],
      [
        'an ally attachment',
        (s: GameState) => {
          const ally = createCardInstance(cardCatalog.getCard('01011')!);
          ally.attachments = [createCardInstance(crisisCard('01005') as never)];
          s.players[1].allies = [ally];
        },
      ],
      [
        'an engaged minion',
        (s: GameState) => {
          s.players[1].engagedMinions = [createCardInstance(crisisCard('01101') as never)];
        },
      ],
      [
        'an upgrade or support in a tableau',
        (s: GameState) => {
          s.players[1].tableau = [createCardInstance(crisisCard('01037') as never)];
        },
      ],
      [
        'an attachment on the villain',
        (s: GameState) => {
          s.villains[0].attachments = [createCardInstance(crisisCard('01005') as never)];
        },
      ],
    ])('is CRISIS for a Crisis icon on %s', (_zone, place) => {
      place(state);
      expect(getMainSchemeThreatBlock(state, state.players[0], {})).toBe('CRISIS');
    });

    it('is PATROL only for the player the Patrol minion is engaged with', () => {
      state.players[0].engagedMinions = [withKeyword(Keyword.PATROL)];
      expect(getMainSchemeThreatBlock(state, state.players[0], {})).toBe('PATROL');
      expect(getMainSchemeThreatBlock(state, state.players[1], {})).toBeUndefined();
    });

    it('reports Patrol before Crisis when both apply', () => {
      state.players[0].engagedMinions = [withKeyword(Keyword.PATROL)];
      state.sideSchemes = [
        { instanceId: 'cc', card: cardCatalog.getCard('01108')!, threat: 2 } as never,
      ];
      expect(getMainSchemeThreatBlock(state, state.players[0], {})).toBe('PATROL');
    });

    it('lets an encounter source ignore both (RR v1.8: player cards only)', () => {
      state.players[0].engagedMinions = [withKeyword(Keyword.PATROL)];
      state.sideSchemes = [
        { instanceId: 'cc', card: cardCatalog.getCard('01108')!, threat: 2 } as never,
      ];
      expect(
        getMainSchemeThreatBlock(state, state.players[0], { isPlayerSource: false }),
      ).toBeUndefined();
    });

    it('lets ignoresCrisis skip Crisis only: Patrol still blocks a player card', () => {
      state.sideSchemes = [
        { instanceId: 'cc', card: cardCatalog.getCard('01108')!, threat: 2 } as never,
      ];
      expect(
        getMainSchemeThreatBlock(state, state.players[0], { ignoresCrisis: true }),
      ).toBeUndefined();
      state.players[0].engagedMinions = [withKeyword(Keyword.PATROL)];
      expect(getMainSchemeThreatBlock(state, state.players[0], { ignoresCrisis: true })).toBe(
        'PATROL',
      );
    });
  });

  describe('isVillainAttackBlockedByGuard', () => {
    it('is true only for the player engaged with a Guard minion', () => {
      state.players[0].engagedMinions = [withKeyword(Keyword.GUARD)];
      expect(isVillainAttackBlockedByGuard(state.players[0])).toBe(true);
      expect(isVillainAttackBlockedByGuard(state.players[1])).toBe(false);
    });

    it('is false for a minion without Guard', () => {
      state.players[0].engagedMinions = [withKeyword(Keyword.PATROL)];
      expect(isVillainAttackBlockedByGuard(state.players[0])).toBe(false);
    });
  });
});
