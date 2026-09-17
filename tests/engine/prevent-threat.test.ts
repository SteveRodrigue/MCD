import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardAbility, AbilityStep } from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/index';
import { dispatchTrigger, formatAbilityStepsSummary } from '@engine/triggers/trigger-dispatcher';
import { executeEffect } from '@engine/effects';

describe('PREVENT_THREAT Primitive Acceptance & Contract Tests (Issue #123, ADR-0063)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let sheHulkHero: HeroCard;
  let jenniferWaltersAlterEgo: AlterEgoCard;

  beforeEach(() => {
    resetInstanceCounter();

    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    sheHulkHero = cardCatalog.getCard('01019a') as HeroCard;
    jenniferWaltersAlterEgo = cardCatalog.getCard('01019b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[0].hand = [];
  });

  describe('Contract 1: Emergency (01085) Partial Threat Prevention', () => {
    it('intercepts THREAT_WOULD_BE_PLACED, reduces impending threat from 3 to 2, and discards itself', () => {
      const emergencyCard = cardCatalog.getCard('01085')!;
      const emergencyInst = createCardInstance(emergencyCard);
      state.players[0].hand = [emergencyInst];

      const res = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
        acceptOptionalTriggers: true,
      });

      expect(res.threatAmount).toBe(2);
      expect(
        res.state.players[0].discard.some((c) => c.instanceId === emergencyInst.instanceId),
      ).toBe(true);
      expect(res.state.players[0].hand).not.toContain(emergencyInst);
    });
  });

  describe('Contract 2: Great Responsibility (01061) Full Threat Prevention & Dynamic Scalar Binding', () => {
    it('intercepts THREAT_WOULD_BE_PLACED, completely reduces threat from 4 to 0, deals 4 damage to hero, and discards itself', () => {
      state.players[0].health = 10;
      const grCard = cardCatalog.getCard('01061')!;
      const grInst = createCardInstance(grCard);
      state.players[0].hand = [grInst];

      const res = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 4,
        acceptOptionalTriggers: true,
      });

      expect(res.threatAmount).toBe(0);
      expect(res.state.players[0].health).toBe(6); // 10 - 4 = 6
      expect(res.state.players[0].discard.some((c) => c.instanceId === grInst.instanceId)).toBe(
        true,
      );
      expect(res.state.players[0].hand).not.toContain(grInst);
    });
  });

  describe('Contract 3: Jennifer Walters (01019b) Form Gating & Turn Limits', () => {
    beforeEach(() => {
      state.players[0].hero = sheHulkHero;
      state.players[0].alterEgo = jenniferWaltersAlterEgo;
      state.players[0].activeFormCard = jenniferWaltersAlterEgo;
      state.players[0].currentForm = 'alter_ego';
    });

    it('prevents 1 threat in Alter-Ego form and enforces ONCE_PER_ROUND limit', () => {
      const firstRes = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
        acceptOptionalTriggers: true,
      });

      expect(firstRes.threatAmount).toBe(2);
      expect(firstRes.state.players[0].usedAbilitiesThisRound?.['jennifer_walters_thwart']).toBe(1);

      // Second attempt in the same round cannot trigger
      const secondRes = dispatchTrigger(firstRes.state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
        acceptOptionalTriggers: true,
      });

      expect(secondRes.threatAmount).toBe(3);
    });

    it('does not trigger in Hero form', () => {
      state.players[0].currentForm = 'hero';
      state.players[0].activeFormCard = sheHulkHero;

      const res = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
        acceptOptionalTriggers: true,
      });

      expect(res.threatAmount).toBe(3);
    });
  });

  describe('Contract 4: Domain Isolation Invariant', () => {
    it('PREVENT_DAMAGE does NOT reduce threat when dispatched in a threat context', () => {
      const damagePreventAbility: CardAbility = {
        id: 'test_damage_prevent',
        timing: 'INTERRUPT',
        trigger: 'THREAT_WOULD_BE_PLACED',
        steps: [
          {
            id: 'prevent_dmg',
            effect: 'PREVENT_DAMAGE',
            effectParams: { amount: 2 },
          },
        ],
      };

      const effCtx = {
        playerId: 'p1',
        threatAmount: 5,
        interceptedValue: 5,
      };

      const res = executeEffect(state, damagePreventAbility, effCtx);
      expect(res.success).toBe(true);
      // threatAmount must remain unchanged by PREVENT_DAMAGE
      expect(effCtx.threatAmount).toBe(5);
    });

    it('PREVENT_THREAT does NOT reduce damage when dispatched in a damage context', () => {
      const threatPreventAbility: CardAbility = {
        id: 'test_threat_prevent',
        timing: 'INTERRUPT',
        trigger: 'DAMAGE_WOULD_BE_TAKEN',
        steps: [
          {
            id: 'prevent_thrt',
            effect: 'PREVENT_THREAT',
            effectParams: { amount: 3 },
          },
        ],
      };

      const effCtx = {
        playerId: 'p1',
        damageAmount: 6,
        interceptedValue: 6,
      };

      const res = executeEffect(state, threatPreventAbility, effCtx);
      expect(res.success).toBe(true);
      // damageAmount must remain unchanged by PREVENT_THREAT
      expect(effCtx.damageAmount).toBe(6);
    });
  });

  describe('Contract 5: Boundary Conditions', () => {
    it('handles 0 impending threat gracefully without negative values', () => {
      const threatStep: AbilityStep = {
        id: 'prevent_thrt',
        effect: 'PREVENT_THREAT',
        effectParams: { amount: 2 },
      };

      const effCtx = {
        playerId: 'p1',
        threatAmount: 0,
        interceptedValue: 0,
      };

      const res = executeEffect(state, threatStep, effCtx);
      expect(res.success).toBe(true);
      expect(res.value).toBe(0);
      expect(effCtx.threatAmount).toBe(0);
    });

    it('clamps consumed amount to impending threat when amount exceeds impending threat', () => {
      const threatStep: AbilityStep = {
        id: 'prevent_thrt',
        effect: 'PREVENT_THREAT',
        effectParams: { amount: 5 },
      };

      const effCtx = {
        playerId: 'p1',
        threatAmount: 2,
        interceptedValue: 2,
      };

      const res = executeEffect(state, threatStep, effCtx);
      expect(res.success).toBe(true);
      expect(res.value).toBe(2); // Only consumed 2
      expect(effCtx.threatAmount).toBe(0); // Threat reduced to 0
    });
  });

  describe('Contract 6: Decision Prompt Copy & Summary Formatting', () => {
    it('formats summary copy as PREVENT_THREAT (1) for Emergency', () => {
      const emergencyCard = cardCatalog.getCard('01085')!;
      const summary = formatAbilityStepsSummary(
        'THREAT_WOULD_BE_PLACED',
        emergencyCard.enrichment?.abilities?.[0].steps || [],
      );
      expect(summary).toContain('PREVENT_THREAT (1)');
    });

    it('formats summary copy as PREVENT_THREAT (ALL) for Great Responsibility', () => {
      const grCard = cardCatalog.getCard('01061')!;
      const summary = formatAbilityStepsSummary(
        'THREAT_WOULD_BE_PLACED',
        grCard.enrichment?.abilities?.[0].steps || [],
      );
      expect(summary).toContain('PREVENT_THREAT (ALL)');
    });

    it('renders PREVENT_THREAT (1) in pending decision prompt description when optional trigger is prompted', () => {
      const emergencyCard = cardCatalog.getCard('01085')!;
      const emergencyInst = createCardInstance(emergencyCard);
      state.players[0].hand = [emergencyInst];

      const res = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
        acceptOptionalTriggers: false,
      });

      expect(res.hasPendingPrompt).toBe(true);
      expect(res.state.pendingDecisionPrompt).toBeDefined();
      expect(res.state.pendingDecisionPrompt?.description).toContain('PREVENT_THREAT (1)');
    });
  });
});
