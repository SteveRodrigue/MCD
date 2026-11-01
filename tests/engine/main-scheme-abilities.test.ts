import { describe, it, expect } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  AlterEgoCard,
  GameState,
  HeroCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  step4_revealEncounterCards,
  getActiveMainScheme,
} from '@engine/index';
import { ScenarioRegistry } from '@engine/scenarios';

// Main scheme Setup and When Revealed abilities are card data, resolved by the engine at setup
// (RR v1.8 Appendix II step 12) and when the main scheme advances. Environments enter play like
// any other card put into play.

const DEFENSE_NETWORK = '01125'; // side scheme of the Klaw set
const SOUND_MANIPULATION = '01124'; // a treachery of the Klaw set
const ULTRON_DRONES = '01140'; // environment of the Ultron set

function setup(scenarioId: string, shuffles?: { count: number }): GameState {
  resetInstanceCounter();
  return setupGame({
    catalog: cardCatalog,
    scenarioId,
    seed: 'main-scheme-abilities',
    shuffleFn: shuffles
      ? (items) => {
          shuffles.count++;
          return items;
        }
      : undefined,
    players: [
      {
        id: 'p1',
        name: 'Spider-Man',
        hero: cardCatalog.getCard('01001a') as HeroCard,
        alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
        deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
      },
    ],
    skipMulligan: true,
  });
}

const codes = (cards: { card: { code: string } }[]) => cards.map((c) => c.card.code);

describe('main scheme abilities at setup', () => {
  it("resolves Klaw's Setup then When Revealed: Defense Network, then the first minion", () => {
    const state = setup('klaw');

    // 1A Setup: Defense Network (the side scheme, not Sound Manipulation) is revealed
    expect(codes(state.sideSchemes)).toContain(DEFENSE_NETWORK);
    expect(codes(state.sideSchemes)).not.toContain(SOUND_MANIPULATION);
    expect(codes(state.encounterDeck)).not.toContain(DEFENSE_NETWORK);

    // 1B When Revealed: cards are discarded until a minion, which engages the first player
    expect(state.players[0].engagedMinions).toHaveLength(1);
    expect(state.players[0].engagedMinions[0].card.type).toBe('minion');
    expect(state.encounterDiscard.every((c) => c.card.type !== 'minion')).toBe(true);

    // Step 12a (Setup) resolves before step 12b (When Revealed)
    const logs = state.log.map((entry) => entry.key);
    expect(logs).toContain('encounter.reveal.sideScheme');
    expect(logs).toContain('card.discarded.fromDeck');
    expect(logs.indexOf('encounter.reveal.sideScheme')).toBeLessThan(
      logs.indexOf('card.discarded.fromDeck'),
    );
  });

  it('shuffles the encounter deck after the Defense Network search (Search rule)', () => {
    const rhino = { count: 0 };
    const klaw = { count: 0 };
    setup('rhino', rhino);
    setup('klaw', klaw);
    // Same players, same deck building: Klaw's search is the one extra shuffle
    expect(klaw.count).toBe(rhino.count + 1);
  });

  it("puts Ultron's Setup environment into play from the encounter deck", () => {
    const state = setup('ultron');
    expect(codes(state.environments)).toEqual([ULTRON_DRONES]);
    expect(codes(state.encounterDeck)).not.toContain(ULTRON_DRONES);
    expect(codes(state.players[0].tableau)).not.toContain(ULTRON_DRONES);
  });

  it('does nothing for a main scheme that declares no abilities (Rhino)', () => {
    const state = setup('rhino');
    expect(state.sideSchemes).toEqual([]);
    expect(state.environments).toEqual([]);
    expect(state.players[0].engagedMinions).toEqual([]);
  });
});

describe('main scheme abilities when the main scheme advances', () => {
  it("resolves stage 2A's When Revealed (discard until a minion) before stage 2B is placed", () => {
    const state = setup('klaw');
    const plugin = ScenarioRegistry.get('klaw');
    const engagedBefore = state.players[0].engagedMinions.length;
    const discardBefore = state.encounterDiscard.length;

    const result = plugin.onMainSchemeCompleted(state, getActiveMainScheme(state).instanceId!);

    expect(result.advancedStage).toBe(true);
    expect(getActiveMainScheme(state).card.code).toBe('01117b');
    expect(state.players[0].engagedMinions.length).toBe(engagedBefore + 1);
    // The cards discarded on the way to the minion end up in the encounter discard pile
    expect(state.encounterDiscard.length).toBeGreaterThanOrEqual(discardBefore);
    expect(state.encounterDiscard.every((c) => c.card.type !== 'minion')).toBe(true);
  });

  it('loses the game when the last stage is completed', () => {
    const state = setup('klaw');
    const plugin = ScenarioRegistry.get('klaw');
    plugin.onMainSchemeCompleted(state, getActiveMainScheme(state).instanceId!);
    const result = plugin.onMainSchemeCompleted(state, getActiveMainScheme(state).instanceId!);
    expect(result.defeat).toBe(true);
    expect(state.winner).toBe('VILLAIN');
  });
});

describe('environments enter play', () => {
  it('a revealed environment enters the villain play area instead of the discard pile', () => {
    const state = setup('rhino');
    state.players[0].dealtEncounterCards.push(
      createCardInstance(cardCatalog.getCard(ULTRON_DRONES)!),
    );
    const revealed = step4_revealEncounterCards(state);

    expect(codes(revealed.environments)).toEqual([ULTRON_DRONES]);
    expect(codes(revealed.encounterDiscard)).not.toContain(ULTRON_DRONES);
  });
});
