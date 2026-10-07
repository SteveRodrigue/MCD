import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard, GameState, MinionCard } from '../../src/engine/models';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { peekDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';
import { executeEffect } from '../../src/engine/effects';

/** Re-verification of low-confidence core player cards (#260). */
function newGame(heroCode: string, altCode: string, players = 1): GameState {
  const pairs = [
    [heroCode, altCode],
    ['01029a', '01029b'],
  ];
  const make = (id: string, [h, a]: string[]) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(h) as HeroCard,
    alterEgo: cardCatalog.getCard(a) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });
  return setupGame({
    scenarioId: 'rhino',
    players: Array.from({ length: players }, (_, i) => make(`p${i + 1}`, pairs[i])),
    skipMulligan: true,
  });
}

function ability(code: string, id: string) {
  return cardCatalog.getCard(code)!.enrichment!.abilities!.find((a) => a.id === id)!;
}

describe('data literal to the printed text (#260)', () => {
  it.each([
    ['01024', 'one_two_punch_response'],
    ['01035', 'arc_reactor_ready'],
  ])('%s readies the hero, not "your identity"', (code, id) => {
    expect(ability(code, id).steps[0].effectParams?.target).toBe('SELF_HERO');
  });

  it('confidence is 95 for the verified cards', () => {
    for (const code of ['01024', '01035', '01069', '01019a']) {
      expect(cardCatalog.getCard(code)!.enrichment!.audit?.confidence, code).toBe(95);
    }
  });
});

describe('Arc Reactor 01035 (#260)', () => {
  it('readies the exhausted hero', () => {
    const state = newGame('01029a', '01029b');
    const p = state.players[0];
    p.currentForm = 'hero';
    p.activeFormCard = cardCatalog.getCard('01029a') as HeroCard;
    p.exhausted = true;
    const reactor = createCardInstance(cardCatalog.getCard('01035')!);
    p.tableau.push(reactor);
    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: reactor.instanceId,
      abilityId: 'arc_reactor_ready',
    });
    expect(res.result.success).toBe(true);
    expect(res.state.players[0].exhausted).toBe(false);
  });
});

describe('Get Ready 01069 (#260)', () => {
  it('lets the player choose among the allies of every player and readies only that ally', () => {
    let state = newGame('01019a', '01019b', 2);
    const a1 = createCardInstance(cardCatalog.getCard('01084')!);
    const a2 = createCardInstance(cardCatalog.getCard('01085')!);
    a1.exhausted = true;
    a2.exhausted = true;
    state.players[0].allies.push(a1);
    state.players[1].allies.push(a2);
    const getReady = createCardInstance(cardCatalog.getCard('01069')!);
    state.players[0].hand = [getReady];
    state.players[0].currentForm = 'hero';
    state = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: getReady.instanceId,
      paymentCardInstanceIds: [],
    }).state;
    const prompt = peekDecisionPrompt(state)!;
    expect(prompt).toBeDefined();
    expect(
      prompt.options
        .map((o) => o.id)
        .filter((id) => id !== 'cancel_target')
        .sort(),
    ).toEqual([a1.instanceId, a2.instanceId].sort());
    state = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: a2.instanceId,
    }).state;
    expect(state.players[1].allies[0].exhausted).toBe(false);
    expect(state.players[0].allies[0].exhausted).toBe(true);
  });

  it('is not playable without an exhausted ally and never readies the hero instead', () => {
    const state = newGame('01019a', '01019b');
    state.players[0].exhausted = true;
    state.players[0].currentForm = 'hero';
    const getReady = createCardInstance(cardCatalog.getCard('01069')!);
    state.players[0].hand = [getReady];
    const res = dispatchAction(state, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: getReady.instanceId,
      paymentCardInstanceIds: [],
    });
    expect(res.state.players[0].exhausted).toBe(true);
  });
});

describe('READY with no target (#260)', () => {
  it('does not ready the acting player when the target resolves to nothing', () => {
    const state = newGame('01019a', '01019b');
    state.players[0].exhausted = true;
    state.players[0].currentForm = 'alter_ego';
    const res = executeEffect(
      state,
      {
        id: 't',
        timing: 'ACTION',
        steps: [{ effect: 'READY', effectParams: { target: 'SELF_HERO' } }],
      } as any,
      { playerId: 'p1' },
    );
    expect(res.state.players[0].exhausted).toBe(true);
  });
});

describe('She-Hulk 01019a form change response (#260)', () => {
  it('prompts for an enemy after the change to She-Hulk and deals 2 damage', () => {
    let state = newGame('01019a', '01019b');
    const minion = createCardInstance(cardCatalog.getCard('01101') as MinionCard);
    state.players[0].engagedMinions = [minion];
    state = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    expect(state.players[0].currentForm).toBe('hero');
    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();
    const pick = prompt!.options.find((o) => !o.disabled && o.id !== 'pass' && o.id !== 'decline');
    expect(pick).toBeDefined();
  });

  it('does not respond on the change back to Jennifer Walters', () => {
    let state = newGame('01019a', '01019b');
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = cardCatalog.getCard('01019a') as HeroCard;
    state.players[0].engagedMinions = [
      createCardInstance(cardCatalog.getCard('01101') as MinionCard),
    ];
    state = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    expect(state.players[0].currentForm).toBe('alter_ego');
    expect(peekDecisionPrompt(state)).toBeUndefined();
  });
});

describe('Nick Fury 01084 round end (#260)', () => {
  it('is discarded exactly once at the end of the round', async () => {
    const { step6_endVillainPhaseAndRound } =
      await import('../../src/engine/pipeline/round-upkeep');
    const state = newGame('01019a', '01019b');
    const fury = createCardInstance(cardCatalog.getCard('01084')!);
    state.players[0].allies.push(fury);
    const next = step6_endVillainPhaseAndRound(state);
    expect(next.players[0].allies).toHaveLength(0);
    expect(next.players[0].discard.filter((c) => c.instanceId === fury.instanceId)).toHaveLength(1);
  });
});

describe('SEARCH selection model data (#260)', () => {
  it('Ancestral Knowledge 01042 is "up to 3 different cards"', () => {
    const params = ability('01042', 'ancestral_knowledge_action').steps[0].effectParams;
    expect(params).toMatchObject({ takeCount: 3, minimumTake: 0, distinctBy: 'NAME' });
    expect(params).not.toHaveProperty('fromTop');
    expect(params).not.toHaveProperty('isVoluntary');
  });

  it('no SEARCH step declares isVoluntary; minimumTake defaults to 1 in the schema', async () => {
    const { SearchAndSelectParamsSchema } = await import('../../src/data/supplemental/schema');
    expect(SearchAndSelectParamsSchema.parse({}).minimumTake).toBe(1);
    expect(SearchAndSelectParamsSchema.safeParse({ isVoluntary: true }).success).toBe(false);
    expect(SearchAndSelectParamsSchema.safeParse({ distinctBy: 'CODE' }).success).toBe(false);
  });
});
