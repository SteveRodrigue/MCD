import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { getActiveMainScheme } from '@engine/models';
import type { GameState, PlayerState, SideSchemeCard } from '@engine/models';
import { createCardInstance } from '@engine/state/game-setup';
import { chooseBotAction, chooseDefenderOption } from '@engine/simulation/player-bot';
import { attachCardToHost } from '@engine/state/state-validator';
import { abilityKey, cardKey, type ScarcityLedger } from '@engine/simulation/ability-coverage';
import { newRhinoGame } from '../support/game-fixtures';

const BREAKIN_SIDE_SCHEME = '01107';
const SHOCKER = '01103';
const HYDRA_MERCENARY = '01101'; // Guard
const AUNT_MAY = '01006'; // support, cost 1
const NICK_FURY = '01084'; // ally, cost 4, 1 resource
const STRENGTH = '01090'; // resource, 2 resources
const BLACK_CAT = '01002'; // ally, cost 2
const SUPERHUMAN_STRENGTH = '01028'; // upgrade, cost 2, stuns an enemy
const AVENGERS_MANSION = '01091'; // support, action: exhaust to draw a card

const card = (code: string) => createCardInstance(cardCatalog.getCard(code)!);

describe('chooseBotAction (strategic player bot, #309)', () => {
  let state: GameState;
  let player: PlayerState;

  const setThreat = (threat: number) => {
    getActiveMainScheme(state).threat = threat;
  };

  beforeEach(() => {
    state = newRhinoGame({ players: [{ hero: '01001a', form: 'hero' }] });
    player = state.players[0];
    player.hand = [];
    state.sideSchemes = [];
    setThreat(0);
  });

  it('thwarts the main scheme before a side scheme when the main scheme is about to complete', () => {
    state.sideSchemes = [
      {
        instanceId: 'side_a',
        card: cardCatalog.getCard(BREAKIN_SIDE_SCHEME) as SideSchemeCard,
        threat: 3,
      },
    ];
    setThreat(getActiveMainScheme(state).targetThreat - 1);

    expect(chooseBotAction({ state, playerId: 'p1' })).toEqual({
      type: 'BASIC_THWART',
      playerId: 'p1',
      targetType: 'main_scheme',
    });
  });

  it('flips from Alter-Ego to hero instead of recovering when the main scheme is about to complete', () => {
    state = newRhinoGame({ players: [{ hero: '01001a' }] });
    player = state.players[0];
    player.hand = [];
    state.sideSchemes = [];
    player.health = Math.floor(player.maxHealth / 2) + 1;
    setThreat(getActiveMainScheme(state).targetThreat - 1);

    const action = chooseBotAction({ state, playerId: 'p1' });
    expect(action.type).toBe('CHANGE_FORM');
  });

  it('pays with the least valuable cards and keeps an ally in hand', () => {
    const nickFury = card(NICK_FURY);
    const auntMay = card(AUNT_MAY);
    const strength = card(STRENGTH);
    player.hand = [nickFury, auntMay, strength];

    expect(chooseBotAction({ state, playerId: 'p1' })).toMatchObject({
      type: 'PLAY_CARD',
      cardInstanceId: auntMay.instanceId,
      paymentCardInstanceIds: [strength.instanceId],
    });
  });

  it('attacks an engaged Guard minion before another engaged minion', () => {
    const shocker = card(SHOCKER);
    const mercenary = card(HYDRA_MERCENARY);
    player.engagedMinions = [shocker, mercenary];

    expect(chooseBotAction({ state, playerId: 'p1' })).toEqual({
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'minion',
      targetInstanceId: mercenary.instanceId,
    });
  });

  it('thwarts before attacking in the opening rounds, then follows the threat pressure', () => {
    setThreat(1);
    expect(chooseBotAction({ state, playerId: 'p1' })).toMatchObject({
      type: 'BASIC_THWART',
      targetType: 'main_scheme',
    });

    state.roundNumber = 5;
    expect(chooseBotAction({ state, playerId: 'p1' })).toMatchObject({
      type: 'BASIC_ATTACK',
      targetType: 'villain',
    });
  });

  it('thwarts a side scheme before the main scheme unless the main scheme is urgent', () => {
    state.sideSchemes = [
      {
        instanceId: 'side_a',
        card: cardCatalog.getCard(BREAKIN_SIDE_SCHEME) as SideSchemeCard,
        threat: 3,
      },
    ];
    setThreat(2);

    expect(chooseBotAction({ state, playerId: 'p1' })).toMatchObject({
      type: 'BASIC_THWART',
      targetType: 'side_scheme',
      targetInstanceId: 'side_a',
    });
  });

  it('plays a card that stuns an enemy before a stronger plain card', () => {
    const stun = card(SUPERHUMAN_STRENGTH);
    player.hand = [card(BLACK_CAT), stun, card(STRENGTH), card(STRENGTH)];

    expect(chooseBotAction({ state, playerId: 'p1' })).toMatchObject({
      type: 'PLAY_CARD',
      cardInstanceId: stun.instanceId,
    });
  });

  it('fills an empty tableau before playing an ally', () => {
    const auntMay = card(AUNT_MAY);
    player.hand = [card(BLACK_CAT), auntMay, card(STRENGTH), card(STRENGTH)];

    expect(chooseBotAction({ state, playerId: 'p1' })).toMatchObject({
      type: 'PLAY_CARD',
      cardInstanceId: auntMay.instanceId,
    });
  });

  it('uses a draw ability before playing a card', () => {
    const mansion = card(AVENGERS_MANSION);
    player.tableau = [mansion];
    player.hand = [card(AUNT_MAY), card(STRENGTH)];

    expect(chooseBotAction({ state, playerId: 'p1' })).toMatchObject({
      type: 'USE_CARD_ABILITY',
      cardInstanceId: mansion.instanceId,
    });
  });

  it('pays with the identity resource ability before any hand card', () => {
    state = newRhinoGame({ players: [{ hero: '01001a' }] });
    player = state.players[0];
    state.sideSchemes = [];
    player.health = Math.floor(player.maxHealth / 2);
    const auntMay = card(AUNT_MAY);
    player.hand = [auntMay, card(STRENGTH)];

    expect(chooseBotAction({ state, playerId: 'p1' })).toMatchObject({
      type: 'PLAY_CARD',
      cardInstanceId: auntMay.instanceId,
      paymentCardInstanceIds: [],
      generatorInstanceIds: ['identity_ability'],
    });
  });

  it('ends the turn once nothing is left to do', () => {
    player.exhausted = true;

    expect(chooseBotAction({ state, playerId: 'p1' })).toEqual({
      type: 'END_PLAYER_TURN',
      playerId: 'p1',
    });
  });
});

describe('chooseDefenderOption (defender policy, #309)', () => {
  const prompt = (ids: string[]) => ({
    playerId: 'p1',
    options: ids.map((id) => ({ id })),
  });
  const withAttack = (health: number, baseAttack: number) => {
    const state = newRhinoGame({ players: [{ hero: '01001a', form: 'hero' }] });
    state.players[0].health = health;
    state.activeAttackContext = { baseAttack } as GameState['activeAttackContext'];
    return state;
  };

  it('takes a safe hit undefended so the hero keeps its next turn', () => {
    const state = withAttack(10, 3);
    expect(chooseDefenderOption(state, prompt(['defend_hero', 'undefended']) as never)).toBe(
      'undefended',
    );
  });

  it('defends with the hero when the hit could be lethal', () => {
    const state = withAttack(4, 3);
    expect(chooseDefenderOption(state, prompt(['defend_hero', 'undefended']) as never)).toBe(
      'defend_hero',
    );
  });

  it('blocks with an ally when the hero cannot defend and the hit could be lethal', () => {
    const state = withAttack(3, 3);
    expect(chooseDefenderOption(state, prompt(['defend_ally_x', 'undefended']) as never)).toBe(
      'defend_ally_x',
    );
  });

  it('leaves other prompts to the default', () => {
    const state = withAttack(10, 3);
    expect(chooseDefenderOption(state, prompt(['yes', 'no']) as never)).toBeUndefined();
  });
});

describe('chooseBotAction in multiplayer (one hero in Alter-Ego at a time, #309)', () => {
  let state: GameState;

  const setup = (p1Form: 'hero' | 'alter-ego', hp1: number, hp2: number) => {
    state = newRhinoGame({ players: [{ form: p1Form }, { form: 'hero' }] });
    state.sideSchemes = [];
    for (const [i, hp] of [hp1, hp2].entries()) {
      state.players[i].hand = [];
      state.players[i].health = hp;
    }
  };

  const botAction = (playerId: string) => {
    state.activePlayerIndex = state.players.findIndex((p) => p.id === playerId);
    return chooseBotAction({ state, playerId });
  };

  it('does not flip to Alter-Ego while another hero is in Alter-Ego', () => {
    setup('alter-ego', 4, 3);
    expect(botAction('p2').type).not.toBe('CHANGE_FORM');
  });

  it('flips to Alter-Ego when it is the only one and needs to heal', () => {
    setup('hero', 9, 3);
    expect(botAction('p2').type).toBe('CHANGE_FORM');
  });

  it('lets the lowest-health hero heal first', () => {
    setup('hero', 4, 2);
    expect(botAction('p1').type).not.toBe('CHANGE_FORM');
    expect(botAction('p2').type).toBe('CHANGE_FORM');
  });
});

describe('chooseBotAction that tests untested abilities (scarcity ledger, #431)', () => {
  const ALPHA_FLIGHT_STATION = '01015'; // support, action: exhaust and discard a card
  const SUPERHUMAN_LAW_DIVISION = '01026'; // support, alter-ego action
  const IVORY_HORN = '01100'; // encounter attachment, hero action: pay 3 physical
  const FIRST_AID = '01086'; // event that heals
  /** Everything counts as used many times, except what a test leaves out. */
  const worn = (...keys: string[]): ScarcityLedger => Object.fromEntries(keys.map((k) => [k, 9]));
  let state: GameState;
  let player: PlayerState;

  beforeEach(() => {
    state = newRhinoGame({ players: [{ hero: '01001a', form: 'hero' }] });
    player = state.players[0];
    player.hand = [];
    state.sideSchemes = [];
    getActiveMainScheme(state).threat = 0;
  });

  it('spends a card with untested abilities last when it pays', () => {
    const auntMay = card(AUNT_MAY);
    const nickFury = card(NICK_FURY);
    const strength = card(STRENGTH);
    player.hand = [auntMay, nickFury, strength];
    const ledger = worn(cardKey(STRENGTH), cardKey(AUNT_MAY), abilityKey(AUNT_MAY, 'aunt_may'));

    const action = chooseBotAction({ state, playerId: 'p1', scarcity: ledger });
    expect(action).toMatchObject({ type: 'PLAY_CARD', cardInstanceId: auntMay.instanceId });
    expect((action as { paymentCardInstanceIds: string[] }).paymentCardInstanceIds).toEqual([
      strength.instanceId,
    ]);
  });

  it('pays the discard cost of an untested ability, which the plain bot never does', () => {
    const station = card(ALPHA_FLIGHT_STATION);
    const filler = card(STRENGTH);
    player.tableau = [station];
    player.hand = [filler];

    expect(chooseBotAction({ state, playerId: 'p1', scarcity: {} })).toMatchObject({
      type: 'USE_CARD_ABILITY',
      cardInstanceId: station.instanceId,
      discardCardInstanceIds: [filler.instanceId],
    });
    expect(chooseBotAction({ state, playerId: 'p1' }).type).not.toBe('USE_CARD_ABILITY');
  });

  it('does not pay for an ability that was already tested', () => {
    player.tableau = [card(ALPHA_FLIGHT_STATION)];
    player.hand = [card(STRENGTH)];
    const ledger = worn(abilityKey(ALPHA_FLIGHT_STATION, 'alpha_flight_station'));

    expect(chooseBotAction({ state, playerId: 'p1', scarcity: ledger }).type).not.toBe(
      'USE_CARD_ABILITY',
    );
  });

  it('pays for an action on an encounter attachment through the legal-actions generator', () => {
    const horn = createCardInstance(cardCatalog.getCard(IVORY_HORN)!);
    attachCardToHost(state, horn, 'VILLAIN');
    const payers = [card(STRENGTH), card(STRENGTH)];
    player.hand = payers;

    const action = chooseBotAction({ state, playerId: 'p1', scarcity: {} });
    expect(action).toMatchObject({
      type: 'USE_CARD_ABILITY',
      cardInstanceId: horn.instanceId,
      abilityId: 'ivory_horn_discard_action',
    });
  });

  it('flips to Alter-Ego for an untested Alter-Ego action when the scheme is safe', () => {
    player.tableau = [card(SUPERHUMAN_LAW_DIVISION)];
    const ledger = worn(abilityKey('01001a', 'spider_sense'), abilityKey('01001b', 'scientist'));

    expect(chooseBotAction({ state, playerId: 'p1', scarcity: ledger }).type).toBe('CHANGE_FORM');
  });

  it('keeps its form when the untested abilities need the form it is in', () => {
    player.tableau = [card(SUPERHUMAN_LAW_DIVISION)];
    const ledger = worn(
      abilityKey('01001a', 'spider_sense'),
      abilityKey('01001b', 'scientist'),
      abilityKey(SUPERHUMAN_LAW_DIVISION, 'superhuman_law_division'),
    );

    expect(chooseBotAction({ state, playerId: 'p1', scarcity: ledger }).type).not.toBe(
      'CHANGE_FORM',
    );
  });

  it('plays the setup piece another card in hand needs in play', () => {
    // Wakanda Forever! needs a Black Panther upgrade in play: the upgrade comes first
    const wakanda = card('01043a');
    const claws = card('01047');
    player.hand = [wakanda, claws, card(STRENGTH), card(STRENGTH)];
    const ledger = worn(cardKey('01043a'));

    const action = chooseBotAction({ state, playerId: 'p1', scarcity: ledger });
    expect(action).toMatchObject({ type: 'PLAY_CARD', cardInstanceId: claws.instanceId });
  });

  describe('taking a hit on purpose to enable a heal ability', () => {
    const prompt = { playerId: 'p1', options: [{ id: 'defend_hero' }, { id: 'undefended' }] };
    const dangerous = () => {
      state.activeAttackContext = { baseAttack: 6 } as GameState['activeAttackContext'];
      player.health = player.maxHealth;
    };

    it('takes a survivable hit while holding an untested heal card at full health', () => {
      dangerous();
      player.hand = [card(FIRST_AID)];
      expect(chooseDefenderOption(state, prompt as never, {})).toBe('undefended');
    });

    it('defends as usual without the ledger', () => {
      dangerous();
      player.hand = [card(FIRST_AID)];
      expect(chooseDefenderOption(state, prompt as never)).toBe('defend_hero');
    });

    it('defends when the heal ability was already tested', () => {
      dangerous();
      player.hand = [card(FIRST_AID)];
      const ledger = worn(abilityKey(FIRST_AID, 'first_aid'));
      expect(chooseDefenderOption(state, prompt as never, ledger)).toBe('defend_hero');
    });
  });
});
