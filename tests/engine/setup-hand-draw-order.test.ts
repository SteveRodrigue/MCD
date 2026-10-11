import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  GamePhase,
  HeroCard,
  AlterEgoCard,
  NormalizedCard,
  SideSchemeCard,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { ScenarioPlugin, ScenarioDefinition, ScenarioRegistry } from '@engine/scenarios';
import { applyThreatPlacement } from '@engine/pipeline/threat-pipeline';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';

/**
 * Issue #240: Appendix II draws the opening hands at step 14, after the scenario setup (steps 11
 * and 12). No player-controlled ability can be used before the game begins (owner ruling).
 */

const identityShuffle = <T>(arr: T[]): T[] => [...arr];

function card(code: string): NormalizedCard {
  return cardCatalog.getCard(code)!;
}

/** Emergency and Great Responsibility first, then known filler. */
function deckWithReactions(): NormalizedCard[] {
  return [card('01085'), card('01061'), ...Array(38).fill(card('01005'))];
}

const SPIDER_MAN = {
  id: 'p1',
  name: 'Peter Parker',
  hero: cardCatalog.getCard('01001a') as HeroCard,
  alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
};
const CAPTAIN_MARVEL = {
  id: 'p2',
  name: 'Carol Danvers',
  hero: cardCatalog.getCard('01010a') as HeroCard,
  alterEgo: cardCatalog.getCard('01010b') as AlterEgoCard,
};
const SHE_HULK = {
  id: 'p1',
  name: 'Jennifer Walters',
  hero: cardCatalog.getCard('01019a') as HeroCard,
  alterEgo: cardCatalog.getCard('01019b') as AlterEgoCard,
};

function breakinAndTakinThreat(state: GameState): number {
  const sideScheme = state.sideSchemes.find((s) => s.card.code === '01107')!;
  const def = sideScheme.card as SideSchemeCard;
  const n = state.players.length;
  return def.baseThreat * (def.baseThreatFixed ? 1 : n) + n;
}

function expertSetup(
  players: (typeof SPIDER_MAN)[],
  skipMulligan: boolean,
  deck: () => NormalizedCard[] = deckWithReactions,
): GameState {
  return setupGame({
    scenarioId: 'rhino',
    difficulty: 'EXPERT',
    players: players.map((p) => ({ ...p, deckCards: deck() })),
    shuffleFn: identityShuffle,
    skipMulligan,
  });
}

describe('Setup order: opening hands drawn after the scenario setup (Issue #240)', () => {
  for (const skipMulligan of [false, true]) {
    const label = skipMulligan ? 'skipMulligan' : 'mulligan';

    it(`Expert, Spider-Man and Captain Marvel (${label}): setup completes with no prompt`, () => {
      const state = expertSetup([SPIDER_MAN, CAPTAIN_MARVEL], skipMulligan);

      expect(peekDecisionPrompt(state)).toBeUndefined();
      expect(state.pendingDecisionQueue).toHaveLength(0);

      const bakeIn = state.sideSchemes.find((s) => s.card.code === '01107');
      expect(bakeIn).toBeDefined();
      expect(bakeIn!.threat).toBe(breakinAndTakinThreat(state));

      for (const p of state.players) {
        expect(p.hand).toHaveLength(p.alterEgo.handSize);
        expect(p.hand.some((c) => c.card.code === '01085')).toBe(true);
        expect(p.hand.some((c) => c.card.code === '01061')).toBe(true);
      }

      if (skipMulligan) {
        expect(state.phase).toBe(GamePhase.PLAYER_PHASE);
        expect(state.setupState).toBeUndefined();
      } else {
        expect(state.phase).toBe(GamePhase.SETUP_PHASE);
        expect(state.setupState?.stage).toBe('MULLIGAN_PHASE');
      }
    });
  }

  it('Standard: opening hands are the first cards of each deck with an identity shuffle', () => {
    const distinct = ['01005', '01006', '01007', '01008', '01009', '01011', '01012', '01013'].map(
      card,
    );
    const deck = () => [...distinct, ...distinct, ...distinct, ...distinct, ...distinct];
    const state = setupGame({
      scenarioId: 'rhino',
      difficulty: 'STANDARD',
      players: [{ ...SPIDER_MAN, deckCards: deck() }],
      shuffleFn: identityShuffle,
      skipMulligan: true,
    });

    const handSize = SPIDER_MAN.alterEgo.handSize;
    expect(state.players[0].hand.map((c) => c.card.code)).toEqual(
      deck()
        .slice(0, handSize)
        .map((c) => c.code),
    );
  });

  it('Expert with She-Hulk: "I Object!" is not offered at setup and Breakin & Takin keeps its threat', () => {
    const state = expertSetup([SHE_HULK], true);

    expect(peekDecisionPrompt(state)).toBeUndefined();
    const bakeIn = state.sideSchemes.find((s) => s.card.code === '01107')!;
    expect(bakeIn.threat).toBe(breakinAndTakinThreat(state));
    expect(state.players[0].usedAbilitiesThisRound?.['i_object']).toBeUndefined();
  });

  it("Expert: Breakin & Takin's own When Revealed still resolves and Rhino's setup log is intact", () => {
    const state = expertSetup([SPIDER_MAN], true);

    const bakeIn = state.sideSchemes.find((s) => s.card.code === '01107')!;
    const def = bakeIn.card as SideSchemeCard;
    expect(bakeIn.threat).toBe(def.baseThreat * (def.baseThreatFixed ? 1 : 1) + 1);

    const keys = state.log.map((l) => l.key);
    expect(keys).toContain('encounter.reveal.sideScheme');
    expect(keys).toContain('scenario.setup');
  });

  it('After setup, "I Object!" and Great Responsibility are offered again in round 1', () => {
    const sheHulk = expertSetup([SHE_HULK], true);
    expect(sheHulk.players[0].currentForm).toBe('alter_ego');
    applyThreatPlacement(sheHulk, {
      targetType: 'main_scheme',
      amount: 2,
      sourceType: 'CARD_EFFECT',
      sourcePlayerId: 'p1',
    });
    expect(peekDecisionPrompt(sheHulk)?.sourceCardCode).toBe('01019b');

    const spider = expertSetup([SPIDER_MAN], true);
    spider.players[0].currentForm = 'hero';
    spider.players[0].activeFormCard = spider.players[0].hero;
    spider.players[0].hand = [
      createCardInstance(card('01061')),
      createCardInstance(card('01005')),
      createCardInstance(card('01005')),
    ];
    applyThreatPlacement(spider, {
      targetType: 'main_scheme',
      amount: 2,
      sourceType: 'CARD_EFFECT',
      sourcePlayerId: 'p1',
    });
    expect(peekDecisionPrompt(spider)?.sourceCardCode).toBe('01061');
  });

  describe('Setup phase around the scenario plugin call', () => {
    const probeDefinition: ScenarioDefinition = {
      id: 'setup_phase_probe',
      name: 'Setup Phase Probe',
      scenarioCardCode: 'probe_001',
      author: 'test',
      version: '1.0.0',
      description: 'Records the phase seen while the scenario plugin runs.',
      supportedDifficulties: ['STANDARD'],
      villainSetup: {
        villainName: 'Rhino',
        stages: { SKIRMISH: ['01094'], STANDARD: ['01094'], EXPERT: ['01094'] },
      },
      mainSchemeSetup: {
        stages: ['01097a'],
        startingThreat: 1,
        targetThreatPerPlayer: 5,
        escalationThreatPerPlayer: 1,
      },
      modularEncounterSets: {
        mandatory: ['rhino'],
        defaults: { SKIRMISH: ['standard'], STANDARD: ['standard'], EXPERT: ['standard'] },
      },
    };

    const seen: { phase?: GamePhase; stage?: string; handSizes?: number[] } = {};
    const probe: ScenarioPlugin = {
      definition: probeDefinition,
      onGameSetup(state) {
        seen.phase = state.phase;
        seen.stage = state.setupState?.stage;
        seen.handSizes = state.players.map((p) => p.hand.length);
        return state;
      },
      onVillainDefeated: (state) => ({ state }),
      onMainSchemeCompleted: (state) => ({ state }),
    };

    function probeSetup(skipMulligan: boolean): GameState {
      ScenarioRegistry.register(probe);
      return setupGame({
        scenarioId: 'setup_phase_probe',
        players: [{ ...SPIDER_MAN, deckCards: deckWithReactions() }],
        villain: card('01094') as any,
        mainScheme: card('01097b') as any,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        shuffleFn: identityShuffle,
        skipMulligan,
      });
    }

    it('skipMulligan: SETUP_PHASE during the plugin call, PLAYER_PHASE afterwards', () => {
      const state = probeSetup(true);
      expect(seen.phase).toBe(GamePhase.SETUP_PHASE);
      expect(seen.stage).toBe('SCENARIO_SETUP');
      expect(seen.handSizes).toEqual([0]);
      expect(state.phase).toBe(GamePhase.PLAYER_PHASE);
      expect(state.setupState).toBeUndefined();
      expect(state.players[0].hand).toHaveLength(SPIDER_MAN.alterEgo.handSize);
    });

    it('mulligan: SETUP_PHASE during the plugin call, mulligan stage afterwards', () => {
      const state = probeSetup(false);
      expect(seen.phase).toBe(GamePhase.SETUP_PHASE);
      expect(seen.stage).toBe('SCENARIO_SETUP');
      expect(state.phase).toBe(GamePhase.SETUP_PHASE);
      expect(state.setupState).toEqual({ stage: 'MULLIGAN_PHASE', mulliganCompleted: {} });
    });
  });
});
