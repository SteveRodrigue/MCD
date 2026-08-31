import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  dispatchAction,
  enqueueDecisionPrompt,
  peekDecisionPrompt,
  pushExecutionFrame,
  peekExecutionFrame,
  popExecutionFrame,
} from '@engine/pipeline';
import { executeEffect } from '@engine/effects';
import { dispatchTrigger } from '@engine/triggers/trigger-dispatcher';

describe('Universal Resolution Stack & Decision Prompt Queue (ADR-0032)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let captainMarvelHero: HeroCard;
  let carolDanversAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
    carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Player 2',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
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
    state.players[1].currentForm = 'hero';
    state.players[1].activeFormCard = spiderManHero;
  });

  describe('Prompt Queue Management & FIFO Ordering', () => {
    it('enqueues multiple decision prompts without state overwrite and indexes queue positions', () => {
      expect(state.pendingDecisionQueue).toEqual([]);
      expect(state.pendingDecisionPrompt).toBeUndefined();

      // Enqueue first prompt for Player 1
      state = enqueueDecisionPrompt(state, {
        promptId: 'prompt_1',
        playerId: 'p1',
        title: 'Choice 1',
        description: 'First player choice',
        sourceCardName: 'Tactical Card 1',
        options: [{ id: 'opt_1a', label: 'Option 1A', effect: 'RESOLVED' }],
      });

      expect(state.pendingDecisionQueue?.length).toBe(1);
      expect(peekDecisionPrompt(state)?.promptId).toBe('prompt_1');
      expect(state.pendingDecisionPrompt?.promptId).toBe('prompt_1');
      expect(state.pendingDecisionQueue?.[0].queuePosition).toBe(1);
      expect(state.pendingDecisionQueue?.[0].totalQueued).toBe(1);

      // Enqueue second prompt for Player 2
      state = enqueueDecisionPrompt(state, {
        promptId: 'prompt_2',
        playerId: 'p2',
        title: 'Choice 2',
        description: 'Second player choice',
        sourceCardName: 'Tactical Card 2',
        options: [{ id: 'opt_2a', label: 'Option 2A', effect: 'RESOLVED' }],
      });

      expect(state.pendingDecisionQueue?.length).toBe(2);
      expect(state.pendingDecisionQueue?.[0].queuePosition).toBe(1);
      expect(state.pendingDecisionQueue?.[0].totalQueued).toBe(2);
      expect(state.pendingDecisionQueue?.[1].queuePosition).toBe(2);
      expect(state.pendingDecisionQueue?.[1].totalQueued).toBe(2);
      // Head of queue remains prompt_1
      expect(peekDecisionPrompt(state)?.promptId).toBe('prompt_1');

      // Player 1 resolves their prompt
      const res1 = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'opt_1a',
      });

      expect(res1.result.success).toBe(true);
      // Now head of queue is prompt_2
      expect(res1.state.pendingDecisionQueue?.length).toBe(1);
      expect(peekDecisionPrompt(res1.state)?.promptId).toBe('prompt_2');
      expect(res1.state.pendingDecisionPrompt?.promptId).toBe('prompt_2');
      expect(res1.state.pendingDecisionQueue?.[0].queuePosition).toBe(1);
      expect(res1.state.pendingDecisionQueue?.[0].totalQueued).toBe(1);

      // Player 2 resolves their prompt
      const res2 = dispatchAction(res1.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p2',
        selectedOptionId: 'opt_2a',
      });

      expect(res2.result.success).toBe(true);
      expect(res2.state.pendingDecisionQueue?.length).toBe(0);
      expect(res2.state.pendingDecisionPrompt).toBeUndefined();
    });

    it('handles voluntary reaction Pass option without mutating game state', () => {
      state = enqueueDecisionPrompt(state, {
        promptId: 'voluntary_prompt',
        playerId: 'p1',
        title: 'Optional Interrupt',
        description: 'Do you want to interrupt?',
        sourceCardName: 'Emergency',
        isVoluntary: true,
        options: [
          { id: 'use_emergency', label: 'Use Emergency', effect: 'REMOVE_THREAT', params: { amount: 1 } },
        ],
      });

      const initialThreat = state.mainScheme.threat;

      // Player chooses to pass
      const res = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'pass',
      });

      expect(res.result.success).toBe(true);
      expect(res.result.onomatopoeia).toBe('PASSED');
      expect(res.state.pendingDecisionPrompt).toBeUndefined();
      expect(res.state.mainScheme.threat).toBe(initialThreat);
    });
  });

  describe('Execution Frame Stack Management', () => {
    it('pushes, peeks, and pops execution frames on the resolution stack', () => {
      expect(state.executionStack).toEqual([]);

      state = pushExecutionFrame(state, {
        id: 'frame_action_1',
        type: 'ACTION',
        sourceCardCode: '01001a',
        playerId: 'p1',
        stepIndex: 0,
        steps: [{ effect: 'DEAL_DAMAGE', params: { amount: 3 } }],
      });

      expect(peekExecutionFrame(state)?.id).toBe('frame_action_1');
      expect(state.executionStack?.length).toBe(1);

      // Push nested interrupt frame
      state = pushExecutionFrame(state, {
        id: 'frame_interrupt_1',
        type: 'INTERRUPT',
        sourceCardCode: '01085',
        playerId: 'p1',
        stepIndex: 0,
        steps: [{ effect: 'REMOVE_THREAT', params: { amount: 1 } }],
      });

      expect(state.executionStack?.length).toBe(2);
      expect(peekExecutionFrame(state)?.id).toBe('frame_interrupt_1');

      // Pop child frame
      const { state: s2, frame: poppedFrame } = popExecutionFrame(state);
      expect(poppedFrame?.id).toBe('frame_interrupt_1');
      expect(peekExecutionFrame(s2)?.id).toBe('frame_action_1');
    });
  });

  describe('Promoted Wave 1 Ambiguity Cards Verification', () => {
    it('01085 Emergency: triggers on THREAT_WOULD_BE_PLACED and reduces threat by 1', () => {
      const emergencyCard = cardCatalog.getCard('01085')!;
      const emergencyInst = createCardInstance(emergencyCard);
      state.players[0].hand.push(emergencyInst);

      const res = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
        targetPlayerId: 'p1',
        threatAmount: 3,
      });

      expect(res.threatAmount).toBe(2);
      expect(res.state.players[0].hand).not.toContain(emergencyInst);
      expect(res.state.players[0].discard.some((c) => c.card.code === '01085')).toBe(true);
    });

    it('01061 Great Responsibility: triggers on THREAT_WOULD_BE_PLACED and converts threat to hero damage', () => {
      const grCard = cardCatalog.getCard('01061')!;
      const grInst = createCardInstance(grCard);
      state.players[0].hand.push(grInst);
      const initialHp = state.players[0].health;

      const ability = grCard.enrichment!.abilities![0];
      const effectRes = executeEffect(state, ability, {
        playerId: 'p1',
        threatAmount: 3,
        sourceCardInstance: grInst,
      });

      expect(effectRes.success).toBe(true);
      expect(effectRes.state.players[0].health).toBe(initialHp - 3);
    });

    it('01078 Get Behind Me!: cancels When Revealed treachery and triggers villain attack', () => {
      const gbmCard = cardCatalog.getCard('01078')!;
      const gbmInst = createCardInstance(gbmCard);
      state.players[0].hand.push(gbmInst);

      const ability = gbmCard.enrichment!.abilities![0];
      const initialHp = state.players[0].health;

      const effectRes = executeEffect(state, ability, {
        playerId: 'p1',
        sourceCardInstance: gbmInst,
      });

      expect(effectRes.success).toBe(true);
      // Villain attacks player (Rhino base ATK = 2)
      expect(effectRes.state.players[0].health).toBeLessThan(initialHp);
    });

    it('01024 One-Two Punch: readies identity after basic attack', () => {
      const otpCard = cardCatalog.getCard('01024')!;
      const otpInst = createCardInstance(otpCard);
      state.players[0].hand.push(otpInst);
      state.players[0].exhausted = true;

      const ability = otpCard.enrichment!.abilities![0];
      const effectRes = executeEffect(state, ability, {
        playerId: 'p1',
        sourceCardInstance: otpInst,
      });

      expect(effectRes.success).toBe(true);
      expect(effectRes.state.players[0].exhausted).toBe(false);
    });

    it('01077 Counter-Punch: deals damage equal to Hero ATK to attacking enemy after defending', () => {
      const cpCard = cardCatalog.getCard('01077')!;
      const cpInst = createCardInstance(cpCard);
      state.players[0].hand.push(cpInst);

      const initialVillainHp = state.villain.health;
      const heroAtk = spiderManHero.attack; // Spider-Man base ATK = 2

      const ability = cpCard.enrichment!.abilities![0];
      const effectRes = executeEffect(state, ability, {
        playerId: 'p1',
        sourceCardInstance: cpInst,
      });

      expect(effectRes.success).toBe(true);
      expect(effectRes.state.villain.health).toBe(initialVillainHp - heroAtk);
    });
  });
});
