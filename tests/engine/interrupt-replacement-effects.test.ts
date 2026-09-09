import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchTrigger } from '@engine/triggers/trigger-dispatcher';
import { resolveDecisionPrompt } from '@engine/pipeline/prompt-queue';
import {
  resolveDefenderDeclaration,
  continueAttackAfterInitiation,
} from '@engine/pipeline/combat-pipeline';

describe('Feature #26 Contract Tests: Interrupt Replacement Effects (01078 & 01061)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

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
      villain: cardCatalog.getCard('01094') as any, // Rhino I (ATK 2)
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[0].hand = [];
  });

  describe('01078 Get Behind Me! (Hero Interrupt @ TREACHERY_REVEALED)', () => {
    it('cancels treachery When Revealed and induces a villain attack when accepted automatically', () => {
      const gbmCard = cardCatalog.getCard('01078')!;
      const gbmInst = createCardInstance(gbmCard);
      state.players[0].hand.push(gbmInst);

      const treacheryCard = cardCatalog.getCard('01103')!; // False Alarm (Rhino treachery)
      const treacheryInst = createCardInstance(treacheryCard);
      state.activeEncounterContext = {
        encounterInstanceId: treacheryInst.instanceId,
        encounterCard: treacheryInst,
        targetPlayerId: 'p1',
      };

      const initialHp = state.players[0].health;

      // Dispatch trigger with acceptOptionalTriggers: true
      let triggerRes = dispatchTrigger(state, 'TREACHERY_REVEALED', {
        targetPlayerId: 'p1',
        encounterCardInstance: treacheryInst,
        acceptOptionalTriggers: true,
      });

      expect(triggerRes.cancelled).toBe(true);
      expect(state.activeEncounterContext.cancelled).toBe(true);
      // Card is discarded as cost
      expect(state.players[0].hand).not.toContain(gbmInst);
      expect(state.players[0].discard.some((c) => c.card.code === '01078')).toBe(true);

      let attackState = triggerRes.state;
      // If Spider-Sense optional interrupt prompts on VILLAIN_INITIATES_ATTACK, pass it and continue attack
      if (attackState.pendingDecisionPrompt?.title?.includes('Spider-Man')) {
        const passRes = resolveDecisionPrompt(attackState, 'p1', 'pass');
        attackState = passRes.state;
        if (attackState.activeAttackContext?.phase === 'INITIATION') {
          attackState = continueAttackAfterInitiation(attackState, attackState.activeAttackContext);
        }
      }

      // Villain attack initiated - pending decision prompt for defender declaration
      expect(attackState.pendingDecisionPrompt).toBeDefined();
      expect(attackState.pendingDecisionPrompt?.title).toContain('Enemy Attack: Rhino');

      // Resolve defender declaration as UNDEFENDED
      const resolvedState = resolveDefenderDeclaration(attackState, {
        type: 'UNDEFENDED',
        playerId: 'p1',
      });

      // Player took damage from Rhino attack
      expect(resolvedState.players[0].health).toBeLessThan(initialHp);
    });

    it('enforces Hero form gating: cannot trigger in Alter-Ego form', () => {
      state.players[0].currentForm = 'alter_ego';
      state.players[0].activeFormCard = peterParkerAlterEgo;

      const gbmCard = cardCatalog.getCard('01078')!;
      const gbmInst = createCardInstance(gbmCard);
      state.players[0].hand.push(gbmInst);

      const treacheryCard = cardCatalog.getCard('01103')!;
      const treacheryInst = createCardInstance(treacheryCard);

      const triggerRes = dispatchTrigger(state, 'TREACHERY_REVEALED', {
        targetPlayerId: 'p1',
        encounterCardInstance: treacheryInst,
        acceptOptionalTriggers: true,
      });

      expect(triggerRes.cancelled).toBeFalsy();
      expect(state.players[0].hand).toContain(gbmInst);
    });
  });

  describe('01061 Great Responsibility (Hero Interrupt @ THREAT_WOULD_BE_PLACED)', () => {
    it('prevents all threat from being placed and deals equal damage to hero when accepted automatically', () => {
      const grCard = cardCatalog.getCard('01061')!;
      const grInst = createCardInstance(grCard);
      state.players[0].hand.push(grInst);

      const initialHp = state.players[0].health;

      const triggerRes = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
        acceptOptionalTriggers: true,
      });

      // Threat redirected to 0
      expect(triggerRes.threatAmount).toBe(0);
      // Hero takes 3 damage
      expect(triggerRes.state.players[0].health).toBe(initialHp - 3);
      // Hand discarded
      expect(triggerRes.state.players[0].hand).not.toContain(grInst);
      expect(triggerRes.state.players[0].discard.some((c) => c.card.code === '01061')).toBe(true);
    });

    it('enforces Hero form gating: cannot trigger in Alter-Ego form', () => {
      state.players[0].currentForm = 'alter_ego';
      state.players[0].activeFormCard = peterParkerAlterEgo;

      const grCard = cardCatalog.getCard('01061')!;
      const grInst = createCardInstance(grCard);
      state.players[0].hand.push(grInst);

      const initialHp = state.players[0].health;

      const triggerRes = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
        acceptOptionalTriggers: true,
      });

      // Threat is NOT prevented
      expect(triggerRes.threatAmount).toBe(3);
      // Hero takes no damage
      expect(triggerRes.state.players[0].health).toBe(initialHp);
      // Card remains in hand
      expect(triggerRes.state.players[0].hand).toContain(grInst);
    });

    it('queues interactive decision prompt when acceptOptionalTriggers is not true, and resolves upon Yes', () => {
      const grCard = cardCatalog.getCard('01061')!;
      const grInst = createCardInstance(grCard);
      state.players[0].hand.push(grInst);

      const initialHp = state.players[0].health;

      const triggerRes = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 4,
      });

      expect(triggerRes.state.pendingDecisionPrompt).toBeDefined();
      expect(triggerRes.state.pendingDecisionPrompt?.sourceCardName).toBe('Great Responsibility');

      const option = triggerRes.state.pendingDecisionPrompt!.options.find(
        (o) => o.label === 'Yes',
      )!;
      const promptRes = resolveDecisionPrompt(triggerRes.state, 'p1', option.id);

      expect(promptRes.state.players[0].health).toBe(initialHp - 4);
      expect(promptRes.state.players[0].hand).not.toContain(grInst);
    });
  });

  describe('01019b Jennifer Walters - I Object! (Alter-Ego Interrupt @ THREAT_WOULD_BE_PLACED)', () => {
    let sheHulkHero: HeroCard;
    let jenniferWaltersAlterEgo: AlterEgoCard;

    beforeEach(() => {
      sheHulkHero = cardCatalog.getCard('01019a') as HeroCard;
      jenniferWaltersAlterEgo = cardCatalog.getCard('01019b') as AlterEgoCard;

      state.players[0].hero = sheHulkHero;
      state.players[0].alterEgo = jenniferWaltersAlterEgo;
      state.players[0].activeFormCard = jenniferWaltersAlterEgo;
      state.players[0].currentForm = 'alter_ego';
    });

    it('prevents 1 threat when threat would be placed in Alter-Ego form', () => {
      const triggerRes = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
        acceptOptionalTriggers: true,
      });

      // 3 threat reduced by 1 to 2 threat
      expect(triggerRes.threatAmount).toBe(2);
      expect(triggerRes.state.players[0].usedAbilitiesThisRound?.['jennifer_walters_thwart']).toBe(
        1,
      );
    });

    it('enforces ONCE_PER_ROUND limit: cannot trigger twice in the same round', () => {
      const firstRes = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
        acceptOptionalTriggers: true,
      });

      expect(firstRes.threatAmount).toBe(2);

      const secondRes = dispatchTrigger(firstRes.state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
        acceptOptionalTriggers: true,
      });

      // Second attempt is not reduced because ability was already used once this round
      expect(secondRes.threatAmount).toBe(3);
    });

    it('does not trigger when in Hero form', () => {
      state.players[0].currentForm = 'hero';
      state.players[0].activeFormCard = sheHulkHero;

      const triggerRes = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
        acceptOptionalTriggers: true,
      });

      expect(triggerRes.threatAmount).toBe(3);
    });
  });
});
