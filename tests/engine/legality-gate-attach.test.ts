import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { createCardInstance } from '@engine/state/game-setup';
import { checkAbilityTargets } from '@engine/effects/target-choice';
import { canPlayCard } from '@engine/pipeline/legality-checker';
import {
  getActiveVillain,
  type AbilityStep,
  type CardAbility,
  type CardInstance,
  type GameState,
} from '@engine/models';
import { abilityOf, newRhinoGame } from '../support/game-fixtures';

/**
 * An attachment is played only while a host can take it, and an ability that searches needs
 * somewhere to look (#366, ADR-0090): one gate decides, for events, attachments and abilities
 * alike (RR v1.8 "Initiating Abilities" step 2, "Target").
 */
const heroGame = (): GameState => newRhinoGame({ players: [{ hero: '01019a', form: 'hero' }] });
const instanceOf = (code: string, id?: string): CardInstance => {
  const card = createCardInstance(cardCatalog.getCard(code)!, 'p1');
  if (id) card.instanceId = id;
  return card;
};
const minionOf = (code: string): CardInstance => instanceOf(code);
const allowed = (state: GameState, ability: CardAbility, source?: CardInstance): boolean =>
  checkAbilityTargets(state, state.players[0], ability, source).allowed;
const searchAbility = (effectParams: Record<string, unknown>): CardAbility => ({
  id: 'test_search',
  timing: 'ACTION',
  steps: [{ effect: 'SEARCH', effectParams } as AbilityStep],
});

describe('ATTACH_TO_HOST: a host must be able to take the card', () => {
  it('Spider-Tracer (CHOSEN_MINION) needs a minion engaged with any player', () => {
    const state = heroGame();
    const tracer = instanceOf('01007');
    const attach = abilityOf('01007', 'spider_tracer_attach');
    expect(allowed(state, attach, tracer)).toBe(false);

    state.players[0].engagedMinions = [minionOf('01101')];
    expect(allowed(state, attach, tracer)).toBe(true);
  });

  it('Webbed Up (CHOSEN_ENEMY, one per host) is refused only when every enemy already holds one', () => {
    const state = heroGame();
    const webbed = instanceOf('01009');
    const attach = abilityOf('01009', 'webbed_up_attach');
    expect(allowed(state, attach, webbed)).toBe(true);

    getActiveVillain(state).attachments = [instanceOf('01009')];
    expect(allowed(state, attach, webbed)).toBe(false);

    state.players[0].engagedMinions = [minionOf('01101')];
    expect(allowed(state, attach, webbed)).toBe(true);
  });

  it('a named host that is full is not a valid target, whatever else is in play', () => {
    const state = heroGame();
    const webbed = instanceOf('01009');
    const villain = getActiveVillain(state);
    villain.attachments = [instanceOf('01009')];
    state.players[0].engagedMinions = [minionOf('01101')];
    const attach = abilityOf('01009', 'webbed_up_attach');

    const onVillain = checkAbilityTargets(state, state.players[0], attach, webbed, {
      chosenTargetId: villain.instanceId,
    });
    expect(onVillain.allowed).toBe(false);
  });

  it('Inspired (CHOSEN_ALLY, one per host) needs an ally without one', () => {
    const state = heroGame();
    const inspired = instanceOf('01074');
    const attach = abilityOf('01074', 'inspired_attach');
    expect(allowed(state, attach, inspired)).toBe(false);

    const ally = instanceOf('01020');
    state.players[0].allies = [ally];
    expect(allowed(state, attach, inspired)).toBe(true);

    ally.attachments = [instanceOf('01074')];
    expect(allowed(state, attach, inspired)).toBe(false);
  });

  it('the hand check refuses an attachment with no host, with the gate reason', () => {
    const state = heroGame();
    const tracer = instanceOf('01007', 'tracer_1');
    state.players[0].hand = [tracer];
    state.players[0].engagedMinions = [];
    const check = canPlayCard(state, 'p1', 'tracer_1');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('No host can take this card');
  });
});

describe('SEARCH: there must be somewhere to look', () => {
  it('a discard pile needs a card that matches the filter', () => {
    const state = heroGame();
    const card = instanceOf('01005');
    const search = (types: string[]) =>
      searchAbility({ source: ['PLAYER_DISCARD'], target: 'SELF', filter: { types } });
    state.players[0].discard = [];
    expect(allowed(state, search([card.card.type]))).toBe(false);

    state.players[0].discard = [card];
    expect(allowed(state, search(['villain']))).toBe(false);
    expect(allowed(state, search([card.card.type]))).toBe(true);
  });

  it('a deck is hidden, so it only needs a card', () => {
    const state = heroGame();
    const search = searchAbility({ source: 'PLAYER_DECK', filter: { types: ['event'] } });
    state.players[0].deck = [];
    expect(allowed(state, search)).toBe(false);

    state.players[0].deck = [instanceOf('01005')];
    expect(allowed(state, search)).toBe(true);
  });

  it('several zones need only one that holds something', () => {
    const state = heroGame();
    const search = searchAbility({ source: ['ENCOUNTER_DECK', 'ENCOUNTER_DISCARD'] });
    state.encounterDeck = [];
    state.encounterDiscard = [];
    expect(allowed(state, search)).toBe(false);

    state.encounterDeck = [instanceOf('01005')];
    expect(allowed(state, search)).toBe(true);
  });
});
