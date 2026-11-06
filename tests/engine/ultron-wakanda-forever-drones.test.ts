import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  AlterEgoCard,
  CardInstance,
  GameState,
  HeroCard,
  StatusCard,
  getActiveMainScheme,
  getActiveVillain,
} from '@engine/models';
import { createCardInstance, setupGame } from '@engine/state/game-setup';
import { executeEffect } from '@engine/effects';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { evaluatePlayRequirements } from '@engine/pipeline/legality-checker';

// Plan #352, scenario S8: Wakanda Forever! vs Drones, in a real Ultron game.

const WAKANDA_FOREVER = '01043a';
const ENERGY_DAGGERS = '01046';
const PANTHER_CLAWS = '01047';
const TACTICAL_GENIUS = '01048';
const VIBRANIUM_SUIT = '01049';
const CHASE_THEM_DOWN = '01052';
const ADVANCED_ULTRON_DRONE = '01143';
const WHIPLASH = '01172';
const WEB_SHOOTER = '01008';
const SWINGING_WEB_KICK = '01005';
const FILLER = '01044'; // Vibranium, a basic resource

function ultronGame(): GameState {
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId: 'ultron',
    difficulty: 'STANDARD',
    seed: 'ultron-wakanda',
    skipMulligan: true,
    players: [
      {
        id: 'p1',
        name: 'Black Panther',
        hero: cardCatalog.getCard('01040a') as HeroCard,
        alterEgo: cardCatalog.getCard('01040b') as AlterEgoCard,
        deckCards: Array(15).fill(cardCatalog.getCard(FILLER)!),
      },
      {
        id: 'p2',
        name: 'Spider-Man',
        hero: cardCatalog.getCard('01001a') as HeroCard,
        alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
        deckCards: Array(15).fill(cardCatalog.getCard(FILLER)!),
      },
    ],
  });
  const panther = state.players[0];
  panther.currentForm = 'hero';
  panther.activeFormCard = cardCatalog.getCard('01040a')!;
  // Only the Drones each scenario names
  panther.engagedMinions = [];
  state.players[1].engagedMinions = [];
  return state;
}

const instance = (code: string): CardInstance => createCardInstance(cardCatalog.getCard(code)!);

/** Puts these cards on top of the player's deck and turns them into Drones, in order. */
function dronesFrom(state: GameState, playerId: string, codes: string[]): CardInstance[] {
  const player = state.players.find((p) => p.id === playerId)!;
  player.deck.unshift(...codes.map(instance));
  executeEffect(
    state,
    {
      id: 'test_drones',
      timing: 'WHEN_REVEALED',
      steps: [
        {
          effect: 'EXECUTE_SPECIAL',
          effectParams: { specialId: 'ULTRON_DRONE', target: 'SELF', count: codes.length },
        },
      ],
    } as never,
    { playerId },
  );
  return player.engagedMinions.slice(-codes.length);
}

function playWakandaForever(state: GameState) {
  const wakanda = instance(WAKANDA_FOREVER);
  return executeEffect(state, wakanda.card.enrichment!.abilities![0], {
    playerId: 'p1',
    sourceCardInstance: wakanda,
  });
}

function answer(state: GameState, fields: Record<string, unknown>): GameState {
  const { state: next, result } = dispatchAction(state, {
    type: 'RESOLVE_DECISION_PROMPT',
    playerId: 'p1',
    ...fields,
  } as never);
  expect(result.success).toBe(true);
  return next;
}

function chooseDaggersPlayer(state: GameState, targetPlayerId: string): GameState {
  const option = peekDecisionPrompt(state)!.options.find(
    (o) => (o.params as { targetPlayerId?: string } | undefined)?.targetPlayerId === targetPlayerId,
  )!;
  return answer(state, { selectedOptionId: option.id });
}

const codesIn = (pile: CardInstance[]) => pile.map((c) => c.card.code);

describe('S8: Wakanda Forever! vs Drones', () => {
  it("S8: Panther Claws then Energy Daggers defeat both Drones and their real cards go to the owner's discard", () => {
    const state = ultronGame();
    const panther = state.players[0];
    const claws = instance(PANTHER_CLAWS);
    const daggers = instance(ENERGY_DAGGERS);
    panther.tableau = [claws, daggers];
    const [drone1, drone2] = dronesFrom(state, 'p2', [WEB_SHOOTER, SWINGING_WEB_KICK]);
    expect(drone1.cardsUnderneath![0].card.code).toBe(WEB_SHOOTER);
    const hp = getActiveVillain(state).health;
    const encounterDiscardBefore = state.encounterDiscard.length;
    const pantherDiscardBefore = panther.discard.length;

    // The player picks the order: Claws first, Daggers last (the final step, so double damage)
    const played = playWakandaForever(state);
    const ordered = answer(played.state, { sequenceOrder: [claws.instanceId, daggers.instanceId] });

    // Claws: 2 damage to Drone 1
    expect(peekDecisionPrompt(ordered)!.options.some((o) => o.id === drone1.instanceId)).toBe(true);
    const afterClaws = answer(ordered, { selectedOptionId: drone1.instanceId });
    const spideyAfterClaws = afterClaws.players[1];
    expect(spideyAfterClaws.engagedMinions.map((m) => m.instanceId)).toEqual([drone2.instanceId]);
    expect(codesIn(spideyAfterClaws.discard)).toEqual([WEB_SHOOTER]);

    // Daggers (final): 2 damage to Ultron and to each enemy engaged with Spider-Man
    const after = chooseDaggersPlayer(afterClaws, 'p2');
    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect(getActiveVillain(after).health).toBe(hp - 2);
    const [pantherAfter, spideyAfter] = after.players;
    expect(spideyAfter.engagedMinions).toHaveLength(0);
    expect(codesIn(spideyAfter.discard)).toEqual([WEB_SHOOTER, SWINGING_WEB_KICK]);
    expect(pantherAfter.discard).toHaveLength(pantherDiscardBefore);
    expect(after.encounterDiscard).toHaveLength(encounterDiscardBefore);
  });

  it('S8-a: a Black Panther upgrade turned into a Drone is not resolved by Wakanda Forever and returns to discard when killed', () => {
    const state = ultronGame();
    const panther = state.players[0];
    const daggers = instance(ENERGY_DAGGERS);
    panther.tableau = [daggers];
    const [clawsDrone] = dronesFrom(state, 'p1', [PANTHER_CLAWS]);
    const hp = getActiveVillain(state).health;

    // One upgrade: no order prompt, it is the final step. Only Daggers asks a question (its player).
    const played = playWakandaForever(state);
    expect(peekDecisionPrompt(played.state)!.title).not.toContain('Sequence Order');
    const after = chooseDaggersPlayer(played.state, 'p1');

    expect(getActiveVillain(after).health).toBe(hp - 2);
    const pantherAfter = after.players[0];
    expect(pantherAfter.engagedMinions.some((m) => m.instanceId === clawsDrone.instanceId)).toBe(
      false,
    );
    // Panther Claws is back in the discard pile, not the tableau
    expect(codesIn(pantherAfter.discard)).toContain(PANTHER_CLAWS);
    expect(codesIn(pantherAfter.tableau)).not.toContain(PANTHER_CLAWS);
    expect(codesIn(pantherAfter.tableau)).toContain(ENERGY_DAGGERS);
  });

  it('S8-b: Energy Daggers deals 0 to Ultron III while a Drone is in play; Claws first then Daggers hits him for 2', () => {
    const ultronIII = () => cardCatalog.getCard('01136') as never;

    // Energy Daggers alone: one effect, so the Drone is still in play when Ultron is dealt damage
    const alone = ultronGame();
    getActiveVillain(alone).card = ultronIII();
    alone.players[0].tableau = [instance(ENERGY_DAGGERS)];
    dronesFrom(alone, 'p2', [WEB_SHOOTER]);
    const hpAlone = getActiveVillain(alone).health;

    const dealt = chooseDaggersPlayer(playWakandaForever(alone).state, 'p2');

    expect(getActiveVillain(dealt).health).toBe(hpAlone);
    expect(dealt.players[1].engagedMinions).toHaveLength(0);
    expect(codesIn(dealt.players[1].discard)).toEqual([WEB_SHOOTER]);

    // Panther Claws first: it cannot target Ultron, kills the last Drone, then Daggers hits him
    const both = ultronGame();
    getActiveVillain(both).card = ultronIII();
    const claws = instance(PANTHER_CLAWS);
    const daggers = instance(ENERGY_DAGGERS);
    both.players[0].tableau = [claws, daggers];
    const [drone] = dronesFrom(both, 'p2', [WEB_SHOOTER]);
    const hpBoth = getActiveVillain(both).health;

    const ordered = answer(playWakandaForever(both).state, {
      sequenceOrder: [claws.instanceId, daggers.instanceId],
    });
    const prompt = peekDecisionPrompt(ordered);
    // The only valid target is resolved without a choice, or offered alone: never Ultron
    expect(prompt?.options.some((o) => o.id === getActiveVillain(ordered).instanceId)).toBeFalsy();
    const afterClaws = prompt?.options.some((o) => o.id === drone.instanceId)
      ? answer(ordered, { selectedOptionId: drone.instanceId })
      : ordered;
    expect(afterClaws.players[1].engagedMinions).toHaveLength(0);

    const after = chooseDaggersPlayer(afterClaws, 'p2');
    expect(getActiveVillain(after).health).toBe(hpBoth - 2);
  });

  it('S8-a: Wakanda Forever is unplayable when the only Black Panther upgrade is a facedown Drone', () => {
    const state = ultronGame();
    const panther = state.players[0];
    panther.tableau = [];
    dronesFrom(state, 'p1', [PANTHER_CLAWS]);

    const wakanda = cardCatalog.getCard(WAKANDA_FOREVER)!;

    expect(evaluatePlayRequirements(state, panther, wakanda).allowed).toBe(false);

    // Control: the same card in the tableau makes it playable
    panther.tableau = [instance(PANTHER_CLAWS)];
    expect(evaluatePlayRequirements(state, panther, wakanda).allowed).toBe(true);
  });
});

// Plan #640: Vibranium Suit chooses its enemy, and the Specials keep their printed labels.
describe('#640: Vibranium Suit and the labels of the Specials', () => {
  function damagedPanther(state: GameState, damage = 3) {
    const panther = state.players[0];
    panther.health -= damage;
    return panther;
  }
  const optionIds = (state: GameState) => peekDecisionPrompt(state)!.options.map((o) => o.id);
  const ultronId = (state: GameState) => getActiveVillain(state).instanceId!;

  it('S1: Vibranium Suit asks for an enemy and moves the damage to the chosen Drone', () => {
    const state = ultronGame();
    const panther = damagedPanther(state);
    panther.tableau = [instance(VIBRANIUM_SUIT)];
    const [drone] = dronesFrom(state, 'p1', [WEB_SHOOTER, SWINGING_WEB_KICK]);
    const [otherDrone] = dronesFrom(state, 'p2', [WEB_SHOOTER]);
    const health = panther.health;
    const ultronHp = getActiveVillain(state).health;

    const played = playWakandaForever(state).state;

    const prompt = peekDecisionPrompt(played)!;
    expect(prompt.title).toBe('Vibranium Suit: Choose an Enemy');
    expect(prompt.options.map((o) => o.id)).toEqual(
      expect.arrayContaining([ultronId(played), drone.instanceId, otherDrone.instanceId]),
    );
    expect(prompt.options).toHaveLength(4);

    const after = answer(played, { selectedOptionId: drone.instanceId });

    // The only upgrade is the final step: 2 damage moves, and the Drone is defeated
    expect(after.players[0].health).toBe(health + 2);
    expect(getActiveVillain(after).health).toBe(ultronHp);
    expect(after.players[0].engagedMinions.map((m) => m.instanceId)).not.toContain(
      drone.instanceId,
    );
    expect(codesIn(after.players[0].discard)).toContain(WEB_SHOOTER);
  });

  it('S1-a: Drones in the prompt name the hero they are engaged with', () => {
    const state = ultronGame();
    damagedPanther(state).tableau = [instance(VIBRANIUM_SUIT)];
    dronesFrom(state, 'p1', [WEB_SHOOTER]);
    dronesFrom(state, 'p2', [WEB_SHOOTER]);

    const prompt = peekDecisionPrompt(playWakandaForever(state).state)!;

    expect(prompt.options.map((o) => o.label)).toEqual(
      expect.arrayContaining([
        'Drone (engaged with Black Panther)',
        'Drone (engaged with Spider-Man)',
      ]),
    );
  });

  it('S1-b: the log names the villain the damage moved to', () => {
    const state = ultronGame();
    damagedPanther(state).tableau = [instance(VIBRANIUM_SUIT)];
    dronesFrom(state, 'p1', [WEB_SHOOTER]);

    const played = playWakandaForever(state).state;
    const after = answer(played, { selectedOptionId: ultronId(played) });

    const moved = after.log.find((l) => l.key === 'damage.transferred')!;
    expect(moved.params).toMatchObject({ target: getActiveVillain(after).card.name, amount: 2 });
  });

  it('S2: Suit first pauses the sequence, Claws keeps its finisher', () => {
    const state = ultronGame();
    const panther = damagedPanther(state);
    const suit = instance(VIBRANIUM_SUIT);
    const claws = instance(PANTHER_CLAWS);
    panther.tableau = [suit, claws];
    const [drone] = dronesFrom(state, 'p1', [WEB_SHOOTER, SWINGING_WEB_KICK]);
    const health = panther.health;
    const ultronHp = getActiveVillain(state).health;

    const ordered = answer(playWakandaForever(state).state, {
      sequenceOrder: [suit.instanceId, claws.instanceId],
    });

    // Nothing has resolved while the Suit waits for its target
    expect(peekDecisionPrompt(ordered)!.sourceCardName).toBe('Vibranium Suit');
    expect(getActiveVillain(ordered).health).toBe(ultronHp);

    const afterSuit = answer(ordered, { selectedOptionId: drone.instanceId });
    expect(afterSuit.players[0].health).toBe(health + 1);
    expect(peekDecisionPrompt(afterSuit)!.sourceCardName).toBe('Panther Claws');

    const after = answer(afterSuit, { selectedOptionId: ultronId(afterSuit) });
    expect(getActiveVillain(after).health).toBe(ultronHp - 4);
    expect(peekDecisionPrompt(after)).toBeUndefined();
  });

  it('S2-a: Suit last moves 2 after the choice', () => {
    const state = ultronGame();
    const panther = damagedPanther(state);
    const suit = instance(VIBRANIUM_SUIT);
    const claws = instance(PANTHER_CLAWS);
    panther.tableau = [claws, suit];
    dronesFrom(state, 'p1', [WEB_SHOOTER]);
    const health = panther.health;
    const ultronHp = getActiveVillain(state).health;

    const ordered = answer(playWakandaForever(state).state, {
      sequenceOrder: [claws.instanceId, suit.instanceId],
    });
    const afterClaws = answer(ordered, { selectedOptionId: ultronId(ordered) });
    const after = answer(afterClaws, { selectedOptionId: ultronId(afterClaws) });

    expect(after.players[0].health).toBe(health + 2);
    expect(getActiveVillain(after).health).toBe(ultronHp - 2 - 2);
  });

  it('S3: with a Guard minion engaged, Suit and Claws do not offer Ultron', () => {
    for (const code of [VIBRANIUM_SUIT, PANTHER_CLAWS]) {
      const state = ultronGame();
      const panther = damagedPanther(state);
      panther.tableau = [instance(code)];
      const guard = instance(ADVANCED_ULTRON_DRONE);
      panther.engagedMinions.push(guard);
      const [drone] = dronesFrom(state, 'p1', [WEB_SHOOTER]);

      const played = playWakandaForever(state).state;

      expect(optionIds(played)).toEqual(
        expect.arrayContaining([guard.instanceId, drone.instanceId]),
      );
      expect(optionIds(played)).not.toContain(ultronId(played));
    }
  });

  it('S3-b: the Guard minion as the only valid target is used without asking', () => {
    const state = ultronGame();
    const panther = damagedPanther(state);
    panther.tableau = [instance(VIBRANIUM_SUIT)];
    const guard = instance(ADVANCED_ULTRON_DRONE);
    panther.engagedMinions.push(guard);
    const ultronHp = getActiveVillain(state).health;

    const played = playWakandaForever(state).state;

    expect(peekDecisionPrompt(played)).toBeUndefined();
    expect(guard.tokens?.damage).toBe(2);
    expect(getActiveVillain(played).health).toBe(ultronHp);
  });

  it('S3-a: a Guard minion on another player does not block Ultron', () => {
    const state = ultronGame();
    damagedPanther(state).tableau = [instance(VIBRANIUM_SUIT)];
    state.players[1].engagedMinions.push(instance(ADVANCED_ULTRON_DRONE));

    const played = playWakandaForever(state).state;

    expect(optionIds(played)).toContain(ultronId(played));
  });

  it('S4: at full health Suit opens no prompt and the sequence continues', () => {
    const state = ultronGame();
    const panther = state.players[0];
    const suit = instance(VIBRANIUM_SUIT);
    const claws = instance(PANTHER_CLAWS);
    panther.tableau = [suit, claws];
    const [drone] = dronesFrom(state, 'p1', [WEB_SHOOTER, SWINGING_WEB_KICK]);
    const health = panther.health;

    const ordered = answer(playWakandaForever(state).state, {
      sequenceOrder: [suit.instanceId, claws.instanceId],
    });

    expect(peekDecisionPrompt(ordered)!.sourceCardName).toBe('Panther Claws');
    expect(ordered.players[0].health).toBe(health);
    expect(ordered.log.some((l) => l.key === 'damage.transferred')).toBe(false);
    expect(drone.tokens?.damage ?? 0).toBe(0);
  });

  it('S5: Stun cancels only the first attack Special and is removed', () => {
    const state = ultronGame();
    const panther = damagedPanther(state);
    panther.statusCards = [StatusCard.STUNNED];
    const claws = instance(PANTHER_CLAWS);
    const suit = instance(VIBRANIUM_SUIT);
    panther.tableau = [claws, suit];
    const health = panther.health;
    const ultronHp = getActiveVillain(state).health;

    const after = answer(playWakandaForever(state).state, {
      sequenceOrder: [claws.instanceId, suit.instanceId],
    });

    expect(after.players[0].statusCards).not.toContain(StatusCard.STUNNED);
    // Claws did nothing; the Suit, final step, moved 2 to the only enemy
    expect(after.players[0].health).toBe(health + 2);
    expect(getActiveVillain(after).health).toBe(ultronHp - 2);
  });

  it('S5-a: Confused cancels Tactical Genius; Energy Daggers is not cancelled by Stun', () => {
    const thwart = ultronGame();
    const confused = thwart.players[0];
    confused.statusCards = [StatusCard.CONFUSED];
    confused.tableau = [instance(TACTICAL_GENIUS)];
    getActiveMainScheme(thwart).threat = 4;

    const afterThwart = playWakandaForever(thwart).state;

    expect(getActiveMainScheme(afterThwart).threat).toBe(4);
    expect(afterThwart.players[0].statusCards).not.toContain(StatusCard.CONFUSED);

    const daggers = ultronGame();
    const stunned = daggers.players[0];
    stunned.statusCards = [StatusCard.STUNNED];
    stunned.tableau = [instance(ENERGY_DAGGERS)];
    const hp = getActiveVillain(daggers).health;

    const afterDaggers = chooseDaggersPlayer(playWakandaForever(daggers).state, 'p1');

    expect(getActiveVillain(afterDaggers).health).toBe(hp - 2);
    expect(afterDaggers.players[0].statusCards).toContain(StatusCard.STUNNED);
  });

  it('S6: Suit on Whiplash provokes Retaliate inside Wakanda Forever!', () => {
    const state = ultronGame();
    const panther = damagedPanther(state);
    panther.tableau = [instance(VIBRANIUM_SUIT)];
    const whiplash = instance(WHIPLASH);
    panther.engagedMinions.push(whiplash);
    const health = panther.health;

    const played = playWakandaForever(state).state;
    const after = answer(played, { selectedOptionId: whiplash.instanceId });

    expect(after.log.some((l) => l.key === 'retaliate.hit')).toBe(true);
    expect(after.players[0].health).toBe(health + 2 - 1);
  });

  it('S6-a: Claws defeating an enemy offers Chase Them Down', () => {
    const state = ultronGame();
    const panther = state.players[0];
    panther.tableau = [instance(PANTHER_CLAWS)];
    panther.hand = [createCardInstance(cardCatalog.getCard(CHASE_THEM_DOWN)!, 'p1')];
    getActiveMainScheme(state).threat = 4;
    const [drone] = dronesFrom(state, 'p1', [WEB_SHOOTER]);

    const played = playWakandaForever(state).state;
    const after = answer(played, { selectedOptionId: drone.instanceId });

    expect(peekDecisionPrompt(after)?.sourceCardCode).toBe(CHASE_THEM_DOWN);
  });
});
