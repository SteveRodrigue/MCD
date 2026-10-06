import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  ConditionGateSchema,
  TargetSelectorSchema,
  CardAbilitySchema,
} from '../../src/data/supplemental/schema';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  CardInstance,
  StatusCard,
  CardAbility,
  DefenderDeclaration,
} from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import {
  executeEnemyAttackSynchronously,
  initiateEnemyAttack,
  step4_and_5_dealAndResolveBoostCards,
  step6_calculateAndApplyAttackDamage,
  dispatchAction,
  peekDecisionPrompt,
} from '@engine/pipeline';
import { executeEffect } from '@engine/effects';

// Sweeping Swoop (01168): "[star] Boost: If this activation deals damage to a friendly character,
// stun that character." The boost resolves in step 5, before damage (step 6), so the engine defers
// the ability until the activation's damage is known (RR v1.8 Boost, Tough, This Activation).
describe('Sweeping Swoop (01168): boost stuns the friendly character the activation damaged', () => {
  let state: GameState;

  const player = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  const setup = (heroCode: [string, string] = ['01001a', '01001b']) => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [player('p1', heroCode[0], heroCode[1])],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    const p = state.players[0];
    p.currentForm = 'hero';
    p.activeFormCard = p.hero;
    p.hand = [];
  };

  const swoop = () => createCardInstance(cardCatalog.getCard('01168')!);

  /** A boost card with no ability: only its icons count. */
  const filler = (name: string, boostIcons = 0): CardInstance =>
    createCardInstance({ code: `filler-${name}`, name, type: 'treachery', boostIcons } as any);

  const stack = (...cards: CardInstance[]) => {
    state.encounterDeck = [...cards, ...state.encounterDeck];
  };

  const stunned = (entity: { statusCards?: StatusCard[] }) =>
    (entity.statusCards ?? []).filter((s) => s === StatusCard.STUNNED).length;

  const addStatusLogs = () => state.log.filter((l) => l.key === 'card.effect.addStatus');

  /** An ally with plenty of health, so the attack damages but does not defeat it. */
  const sturdyAlly = (health = 9) =>
    createCardInstance({ ...(cardCatalog.getCard('01002') as any), health });

  /** Steps 3 to 6 by hand so a test can look between step 5 (boosts) and step 6 (damage). */
  const startAttack = (defender: DefenderDeclaration) => {
    initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1', { acceptOptionalTriggers: false });
    const ctx = state.activeAttackContext!;
    ctx.defender = defender;
    ctx.heroDefended = defender.type === 'HERO';
    ctx.defenseValue = 0;
    return ctx;
  };

  beforeEach(() => setup());

  it('1. undefended: the hero is stunned after damage, not while the boost resolves', () => {
    stack(swoop());
    const hero = state.players[0];
    const hp = hero.health;
    const ctx = startAttack({ type: 'UNDEFENDED', playerId: 'p1' });

    step4_and_5_dealAndResolveBoostCards(state, ctx);
    expect(stunned(hero)).toBe(0);
    expect(hero.health).toBe(hp);

    step6_calculateAndApplyAttackDamage(state, ctx);
    expect(hero.health).toBeLessThan(hp);
    expect(stunned(hero)).toBe(1);
  });

  it('1b. full synchronous flow: hero damaged and stunned once', () => {
    stack(swoop());
    const hp = state.players[0].health;

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

    expect(state.players[0].health).toBeLessThan(hp);
    expect(stunned(state.players[0])).toBe(1);
    expect(addStatusLogs()).toHaveLength(1);
  });

  it('2. hero defends and DEF reduces the damage to 0: nobody is stunned', () => {
    stack(swoop());
    const hero = state.players[0];
    hero.activeFormCard = { ...(hero.hero as any), defense: 9 };
    const hp = hero.health;

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'HERO_IF_READY');

    expect(state.lastCombatOutcome?.finalDamage).toBe(0);
    expect(hero.health).toBe(hp);
    expect(stunned(hero)).toBe(0);
    expect(addStatusLogs()).toHaveLength(0);
  });

  it('3. Tough absorbs all the damage: no stun, Tough is consumed', () => {
    stack(swoop());
    const hero = state.players[0];
    hero.statusCards.push(StatusCard.TOUGH);
    const hp = hero.health;

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

    expect(hero.health).toBe(hp);
    expect(hero.statusCards).not.toContain(StatusCard.TOUGH);
    expect(stunned(hero)).toBe(0);
  });

  it('4. an ally defends and takes damage: the ally is stunned, the hero is not', () => {
    stack(swoop());
    const ally = sturdyAlly();
    state.players[0].allies.push(ally);

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'ALLY_CHUMP_BLOCK');

    expect(ally.tokens?.damage ?? 0).toBeGreaterThan(0);
    expect(stunned(ally)).toBe(1);
    expect(stunned(state.players[0])).toBe(0);
  });

  it('4b. a Tough ally absorbs the damage: the ally is not stunned', () => {
    stack(swoop());
    const ally = sturdyAlly();
    ally.statusCards = [StatusCard.TOUGH];
    state.players[0].allies.push(ally);

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'ALLY_CHUMP_BLOCK');

    expect(ally.tokens?.damage ?? 0).toBe(0);
    expect(stunned(ally)).toBe(0);
    expect(stunned(state.players[0])).toBe(0);
  });

  it('5. the defending ally leaves play before damage: the attack is undefended and the identity is stunned', () => {
    stack(swoop());
    const ally = sturdyAlly();
    const hero = state.players[0];
    hero.allies.push(ally);
    const ctx = startAttack({ type: 'ALLY', playerId: 'p1', allyInstanceId: ally.instanceId });

    step4_and_5_dealAndResolveBoostCards(state, ctx);
    // An earlier boost ability defeated the defender.
    hero.allies = [];
    step6_calculateAndApplyAttackDamage(state, ctx);

    expect(ctx.defender?.type).toBe('UNDEFENDED');
    expect(stunned(hero)).toBe(1);
    expect(stunned(ally)).toBe(0);
  });

  it('5b. the damage defeats the defending ally: nothing to stun, no error, hero not stunned', () => {
    stack(swoop());
    const ally = sturdyAlly(1);
    state.players[0].allies.push(ally);

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'ALLY_CHUMP_BLOCK');

    expect(state.players[0].allies.some((a) => a.instanceId === ally.instanceId)).toBe(false);
    expect(stunned(state.players[0])).toBe(0);
    expect(addStatusLogs()).toHaveLength(0);
  });

  it('5b. the damage defeats the hero: the player is eliminated, the stun is not applied', () => {
    stack(swoop());
    const hero = state.players[0];
    hero.health = 1;

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

    expect(hero.health).toBe(0);
    expect(state.eliminatedPlayers?.map((p) => p.id)).toEqual(['p1']);
    expect(stunned(hero)).toBe(0);
  });

  describe('6. prevention prompt path', () => {
    beforeEach(() => {
      setup(['01010a', '01010b']);
      // Cosmic Flight: prevent up to 3 damage.
      state.players[0].tableau = [createCardInstance(cardCatalog.getCard('01017')!)];
    });

    const attackUntilPrompt = () => {
      // Two boost cards (Swoop and a 2-icon card): 4 damage, so Cosmic Flight leaves 1.
      state.villain.card = { ...state.villain.card, additionalBoostCards: 1 } as any;
      stack(swoop(), filler('two', 2));
      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED', {
        acceptOptionalTriggers: false,
      });
      expect(peekDecisionPrompt(state)).toBeDefined();
      expect(stunned(state.players[0])).toBe(0);
    };

    it('prevent part of the damage: the hero is stunned once after the prompt resolves', () => {
      attackUntilPrompt();
      const yes = peekDecisionPrompt(state)!.options.find((o) => o.label === 'Yes')!.id;

      const res = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: yes,
      });

      expect(res.state.lastCombatOutcome!.finalDamage).toBeGreaterThan(0);
      expect(stunned(res.state.players[0])).toBe(1);
      expect(res.state.log.filter((l) => l.key === 'card.effect.addStatus')).toHaveLength(1);
    });

    it('decline the prevention: the hero is stunned once', () => {
      attackUntilPrompt();

      const res = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'pass',
      });

      expect(stunned(res.state.players[0])).toBe(1);
      expect(res.state.log.filter((l) => l.key === 'card.effect.addStatus')).toHaveLength(1);
    });
  });

  it('7. two copies revealed on one activation: two stuns resolve, the second is a no-op, no crash', () => {
    state.villain.card = { ...state.villain.card, additionalBoostCards: 1 } as any;
    stack(swoop(), swoop());

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

    expect(addStatusLogs()).toHaveLength(2);
    expect(stunned(state.players[0])).toBe(1);
  });

  it('8. outside an attack the gate is closed and the step is skipped', () => {
    const ability = cardCatalog
      .getCard('01168')!
      .enrichment!.abilities!.find((a) => a.timing === 'BOOST')!;

    executeEffect(state, ability, { playerId: 'p1' });

    expect(stunned(state.players[0])).toBe(0);
    expect(addStatusLogs()).toHaveLength(0);
  });

  describe('9. data and schema', () => {
    const card = () => cardCatalog.getCard('01168')!;

    it('01168 carries the boost ability with the new gate and selector', () => {
      const boost = card().enrichment!.abilities!.find((a) => a.timing === 'BOOST') as CardAbility;
      expect(boost).toBeDefined();
      expect(CardAbilitySchema.safeParse(boost).success).toBe(true);
      expect(boost.steps).toHaveLength(1);
      expect(boost.steps![0].effect).toBe('ADD_STATUS');
      expect(boost.steps![0].gate).toBe('IF_ACTIVATION_DEALT_DAMAGE');
      expect(boost.steps![0].effectParams).toEqual({
        status: 'STUNNED',
        target: 'DAMAGED_CHARACTER',
      });
    });

    it('is fully reviewed: confidence 95 and no ambiguity file', () => {
      const audit = card().enrichment!.audit as { confidence?: number; ambiguityFile?: string };
      expect(audit.confidence).toBe(95);
      expect(audit.ambiguityFile).toBeUndefined();
      expect(
        fs.existsSync(
          path.resolve(__dirname, '../../docs/ambiguities/core_encounter_01168_sweeping-swoop.md'),
        ),
      ).toBe(false);
    });

    it('the schema enums include the gate and the selector', () => {
      expect(ConditionGateSchema.options).toContain('IF_ACTIVATION_DEALT_DAMAGE');
      expect(TargetSelectorSchema.options).toContain('DAMAGED_CHARACTER');
    });
  });
});
