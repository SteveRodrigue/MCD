import { describe, expect, it } from 'vitest';
import { GamePhase, StatusCard, getActiveVillain, type GameState } from '@engine/models';
import { createCardInstance } from '@engine/state/game-setup';
import { dispatchAction, initiateEnemyAttack, peekDecisionPrompt } from '@engine/pipeline';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { recordDispatchedTriggers } from '../helpers/kernel-spy';
import { overrideCard } from '../support/card-overrides';
import { newRhinoGame, type PlayerSpec } from '../support/game-fixtures';

/**
 * #389: the damage beyond a defeated ally (Overkill) is damage of the same attack dealt to the
 * identity of the ally's controller (RR v1.8 glossary O), so it has its own "would take" window,
 * after Tough (RR v1.8 Damage, steps 2 and 3). The hero's own damage opens the same window after
 * Tough, not before it.
 */

const CHARGE = '01099'; // +3 ATK, Overkill: Rhino attacks for 2 + 3 = 5
const BLACK_CAT = '01002'; // ally, 2 hit points: 5 damage leave an excess of 3
const BACKFLIP = '01003'; // hand: prevent all damage from an attack
const COSMIC_FLIGHT = '01017'; // Captain Marvel upgrade in play: prevent 3 of that damage

const SPIDER_MAN: PlayerSpec = { hero: '01001a', alterEgo: '01001b', form: 'hero' };
const CAPTAIN_MARVEL: PlayerSpec = { hero: '01010a', alterEgo: '01010b', form: 'hero' };

const dispatched = recordDispatchedTriggers();

function inPlay(code: string) {
  return createCardInstance(cardCatalog.getCard(code)!);
}

function logKeys(state: GameState): string[] {
  return state.log.map((l) => l.key);
}

function count(trigger: string, targetType?: string): number {
  return dispatched.filter(
    (d) => d.trigger === trigger && (!targetType || d.context.targetType === targetType),
  ).length;
}

/** Rhino with Charge, an empty encounter deck, and Black Cat in play for the last seat. */
function overkillGame(seats: PlayerSpec[] = [SPIDER_MAN], withOverkill = true): GameState {
  const state = newRhinoGame({ players: seats });
  state.phase = GamePhase.PLAYER_PHASE;
  state.players[state.players.length - 1].allies.push(inPlay(BLACK_CAT));
  if (withOverkill) getActiveVillain(state).attachments.push(inPlay(CHARGE));
  state.encounterDeck = [];
  return state;
}

function answer(state: GameState, playerId: string, optionId: string): GameState {
  const res = dispatchAction(state, {
    type: 'RESOLVE_DECISION_PROMPT',
    playerId,
    selectedOptionId: optionId,
  });
  expect(res.result.success, res.result.error).toBe(true);
  return res.state;
}

function answerYes(state: GameState): GameState {
  const prompt = peekDecisionPrompt(state)!;
  const yes = prompt.options.find((o) => o.effect === 'EXECUTE_OPTIONAL_TRIGGER');
  expect(yes).toBeDefined();
  return answer(state, prompt.playerId, yes!.id);
}

function answerNo(state: GameState): GameState {
  return answer(state, peekDecisionPrompt(state)!.playerId, 'pass');
}

/** Rhino attacks `playerId`; the defender prompt is answered with `defense`. */
function rhinoAttacks(
  state: GameState,
  playerId: string,
  defense: 'ally' | 'undefended',
): GameState {
  initiateEnemyAttack(state, { type: 'VILLAIN' }, playerId);
  if (
    peekDecisionPrompt(state)?.options.some(
      (o) => (o.params?.ability as { id?: string } | undefined)?.id === 'spider_sense',
    )
  ) {
    state = answerNo(state);
  }
  const player = state.players.find((p) => p.id === playerId)!;
  return answer(
    state,
    playerId,
    defense === 'ally' ? `defend_ally_${player.allies[0].instanceId}` : 'undefended',
  );
}

describe('#389: the Overkill excess opens its own damage interrupt window', () => {
  it('A: offers Backflip for the excess, with the ally shown as the defender', () => {
    const state = rhinoAttacks(overkillGame([{ ...SPIDER_MAN, hand: [BACKFLIP] }]), 'p1', 'ally');

    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();
    expect(prompt).toMatchObject({
      incomingDamage: 3,
      defenderType: 'ALLY',
      defenderName: 'Black Cat',
    });
    expect(state.pendingDamagePlacements).toHaveLength(1);
    expect(state.pendingDamagePlacements![0]).toMatchObject({ amount: 3, initialAmount: 3 });
    expect(state.players[0].allies).toHaveLength(0);
  });

  it('B: answering Yes prevents the excess and the attack resolves once', () => {
    const initial = overkillGame([{ ...SPIDER_MAN, hand: [BACKFLIP] }]);
    const hitPoints = initial.players[0].health;

    let state = rhinoAttacks(initial, 'p1', 'ally');
    expect(count('ATTACK_RESOLVED')).toBe(0);
    expect(count('DEFEATED', 'ALLY')).toBe(0);
    state = answerYes(state);

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(state.players[0].health).toBe(hitPoints);
    expect(state.players[0].discard.map((c) => c.card.code)).toContain(BACKFLIP);
    expect(logKeys(state)).not.toContain('overkill.hit');
    expect(count('ATTACK_RESOLVED')).toBe(1);
    expect(count('DEFEATED', 'ALLY')).toBe(1);
    // The outcome is the ally's: the 5 damage it took, not the excess the identity avoided.
    expect(state.lastCombatOutcome).toMatchObject({ defenderType: 'ALLY', finalDamage: 5 });
    expect(state.activeAttackContext).toBeUndefined();
    expect(state.pendingDamagePlacements ?? []).toHaveLength(0);
  });

  it('C: answering No applies the whole excess through the pipeline', () => {
    const initial = overkillGame([{ ...SPIDER_MAN, hand: [BACKFLIP] }]);
    const hitPoints = initial.players[0].health;

    let state = rhinoAttacks(initial, 'p1', 'ally');
    state = answerNo(state);

    expect(state.players[0].health).toBe(hitPoints - 3);
    expect(state.players[0].hand.map((c) => c.card.code)).toContain(BACKFLIP);
    expect(state.log.find((l) => l.key === 'overkill.hit')?.params).toMatchObject({ amount: 3 });
    expect(count('ATTACK_RESOLVED')).toBe(1);
    expect(count('DEFEATED', 'ALLY')).toBe(1);
  });

  it('D: Cosmic Flight in play prevents 3 of the excess (Yes) or nothing (No)', () => {
    const yes = overkillGame([{ ...CAPTAIN_MARVEL, tableau: [COSMIC_FLIGHT] }]);
    const hitPoints = yes.players[0].health;
    const afterYes = answerYes(rhinoAttacks(yes, 'p1', 'ally'));
    expect(afterYes.players[0].health).toBe(hitPoints);
    expect(afterYes.players[0].tableau.map((c) => c.card.code)).not.toContain(COSMIC_FLIGHT);

    const no = overkillGame([{ ...CAPTAIN_MARVEL, tableau: [COSMIC_FLIGHT] }]);
    const afterNo = answerNo(rhinoAttacks(no, 'p1', 'ally'));
    expect(afterNo.players[0].health).toBe(hitPoints - 3);
    expect(afterNo.players[0].tableau.map((c) => c.card.code)).toContain(COSMIC_FLIGHT);
  });

  it('E: a prevention smaller than the excess leaves the rest to be taken', () => {
    const initial = overkillGame([{ ...CAPTAIN_MARVEL, tableau: [COSMIC_FLIGHT] }]);
    overrideCard(initial, initial.players[0].allies[0].card, { health: 1 }); // excess 4
    const hitPoints = initial.players[0].health;

    let state = rhinoAttacks(initial, 'p1', 'ally');
    expect(state.pendingDamagePlacements![0]).toMatchObject({ amount: 4, initialAmount: 4 });
    state = answerYes(state);

    expect(state.players[0].health).toBe(hitPoints - 1);
    expect(count('ATTACK_RESOLVED')).toBe(1);
  });

  it('F: no window when the ally absorbs the whole attack (excess 0)', () => {
    const initial = overkillGame([{ ...SPIDER_MAN, hand: [BACKFLIP] }]);
    overrideCard(initial, initial.players[0].allies[0].card, { health: 5 });

    const state = rhinoAttacks(initial, 'p1', 'ally');

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(count('DAMAGE_WOULD_BE_TAKEN')).toBe(0);
    expect(count('ATTACK_RESOLVED')).toBe(1);
  });

  it('G: no window when Tough on the identity prevents the excess', () => {
    const initial = overkillGame([{ ...SPIDER_MAN, hand: [BACKFLIP] }]);
    initial.players[0].statusCards.push(StatusCard.TOUGH);
    const hitPoints = initial.players[0].health;

    const state = rhinoAttacks(initial, 'p1', 'ally');

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(state.players[0].statusCards).not.toContain(StatusCard.TOUGH);
    expect(state.players[0].health).toBe(hitPoints);
    expect(state.players[0].hand.map((c) => c.card.code)).toContain(BACKFLIP);
    expect(logKeys(state)).toContain('damage.prevented.tough');
  });

  it('H: an undefended hero with Tough is not offered a prevention for damage Tough prevents', () => {
    const tough = overkillGame([{ ...SPIDER_MAN, hand: [BACKFLIP] }], false);
    tough.players[0].allies = [];
    tough.players[0].statusCards.push(StatusCard.TOUGH);
    const hitPoints = tough.players[0].health;

    const afterTough = rhinoAttacks(tough, 'p1', 'undefended');

    expect(peekDecisionPrompt(afterTough)).toBeUndefined();
    expect(afterTough.players[0].statusCards).not.toContain(StatusCard.TOUGH);
    expect(afterTough.players[0].health).toBe(hitPoints);

    const plain = overkillGame([{ ...SPIDER_MAN, hand: [BACKFLIP] }], false);
    plain.players[0].allies = [];
    const afterPlain = rhinoAttacks(plain, 'p1', 'undefended');
    expect(peekDecisionPrompt(afterPlain)?.sourceCardName).toBe('Backflip');
  });

  it('I: a lethal excess eliminates the player after the answer; both defeats come after it', () => {
    const initial = overkillGame([SPIDER_MAN, { ...CAPTAIN_MARVEL, tableau: [COSMIC_FLIGHT] }]);
    const [a, b] = initial.players;
    b.health = 1;
    const ally = b.allies[0];

    let state = rhinoAttacks(initial, b.id, 'ally');
    expect(count('DEFEATED')).toBe(0);
    state = answerNo(state);

    expect(state.players.map((p) => p.id)).toEqual([a.id]);
    const defeats = dispatched.filter((d) => d.trigger === 'DEFEATED');
    expect(defeats.map((d) => d.context.targetType)).toEqual(['ALLY', 'HERO']);
    expect(defeats.map((d) => d.context.targetInstanceId)).toEqual([ally.instanceId, b.id]);
  });

  it('J: without Overkill the damage beyond the ally is not dealt and no window opens', () => {
    const initial = overkillGame([{ ...SPIDER_MAN, hand: [BACKFLIP] }], false);
    overrideCard(initial, initial.players[0].allies[0].card, { health: 1 });
    const hitPoints = initial.players[0].health;

    const state = rhinoAttacks(initial, 'p1', 'ally');

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(state.players[0].health).toBe(hitPoints);
    expect(count('DAMAGE_WOULD_BE_TAKEN')).toBe(0);
  });

  it('K: step 7 (Retaliate, ATTACK_RESOLVED) runs once, after the last answer', () => {
    const initial = overkillGame([{ ...SPIDER_MAN, hand: [BACKFLIP, BACKFLIP] }]);

    let state = rhinoAttacks(initial, 'p1', 'ally');
    expect(state.pendingDecisionQueue).toHaveLength(2);
    state = answerNo(state);
    expect(count('ATTACK_RESOLVED')).toBe(0);
    state = answerYes(state);

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(count('ATTACK_RESOLVED')).toBe(1);
  });
});
