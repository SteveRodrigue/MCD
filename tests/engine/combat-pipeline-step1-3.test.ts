import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  dispatchAction,
  initiateEnemyAttack,
  resolveDefenderDeclaration,
  executeEnemyAttackSynchronously,
} from '@engine/pipeline';

describe('Sub-Milestone 2B-1: Core Combat Lifecycle & Defender Declaration Engine', () => {
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
          name: 'Spider-Man',
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
  });

  describe('Step 1: Pre-Attack & Status Intercepts', () => {
    it('clears Stun from villain and cancels attack without dealing damage or boost cards', () => {
      state.villain.statusCards.push(StatusCard.STUNNED);
      const initialHp = state.players[0].health;
      const initialEncounterDiscard = state.encounterDiscard.length;

      const nextState = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');

      expect(nextState.villain.statusCards).not.toContain(StatusCard.STUNNED);
      expect(nextState.players[0].health).toBe(initialHp);
      expect(nextState.encounterDiscard.length).toBe(initialEncounterDiscard);
      expect(nextState.pendingDecisionPrompt).toBeUndefined();
    });

    it('triggers Webbed Up attachment: discards attachment, stuns villain, and cancels attack', () => {
      const webbedUpCard = cardCatalog.getCard('01009')!;
      const webbedUpInst = createCardInstance(webbedUpCard);
      state.villain.attachments.push(webbedUpInst);

      const initialHp = state.players[0].health;

      const nextState = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');

      expect(nextState.villain.attachments).not.toContain(webbedUpInst);
      expect(nextState.players[0].discard.some((c) => c.card.code === '01009')).toBe(true);
      expect(nextState.villain.statusCards).toContain(StatusCard.STUNNED);
      expect(nextState.players[0].health).toBe(initialHp);
    });
  });

  describe('Step 2: Attack Initiation Triggers', () => {
    it('triggers Spider-Sense (01001a) to draw 1 card BEFORE defender declaration', () => {
      const initialHandSize = state.players[0].hand.length;

      const nextState = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1', {
        acceptOptionalTriggers: true,
      });

      // Spider-Sense draws 1 card
      expect(nextState.players[0].hand.length).toBe(initialHandSize + 1);
      // And then opens Step 3 DECLARE_DEFENDER prompt
      expect(nextState.pendingDecisionPrompt).toBeDefined();
      expect(nextState.pendingDecisionPrompt?.title).toContain('Enemy Attack: Rhino');
    });
  });

  describe('Step 3: Defender Declaration & Step 6 Damage Mitigation', () => {
    it('enqueues DECLARE_DEFENDER prompt with Hero Defend, Ready Allies, and Take Undefended options', () => {
      const daredevilCard = cardCatalog.getCard('01058')!;
      const daredevilInst = createCardInstance(daredevilCard);
      state.players[0].allies.push(daredevilInst);

      const nextState = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1', {
        acceptOptionalTriggers: true,
      });

      expect(nextState.pendingDecisionPrompt).toBeDefined();
      const options = nextState.pendingDecisionPrompt!.options;

      expect(options.some((o) => o.id === 'defend_hero')).toBe(true);
      expect(options.some((o) => o.id.includes('defend_ally_'))).toBe(true);
      expect(options.some((o) => o.id === 'undefended')).toBe(true);
    });

    it('resolves Basic Hero Defend: exhausts Hero, mitigates attack with Hero.DEF, and sets heroDefended', () => {
      // Spider-Man base DEF = 3, Rhino base ATK = 2
      const initialHp = state.players[0].health;
      expect(state.players[0].exhausted).toBe(false);

      // Force top of encounter deck to have a card with 0 boost icons for predictable testing
      const zeroBoostCard = cardCatalog.getCard('01097b')!; // or another card with 0 boost
      state.encounterDeck = [createCardInstance(zeroBoostCard), ...state.encounterDeck];

      const s1 = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');

      // Player chooses Hero Defend
      const s2 = resolveDefenderDeclaration(s1, {
        type: 'HERO',
        playerId: 'p1',
      });

      expect(s2.players[0].exhausted).toBe(true);
      // Rhino ATK (2) - Spider-Man DEF (3) = 0 damage taken
      expect(s2.players[0].health).toBe(initialHp);
    });

    it('resolves Ally Defend: exhausts Ally and ally absorbs incoming damage up to its HP', () => {
      const daredevilCard = cardCatalog.getCard('01058')!; // Daredevil HP = 3
      const daredevilInst = createCardInstance(daredevilCard);
      state.players[0].allies.push(daredevilInst);

      const initialHeroHp = state.players[0].health;

      // Force 0 boost card
      const zeroBoostCard = cardCatalog.getCard('01097b')!;
      state.encounterDeck = [createCardInstance(zeroBoostCard), ...state.encounterDeck];

      const s1 = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');

      // Player chooses Daredevil Ally Defend
      const s2 = resolveDefenderDeclaration(s1, {
        type: 'ALLY',
        playerId: 'p1',
        allyInstanceId: daredevilInst.instanceId,
      });

      // Hero takes no damage and is not exhausted
      expect(s2.players[0].health).toBe(initialHeroHp);
      expect(s2.players[0].exhausted).toBe(false);

      // Ally takes 2 damage from Rhino and is exhausted
      expect(daredevilInst.exhausted).toBe(true);
      expect(daredevilInst.tokens?.damage).toBe(2);
    });

    it('resolves Take Undefended: Hero takes full attack damage without DEF mitigation', () => {
      const initialHp = state.players[0].health;

      // Force 0 boost card
      const zeroBoostCard = cardCatalog.getCard('01097b')!;
      state.encounterDeck = [createCardInstance(zeroBoostCard), ...state.encounterDeck];

      const s1 = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');

      // Player chooses Take Undefended
      const s2 = resolveDefenderDeclaration(s1, {
        type: 'UNDEFENDED',
        playerId: 'p1',
      });

      expect(s2.players[0].exhausted).toBe(false);
      // Rhino base ATK (2) dealt directly to Hero
      expect(s2.players[0].health).toBe(initialHp - 2);
    });

    it('executes via dispatchAction with DECLARE_DEFENDER action type', () => {
      const initialHp = state.players[0].health;
      const zeroBoostCard = cardCatalog.getCard('01097b')!;
      state.encounterDeck = [createCardInstance(zeroBoostCard), ...state.encounterDeck];

      const s1 = initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');

      const actionRes = dispatchAction(s1, {
        type: 'DECLARE_DEFENDER',
        playerId: 'p1',
        defenderType: 'HERO',
      });

      expect(actionRes.result.success).toBe(true);
      expect(actionRes.state.players[0].exhausted).toBe(true);
      expect(actionRes.state.players[0].health).toBe(initialHp);
    });
  });

  describe('Step 7: Post-Defense Triggers', () => {
    it('triggers Indomitable (01082) after hero defends to ready hero', () => {
      const indomitableCard = cardCatalog.getCard('01082')!;
      const indomitableInst = createCardInstance(indomitableCard);
      state.players[0].tableau.push(indomitableInst);

      const zeroBoostCard = cardCatalog.getCard('01097b')!;
      state.encounterDeck = [createCardInstance(zeroBoostCard), ...state.encounterDeck];

      // Execute attack with HERO defense
      const finalState = executeEnemyAttackSynchronously(
        state,
        { type: 'VILLAIN' },
        'p1',
        'HERO_IF_READY',
      );

      // Hero defended, so Indomitable triggered and readied the hero
      expect(finalState.players[0].exhausted).toBe(false);
      expect(finalState.players[0].discard.some((c) => c.card.code === '01082')).toBe(true);
    });
  });
});
