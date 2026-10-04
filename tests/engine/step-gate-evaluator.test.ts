import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { getEffectiveHeroStats } from '@engine/pipeline/stat-calculator';
import { evaluateStepGate, isStepGateClosedByState } from '@engine/pipeline/step-gate-evaluator';

describe('Shared step-gate evaluator (Issue #122, RR v1.8 p. 2, 24)', () => {
  let state: GameState;
  let hero: HeroCard;

  beforeEach(() => {
    hero = cardCatalog.getCard('01001a') as HeroCard;
    const alterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero,
          alterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = hero;
  });

  const ctx = { playerId: 'p1' };
  const evalGate = (step: any, prev?: any, extra: any = {}) =>
    evaluateStepGate(step.gate, prev, state, step, { ...ctx, ...extra });

  it('ALWAYS / no gate always passes', () => {
    expect(evalGate({ gate: undefined, effect: 'DRAW' })).toBe(true);
    expect(evalGate({ gate: 'ALWAYS', effect: 'DRAW' })).toBe(true);
  });

  it('IF_FORM compares the player form', () => {
    expect(evalGate({ gate: 'IF_FORM', gateParams: { form: 'hero' }, effect: 'DRAW' })).toBe(true);
    expect(evalGate({ gate: 'IF_FORM', gateParams: { form: 'alter_ego' }, effect: 'DRAW' })).toBe(
      false,
    );
    state.players[0].currentForm = 'alter_ego';
    expect(evalGate({ gate: 'IF_FORM', gateParams: { form: 'alter-ego' }, effect: 'DRAW' })).toBe(
      true,
    );
  });

  it('IF_CARD_IN_PLAY / IF_CARD_NOT_IN_PLAY look across zones', () => {
    const inPlay = { gate: 'IF_CARD_IN_PLAY', gateParams: { cardCode: '01064' }, effect: 'DRAW' };
    const notInPlay = { ...inPlay, gate: 'IF_CARD_NOT_IN_PLAY' };
    expect(evalGate(inPlay)).toBe(false);
    expect(evalGate(notInPlay)).toBe(true);
    state.players[0].tableau.push(createCardInstance(cardCatalog.getCard('01064')!));
    expect(evalGate(inPlay)).toBe(true);
    expect(evalGate(notInPlay)).toBe(false);
  });

  it('IF_ALREADY_HAS_STATUS checks the villain status', () => {
    const step = {
      gate: 'IF_ALREADY_HAS_STATUS',
      gateParams: { status: StatusCard.STUNNED, target: 'VILLAIN' },
      effect: 'DRAW',
    };
    expect(evalGate(step)).toBe(false);
    state.villain.statusCards.push(StatusCard.STUNNED);
    expect(evalGate(step)).toBe(true);
  });

  it('IF_RESOURCE_MATCH uses resources spent, wild matches unless printed is required', () => {
    const step = { gate: 'IF_RESOURCE_MATCH', gateParams: { resource: 'mental' }, effect: 'DRAW' };
    expect(evalGate(step, undefined, { resourcesSpent: ['mental'] })).toBe(true);
    expect(evalGate(step, undefined, { resourcesSpent: ['wild'] })).toBe(true);
    expect(evalGate(step, undefined, { resourcesSpent: ['physical'] })).toBe(false);
    const printed = { ...step, gateParams: { resource: 'mental', printedResource: true } };
    expect(evalGate(printed, undefined, { resourcesSpent: ['wild'] })).toBe(false);
  });

  it('IF_CONDITION_MET + TARGET_TRAIT_MATCH checks the player traits', () => {
    const step = (trait: string) => ({
      gate: 'IF_CONDITION_MET',
      condition: 'TARGET_TRAIT_MATCH',
      gateParams: { trait },
      effect: 'DRAW',
    });
    expect(evalGate(step('Nonexistent Trait'))).toBe(false);
    const traits = (hero.traits || [])[0];
    if (traits) expect(evalGate(step(traits))).toBe(true);
  });

  it('IF_CONDITION_NOT_MET is the exact negation of IF_CONDITION_MET (trait condition)', () => {
    const step = (gate: string, trait: string) => ({
      gate,
      condition: 'TARGET_TRAIT_MATCH',
      gateParams: { trait },
      effect: 'DRAW',
    });
    const present = (hero.traits || [])[0] ?? 'Avenger';
    for (const trait of [present, 'Nonexistent Trait']) {
      const met = evalGate(step('IF_CONDITION_MET', trait));
      expect(evalGate(step('IF_CONDITION_NOT_MET', trait))).toBe(!met);
    }
    // A granted trait flips both gates together.
    state.players[0].activeTraitModifiers = [{ trait: 'Aerial', duration: 'PHASE' }];
    expect(evalGate(step('IF_CONDITION_MET', 'Aerial'))).toBe(true);
    expect(evalGate(step('IF_CONDITION_NOT_MET', 'Aerial'))).toBe(false);
  });

  it('IF_CONDITION_NOT_MET also negates a result-based condition when no trait is checked', () => {
    const met = { success: true, mutatedState: true, conditionMet: true };
    const notMet = { success: true, mutatedState: true, conditionMet: false };
    const step = { gate: 'IF_CONDITION_NOT_MET', effect: 'DRAW' };
    expect(evalGate(step, met)).toBe(false);
    expect(evalGate(step, notMet)).toBe(true);
    expect(evalGate(step, undefined)).toBe(true);
  });

  it('UNDEFENDED_ATTACK is true only for an attack with no defender, optionally by a given attacker kind', () => {
    const step = (gate: string, gateParams?: Record<string, unknown>) => ({
      gate,
      condition: 'UNDEFENDED_ATTACK',
      gateParams,
      effect: 'ADD_THREAT',
    });
    const met = (gateParams: Record<string, unknown> | undefined, extra: any) =>
      evalGate(step('IF_CONDITION_MET', gateParams), undefined, extra);

    expect(met(undefined, { attackerType: 'VILLAIN', defenderType: 'UNDEFENDED' })).toBe(true);
    expect(met(undefined, { attackerType: 'MINION', defenderType: 'UNDEFENDED' })).toBe(true);
    expect(met(undefined, { attackerType: 'VILLAIN', defenderType: 'HERO' })).toBe(false);
    expect(met(undefined, { attackerType: 'VILLAIN', defenderType: 'ALLY' })).toBe(false);
    // Not an attack at all (for example a scheme activation boost): never undefended.
    expect(met(undefined, {})).toBe(false);

    const villainOnly = { attackerKind: 'VILLAIN' };
    expect(met(villainOnly, { attackerType: 'VILLAIN', defenderType: 'UNDEFENDED' })).toBe(true);
    expect(met(villainOnly, { attackerType: 'MINION', defenderType: 'UNDEFENDED' })).toBe(false);
    expect(
      met({ attackerKind: 'MINION' }, { attackerType: 'MINION', defenderType: 'UNDEFENDED' }),
    ).toBe(true);
    expect(
      met({ attackerKind: 'ANY_ENEMY' }, { attackerType: 'MINION', defenderType: 'UNDEFENDED' }),
    ).toBe(true);

    // IF_CONDITION_NOT_MET is the exact negation.
    expect(
      evalGate(step('IF_CONDITION_NOT_MET', villainOnly), undefined, {
        attackerType: 'VILLAIN',
        defenderType: 'HERO',
      }),
    ).toBe(true);
    expect(evalGate(step('IF_CONDITION_NOT_MET', villainOnly), undefined, {})).toBe(true);
  });

  it('isStepGateClosedByState reports only state-evaluable gates that are closed now', () => {
    const trait = (gate: string) => ({
      gate,
      condition: 'TARGET_TRAIT_MATCH',
      gateParams: { trait: 'Aerial' },
      effect: 'DRAW',
    });
    const closed = (step: any) => isStepGateClosedByState(step, state, ctx);
    expect(closed(trait('IF_CONDITION_MET'))).toBe(true);
    expect(closed(trait('IF_CONDITION_NOT_MET'))).toBe(false);
    expect(closed({ gate: 'IF_FORM', gateParams: { form: 'alter_ego' }, effect: 'DRAW' })).toBe(
      true,
    );
    // Result-based gates and ungated steps are never "closed by state".
    expect(closed({ gate: 'THEN', effect: 'DRAW' })).toBe(false);
    expect(closed({ gate: 'IF_CONDITION_MET', effect: 'DRAW' })).toBe(false);
    expect(closed({ effect: 'DRAW' })).toBe(false);
  });

  it('result-based gates read the previous step result', () => {
    const ok = { success: true, mutatedState: true };
    const no = { success: true, mutatedState: false };
    expect(evalGate({ gate: 'THEN', effect: 'DRAW' }, ok)).toBe(true);
    expect(evalGate({ gate: 'IF_PREVIOUS_SUCCESS', effect: 'DRAW' }, no)).toBe(false);
    expect(evalGate({ gate: 'IF_FAILED', effect: 'DRAW' }, no)).toBe(true);
    expect(evalGate({ gate: 'IF_AMOUNT_ZERO', effect: 'DRAW' }, { ...no, value: 0 })).toBe(true);
    expect(evalGate({ gate: 'THEN', effect: 'DRAW' }, undefined)).toBe(false);
  });

  describe('CONSTANT steps honor gates in the stat calculator', () => {
    function withConstantAttack(gate: any, gateParams: any) {
      const upgrade = createCardInstance(cardCatalog.getCard('01093')!);
      upgrade.card = {
        ...upgrade.card,
        enrichment: {
          abilities: [
            {
              id: 'gated_attack',
              timing: 'CONSTANT',
              steps: [
                {
                  effect: 'MODIFY_STAT',
                  gate,
                  gateParams,
                  effectParams: { stat: 'ATTACK', amount: 2 },
                },
              ],
            },
          ],
        },
      } as any;
      state.players[0].tableau = [upgrade];
      return getEffectiveHeroStats(state, state.players[0]).attack;
    }

    it('IF_FORM hero applies in hero form and IF_FORM alter_ego does not', () => {
      const base = getEffectiveHeroStats(state, state.players[0]).attack;
      expect(withConstantAttack('IF_FORM', { form: 'hero' })).toBe(base + 2);
      expect(withConstantAttack('IF_FORM', { form: 'alter_ego' })).toBe(base);
    });

    it('result-based gates do not apply to CONSTANT steps (no previous step)', () => {
      const base = getEffectiveHeroStats(state, state.players[0]).attack;
      expect(withConstantAttack('THEN', {})).toBe(base);
    });

    it('ungated CONSTANT steps still apply', () => {
      const base = getEffectiveHeroStats(state, state.players[0]).attack;
      expect(withConstantAttack(undefined, undefined)).toBe(base + 2);
    });
  });
});
