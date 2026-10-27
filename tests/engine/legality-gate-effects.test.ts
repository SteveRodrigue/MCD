import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '@engine/state/game-setup';
import { checkAbilityTargets } from '@engine/effects/target-choice';
import {
  getActiveMainScheme,
  getActiveVillain,
  StatusCard,
  type AbilityStep,
  type CardAbility,
  type CardInstance,
  type GameState,
  type SideSchemeCard,
} from '@engine/models';
import { getEffectivePlayerTraits } from '@engine/pipeline/stat-calculator';
import { abilityOf, newRhinoGame } from '../support/game-fixtures';

/**
 * The target-state rules of the effects that act on cards, schemes and counters (#365, ADR-0090):
 * an ability whose only step has nothing to act on is not offered and costs nothing (RR v1.8
 * "Target", "Forced").
 */
const heroGame = (): GameState => newRhinoGame({ players: [{ hero: '01019a', form: 'hero' }] });
const instanceOf = (code: string): CardInstance => createCardInstance(cardCatalog.getCard(code)!);
const abilityWith = (...steps: AbilityStep[]): CardAbility => ({
  id: 'test_ability',
  timing: 'ACTION',
  steps,
});
const step = (effect: AbilityStep['effect'], effectParams: Record<string, unknown> = {}) =>
  ({ effect, effectParams }) as AbilityStep;
const allowed = (state: GameState, ability: CardAbility, source?: CardInstance): boolean =>
  checkAbilityTargets(state, state.players[0], ability, source).allowed;

describe('ADD_THREAT: the scheme a card code names must be in play', () => {
  const sideSchemeIn = (state: GameState, code: string) =>
    state.sideSchemes.push({
      instanceId: 'side-1',
      card: cardCatalog.getCard(code) as SideSchemeCard,
      threat: 0,
    });

  it("Yon-Rogg's Forced Response (01177) is skipped while the Psyche-Magnitron is absent", () => {
    const state = heroGame();
    state.sideSchemes = [];
    const ability = abilityOf('01177', 'yon_rogg_response');
    expect(allowed(state, ability)).toBe(false);

    sideSchemeIn(state, '01176');
    expect(allowed(state, ability)).toBe(true);
  });

  it('a step without a named scheme targets the main scheme, which is always in play', () => {
    expect(allowed(heroGame(), abilityWith(step('ADD_THREAT', { amount: 1 })))).toBe(true);
  });
});

describe('ADD_TRAIT: the identity must lack the trait', () => {
  it('is not offered when the identity already has it', () => {
    const state = heroGame();
    const [held] = getEffectivePlayerTraits(state.players[0], state);
    const grant = (trait: string) =>
      abilityWith(step('ADD_TRAIT', { target: 'SELF_IDENTITY', trait }));
    expect(allowed(state, grant(held))).toBe(false);
    expect(allowed(state, grant('Brand New Trait'))).toBe(true);
  });
});

describe('DISCARD: there must be a card to discard from the source zone', () => {
  const discard = (source: string, extra: Record<string, unknown> = {}) =>
    abilityWith(step('DISCARD', { source, count: 1, ...extra }));

  it('HAND needs a card in hand, honouring the filter', () => {
    const state = heroGame();
    state.players[0].hand = [];
    expect(allowed(state, discard('HAND'))).toBe(false);

    state.players[0].hand = [instanceOf('01005')];
    expect(allowed(state, discard('HAND'))).toBe(true);
    expect(allowed(state, discard('HAND', { filter: { types: ['villain'] } }))).toBe(false);
  });

  it('DECK needs a card in the deck or its discard pile (an empty deck is reset)', () => {
    const state = heroGame();
    state.players[0].deck = [];
    state.players[0].discard = [];
    expect(allowed(state, discard('DECK'))).toBe(false);

    state.players[0].discard = [instanceOf('01005')];
    expect(allowed(state, discard('DECK'))).toBe(true);
  });

  it('ENCOUNTER_DECK needs a card in the encounter deck or its discard pile', () => {
    const state = heroGame();
    state.encounterDeck = [];
    state.encounterDiscard = [];
    expect(allowed(state, discard('ENCOUNTER_DECK'))).toBe(false);

    state.encounterDeck = [instanceOf('01005')];
    expect(allowed(state, discard('ENCOUNTER_DECK'))).toBe(true);
  });

  it('TABLEAU needs a matching card there, and a fallback always has something to do', () => {
    const state = heroGame();
    state.players[0].tableau = [];
    expect(allowed(state, discard('TABLEAU'))).toBe(false);
    expect(allowed(state, discard('TABLEAU', { fallback: 'SURGE' }))).toBe(true);

    state.players[0].tableau = [instanceOf('01057')];
    expect(allowed(state, discard('TABLEAU'))).toBe(true);
  });

  it('CARDS_UNDER_HOST needs cards underneath the villain or main scheme', () => {
    const state = heroGame();
    expect(allowed(state, discard('CARDS_UNDER_HOST'))).toBe(false);

    getActiveVillain(state).cardsUnderneath = [instanceOf('01005')];
    expect(allowed(state, discard('CARDS_UNDER_HOST'))).toBe(true);
    expect(allowed(state, discard('CARDS_UNDER_HOST', { target: 'MAIN_SCHEME' }))).toBe(false);
  });

  it('SELF needs the source card', () => {
    const state = heroGame();
    expect(allowed(state, discard('SELF'))).toBe(false);
    expect(allowed(state, discard('SELF'), instanceOf('01057'))).toBe(true);
  });
});

describe('PUT_INTO_PLAY: a matching card must wait in the source zone', () => {
  it('needs a card set aside, and a card that passes the filter', () => {
    const state = heroGame();
    const put = (filter?: Record<string, unknown>) =>
      abilityWith(step('PUT_INTO_PLAY', { from: 'SET_ASIDE', to: 'TABLEAU', filter }));
    state.players[0].setAsideCards = [];
    expect(allowed(state, put())).toBe(false);

    state.players[0].setAsideCards = [instanceOf('01005')];
    expect(allowed(state, put())).toBe(true);
    expect(allowed(state, put({ types: ['villain'] }))).toBe(false);
  });
});

describe('REMOVE_COUNTERS and REMOVE_COUNTERS_MATCHING_FILTER: a counter must exist', () => {
  it('REMOVE_COUNTERS needs a counter on the source card', () => {
    const state = heroGame();
    const source = instanceOf('01057');
    const remove = abilityWith(step('REMOVE_COUNTERS', { counterType: 'energy', amount: 1 }));
    source.counters = { energy: 0 };
    source.tokens = { damage: 0, threat: 0, counters: 0 };
    expect(allowed(state, remove, source)).toBe(false);

    source.counters = { energy: 2 };
    expect(allowed(state, remove, source)).toBe(true);
  });

  it('REMOVE_COUNTERS on the identity needs a counter there', () => {
    const state = heroGame();
    const remove = abilityWith(
      step('REMOVE_COUNTERS', { target: 'IDENTITY', counterType: 'energy' }),
    );
    expect(allowed(state, remove)).toBe(false);

    state.players[0].counters = { energy: 1 };
    expect(allowed(state, remove)).toBe(true);
  });

  it('REMOVE_COUNTERS_MATCHING_FILTER needs a controlled card holding a counter', () => {
    const state = heroGame();
    const remove = abilityWith(
      step('REMOVE_COUNTERS_MATCHING_FILTER', { counterType: 'ALL', amount: 'ALL' }),
    );
    const card = instanceOf('01057');
    state.players[0].tableau = [card];
    expect(allowed(state, remove)).toBe(false);

    card.counters = { energy: 1 };
    expect(allowed(state, remove)).toBe(true);
  });
});

describe('REMOVE_STATUS: the target must hold the status card', () => {
  it('judges the villain by default', () => {
    const state = heroGame();
    const remove = abilityWith(step('REMOVE_STATUS', { status: 'STUNNED' }));
    expect(allowed(state, remove)).toBe(false);

    getActiveVillain(state).statusCards = [StatusCard.CONFUSED];
    expect(allowed(state, remove)).toBe(false);

    getActiveVillain(state).statusCards = [StatusCard.STUNNED];
    expect(allowed(state, remove)).toBe(true);
  });

  it('judges the named target: your own identity', () => {
    const state = heroGame();
    const remove = abilityWith(step('REMOVE_STATUS', { status: 'ALL', target: 'SELF_HERO' }));
    expect(allowed(state, remove)).toBe(false);

    state.players[0].statusCards = [StatusCard.STUNNED];
    expect(allowed(state, remove)).toBe(true);
  });
});

describe('RETURN_TO_HAND: the source is in play, or holds cards underneath', () => {
  const ret = abilityWith(step('RETURN_TO_HAND'));

  it("Hellcat's (01020) and Make the Call's (01071) source must be in its controller's play area", () => {
    const state = heroGame();
    const hellcat = instanceOf('01020');
    expect(allowed(state, ret, hellcat)).toBe(false);

    state.players[0].allies.push(hellcat);
    expect(allowed(state, ret, hellcat)).toBe(true);
  });

  it('Highway Robbery (01166) returns the cards underneath, and has none to return when empty', () => {
    const state = heroGame();
    const robbery = instanceOf('01166');
    const ability = abilityOf('01166', 'highway_robbery_when_defeated');
    expect(allowed(state, ability, robbery)).toBe(false);

    robbery.cardsUnderneath = [instanceOf('01005')];
    expect(allowed(state, ability, robbery)).toBe(true);
  });
});

describe('a step judged by its own params decides the ability only when alone (#369)', () => {
  const thwart = step('REMOVE_THREAT', { target: 'CHOSEN_SCHEME', amount: 1 });
  const noThreat = (state: GameState): void => {
    for (const scheme of [getActiveMainScheme(state), ...state.sideSchemes]) scheme.threat = 0;
  };

  it('does not excuse a selector target that is missing', () => {
    const state = heroGame();
    noThreat(state);
    state.players[0].hand = [instanceOf('01005')];
    const ability = abilityWith(thwart, step('DISCARD', { source: 'HAND', count: 1 }));
    expect(allowed(state, ability)).toBe(false);
  });

  it('does not block a selector target that is valid', () => {
    const state = heroGame();
    getActiveMainScheme(state).threat = 2;
    state.players[0].hand = [];
    const ability = abilityWith(thwart, step('DISCARD', { source: 'HAND', count: 1 }));
    expect(allowed(state, ability)).toBe(true);
  });
});
