import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { getActiveMainScheme } from '@engine/models';
import type { GameState, PlayerState, SideSchemeCard } from '@engine/models';
import { createCardInstance } from '@engine/state/game-setup';
import { chooseBotAction, chooseDefenderOption } from '@engine/simulation/player-bot';
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
