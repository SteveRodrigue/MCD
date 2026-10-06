import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  GamePhase,
  VillainPhaseStep,
  HeroCard,
  AlterEgoCard,
  CardAbility,
  getActiveMainScheme,
} from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { peekDecisionPrompt, resolveDecisionPrompt } from '@engine/pipeline/prompt-queue';
import {
  executeVillainSchemeAgainstPlayer,
  advanceVillainPhaseStep,
} from '@engine/pipeline/villain-phase';
import { dispatchTrigger } from '@engine/triggers/trigger-dispatcher';
import { executeEffect } from '@engine/effects';

/**
 * Issue #266: accepting a threat interrupt from its prompt must change the threat that is placed.
 * Every test answers through the real prompt path (dispatchAction RESOLVE_DECISION_PROMPT or
 * resolveDecisionPrompt), never through acceptOptionalTriggers.
 */

type FormName = 'hero' | 'alter_ego';
interface PlayerSetup {
  hero: [string, string];
  form: FormName;
  hand: string[];
}

const SPIDER_MAN: [string, string] = ['01001a', '01001b'];
const CAPTAIN_MARVEL: [string, string] = ['01010a', '01010b'];
const SHE_HULK: [string, string] = ['01019a', '01019b'];

const EMERGENCY = '01085';
const GREAT_RESPONSIBILITY = '01061';
const FILLER = '01005'; // 0 boost icons
const TWO_ICON_BOOST = '01099'; // Charge, 2 boost icons

function setup(players: PlayerSetup[], opts: { firstPlayerIndex?: number } = {}): GameState {
  resetInstanceCounter();
  const state = setupGame({
    scenarioId: 'rhino',
    players: players.map((p, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      hero: cardCatalog.getCard(p.hero[0]) as HeroCard,
      alterEgo: cardCatalog.getCard(p.hero[1]) as AlterEgoCard,
      deckCards: Array(10).fill(cardCatalog.getCard(FILLER)!),
    })),
    villain: cardCatalog.getCard('01094') as any,
    mainScheme: cardCatalog.getCard('01097b') as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    shuffleFn: (arr) => arr,
    skipMulligan: true,
    skipScenarioPlugin: true,
  });
  state.players.forEach((p, i) => {
    p.currentForm = players[i].form;
    p.activeFormCard = players[i].form === 'hero' ? p.hero : p.alterEgo;
    p.hand = players[i].hand.map((code) => createCardInstance(cardCatalog.getCard(code)!));
    p.usedAbilitiesThisRound = {};
  });
  if (opts.firstPlayerIndex !== undefined) state.firstPlayerIndex = opts.firstPlayerIndex;
  return state;
}

function stackEncounterDeck(state: GameState, codes: string[]): void {
  state.encounterDeck = [
    ...codes.map((c) => createCardInstance(cardCatalog.getCard(c)!)),
    ...state.encounterDeck,
  ];
}

function threat(state: GameState): number {
  return getActiveMainScheme(state).threat;
}

function answer(state: GameState, playerId: string, optionId: string): GameState {
  const res = dispatchAction(state, {
    type: 'RESOLVE_DECISION_PROMPT',
    playerId,
    selectedOptionId: optionId,
  });
  expect(res.result.success).toBe(true);
  return res.state;
}

function accept(state: GameState): GameState {
  const prompt = peekDecisionPrompt(state)!;
  expect(prompt).toBeDefined();
  const yes = prompt.options.find((o) => o.effect === 'EXECUTE_OPTIONAL_TRIGGER')!;
  return answer(state, prompt.playerId, yes.id);
}

function pass(state: GameState): GameState {
  const prompt = peekDecisionPrompt(state)!;
  expect(prompt).toBeDefined();
  return answer(state, prompt.playerId, 'pass');
}

function handCodes(state: GameState, playerIndex: number): string[] {
  return state.players[playerIndex].hand.map((c) => c.card.code);
}

function discardCodes(state: GameState, playerIndex: number): string[] {
  return state.players[playerIndex].discard.map((c) => c.card.code);
}

/** A villain scheme of 1 (Rhino SCH 1) plus the boost icons of the stacked boost card. */
function scheme(state: GameState, boost: string, playerIndex = 0): void {
  stackEncounterDeck(state, [boost]);
  executeVillainSchemeAgainstPlayer(state, state.players[playerIndex]);
}

describe('threat interrupt prompts change the placed threat (Issue #266)', () => {
  it('1. Emergency accepted: the villain scheme places 0 and Emergency is discarded', () => {
    const state = setup([{ hero: SPIDER_MAN, form: 'alter_ego', hand: [EMERGENCY] }]);
    const before = threat(state);
    scheme(state, FILLER);
    expect(peekDecisionPrompt(state)?.sourceCardCode).toBe(EMERGENCY);
    expect(threat(state)).toBe(before);

    const after = accept(state);
    expect(threat(after)).toBe(before);
    expect(discardCodes(after, 0)).toContain(EMERGENCY);
    expect(handCodes(after, 0)).not.toContain(EMERGENCY);
  });

  it('2. Emergency passed: the full amount is placed and Emergency stays in hand', () => {
    const state = setup([{ hero: SPIDER_MAN, form: 'alter_ego', hand: [EMERGENCY] }]);
    const before = threat(state);
    scheme(state, FILLER);
    const after = pass(state);
    expect(threat(after)).toBe(before + 1);
    expect(handCodes(after, 0)).toContain(EMERGENCY);
  });

  it('3. Emergency accepted against a scheme of 3: the scheme gains 2', () => {
    const state = setup([{ hero: SPIDER_MAN, form: 'alter_ego', hand: [EMERGENCY] }]);
    const before = threat(state);
    scheme(state, TWO_ICON_BOOST);
    const after = accept(state);
    expect(threat(after)).toBe(before + 2);
  });

  it('4. Great Responsibility accepted: nothing is placed and the identity takes the amount', () => {
    const state = setup([{ hero: SPIDER_MAN, form: 'hero', hand: [GREAT_RESPONSIBILITY] }]);
    const before = threat(state);
    const hp = state.players[0].health;
    scheme(state, TWO_ICON_BOOST);
    expect(threat(state)).toBe(before);

    const after = accept(state);
    expect(threat(after)).toBe(before);
    expect(after.players[0].health).toBe(hp - 3);
    expect(discardCodes(after, 0)).toContain(GREAT_RESPONSIBILITY);
  });

  it('5. "I Object!" accepted on an ADD_THREAT effect: the scheme gains 1; once per round', () => {
    const state = setup([{ hero: SHE_HULK, form: 'alter_ego', hand: [FILLER] }]);
    const before = threat(state);
    const addThreat: CardAbility = {
      id: 'test_add_threat',
      timing: 'ACTION',
      steps: [{ effect: 'ADD_THREAT', effectParams: { amount: 2 } }],
    };
    executeEffect(state, addThreat, { playerId: 'p1' });
    expect(peekDecisionPrompt(state)?.sourceCardCode).toBe('01019b');
    expect(threat(state)).toBe(before);

    const after = accept(state);
    expect(threat(after)).toBe(before + 1);
    expect(after.players[0].usedAbilitiesThisRound?.['jennifer_walters_thwart']).toBe(1);

    executeEffect(after, addThreat, { playerId: 'p1' });
    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect(threat(after)).toBe(before + 3);
  });

  it('6. Two players: the second interrupt reads the live amount', () => {
    const state = setup([
      { hero: SPIDER_MAN, form: 'hero', hand: [EMERGENCY] },
      { hero: CAPTAIN_MARVEL, form: 'hero', hand: [GREAT_RESPONSIBILITY] },
    ]);
    const before = threat(state);
    const hp2 = state.players[1].health;
    scheme(state, TWO_ICON_BOOST);

    expect(peekDecisionPrompt(state)?.playerId).toBe('p1');
    const afterFirst = accept(state);
    expect(peekDecisionPrompt(afterFirst)?.playerId).toBe('p2');
    expect(threat(afterFirst)).toBe(before);

    const after = accept(afterFirst);
    expect(threat(after)).toBe(before);
    expect(after.players[1].health).toBe(hp2 - 2);
  });

  it('7. Stepped villain phase: the step event shows the final amount, then the phase continues', () => {
    const state = setup([
      { hero: SPIDER_MAN, form: 'alter_ego', hand: [EMERGENCY] },
      { hero: CAPTAIN_MARVEL, form: 'alter_ego', hand: [] },
    ]);
    state.options = { ...(state.options ?? {}), villainPhaseStepping: true };
    state.phase = GamePhase.VILLAIN_PHASE;
    state.villainPhaseStep = VillainPhaseStep.VILLAIN_ACTIVATIONS;
    stackEncounterDeck(state, [TWO_ICON_BOOST, FILLER]);
    const before = threat(state);

    const paused = advanceVillainPhaseStep(state);
    expect(peekDecisionPrompt(paused)?.sourceCardCode).toBe(EMERGENCY);
    expect(threat(paused)).toBe(before);

    const accepted = accept(paused);
    expect(threat(accepted)).toBe(before + 2);
    expect(accepted.villainPhaseStepEvent?.type).toBe('VILLAIN_SCHEME');
    expect(accepted.villainPhaseStepEvent?.targetPlayerId).toBe('p1');
    expect(accepted.villainPhaseStepEvent?.amount).toBe(2);

    const next = advanceVillainPhaseStep(accepted);
    expect(next.villainPhaseStepEvent?.type).toBe('VILLAIN_SCHEME');
    expect(next.villainPhaseStepEvent?.targetPlayerId).toBe('p2');
    expect(threat(next)).toBe(before + 3);
  });

  it('8. A step after ADD_THREAT runs only once the placement is finished', () => {
    const state = setup([{ hero: SHE_HULK, form: 'alter_ego', hand: [] }]);
    const before = threat(state);
    const handBefore = state.players[0].hand.length;
    const ability: CardAbility = {
      id: 'test_add_threat_then_draw',
      timing: 'ACTION',
      steps: [
        { effect: 'ADD_THREAT', effectParams: { amount: 2 } },
        { effect: 'DRAW', effectParams: { count: 1 } },
      ],
    };
    executeEffect(state, ability, { playerId: 'p1' });
    expect(peekDecisionPrompt(state)).toBeDefined();
    expect(threat(state)).toBe(before);
    expect(state.players[0].hand.length).toBe(handBefore);

    const after = accept(state);
    expect(threat(after)).toBe(before + 1);
    expect(after.players[0].hand.length).toBe(handBefore + 1);
  });

  it('9. Scheme completion waits for the prompt and does not happen when the interrupt prevents it', () => {
    const build = () => {
      const s = setup([{ hero: SPIDER_MAN, form: 'alter_ego', hand: [EMERGENCY] }]);
      const main = getActiveMainScheme(s);
      main.threat = main.targetThreat! - 3;
      return s;
    };

    const passed = build();
    scheme(passed, TWO_ICON_BOOST);
    expect(passed.winner).toBeFalsy();
    expect(pass(passed).winner).toBe('VILLAIN');

    const accepted = build();
    scheme(accepted, TWO_ICON_BOOST);
    const after = accept(accepted);
    expect(after.winner).toBeFalsy();
    expect(threat(after)).toBe(getActiveMainScheme(after).targetThreat! - 1);
  });

  it('10. No eligible card: the threat is placed at once', () => {
    const state = setup([{ hero: SPIDER_MAN, form: 'alter_ego', hand: [FILLER] }]);
    const before = threat(state);
    scheme(state, FILLER);
    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(threat(state)).toBe(before + 1);
    expect(state.pendingThreatPlacements ?? []).toHaveLength(0);
  });

  it('11. Emergency and Great Responsibility are both offered and both resolve', () => {
    const state = setup([
      { hero: SPIDER_MAN, form: 'hero', hand: [EMERGENCY, GREAT_RESPONSIBILITY] },
    ]);
    const before = threat(state);
    const hp = state.players[0].health;
    scheme(state, TWO_ICON_BOOST);

    expect(peekDecisionPrompt(state)?.sourceCardCode).toBe(EMERGENCY);
    expect(state.pendingDecisionQueue).toHaveLength(2);
    const afterFirst = accept(state);
    expect(peekDecisionPrompt(afterFirst)?.sourceCardCode).toBe(GREAT_RESPONSIBILITY);
    const after = accept(afterFirst);

    expect(threat(after)).toBe(before);
    expect(after.players[0].health).toBe(hp - 2);
    expect(discardCodes(after, 0)).toEqual(
      expect.arrayContaining([EMERGENCY, GREAT_RESPONSIBILITY]),
    );
    expect(handCodes(after, 0)).toEqual([]);
  });

  it('12. Great Responsibility first: the window closes and Emergency stays in hand', () => {
    const state = setup([
      { hero: SPIDER_MAN, form: 'hero', hand: [GREAT_RESPONSIBILITY, EMERGENCY] },
    ]);
    const before = threat(state);
    const hp = state.players[0].health;
    scheme(state, TWO_ICON_BOOST);

    const after = accept(state);
    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect(threat(after)).toBe(before);
    expect(after.players[0].health).toBe(hp - 3);
    expect(discardCodes(after, 0)).toContain(GREAT_RESPONSIBILITY);
    expect(handCodes(after, 0)).toEqual([EMERGENCY]);
  });

  it('13. Two copies of Emergency are both offered', () => {
    const state = setup([{ hero: SPIDER_MAN, form: 'alter_ego', hand: [EMERGENCY, EMERGENCY] }]);
    const before = threat(state);
    scheme(state, TWO_ICON_BOOST);
    expect(state.pendingDecisionQueue).toHaveLength(2);

    const after = accept(accept(state));
    expect(threat(after)).toBe(before + 1);
    expect(discardCodes(after, 0).filter((c) => c === EMERGENCY)).toHaveLength(2);
  });

  it('14. "I Object!" and Emergency both resolve for one placement', () => {
    const state = setup([{ hero: SHE_HULK, form: 'alter_ego', hand: [EMERGENCY] }]);
    const before = threat(state);
    scheme(state, TWO_ICON_BOOST);
    expect(state.pendingDecisionQueue).toHaveLength(2);

    const after = accept(accept(state));
    expect(threat(after)).toBe(before + 1);
    expect(after.players[0].usedAbilitiesThisRound?.['jennifer_walters_thwart']).toBe(1);
    expect(discardCodes(after, 0)).toContain(EMERGENCY);
  });

  it('15. A pass does not close the window for the other player', () => {
    const state = setup([
      { hero: SPIDER_MAN, form: 'hero', hand: [EMERGENCY] },
      { hero: CAPTAIN_MARVEL, form: 'hero', hand: [EMERGENCY] },
    ]);
    const before = threat(state);
    scheme(state, TWO_ICON_BOOST);

    const afterPass = pass(state);
    expect(peekDecisionPrompt(afterPass)?.playerId).toBe('p2');
    const after = accept(afterPass);
    expect(threat(after)).toBe(before + 2);
    expect(handCodes(after, 0)).toContain(EMERGENCY);
    expect(discardCodes(after, 1)).toContain(EMERGENCY);
  });

  it('15b. The first player is asked first', () => {
    const state = setup(
      [
        { hero: SPIDER_MAN, form: 'hero', hand: [EMERGENCY] },
        { hero: CAPTAIN_MARVEL, form: 'hero', hand: [EMERGENCY] },
      ],
      { firstPlayerIndex: 1 },
    );
    scheme(state, TWO_ICON_BOOST);
    expect(peekDecisionPrompt(state)?.playerId).toBe('p2');
    const afterFirst = pass(state);
    expect(peekDecisionPrompt(afterFirst)?.playerId).toBe('p1');
  });

  it('16. Everyone passes: the full amount is placed and no card leaves a hand', () => {
    const state = setup([
      { hero: SPIDER_MAN, form: 'hero', hand: [EMERGENCY] },
      { hero: CAPTAIN_MARVEL, form: 'hero', hand: [EMERGENCY, GREAT_RESPONSIBILITY] },
    ]);
    const before = threat(state);
    scheme(state, TWO_ICON_BOOST);
    let current = state;
    while (peekDecisionPrompt(current)) current = pass(current);
    expect(threat(current)).toBe(before + 3);
    expect(handCodes(current, 0)).toEqual([EMERGENCY]);
    expect(handCodes(current, 1)).toEqual([EMERGENCY, GREAT_RESPONSIBILITY]);
  });

  it('17. Reductions that use the threat up close the window', () => {
    const state = setup([{ hero: SPIDER_MAN, form: 'alter_ego', hand: [EMERGENCY, EMERGENCY] }]);
    const before = threat(state);
    scheme(state, FILLER);
    expect(state.pendingDecisionQueue).toHaveLength(2);

    const after = accept(state);
    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect(threat(after)).toBe(before);
    expect(handCodes(after, 0)).toEqual([EMERGENCY]);
    expect(discardCodes(after, 0).filter((c) => c === EMERGENCY)).toHaveLength(1);
  });

  it('18. A non-threat hand trigger still offers one card per player', () => {
    const state = setup([
      { hero: SPIDER_MAN, form: 'hero', hand: ['01078', '01078'] },
      { hero: CAPTAIN_MARVEL, form: 'hero', hand: ['01078'] },
    ]);
    dispatchTrigger(state, 'TREACHERY_REVEALED', { targetPlayerId: 'p1' });
    expect(state.pendingDecisionQueue ?? []).toHaveLength(1);
    expect(peekDecisionPrompt(state)?.playerId).toBe('p1');
  });

  it('answers through resolveDecisionPrompt as well', () => {
    const state = setup([{ hero: SPIDER_MAN, form: 'alter_ego', hand: [EMERGENCY] }]);
    const before = threat(state);
    scheme(state, TWO_ICON_BOOST);
    const prompt = peekDecisionPrompt(state)!;
    const yes = prompt.options.find((o) => o.effect === 'EXECUTE_OPTIONAL_TRIGGER')!;
    const res = resolveDecisionPrompt(state, prompt.playerId, yes.id);
    expect(res.result.success).toBe(true);
    expect(threat(res.state)).toBe(before + 2);
  });
});
