import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  AlterEgoCard,
  CardInstance,
  GameState,
  HeroCard,
  createCardInstance,
  getActiveMainScheme,
  setupGame,
  step4_revealEncounterCards,
} from '@engine/index';
import { discardCardInstance, executeEffect } from '@engine/effects';
import { ScenarioRegistry } from '@engine/scenarios';
import { defeatMinionsBeyondHitPoints } from '@engine/pipeline/damage-pipeline';
import { eliminatePlayer } from '@engine/pipeline/player-elimination';

// A Drone is a minion shell ("Drone" 1/1/1) with the real deck card tucked under it, owned by the
// player whose deck it came from. Plan #352, scenarios S1, S1-edge and S2.

const WEB_SHOOTER = '01008';
const SWINGING_WEB_KICK = '01005';

function game(playerCount: 1 | 2 = 2): GameState {
  const heroes = [
    { id: 'p1', name: 'Spider-Man', hero: '01001a', alterEgo: '01001b' },
    { id: 'p2', name: 'Captain Marvel', hero: '01010a', alterEgo: '01010b' },
  ].slice(0, playerCount);
  return setupGame({
    catalog: cardCatalog,
    scenarioId: 'ultron',
    difficulty: 'STANDARD',
    seed: 'ultron-drones',
    skipMulligan: true,
    players: heroes.map((h) => ({
      id: h.id,
      name: h.name,
      hero: cardCatalog.getCard(h.hero) as HeroCard,
      alterEgo: cardCatalog.getCard(h.alterEgo) as AlterEgoCard,
      deckCards: Array(15).fill(cardCatalog.getCard(SWINGING_WEB_KICK)!),
    })),
  });
}

const instance = (code: string): CardInstance => createCardInstance(cardCatalog.getCard(code)!);

const cardOf = (code: string) => cardCatalog.getCard(code)!;

function createDronesFor(state: GameState, playerId: string, count = 1) {
  return executeEffect(
    state,
    {
      id: 'test_drone',
      timing: 'WHEN_REVEALED',
      steps: [
        {
          effect: 'EXECUTE_SPECIAL',
          effectParams: { specialId: 'ULTRON_DRONE', target: 'SELF', count },
        },
      ],
    } as never,
    { playerId },
  );
}

function revealFrom(state: GameState, playerIndex: number, code: string): GameState {
  state.activePlayerIndex = playerIndex;
  state.players[playerIndex].dealtEncounterCards.push(instance(code));
  return step4_revealEncounterCards(state);
}

describe('S1: every creator card makes a Drone through the same action', () => {
  it('S1: Crimson Cowl 1B gives each player a Drone that hides its real card', () => {
    const state = game();
    for (const player of state.players) {
      expect(player.engagedMinions).toHaveLength(1);
      const [drone] = player.engagedMinions;
      expect(drone.isShell).toBe(true);
      expect(drone.card).toMatchObject({
        name: 'Drone',
        type: 'minion',
        health: 1,
        attack: 1,
        scheme: 1,
      });
      expect(drone.card.traits).toEqual(['Drone']);
      // The face says nothing about the real card (hidden information)
      expect(JSON.stringify(drone.card)).not.toContain('Swinging Web Kick');

      expect(drone.cardsUnderneath).toHaveLength(1);
      expect(drone.cardsUnderneath![0].card.code).toBe(SWINGING_WEB_KICK);
      expect(drone.cardsUnderneath![0].ownerId).toBe(player.id);
    }
  });

  it('S1: a Drone takes the top card of the deck, and the deck loses exactly that card', () => {
    const state = game(1);
    const player = state.players[0];
    const web = instance(WEB_SHOOTER);
    player.deck.unshift(web);
    const deckSize = player.deck.length;

    const result = createDronesFor(state, 'p1');

    expect(result.value).toBe(1);
    expect(player.deck).toHaveLength(deckSize - 1);
    expect(player.deck.some((c) => c.instanceId === web.instanceId)).toBe(false);
    expect(player.engagedMinions.at(-1)!.cardsUnderneath![0].instanceId).toBe(web.instanceId);
  });

  it.each([
    ['Assault on NORAD 2A', 0],
    ['Countdown to Oblivion 3A', 1],
  ])('S1: %s gives each player a Drone when the main scheme advances', (_name, advancesBefore) => {
    const state = game();
    const plugin = ScenarioRegistry.get('ultron')!;
    for (let i = 0; i < advancesBefore; i++) {
      plugin.onMainSchemeCompleted(state, getActiveMainScheme(state).instanceId!);
    }
    const before = state.players.map((p) => p.engagedMinions.length);

    plugin.onMainSchemeCompleted(state, getActiveMainScheme(state).instanceId!);

    state.players.forEach((p, i) => expect(p.engagedMinions).toHaveLength(before[i] + 1));
  });

  it.each(['01144a', '01144b', '01144c'])(
    'S1: Android Efficiency %s gives each player a Drone when revealed',
    (code) => {
      const state = game();
      const before = state.players.map((p) => p.engagedMinions.length);

      const after = revealFrom(state, 0, code);

      after.players.forEach((p, i) => expect(p.engagedMinions).toHaveLength(before[i] + 1));
    },
  );

  it("S1: Ultron's Imperative gives the first player 2 Drones and the other player none", () => {
    const state = game();
    state.firstPlayerIndex = 1;
    const before = state.players.map((p) => p.engagedMinions.length);

    const after = revealFrom(state, 0, '01150');

    expect(after.players[0].engagedMinions).toHaveLength(before[0]);
    expect(after.players[1].engagedMinions).toHaveLength(before[1] + 2);
  });

  it('S1: "each player" starts with the first player', () => {
    const state = game();
    state.firstPlayerIndex = 1;
    state.log = [];

    executeEffect(state, cardOf('01137b').enrichment!.abilities![0], { playerId: 'p1' });

    const actors = state.log
      .filter((e) => e.key === 'minion.drone.created')
      .map((e) => (e.params as { actor: string }).actor);
    expect(actors).toEqual(['Captain Marvel', 'Spider-Man']);
  });

  it('S1: Advanced Ultron Drone defeated gives the engaged player one Drone, once', () => {
    const state = game();
    const advanced = instance('01143');
    const p2 = state.players[1];
    p2.engagedMinions = [advanced];
    advanced.tokens = { damage: 4 };

    defeatMinionsBeyondHitPoints(state);

    expect(p2.engagedMinions).toHaveLength(1);
    expect(p2.engagedMinions[0].isShell).toBe(true);
    expect(state.players[0].engagedMinions).toHaveLength(1); // only the Drone from setup
    expect(state.encounterDiscard.some((c) => c.instanceId === advanced.instanceId)).toBe(true);
  });
});

describe('S1-edge: an empty deck', () => {
  it('S1-edge: an empty deck is reshuffled before the Drone is taken', () => {
    const state = game();
    const p2 = state.players[1];
    p2.deck = [];
    p2.discard = [instance(WEB_SHOOTER)];
    const dealtBefore = p2.dealtEncounterCards.length;
    const minionsBefore = p2.engagedMinions.length;

    const result = createDronesFor(state, 'p2');

    expect(result.value).toBe(1);
    expect(p2.engagedMinions).toHaveLength(minionsBefore + 1);
    expect(p2.engagedMinions.at(-1)!.cardsUnderneath![0].card.code).toBe(WEB_SHOOTER);
    // Deck exhaustion's penalty: 1 facedown encounter card
    expect(p2.dealtEncounterCards).toHaveLength(dealtBefore + 1);
  });

  it('S1-edge: with no deck and no discard pile there is no card, so no Drone', () => {
    const state = game();
    const p2 = state.players[1];
    p2.deck = [];
    p2.discard = [];
    const minionsBefore = p2.engagedMinions.length;

    const result = createDronesFor(state, 'p2');

    expect(result.value).toBe(0);
    expect(p2.engagedMinions).toHaveLength(minionsBefore);
  });
});

describe("S2: a Drone leaving play sends the real card to its owner's discard", () => {
  function droneWithWebShooter(state: GameState, playerId: string) {
    const player = state.players.find((p) => p.id === playerId)!;
    player.engagedMinions = [];
    player.deck.unshift(instance(WEB_SHOOTER));
    createDronesFor(state, playerId);
    return { player, drone: player.engagedMinions[0] };
  }

  it("S2: a defeated Drone goes to its owner's discard face up", () => {
    const state = game();
    const { player, drone } = droneWithWebShooter(state, 'p1');
    const encounterDiscardBefore = state.encounterDiscard.length;
    drone.tokens = { damage: 1 };

    defeatMinionsBeyondHitPoints(state);

    expect(player.engagedMinions).toHaveLength(0);
    expect(player.discard.map((c) => c.card.code)).toContain(WEB_SHOOTER);
    // The shell is not a card: it is in no pile
    expect(state.encounterDiscard).toHaveLength(encounterDiscardBefore);
    expect(state.encounterDiscard.some((c) => c.instanceId === drone.instanceId)).toBe(false);
    expect(player.discard.some((c) => c.instanceId === drone.instanceId)).toBe(false);
  });

  it("S2: a Drone discarded by an effect also sends the real card to its owner's discard", () => {
    const state = game();
    const { player, drone } = droneWithWebShooter(state, 'p1');
    const encounterDiscardBefore = state.encounterDiscard.length;

    discardCardInstance(state, drone);

    expect(player.engagedMinions).toHaveLength(0);
    expect(player.discard.map((c) => c.card.code)).toEqual([WEB_SHOOTER]);
    expect(state.encounterDiscard).toHaveLength(encounterDiscardBefore);
  });

  it('S2: the real card goes to its owner even when the Drone engages another player', () => {
    const state = game();
    const { player: owner, drone } = droneWithWebShooter(state, 'p1');
    const other = state.players[1];
    owner.engagedMinions = [];
    other.engagedMinions = [drone];
    drone.tokens = { damage: 1 };

    defeatMinionsBeyondHitPoints(state);

    expect(owner.discard.map((c) => c.card.code)).toContain(WEB_SHOOTER);
    expect(other.discard.map((c) => c.card.code)).not.toContain(WEB_SHOOTER);
  });

  it('S2: a search for the card does not find it as a Drone', () => {
    const state = game(1);
    const { player } = droneWithWebShooter(state, 'p1');
    player.deck = player.deck.filter((c) => c.card.code !== WEB_SHOOTER);
    player.hand = [];

    executeEffect(
      state,
      {
        id: 'test_search',
        timing: 'SETUP',
        steps: [
          {
            effect: 'SEARCH',
            effectParams: {
              source: ['DECK', 'DISCARD'],
              filter: { codes: [WEB_SHOOTER] },
              takeCount: 1,
              selectedDestination: 'HAND',
              autoSelectIfUnambiguous: true,
            },
          },
        ],
      } as never,
      { playerId: 'p1' },
    );

    expect(player.hand.map((c) => c.card.code)).not.toContain(WEB_SHOOTER);
    expect(player.engagedMinions[0].cardsUnderneath![0].card.code).toBe(WEB_SHOOTER);
  });

  it('S2: the real card completes a deck exhaustion waiting for a card in the discard pile', () => {
    const state = game(1);
    const { player, drone } = droneWithWebShooter(state, 'p1');
    player.deck = [];
    player.discard = [];
    player.deckEmptiedWithEmptyDiscard = true;
    drone.tokens = { damage: 1 };

    defeatMinionsBeyondHitPoints(state);

    expect(player.deckEmptiedWithEmptyDiscard).toBe(false);
    expect(player.deck.map((c) => c.card.code)).toEqual([WEB_SHOOTER]);
    expect(player.discard).toHaveLength(0);
  });

  it("S2: an eliminated player's Drone leaves play: its real card is theirs, step 4", () => {
    const state = game();
    const p1 = state.players[0];
    const p2 = state.players[1];
    const { drone: p1Drone } = droneWithWebShooter(state, 'p1');
    const p2DroneCount = p2.engagedMinions.length;

    eliminatePlayer(state, 'p1');

    expect(p2.engagedMinions.some((m) => m.instanceId === p1Drone.instanceId)).toBe(false);
    expect(p2.engagedMinions).toHaveLength(p2DroneCount);
    expect(p1.discard.map((c) => c.card.code)).toContain(WEB_SHOOTER);
    expect(p2.discard.map((c) => c.card.code)).not.toContain(WEB_SHOOTER);
  });

  it('S2: a non-shell minion is still discarded as itself', () => {
    const state = game();
    const minion = instance('01143');
    state.players[0].engagedMinions = [minion];

    discardCardInstance(state, minion);

    expect(state.encounterDiscard.some((c) => c.instanceId === minion.instanceId)).toBe(true);
  });
});
