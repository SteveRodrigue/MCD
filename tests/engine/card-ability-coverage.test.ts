import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { EFFECT_TYPES } from '../../src/data/supplemental/runtime';
import {
  COVERAGE_RULE_BY_TIMING,
  CoverageLedger,
  buildAbilityInventory,
  hashCardData,
} from '@engine/simulation/ability-coverage';
import {
  EFFECT_DELTA_CONTRACTS,
  assertNoStepErrors,
  collectStepErrors,
  digestState,
  verifyAbilityExecution,
} from '@engine/simulation/effect-delta-verifier';
import {
  exerciseAbility,
  sweepAbilities,
  variantsFor,
} from '@engine/simulation/ability-stage-setter';
import { runMatch } from '@engine/simulation/match-simulator';
import { setupGame } from '@engine/state/game-setup';
import { appendLog } from '@engine/state/game-log';
import type { AbilityStep } from '@engine/models';

const allCards = cardCatalog.getAllCards();
const inventory = buildAbilityInventory(allCards);
const options = { catalog: cardCatalog, allCards };
const find = (cardCode: string, abilityId: string) => {
  const target = inventory.find((t) => t.cardCode === cardCode && t.abilityId === abilityId);
  if (!target) throw new Error(`no ability ${cardCode}#${abilityId}`);
  return target;
};

function freshState() {
  const spiderMan = cardCatalog.getHeroIdentity('spider_man')!;
  return setupGame({
    catalog: cardCatalog,
    scenarioId: 'rhino',
    players: [
      {
        id: 'p1',
        name: 'Spider-Man',
        hero: spiderMan.hero,
        alterEgo: spiderMan.alterEgo,
        deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
      },
    ],
    skipMulligan: true,
    shuffleFn: (arr) => arr,
  });
}

function logStepError(state: ReturnType<typeof freshState>, error: string) {
  appendLog(state, {
    category: 'ability',
    key: 'engine.stepError',
    params: { effect: 'DRAW', error },
    text: `DRAW failed: ${error}`,
  });
}

describe('Effect-Delta Registry', () => {
  it('declares a contract for every effect the supplemental schema knows', () => {
    const missing = EFFECT_TYPES.filter((effect) => !(effect in EFFECT_DELTA_CONTRACTS));
    expect(missing).toEqual([]);
  });

  it('gives every contract at least one observable domain', () => {
    for (const [effect, domains] of Object.entries(EFFECT_DELTA_CONTRACTS)) {
      expect(domains.length, effect).toBeGreaterThan(0);
    }
  });
});

describe('ability inventory', () => {
  it('lists every Core ability and gives each timing a coverage rule', () => {
    expect(inventory.length).toBeGreaterThan(0);
    for (const target of inventory) {
      expect(COVERAGE_RULE_BY_TIMING[target.ability.timing], target.cardCode).toBeDefined();
    }
  });

  it('hashes the card data deterministically', () => {
    expect(hashCardData(inventory)).toBe(hashCardData(buildAbilityInventory(allCards)));
  });

  it('tracks coverage and the reason an ability could not be driven', () => {
    const ledger = new CoverageLedger(inventory.slice(0, 3));
    const [first, second] = ledger.inventory;
    ledger.markCovered(first.cardCode, first.abilityId, 'used-counter');
    ledger.markFailed({
      cardCode: second.cardCode,
      abilityId: second.abilityId,
      reason: 'no target',
    });
    expect(ledger.coveredCount).toBe(1);
    expect(ledger.failureList().find((f) => f.abilityId === second.abilityId)?.reason).toBe(
      'no target',
    );
  });
});

describe('effect-delta verifier', () => {
  const damage: AbilityStep = { effect: 'DEAL_DAMAGE', effectParams: {} };

  it('fails a step that resolved without changing its declared domain', () => {
    const state = freshState();
    const result = verifyAbilityExecution(
      { id: 'noop', steps: [damage] },
      digestState(state),
      state,
    );
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('DEAL_DAMAGE');
  });

  it('passes a step whose domain changed', () => {
    const state = freshState();
    const before = digestState(state);
    state.players[0].health -= 1;
    expect(verifyAbilityExecution({ id: 'hit', steps: [damage] }, before, state).ok).toBe(true);
  });

  it('allows a gated step to change nothing', () => {
    const state = freshState();
    const gated = { effect: 'DEAL_DAMAGE', gate: 'IF_FORM' } as AbilityStep;
    const result = verifyAbilityExecution(
      { id: 'gated', steps: [gated] },
      digestState(state),
      state,
    );
    expect(result.ok).toBe(true);
  });

  it('reports engine.stepError log entries', () => {
    const state = freshState();
    logStepError(state, 'boom');
    expect(collectStepErrors(state)).toHaveLength(1);
    expect(() => assertNoStepErrors(state, 'test')).toThrow(/boom/);
    expect(verifyAbilityExecution({ id: 'x', steps: [] }, digestState(state), state).ok).toBe(
      false,
    );
  });
});

describe('runMatch step errors', () => {
  it('fails a match whose log holds an engine.stepError', () => {
    const state = freshState();
    logStepError(state, 'broken step');
    expect(() => runMatch(state, { maxRounds: 1, seed: 'step-error' })).toThrow(/broken step/);
  });

  it('tolerates it when a test of the error log asks for that', () => {
    const state = freshState();
    logStepError(state, 'broken step');
    expect(() =>
      runMatch(state, { maxRounds: 1, seed: 'step-error', allowStepErrors: true }),
    ).not.toThrow();
  });
});

describe('Stage-Setter drivers', () => {
  it.each([
    ['a player action on an event', '01005', 'swinging_web_kick'],
    ['an identity ability, counted in stats', '01010a', 'rechannel'],
    ['an in-play upgrade ability', '01028', 'superhuman_strength_atk'],
    ['a trigger on ENTERS_PLAY', '01084', 'nick_fury_enters_play'],
  ])('covers %s', (_label, cardCode, abilityId) => {
    const outcome = exerciseAbility(find(cardCode, abilityId), options);
    expect(outcome.reason).toBeUndefined();
    expect(outcome.ok).toBe(true);
  });

  it('covers a When Revealed treachery and a Boost card through the encounter path', () => {
    const revealed = inventory.find(
      (t) => t.ability.timing === 'WHEN_REVEALED' && t.card.type === 'treachery',
    )!;
    const boost = inventory.find((t) => t.ability.timing === 'BOOST')!;
    expect(exerciseAbility(revealed, options).ok).toBe(true);
    expect(exerciseAbility(boost, options).ok).toBe(true);
  });

  it.each([
    ['an identity resource, paid with no hand cards', '01001b', 'scientist', 'resource'],
    ['a Power of ... card that doubles its aspect', '01055', 'power_of_aggression', 'resource'],
    ['a Setup search resolved after the mulligan', '01040b', 't_challa_foresight', 'setup'],
    [
      'a Special ability opened by the play of a Special card',
      '01046',
      'energy_daggers_special',
      'special',
    ],
  ])('covers %s', (_label, cardCode, abilityId, evidence) => {
    const outcome = exerciseAbility(find(cardCode, abilityId), options);
    expect(outcome.reason).toBeUndefined();
    expect(outcome.evidence).toBe(evidence);
  });

  it('fails an ability it cannot drive with the unmet precondition named, never silently', () => {
    const base = find('01005', 'swinging_web_kick');
    const undrivable = {
      ...base,
      ability: { ...base.ability, timing: 'ALTER_EGO_INTERRUPT' as const, trigger: undefined },
    };
    const outcome = exerciseAbility(undrivable, options);
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toContain('declares no trigger');
  });

  it('reproduces the same state fingerprint from the same seed', () => {
    const target = find('01005', 'swinging_web_kick');
    const first = exerciseAbility(target, { ...options, seed: 'replay' });
    const second = exerciseAbility(target, { ...options, seed: 'replay' });
    expect(first.fingerprint).toBeDefined();
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it('walks every PLAYER_CHOICE branch of a card as its own run', () => {
    const target = find('01084', 'nick_fury_enters_play');
    const ledger = new CoverageLedger([target]);
    const [result] = sweepAbilities(ledger, options);
    const branches = result.outcomes.filter((o) => o.variant.includes(':b'));
    expect(branches.length).toBeGreaterThanOrEqual(2);
    expect(branches.every((o) => o.ok)).toBe(true);
    expect(ledger.coveredCount).toBe(1);
  });
});

describe('Gate 1.4: Core Set card-ability coverage', () => {
  const ledger = new CoverageLedger(inventory);
  const results = sweepAbilities(ledger, options);

  it('covers every Core Set ability by its timing rule', () => {
    expect(ledger.failureList()).toEqual([]);
    expect(ledger.percent).toBe(100);
  });

  it('runs every extra variant (two players, each choice branch) without a failure', () => {
    const failures = results.flatMap(({ target, outcomes }) =>
      outcomes
        .filter((o) => !o.ok)
        .map((o) => `${target.cardCode}#${target.abilityId}@${o.variant}: ${o.reason}`),
    );
    expect(failures).toEqual([]);
  });

  it('leaves no engine.stepError, stuck prompt or broken invariant in any run', () => {
    const dirty = results.flatMap(({ target, outcomes }) =>
      outcomes
        .filter((o) => o.verification && !o.verification.ok)
        .map((o) => `${target.cardCode}#${target.abilityId}@${o.variant}`),
    );
    expect(dirty).toEqual([]);
  });

  it('replays every covered ability to the same state fingerprint', () => {
    const mismatches = results
      .filter(({ outcomes }) => outcomes[0].ok)
      .filter(({ target, outcomes }) => {
        const [primary] = variantsFor(target);
        const again = exerciseAbility(target, { ...options, ...primary });
        return again.fingerprint !== outcomes[0].fingerprint;
      })
      .map(({ target }) => `${target.cardCode}#${target.abilityId}`);
    expect(mismatches).toEqual([]);
  });
});
