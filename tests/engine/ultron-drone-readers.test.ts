import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  AlterEgoCard,
  CardInstance,
  GameState,
  HeroCard,
  createCardInstance,
  getActiveMainScheme,
  getActiveVillain,
  setupGame,
  step1_placeThreat,
  step4_revealEncounterCards,
} from '@engine/index';
import { discardCardInstance, executeEffect } from '@engine/effects';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import {
  getEffectiveMinionAttack,
  getEffectiveMinionHitPoints,
  getEffectiveMinionScheme,
} from '@engine/pipeline/stat-calculator';
import { isImmuneToDamage } from '@engine/pipeline/damage-immunity';
import { evaluateStepGate } from '@engine/pipeline/step-gate-evaluator';
import { attachCardToHost, getAllCardInstances } from '@engine/state/state-validator';
import { executeVillainAttackAgainstPlayer } from '@engine/pipeline/villain-phase';
import { resolveAttachmentHost } from '@engine/pipeline/attachment-host';

// Plan #352, scenarios S3 to S6: the cards that read Drones.

const ULTRON_I = '01134';
const ULTRON_II = '01135';
const ULTRON_III = '01136';
const UPGRADED_DRONES = '01142';
const ADVANCED_DRONE = '01143';
const REPAIR_SEQUENCE = '01146';
const SWARM_ATTACK = '01147';
const DRONE_FACTORY = '01148';
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
    seed: 'ultron-readers',
    skipMulligan: true,
    players: heroes.map((h) => ({
      id: h.id,
      name: h.name,
      hero: cardCatalog.getCard(h.hero) as HeroCard,
      alterEgo: cardCatalog.getCard(h.alterEgo) as AlterEgoCard,
      deckCards: Array(20).fill(cardCatalog.getCard(FILLER)!),
    })),
  });
  // Each test sets its own Drones and form
  for (const p of state.players) {
    p.engagedMinions = [];
    p.currentForm = 'hero';
    p.activeFormCard = p.hero;
    p.hand = [];
  }
  state.encounterDeck = Array.from({ length: 8 }, () =>
    createCardInstance(cardCatalog.getCard('01141')!),
  );
  return state;
}

const instance = (code: string): CardInstance => createCardInstance(cardCatalog.getCard(code)!);

const printed = (code: string) =>
  cardCatalog.getCard(code) as unknown as { attack: number; health: number };

function becomeUltron(state: GameState, code: string): void {
  const villain = getActiveVillain(state);
  villain.card = cardCatalog.getCard(code) as never;
  villain.statusCards = [];
}

function drones(state: GameState, playerId: string, count = 1): CardInstance[] {
  const player = state.players.find((p) => p.id === playerId)!;
  const before = player.engagedMinions.length;
  executeEffect(
    state,
    {
      id: 'test_drones',
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
  return player.engagedMinions.slice(before);
}

function upgradedDrones(state: GameState): CardInstance {
  const attachment = instance(UPGRADED_DRONES);
  attachCardToHost(state, attachment, 'ENEMY', state.environments[0].instanceId);
  return attachment;
}

function reveal(state: GameState, playerIndex: number, code: string): GameState {
  state.activePlayerIndex = playerIndex;
  state.players[playerIndex].dealtEncounterCards.push(instance(code));
  return step4_revealEncounterCards(state);
}

function choose(
  state: GameState,
  optionId: string,
  extra: Record<string, unknown> = {},
): GameState {
  const prompt = peekDecisionPrompt(state)!;
  const { state: next, result } = dispatchAction(state, {
    type: 'RESOLVE_DECISION_PROMPT',
    playerId: prompt.playerId,
    selectedOptionId: optionId,
    ...extra,
  } as never);
  expect(result.success).toBe(true);
  return next;
}

/** Answers prompts until the attack is over: no defense, every optional window passed. */
function finishAttack(state: GameState): GameState {
  let current = state;
  for (let i = 0; i < 12; i++) {
    const prompt = peekDecisionPrompt(current);
    if (!prompt) break;
    const undefended = prompt.options.find(
      (o) =>
        (o.params as { defenderType?: string } | undefined)?.defenderType === 'UNDEFENDED' ||
        /no defen|undefended|take/i.test(o.label),
    );
    const option = undefended ?? prompt.options.find((o) => !o.disabled)!;
    if (/^(place_threat|create_drone)$/.test(option.id)) break;
    current = choose(current, option.id);
  }
  return current;
}

describe('S3: Drones get stronger', () => {
  it('S3: Ultron III and Upgraded Drones stack on facedown Drones; Advanced Drone gets only Ultron III', () => {
    const state = game();
    becomeUltron(state, ULTRON_III);
    upgradedDrones(state);
    const [drone] = drones(state, 'p1');
    const advanced = instance(ADVANCED_DRONE);
    state.players[0].engagedMinions.push(advanced);

    expect(getEffectiveMinionAttack(state, drone)).toBe(3);
    expect(getEffectiveMinionHitPoints(state, drone)).toBe(3);
    expect(getEffectiveMinionScheme(state, drone)).toBe(1);
    expect(getEffectiveMinionAttack(state, advanced)).toBe(2);
    expect(getEffectiveMinionHitPoints(state, advanced)).toBe(5);
  });

  it('S3: a minion that is not a Drone gets nothing', () => {
    const state = game();
    becomeUltron(state, ULTRON_III);
    upgradedDrones(state);
    const other = instance('01096');
    const printedAttack = printed('01096').attack;
    const printedHp = printed('01096').health;

    expect(getEffectiveMinionAttack(state, other)).toBe(printedAttack);
    expect(getEffectiveMinionHitPoints(state, other)).toBe(printedHp);
  });

  it('S3: Upgraded Drones revealed attaches to the Ultron Drones environment', () => {
    const state = game();
    const card = instance(UPGRADED_DRONES);
    const resolution = resolveAttachmentHost(state, card, card.card.enrichment?.attachTo);
    expect(resolution.kind).toBe('attach');

    const after = reveal(state, 0, UPGRADED_DRONES);

    expect(after.environments[0].attachments?.map((a) => a.card.code)).toEqual([UPGRADED_DRONES]);
    expect(getAllCardInstances(after).some((c) => c.card.code === UPGRADED_DRONES)).toBe(true);
  });

  it('S3: discarding Upgraded Drones removes the bonus and defeats a Drone at its new maximum', () => {
    const state = game();
    const attachment = upgradedDrones(state);
    const [drone] = drones(state, 'p1');
    drone.tokens = { damage: 1 };
    expect(getEffectiveMinionHitPoints(state, drone)).toBe(2);

    discardCardInstance(state, attachment);

    expect(state.environments[0].attachments).toHaveLength(0);
    expect(state.encounterDiscard.some((c) => c.instanceId === attachment.instanceId)).toBe(true);
    expect(state.players[0].engagedMinions).toHaveLength(0);
    expect(state.players[0].discard.map((c) => c.card.code)).toContain(FILLER);
  });
});

describe('S4: Ultron III cannot take damage while a Drone is in play', () => {
  it('S4: Ultron III takes no damage while a Drone is in play', () => {
    const state = game();
    becomeUltron(state, ULTRON_III);
    drones(state, 'p2');
    expect(isImmuneToDamage(state, getActiveVillain(state))).toBe(true);
    const hp = getActiveVillain(state).health;

    executeEffect(
      state,
      {
        id: 'test_damage',
        timing: 'HERO_ACTION',
        steps: [{ effect: 'DEAL_DAMAGE', effectParams: { target: 'VILLAIN', amount: 3 } }],
      } as never,
      { playerId: 'p1' },
    );

    expect(getActiveVillain(state).health).toBe(hp);
  });

  it('S4: with no Drone in play Ultron III takes damage; an Advanced Drone also counts', () => {
    const state = game();
    becomeUltron(state, ULTRON_III);
    expect(isImmuneToDamage(state, getActiveVillain(state))).toBe(false);

    state.players[1].engagedMinions = [instance(ADVANCED_DRONE)];
    expect(isImmuneToDamage(state, getActiveVillain(state))).toBe(true);
  });

  it('IF_CARD_IN_PLAY with a filter counts only matching cards', () => {
    const state = game();
    const step = {
      effect: 'RESOLVED',
      gate: 'IF_CARD_IN_PLAY',
      gateParams: { filter: { traits: ['Drone'], types: ['minion'] } },
    } as never;
    const gate = () => evaluateStepGate(step, undefined, state, { playerId: 'p1' });

    expect(gate()).toBe(false);
    state.players[0].engagedMinions = [instance('01096')];
    expect(gate()).toBe(false);
    drones(state, 'p1');
    expect(gate()).toBe(true);
  });
});

describe('S5: cards that count Drones', () => {
  it('S5: Repair Sequence heals 2 per Drone, surges when nothing healed', () => {
    const healed = game();
    const villain = getActiveVillain(healed);
    villain.health = villain.maxHealth - 5;
    drones(healed, 'p1', 2);
    drones(healed, 'p2', 3); // another player's Drones do not count
    const deckBefore = healed.encounterDeck.length;

    const after = reveal(healed, 0, REPAIR_SEQUENCE);

    expect(getActiveVillain(after).health).toBe(villain.maxHealth - 1);
    expect(after.encounterDeck).toHaveLength(deckBefore);

    const nothing = game();
    const hurt = getActiveVillain(nothing);
    hurt.health = hurt.maxHealth - 5;
    const noDronesDeck = nothing.encounterDeck.length;

    const afterNothing = reveal(nothing, 0, REPAIR_SEQUENCE);

    expect(getActiveVillain(afterNothing).health).toBe(hurt.maxHealth - 5);
    // Surge: one more encounter card was dealt
    expect(afterNothing.encounterDeck.length).toBeLessThan(noDronesDeck);
  });

  it('S5: as a boost, Repair Sequence heals 1 per Drone', () => {
    const state = game();
    const villain = getActiveVillain(state);
    villain.health = villain.maxHealth - 5;
    drones(state, 'p1', 2);
    const boost = cardCatalog
      .getCard(REPAIR_SEQUENCE)!
      .enrichment!.abilities!.find((a) => a.timing === 'BOOST')!;

    executeEffect(state, boost, { playerId: 'p1', sourceCardInstance: instance(REPAIR_SEQUENCE) });

    expect(getActiveVillain(state).health).toBe(villain.maxHealth - 3);
  });

  it("S5: Swarm Attack: each Drone engaged with your hero attacks you; another player's does not", () => {
    const state = game();
    const [drone] = drones(state, 'p1');
    drones(state, 'p2');
    const minionsBefore = state.players[0].engagedMinions.length;

    const after = finishAttack(reveal(state, 0, SWARM_ATTACK));

    expect(after.players[0].engagedMinions.map((m) => m.instanceId)).toContain(drone.instanceId);
    expect(after.players[0].engagedMinions).toHaveLength(minionsBefore);
    expect(after.players[0].health).toBe(after.players[0].maxHealth - 1);
    expect(after.players[1].health).toBe(after.players[1].maxHealth);
  });

  it('S5: Swarm Attack with no Drone engaged with you: you create one', () => {
    const state = game();
    drones(state, 'p2');

    const after = reveal(state, 0, SWARM_ATTACK);

    expect(after.players[0].engagedMinions).toHaveLength(1);
    expect(after.players[0].engagedMinions[0].isShell).toBe(true);
    expect(after.players[1].health).toBe(after.players[1].maxHealth);
  });

  it('S5: Drone Factory places threat once per Drone in play', () => {
    const state = game();
    drones(state, 'p1', 1);
    state.players[1].engagedMinions = [instance(ADVANCED_DRONE)];

    const after = reveal(state, 0, DRONE_FACTORY);

    const factory = after.sideSchemes.find((s) => s.card.code === DRONE_FACTORY)!;
    const base = (factory.card as { baseThreat?: number }).baseThreat ?? 0;
    // 1 + 1 Advanced Drone + 2 new Drones: counted once, not once per player
    expect(factory.threat).toBe(base + 4);
    expect(after.players[0].engagedMinions).toHaveLength(2);
    expect(after.players[1].engagedMinions).toHaveLength(2);
  });

  it('S5: Ultron II creates a Drone first, then gets +1 ATK per Drone engaged with the attacked player', () => {
    const state = game();
    becomeUltron(state, ULTRON_II);
    const p2 = state.players[1];
    drones(state, 'p2', 2);
    drones(state, 'p1', 3); // another player's Drones do not count
    const printedAttack = printed(ULTRON_II).attack;
    state.encounterDeck = []; // no boost icons

    const attacked = executeVillainAttackAgainstPlayer(state, p2);

    expect(p2.engagedMinions).toHaveLength(3);
    const prompt = peekDecisionPrompt(attacked);
    expect(prompt?.title).toContain(`Base ATK: ${printedAttack + 3}`);
  });

  it('S5: Ultron II ATK follows the count during the attack, then the bonus ends', () => {
    const state = game();
    becomeUltron(state, ULTRON_II);
    const p1 = state.players[0];
    drones(state, 'p1', 1);
    const printedAttack = printed(ULTRON_II).attack;
    state.encounterDeck = [];

    const attacked = executeVillainAttackAgainstPlayer(state, p1);
    expect(attacked.activeAttackContext?.attackModifiers).toHaveLength(1);

    // A Drone leaves before damage is calculated: the bonus drops with it
    discardCardInstance(attacked, attacked.players[0].engagedMinions[0]);
    expect(peekDecisionPrompt(attacked)).toBeDefined();

    const healthBefore = attacked.players[0].health;
    const after = finishAttack(attacked);

    expect(after.activeAttackContext).toBeUndefined();
    expect(after.players[0].health).toBe(healthBefore - (printedAttack + 1));
  });
});

describe('S6: choices', () => {
  function afterUltronAttack(attackedIndex: number): GameState {
    const state = game();
    becomeUltron(state, ULTRON_I);
    state.encounterDeck = [];
    const attacked = executeVillainAttackAgainstPlayer(state, state.players[attackedIndex]);
    return finishAttack(attacked);
  }

  it('S6: Ultron I, after attacking you: 1 threat on the main scheme', () => {
    const state = afterUltronAttack(1);
    const prompt = peekDecisionPrompt(state)!;
    // The attacked player decides, not the first player
    expect(prompt.playerId).toBe('p2');
    const threat = getActiveMainScheme(state).threat;

    const after = choose(state, 'place_threat');

    expect(getActiveMainScheme(after).threat).toBe(threat + 1);
    expect(after.players[1].engagedMinions).toHaveLength(0);
  });

  it('S6: Ultron I, after attacking you: create a Drone', () => {
    const state = afterUltronAttack(1);

    const after = choose(state, 'create_drone');

    expect(after.players[1].engagedMinions).toHaveLength(1);
    expect(after.players[0].engagedMinions).toHaveLength(0);
  });

  it('S6: Ultron I does not trigger on a minion attack', () => {
    const state = game();
    becomeUltron(state, ULTRON_I);
    state.encounterDeck = [];
    const threat = getActiveMainScheme(state).threat;
    drones(state, 'p1');

    const after = finishAttack(reveal(state, 0, SWARM_ATTACK));

    expect(peekDecisionPrompt(after)?.options.some((o) => o.id === 'place_threat')).toBeFalsy();
    expect(getActiveMainScheme(after).threat).toBe(threat);
  });

  function norad(): GameState {
    const state = game();
    const scheme = getActiveMainScheme(state);
    scheme.card = cardCatalog.getCard('01138b') as never;
    scheme.targetThreat = 99;
    return state;
  }

  it('S6: Assault on NORAD 2B: after step-one threat each player chooses', () => {
    const state = norad();
    const placed = step1_placeThreat(state);
    const threatAfterStepOne = getActiveMainScheme(placed).threat;
    expect(threatAfterStepOne).toBeGreaterThan(0);

    expect(peekDecisionPrompt(placed)!.playerId).toBe('p1');
    const afterP1 = choose(placed, 'place_threat');
    expect(getActiveMainScheme(afterP1).threat).toBe(threatAfterStepOne + 2);

    expect(peekDecisionPrompt(afterP1)!.playerId).toBe('p2');
    const afterP2 = choose(afterP1, 'create_drone');
    expect(afterP2.players[1].engagedMinions).toHaveLength(1);
    expect(afterP2.players[0].engagedMinions).toHaveLength(0);
    // Its own threat does not trigger it again
    expect(peekDecisionPrompt(afterP2)).toBeUndefined();
  });

  it('S6: Assault on NORAD 2B ignores threat from other sources', () => {
    const state = norad();

    executeEffect(
      state,
      {
        id: 'test_threat',
        timing: 'WHEN_REVEALED',
        steps: [{ effect: 'ADD_THREAT', effectParams: { target: 'MAIN_SCHEME', amount: 1 } }],
      } as never,
      { playerId: 'p1' },
    );

    expect(peekDecisionPrompt(state)).toBeUndefined();
  });

  it('S6: a stage completed by step-one threat does not trigger the next stage 2B', () => {
    const state = game();
    const scheme = getActiveMainScheme(state);
    scheme.threat = scheme.targetThreat! - 1;

    const placed = step1_placeThreat(state);

    expect(getActiveMainScheme(placed).card.code).toBe('01138b');
    expect(peekDecisionPrompt(placed)).toBeUndefined();
  });

  function boostOf(code: string) {
    return cardCatalog.getCard(code)!.enrichment!.abilities!.find((a) => a.timing === 'BOOST')!;
  }

  it('S6: Android Efficiency boost: cannot pay, so only the Drone can be chosen', () => {
    const state = game();
    const code = '01144a';

    executeEffect(state, boostOf(code), { playerId: 'p1', sourceCardInstance: instance(code) });

    const prompt = peekDecisionPrompt(state)!;
    expect(prompt.options.find((o) => o.id === 'spend_resource')?.disabled).toBe(true);
    expect(prompt.options.find((o) => o.id === 'create_drone')?.disabled).toBeFalsy();

    const after = choose(state, 'create_drone');
    expect(after.players[0].engagedMinions).toHaveLength(1);
  });

  it('S6: Android Efficiency boost: spending the resource pays once and makes no Drone', () => {
    const state = game();
    const code = '01144a';
    const energy = cardCatalog
      .getAllCards()
      .find((c) => c.type === 'resource' && (c.resources?.energy ?? 0) > 0 && !c.isUnique)!;
    const paid = instance(energy.code);
    const kept = instance(energy.code);
    state.players[0].hand = [paid, kept];

    executeEffect(state, boostOf(code), { playerId: 'p1', sourceCardInstance: instance(code) });
    const prompt = peekDecisionPrompt(state)!;
    expect(prompt.options.find((o) => o.id === 'spend_resource')?.disabled).toBeFalsy();

    const after = choose(state, 'spend_resource', {
      paymentCardInstanceIds: [paid.instanceId],
    });

    expect(after.players[0].engagedMinions).toHaveLength(0);
    expect(after.players[0].hand.map((c) => c.instanceId)).toEqual([kept.instanceId]);
    expect(after.players[0].discard.map((c) => c.instanceId)).toContain(paid.instanceId);
  });
});
