import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  AlterEgoCard,
  CardInstance,
  GameState,
  HeroCard,
  StatusCard,
  createCardInstance,
  getActiveMainScheme,
  getActiveVillain,
  setupGame,
  step4_revealEncounterCards,
} from '@engine/index';
import { executeEffect } from '@engine/effects';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { HERO_ACTOR, canThwart } from '@engine/pipeline/legality-checker';
import { getEffectiveVillainStats } from '@engine/pipeline/stat-calculator';
import { handleMainSchemeCompletion } from '@engine/pipeline/scenario-helpers';
import { executeVillainSchemeAgainstPlayer } from '@engine/pipeline/villain-phase';
import { attachCardToHost } from '@engine/state/state-validator';
import { getLegalActionsForPlayer } from '@engine/pipeline/legal-actions-generator';

// Plan #352, scenario S7: the Ultron cards with no Drones.

const COUNTDOWN_3B = '01139b';
const PROGRAM_TRANSMITTER = '01141';
const RAGE_OF_ULTRON = '01145';
const INVASIVE_AI = '01149';
const ULTRONS_IMPERATIVE = '01150';
const ULTRON_III = '01136';
const FILLER = '01005';

function game(playerCount: 1 | 2 = 2): GameState {
  const heroes = [
    { id: 'p1', name: 'Spider-Man', hero: '01001a', alterEgo: '01001b' },
    { id: 'p2', name: 'Captain Marvel', hero: '01010a', alterEgo: '01010b' },
  ].slice(0, playerCount);
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId: 'ultron',
    difficulty: 'STANDARD',
    seed: 'ultron-non-drones',
    skipMulligan: true,
    players: heroes.map((h) => ({
      id: h.id,
      name: h.name,
      hero: cardCatalog.getCard(h.hero) as HeroCard,
      alterEgo: cardCatalog.getCard(h.alterEgo) as AlterEgoCard,
      deckCards: Array(20).fill(cardCatalog.getCard(FILLER)!),
    })),
  });
  for (const p of state.players) {
    p.engagedMinions = [];
    p.hand = [];
    p.discard = [];
    p.currentForm = 'hero';
    p.activeFormCard = p.hero;
  }
  // Upgraded Drones has no boost icon and no star, so the amounts below are exact
  state.encounterDeck = Array.from({ length: 10 }, () => instance('01142'));
  state.encounterDiscard = [];
  return state;
}

const instance = (code: string): CardInstance => createCardInstance(cardCatalog.getCard(code)!);

function reveal(state: GameState, playerIndex: number, code: string): GameState {
  state.activePlayerIndex = playerIndex;
  state.players[playerIndex].dealtEncounterCards.push(instance(code));
  return step4_revealEncounterCards(state);
}

function answerAll(state: GameState): GameState {
  let current = state;
  for (let i = 0; i < 12; i++) {
    const prompt = peekDecisionPrompt(current);
    if (!prompt) break;
    const option =
      prompt.options.find((o) => /undefended|no defen|take/i.test(o.label)) ??
      prompt.options.find((o) => !o.disabled)!;
    current = dispatchAction(current, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: prompt.playerId,
      selectedOptionId: option.id,
    } as never).state;
  }
  return current;
}

describe('S7: Countdown to Oblivion 3B', () => {
  function countdown(): GameState {
    const state = game();
    const scheme = getActiveMainScheme(state);
    scheme.card = cardCatalog.getCard(COUNTDOWN_3B) as never;
    scheme.targetThreat = 99;
    scheme.threat = 5;
    return state;
  }

  it('S7: a basic thwart cannot remove threat from it', () => {
    const state = countdown();

    expect(canThwart(state, 'p1', HERO_ACTOR, 'main_scheme')).toEqual({
      allowed: false,
      reason: 'Threat cannot be removed from this scheme.',
    });
  });

  it('S7: no effect can remove threat from it, even an encounter card or one ignoring Crisis', () => {
    const state = countdown();
    const remove = (sourceCardInstance?: CardInstance) =>
      executeEffect(
        state,
        {
          id: 'test_remove',
          timing: 'HERO_ACTION',
          steps: [
            {
              effect: 'REMOVE_THREAT',
              effectParams: { target: 'MAIN_SCHEME', amount: 2, ignoresCrisis: true },
            },
          ],
        } as never,
        { playerId: 'p1', sourceCardInstance },
      );

    remove(instance(FILLER));
    remove(instance(RAGE_OF_ULTRON));

    expect(getActiveMainScheme(state).threat).toBe(5);
  });

  it('S7: threat can be removed from other main schemes', () => {
    const state = game();
    getActiveMainScheme(state).threat = 3;

    expect(canThwart(state, 'p1', HERO_ACTOR, 'main_scheme').allowed).toBe(true);
  });

  it('S7: completing it loses the game', () => {
    const state = countdown();
    const scheme = getActiveMainScheme(state);

    const after = handleMainSchemeCompletion(state, scheme.instanceId);

    expect(after.winner).toBe('VILLAIN');
  });
});

describe('S7: Program Transmitter', () => {
  function withTransmitter(): { state: GameState; transmitter: CardInstance } {
    const state = game();
    const transmitter = instance(PROGRAM_TRANSMITTER);
    attachCardToHost(state, transmitter, 'VILLAIN');
    return { state, transmitter };
  }

  it('S7: it attaches to Ultron when revealed and gives him +1 SCH', () => {
    const state = game();
    const before = getEffectiveVillainStats(state, getActiveVillain(state)).scheme;

    const after = reveal(state, 0, PROGRAM_TRANSMITTER);

    const villain = getActiveVillain(after);
    expect(villain.attachments.map((a) => a.card.code)).toEqual([PROGRAM_TRANSMITTER]);
    expect(getEffectiveVillainStats(after, villain).scheme).toBe(before + 1);
  });

  it('S7: after Ultron schemes, 1 threat goes on each side scheme', () => {
    const { state } = withTransmitter();
    state.sideSchemes.push(
      { instanceId: 'ss1', card: cardCatalog.getCard('01149') as never, threat: 1 },
      { instanceId: 'ss2', card: cardCatalog.getCard('01148') as never, threat: 2 },
    );

    executeVillainSchemeAgainstPlayer(state, state.players[0]);

    expect(state.sideSchemes.map((s) => s.threat)).toEqual([2, 3]);
  });

  it('S7: with no Transmitter, a villain scheme adds nothing to side schemes', () => {
    const state = game();
    state.sideSchemes.push({
      instanceId: 'ss1',
      card: cardCatalog.getCard('01149') as never,
      threat: 1,
    });

    executeVillainSchemeAgainstPlayer(state, state.players[0]);

    expect(state.sideSchemes[0].threat).toBe(1);
  });

  it('S7: a Confused Ultron does not scheme, so nothing is placed', () => {
    const { state } = withTransmitter();
    getActiveVillain(state).statusCards = [StatusCard.CONFUSED];
    state.sideSchemes.push({
      instanceId: 'ss1',
      card: cardCatalog.getCard('01149') as never,
      threat: 1,
    });

    executeVillainSchemeAgainstPlayer(state, state.players[0]);

    expect(state.sideSchemes[0].threat).toBe(1);
  });

  it('S7: the Hero Action exhausts your hero, spends 2 mental and discards it', () => {
    const { state, transmitter } = withTransmitter();
    const player = state.players[0];
    const mental = cardCatalog
      .getAllCards()
      .find((c) => c.type === 'resource' && (c.resources?.mental ?? 0) > 0 && !c.isUnique)!;
    const pay = [instance(mental.code), instance(mental.code)];
    player.hand = pay;
    player.exhausted = false;

    const offered = getLegalActionsForPlayer(state, player.id);
    expect(JSON.stringify(offered)).toContain(transmitter.instanceId);

    const { state: after, result } = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: player.id,
      cardInstanceId: transmitter.instanceId,
      abilityId: 'program_transmitter_discard',
      paymentCardInstanceIds: pay.map((c) => c.instanceId),
    } as never);

    expect(result.success).toBe(true);
    expect(getActiveVillain(after).attachments).toHaveLength(0);
    expect(after.encounterDiscard.some((c) => c.instanceId === transmitter.instanceId)).toBe(true);
    expect(after.players[0].exhausted).toBe(true);
    expect(after.players[0].hand).toHaveLength(0);
  });
});

describe('S7: Rage of Ultron', () => {
  it('S7: in alter-ego, Ultron schemes and you discard 1 deck card per threat placed', () => {
    const state = game();
    const player = state.players[1];
    player.currentForm = 'alter_ego';
    player.activeFormCard = player.alterEgo;
    const scheme = getEffectiveVillainStats(state, getActiveVillain(state)).scheme;
    const threat = getActiveMainScheme(state).threat;
    const deck = player.deck.length;

    const after = answerAll(reveal(state, 1, RAGE_OF_ULTRON));

    expect(scheme).toBeGreaterThan(0);
    expect(getActiveMainScheme(after).threat).toBe(threat + scheme);
    expect(after.players[1].deck).toHaveLength(deck - scheme);
    expect(after.players[1].discard.map((c) => c.card.code)).toEqual(Array(scheme).fill(FILLER));
    expect(after.players[1].health).toBe(after.players[1].maxHealth);
  });

  it('S7: in hero form, Ultron attacks you and you discard 1 deck card per damage dealt', () => {
    const state = game();
    const player = state.players[1];
    const attack = getEffectiveVillainStats(state, getActiveVillain(state)).attack;
    const deck = player.deck.length;
    const threat = getActiveMainScheme(state).threat;

    const after = answerAll(reveal(state, 1, RAGE_OF_ULTRON));

    expect(attack).toBeGreaterThan(0);
    expect(after.players[1].health).toBe(after.players[1].maxHealth - attack);
    expect(after.players[1].deck.length).toBeLessThanOrEqual(deck - attack);
    expect(after.players[1].discard.filter((c) => c.card.code === FILLER)).toHaveLength(attack);
    expect(getActiveMainScheme(after).threat).toBeGreaterThanOrEqual(threat);
  });

  it('S7: a scheme that pauses on a boost reveal still discards per threat placed', () => {
    const state = game();
    state.options = { ...state.options, villainPhaseStepping: true };
    // Repair Sequence: a star boost, so the scheme waits for the reveal, and 1 boost icon
    state.encounterDeck = [instance('01146'), ...state.encounterDeck];
    const player = state.players[1];
    player.currentForm = 'alter_ego';
    player.activeFormCard = player.alterEgo;
    const threatPlaced = getEffectiveVillainStats(state, getActiveVillain(state)).scheme + 1;
    const deck = player.deck.length;
    const ability = cardCatalog.getCard(RAGE_OF_ULTRON)!.enrichment!.abilities![0];

    const paused = executeEffect(state, ability, {
      playerId: 'p2',
      sourceCardInstance: instance(RAGE_OF_ULTRON),
    }).state;
    expect(peekDecisionPrompt(paused)?.kind).toBe('BOOST_ABILITY_REVEAL');
    expect(paused.players[1].deck).toHaveLength(deck);

    const after = answerAll(paused);

    expect(after.activeSchemeContext).toBeUndefined();
    expect(after.pendingSequences ?? []).toHaveLength(0);
    expect(after.players[1].deck).toHaveLength(deck - threatPlaced);
  });

  it('S7: no damage dealt, so no card is discarded', () => {
    const state = game();
    const player = state.players[1];
    getActiveVillain(state).statusCards = [StatusCard.STUNNED];
    const deck = player.deck.length;

    const after = answerAll(reveal(state, 1, RAGE_OF_ULTRON));

    expect(after.players[1].deck).toHaveLength(deck);
    expect(after.players[1].discard).toHaveLength(0);
  });
});

describe('S7: Invasive AI', () => {
  it('S7: each player discards the top 3 cards of their deck', () => {
    const state = game();
    const decks = state.players.map((p) => p.deck.length);

    const after = reveal(state, 0, INVASIVE_AI);

    after.players.forEach((p, i) => {
      expect(p.deck).toHaveLength(decks[i] - 3);
      expect(p.discard).toHaveLength(3);
    });
    expect(after.sideSchemes.some((s) => s.card.code === INVASIVE_AI)).toBe(true);
  });
});

describe("S7: Ultron III's When Revealed", () => {
  function revealUltronIII(state: GameState): GameState {
    const ability = cardCatalog
      .getCard(ULTRON_III)!
      .enrichment!.abilities!.find((a) => a.timing === 'WHEN_REVEALED')!;
    executeEffect(state, ability, { playerId: 'p1' });
    return state;
  }

  it("S7: it finds Ultron's Imperative in the encounter deck and reveals it", () => {
    const state = game();
    state.encounterDeck = [instance(ULTRONS_IMPERATIVE), instance(RAGE_OF_ULTRON)];

    const after = revealUltronIII(state);

    expect(after.sideSchemes.map((s) => s.card.code)).toContain(ULTRONS_IMPERATIVE);
    expect(after.encounterDeck.map((c) => c.card.code)).toEqual([RAGE_OF_ULTRON]);
  });

  it("S7: it finds Ultron's Imperative in the encounter discard pile", () => {
    const state = game();
    state.encounterDiscard = [instance(ULTRONS_IMPERATIVE)];

    const after = revealUltronIII(state);

    expect(after.sideSchemes.map((s) => s.card.code)).toContain(ULTRONS_IMPERATIVE);
    expect(after.encounterDiscard.map((c) => c.card.code)).not.toContain(ULTRONS_IMPERATIVE);
  });
});

describe('The whole Ultron set', () => {
  it('every Ultron card has an entry that models it', () => {
    const cards = cardCatalog.getCardsBySet('ultron');
    expect(cards.length).toBeGreaterThanOrEqual(22);
    for (const card of cards) {
      const enrichment = card.enrichment;
      expect(enrichment, card.code).toBeDefined();
      expect(
        (enrichment?.abilities?.length ?? 0) > 0 || enrichment?.noSupplementalNeeded === true,
        card.code,
      ).toBe(true);
      // Nothing left partial: the cards marked lower in PR A and B are complete now
      expect(enrichment?.audit?.confidence ?? 0, card.code).toBeGreaterThanOrEqual(95);
    }
  });
});
