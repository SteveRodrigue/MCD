import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  SideSchemeCard,
  AllyCard,
  MinionCard,
  Keyword,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { canAllyThwart } from '@engine/pipeline/legality-checker';
import { dispatchAction } from '@engine/pipeline';

describe('Ally Thwart Legality & Dispatch Invariants (RR v1.8 p. 3, 11, 20)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let allyCard: AllyCard;
  let allyInstanceId: string;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    allyCard = cardCatalog.getCard('01011') as AllyCard; // Spider-Woman ally (THW 2, ATK 2, HP 2)

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;

    const allyInstance = createCardInstance(allyCard);
    allyInstance.tokens = { damage: 0 };
    allyInstance.exhausted = false;
    allyInstanceId = allyInstance.instanceId;
    state.players[0].allies = [allyInstance];
    state.mainScheme.threat = 4;
  });

  describe('canAllyThwart Legality', () => {
    it('permits ally thwart on main scheme when ready and threat > 0', () => {
      const check = canAllyThwart(state, 'p1', allyInstanceId, 'main_scheme');
      expect(check.allowed).toBe(true);
    });

    it('rejects ally thwart when ally is exhausted', () => {
      state.players[0].allies[0].exhausted = true;
      const check = canAllyThwart(state, 'p1', allyInstanceId, 'main_scheme');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('exhausted');
    });

    it('rejects ally thwart on main scheme when main scheme threat is 0', () => {
      state.mainScheme.threat = 0;
      const check = canAllyThwart(state, 'p1', allyInstanceId, 'main_scheme');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('no threat');
    });

    it('rejects ally thwart on main scheme when Crisis side scheme is in play (RR v1.8 p. 11)', () => {
      const crowdControlCard = cardCatalog.getCard('01108') as SideSchemeCard;
      state.sideSchemes = [
        {
          instanceId: 'side_1',
          card: crowdControlCard,
          threat: 2,
        },
      ];

      const check = canAllyThwart(state, 'p1', allyInstanceId, 'main_scheme');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Crisis');
    });

    it('rejects ally thwart on main scheme when player is engaged with Patrol minion (RR v1.8 p. 20)', () => {
      const minionCard = {
        ...cardCatalog.getCard('01110')!,
        keywords: [Keyword.PATROL],
      } as unknown as MinionCard;
      const minionInst = createCardInstance(minionCard);
      state.players[0].engagedMinions.push(minionInst);

      const check = canAllyThwart(state, 'p1', allyInstanceId, 'main_scheme');
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Patrol');
    });

    it('permits ally thwart on side scheme even when Crisis is active', () => {
      const crowdControlCard = cardCatalog.getCard('01108') as SideSchemeCard;
      state.sideSchemes = [
        {
          instanceId: 'side_1',
          card: crowdControlCard,
          threat: 2,
        },
      ];

      const check = canAllyThwart(state, 'p1', allyInstanceId, 'side_scheme', 'side_1');
      expect(check.allowed).toBe(true);
    });
  });

  describe('ALLY_THWART Action Resolution', () => {
    it('thwarts main scheme, exhausts ally, and inflicts consequential damage', () => {
      const res = dispatchAction(state, {
        type: 'ALLY_THWART',
        playerId: 'p1',
        allyInstanceId,
        targetType: 'main_scheme',
      });

      expect(res.result.success).toBe(true);
      expect(res.state.mainScheme.threat).toBe(2); // 4 - 2 THW
      expect(res.state.players[0].allies[0].exhausted).toBe(true);
      expect(res.state.players[0].allies[0].tokens?.damage).toBe(1); // 1 consequential damage
    });

    it('thwarts side scheme, reducing its threat', () => {
      const sideSchemeCard = cardCatalog.getCard('01108') as SideSchemeCard;
      state.sideSchemes = [
        {
          instanceId: 'side_1',
          card: sideSchemeCard,
          threat: 5,
        },
      ];

      const res = dispatchAction(state, {
        type: 'ALLY_THWART',
        playerId: 'p1',
        allyInstanceId,
        targetType: 'side_scheme',
        targetInstanceId: 'side_1',
      });

      expect(res.result.success).toBe(true);
      expect(res.state.sideSchemes[0].threat).toBe(3); // 5 - 2 THW
      expect(res.state.players[0].allies[0].exhausted).toBe(true);
      expect(res.state.players[0].allies[0].tokens?.damage).toBe(1);
    });

    it('defeats and discards side scheme when threat reaches 0', () => {
      const sideSchemeCard = cardCatalog.getCard('01108') as SideSchemeCard;
      state.sideSchemes = [
        {
          instanceId: 'side_1',
          card: sideSchemeCard,
          threat: 2,
        },
      ];

      const res = dispatchAction(state, {
        type: 'ALLY_THWART',
        playerId: 'p1',
        allyInstanceId,
        targetType: 'side_scheme',
        targetInstanceId: 'side_1',
      });

      expect(res.result.success).toBe(true);
      expect(res.state.sideSchemes).toHaveLength(0);
      expect(res.state.encounterDiscard.some((c) => c.card.code === '01108')).toBe(true);
    });

    it('defeats and discards ally when consequential damage reaches ally HP', () => {
      state.players[0].allies[0].tokens = { damage: 1 };

      const res = dispatchAction(state, {
        type: 'ALLY_THWART',
        playerId: 'p1',
        allyInstanceId,
        targetType: 'main_scheme',
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].allies).toHaveLength(0);
      expect(res.state.players[0].discard.some((c) => c.card.code === '01011')).toBe(true);
    });
  });
});
