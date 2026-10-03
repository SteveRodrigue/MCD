import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  VillainState,
  getActiveVillain,
  getVillainsInPlay,
  getVillainById,
  setActiveVillain,
  replaceVillain,
  removeVillain,
  getActiveMainScheme,
  getMainSchemesInPlay,
} from '@engine/models';
import { setupGame } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';

/**
 * #194: `villains[]` is canonical; the active villain is identified by `activeVillainId`
 * (the MC03 "active counter"). `state.villain` / `state.mainScheme` are legacy pointers that
 * silently diverge from the collections after the JSON clone in `dispatchAction`.
 * MC03 Wrecking Crew rules insert p.6: "the villain" means the active villain only; players may
 * attack any villain.
 */

const makeVillain = (instanceId: string, code: string, health: number): VillainState => ({
  instanceId,
  card: cardCatalog.getCard(code) as any,
  health,
  maxHealth: health,
  exhausted: false,
  statusCards: [],
  attachments: [],
});

const buildHeroState = (): GameState => {
  const state = setupGame({
    scenarioId: 'rhino',
    players: [
      {
        id: 'p1',
        name: 'Player 1',
        hero: cardCatalog.getCard('01001a') as HeroCard,
        alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
        deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
      },
    ],
    villain: cardCatalog.getCard('01094') as any,
    mainScheme: cardCatalog.getCard('01097b') as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });
  state.players[0].currentForm = 'hero';
  state.players[0].activeFormCard = state.players[0].hero;
  return state;
};

/** Four villains in play, Wrecker-style: the first holds the active counter. */
const buildFourVillainState = (): GameState => {
  const state = buildHeroState();
  const villains = [
    makeVillain('v_wrecker', '01094', 18),
    makeVillain('v_thunderball', '01095', 16),
    makeVillain('v_piledriver', '01094', 11),
    makeVillain('v_bulldozer', '01095', 15),
  ];
  state.villains = villains;
  state.villain = villains[0];
  state.activeVillainId = 'v_wrecker';
  return state;
};

describe('Active villain accessors (#194, MC03 multi-villain readiness)', () => {
  describe('queries', () => {
    it('getActiveVillain resolves the villain holding the active counter by id', () => {
      const state = buildFourVillainState();
      state.activeVillainId = 'v_piledriver';
      expect(getActiveVillain(state).instanceId).toBe('v_piledriver');
    });

    it('getVillainsInPlay returns every villain, active or not', () => {
      const state = buildFourVillainState();
      expect(getVillainsInPlay(state).map((v) => v.instanceId)).toEqual([
        'v_wrecker',
        'v_thunderball',
        'v_piledriver',
        'v_bulldozer',
      ]);
    });

    it('getVillainById reaches a non-active villain by instance id', () => {
      const state = buildFourVillainState();
      expect(getVillainById(state, 'v_bulldozer')?.health).toBe(15);
    });

    it('falls back to the first villain when no active id is recorded', () => {
      const state = buildFourVillainState();
      delete state.activeVillainId;
      expect(getActiveVillain(state).instanceId).toBe('v_wrecker');
    });

    it('falls back to the legacy pointer only when the collection is empty', () => {
      const state = buildHeroState();
      const legacy = state.villains[0];
      state.villains = [];
      delete state.activeVillainId;
      expect(getActiveVillain(state)).toBe(legacy);
      expect(getVillainsInPlay(state)).toEqual([]);
    });

    it('main scheme collection helpers mirror the villain split', () => {
      const state = buildHeroState();
      expect(getMainSchemesInPlay(state)).toHaveLength(1);
      expect(getActiveMainScheme(state)).toBe(state.mainSchemes[0]);
    });
  });

  describe('setters', () => {
    it('setActiveVillain moves the active counter by id', () => {
      const state = buildFourVillainState();
      setActiveVillain(state, 'v_bulldozer');
      expect(state.activeVillainId).toBe('v_bulldozer');
      expect(getActiveVillain(state).instanceId).toBe('v_bulldozer');
    });

    it('setActiveVillain rejects an id that is not in play', () => {
      const state = buildFourVillainState();
      expect(() => setActiveVillain(state, 'v_missing')).toThrow();
      expect(state.activeVillainId).toBe('v_wrecker');
    });

    it('replaceVillain swaps a stage in place and keeps the counter when it was active', () => {
      const state = buildFourVillainState();
      const next = makeVillain('v_wrecker_b', '01095', 20);
      replaceVillain(state, 'v_wrecker', next);
      expect(state.villains.map((v) => v.instanceId)).toEqual([
        'v_wrecker_b',
        'v_thunderball',
        'v_piledriver',
        'v_bulldozer',
      ]);
      expect(state.activeVillainId).toBe('v_wrecker_b');
    });

    it('replaceVillain leaves the counter alone when a non-active villain is replaced', () => {
      const state = buildFourVillainState();
      replaceVillain(state, 'v_piledriver', makeVillain('v_piledriver_b', '01095', 14));
      expect(state.activeVillainId).toBe('v_wrecker');
      expect(state.villains[2].instanceId).toBe('v_piledriver_b');
    });

    it('removeVillain drops a non-active villain and leaves the counter untouched', () => {
      const state = buildFourVillainState();
      removeVillain(state, 'v_thunderball');
      expect(state.villains.map((v) => v.instanceId)).toEqual([
        'v_wrecker',
        'v_piledriver',
        'v_bulldozer',
      ]);
      expect(state.activeVillainId).toBe('v_wrecker');
    });

    it('removeVillain on the active villain moves the counter to the successor the scenario picks', () => {
      const state = buildFourVillainState();
      removeVillain(state, 'v_wrecker', (remaining) =>
        remaining.find((v) => v.instanceId === 'v_bulldozer'),
      );
      expect(state.villains).toHaveLength(3);
      expect(state.activeVillainId).toBe('v_bulldozer');
      expect(getActiveVillain(state).instanceId).toBe('v_bulldozer');
    });

    it('removeVillain on the active villain defaults to the first remaining villain', () => {
      const state = buildFourVillainState();
      removeVillain(state, 'v_wrecker');
      expect(state.activeVillainId).toBe('v_thunderball');
    });
  });

  describe('legacy pointer divergence after dispatch (JSON clone)', () => {
    let state: GameState;
    beforeEach(() => {
      state = buildHeroState();
    });

    it('damage dealt through dispatch lands on the entity the accessor returns', () => {
      const { state: next, result } = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'villain',
      });
      expect(result.success).toBe(true);
      const active = getActiveVillain(next);
      expect(active.health).toBeLessThan(active.maxHealth);
      // The canonical collection and the accessor agree after the clone.
      expect(next.villains[0].health).toBe(active.health);
    });
  });

  describe('attacking a chosen non-active villain (B: by-id) ', () => {
    it('BASIC_ATTACK with a villain targetInstanceId damages that villain, not the active one', () => {
      const state = buildFourVillainState();
      const { state: next, result } = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'villain',
        targetInstanceId: 'v_piledriver',
      });
      expect(result.success).toBe(true);
      expect(getVillainById(next, 'v_piledriver')!.health).toBeLessThan(11);
      expect(getVillainById(next, 'v_wrecker')!.health).toBe(18);
    });

    it('BASIC_ATTACK without a villain target id still hits the active villain', () => {
      const state = buildFourVillainState();
      setActiveVillain(state, 'v_thunderball');
      const { state: next, result } = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'villain',
      });
      expect(result.success).toBe(true);
      expect(getVillainById(next, 'v_thunderball')!.health).toBeLessThan(16);
      expect(getVillainById(next, 'v_wrecker')!.health).toBe(18);
    });
  });
});
