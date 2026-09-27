import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard, MinionCard, AllyCard, CardInstance } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { getEligibleTargets } from '@engine/effects/target-resolver';
import { canPlayCard } from '@engine/pipeline/legality-checker';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';

describe('Systemic CHOSEN_* Entity Targeting Pipeline (Fixes #146)', () => {
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;
  });

  function makeCard(card: any, instanceId: string): CardInstance {
    const inst = createCardInstance(card);
    inst.instanceId = instanceId;
    return inst;
  }

  const createTwoPlayerGame = () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
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
    state.players[1].activeFormCard = ironManHero;
    return state;
  };

  describe('1. Target Candidate Extraction & Filter Options (getEligibleTargets)', () => {
    it('CHOSEN_CHARACTER unfiltered returns all heroes, alter-egos, allies, minions, and villain', () => {
      const state = createTwoPlayerGame();
      // Add ally to p1
      const blackCatCard = cardCatalog.getCard('01002') as AllyCard;
      const ally = makeCard(blackCatCard, 'black_cat_1');
      state.players[0].allies.push(ally);

      // Add minion to p2
      const hydraCard = cardCatalog.getCard('01098') as MinionCard;
      const minion = makeCard(hydraCard, 'hydra_1');
      state.players[1].engagedMinions.push(minion);

      const targets = getEligibleTargets(state, state.players[0], 'CHOSEN_CHARACTER');
      const targetIds = targets.map((t) => t.id);

      expect(targetIds).toContain('p1');
      expect(targetIds).toContain('p2');
      expect(targetIds).toContain('black_cat_1');
      expect(targetIds).toContain('hydra_1');
      expect(targetIds).toContain(state.villain.instanceId || 'villain');
      expect(targets.length).toBe(5);
    });

    it('CHOSEN_CHARACTER with damaged: true returns only characters with sustained damage', () => {
      const state = createTwoPlayerGame();
      const blackCatCard = cardCatalog.getCard('01002') as AllyCard;
      const ally = makeCard(blackCatCard, 'black_cat_1');
      ally.tokens = { damage: 1 };
      state.players[0].allies.push(ally);

      // Both players start full HP; injure p2
      state.players[1].health = 5; // Max is 9

      const targets = getEligibleTargets(state, state.players[0], 'CHOSEN_CHARACTER', {
        damaged: true,
      });
      const targetIds = targets.map((t) => t.id);

      expect(targetIds).toContain('p2');
      expect(targetIds).toContain('black_cat_1');
      expect(targetIds).not.toContain('p1');
      expect(targets.length).toBe(2);
    });

    it('CHOSEN_ALLY with exhausted: true returns only exhausted allies', () => {
      const state = createTwoPlayerGame();
      const blackCat = makeCard(cardCatalog.getCard('01002') as AllyCard, 'cat_1');
      blackCat.exhausted = true;
      state.players[0].allies.push(blackCat);

      const daredevil = makeCard(cardCatalog.getCard('01011') as AllyCard, 'dd_1');
      daredevil.exhausted = false;
      state.players[1].allies.push(daredevil);

      const allAllies = getEligibleTargets(state, state.players[0], 'CHOSEN_ALLY');
      expect(allAllies.length).toBe(2);

      const exhaustedAllies = getEligibleTargets(state, state.players[0], 'CHOSEN_ALLY', {
        exhausted: true,
      });
      expect(exhaustedAllies.length).toBe(1);
      expect(exhaustedAllies[0].id).toBe('cat_1');
    });

    it('CHOSEN_MINION returns only engaged minions across table, excluding villain', () => {
      const state = createTwoPlayerGame();
      const hydra = makeCard(cardCatalog.getCard('01098') as MinionCard, 'hydra_1');
      state.players[1].engagedMinions.push(hydra);

      const targets = getEligibleTargets(state, state.players[0], 'CHOSEN_MINION');
      expect(targets.length).toBe(1);
      expect(targets[0].id).toBe('hydra_1');
      if (targets[0].kind === 'character') {
        expect(targets[0].entityType).toBe('minion');
      }
    });

    it('CHOSEN_PLAYER returns all players in the game', () => {
      const state = createTwoPlayerGame();
      const targets = getEligibleTargets(state, state.players[0], 'CHOSEN_PLAYER');
      expect(targets.length).toBe(2);
      expect(targets.map((t) => t.id)).toEqual(['p1', 'p2']);
    });
  });

  describe('2. Pre-Play Legality Gate (canPlayCard & canInitiateAbility)', () => {
    it('First Aid cannot be played when all characters are at full health', () => {
      const state = createTwoPlayerGame();
      const firstAidCard = cardCatalog.getCard('01086')!;
      const firstAidInst = makeCard(firstAidCard, 'fa_1');
      state.players[0].hand = [firstAidInst];

      // Give player plenty of resources
      const doubleRes = makeCard(cardCatalog.getCard('01088')!, 'res_1');
      state.players[0].hand.push(doubleRes);

      const check = canPlayCard(state, 'p1', 'fa_1', ['res_1']);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('No character has sustained damage to heal');
    });

    it('First Aid can be played when at least one character is damaged', () => {
      const state = createTwoPlayerGame();
      const firstAidCard = cardCatalog.getCard('01086')!;
      const firstAidInst = makeCard(firstAidCard, 'fa_1');
      const doubleRes = makeCard(cardCatalog.getCard('01088')!, 'res_1');
      state.players[0].hand = [firstAidInst, doubleRes];

      // Injure player 2
      state.players[1].health = 6;

      const check = canPlayCard(state, 'p1', 'fa_1', ['res_1']);
      expect(check.allowed).toBe(true);
    });

    it('Get Ready cannot be played when no ally is exhausted', () => {
      const state = createTwoPlayerGame();
      const getReadyCard = cardCatalog.getCard('01069')!;
      const getReadyInst = makeCard(getReadyCard, 'gr_1');
      const doubleRes = makeCard(cardCatalog.getCard('01088')!, 'res_1');
      state.players[0].hand = [getReadyInst, doubleRes];

      // In-play ally is NOT exhausted
      const ally = makeCard(cardCatalog.getCard('01002') as AllyCard, 'cat_1');
      ally.exhausted = false;
      state.players[0].allies.push(ally);

      const check = canPlayCard(state, 'p1', 'gr_1', ['res_1']);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('No ally is exhausted to ready');
    });

    it('Get Ready can be played when an ally is exhausted', () => {
      const state = createTwoPlayerGame();
      const getReadyCard = cardCatalog.getCard('01069')!;
      const getReadyInst = makeCard(getReadyCard, 'gr_1');
      const doubleRes = makeCard(cardCatalog.getCard('01088')!, 'res_1');
      state.players[0].hand = [getReadyInst, doubleRes];

      // In-play ally is exhausted
      const ally = makeCard(cardCatalog.getCard('01002') as AllyCard, 'cat_1');
      ally.exhausted = true;
      state.players[0].allies.push(ally);

      const check = canPlayCard(state, 'p1', 'gr_1', ['res_1']);
      expect(check.allowed).toBe(true);
    });
  });

  describe('3. First Aid Play Resolution (Issue #146 Core)', () => {
    it('heals specified teammate hero when targetInstanceId is provided', () => {
      const state = createTwoPlayerGame();
      const firstAidCard = cardCatalog.getCard('01086')!;
      const firstAidInst = makeCard(firstAidCard, 'fa_1');
      const resCard = makeCard(cardCatalog.getCard('01088')!, 'res_1');
      state.players[0].hand = [firstAidInst, resCard];

      // p1 damaged: 8/10 HP. p2 damaged: 5/9 HP.
      state.players[0].health = 8;
      state.players[1].health = 5;

      // Player 1 plays First Aid targeting player 2 ('p2')
      const actionResult = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: 'fa_1',
        paymentCardInstanceIds: ['res_1'],
        targetInstanceId: 'p2',
      });

      expect(actionResult.result.success).toBe(true);
      // p2 healed from 5 to 7 HP (+2)
      expect(actionResult.state.players[1].health).toBe(7);
      // p1 was NOT healed (remains at 8)
      expect(actionResult.state.players[0].health).toBe(8);
    });

    it('heals specified ally when targetInstanceId is provided', () => {
      const state = createTwoPlayerGame();
      const firstAidCard = cardCatalog.getCard('01086')!;
      const firstAidInst = makeCard(firstAidCard, 'fa_1');
      const resCard = makeCard(cardCatalog.getCard('01088')!, 'res_1');
      state.players[0].hand = [firstAidInst, resCard];

      // Ally has 3 damage
      const blackCat = makeCard(cardCatalog.getCard('01002') as AllyCard, 'cat_1');
      blackCat.tokens = { damage: 3 };
      state.players[0].allies.push(blackCat);

      const actionResult = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: 'fa_1',
        paymentCardInstanceIds: ['res_1'],
        targetInstanceId: 'cat_1',
      });

      expect(actionResult.result.success).toBe(true);
      expect(actionResult.state.players[0].allies[0].tokens?.damage).toBe(1);
    });
  });

  describe('4. Pipeline Decision Prompt Fallback (Edge Cases)', () => {
    it('enqueues decision prompt when First Aid is played without target and multiple characters are damaged', () => {
      const state = createTwoPlayerGame();
      const firstAidCard = cardCatalog.getCard('01086')!;
      const firstAidInst = makeCard(firstAidCard, 'fa_1');
      const resCard = makeCard(cardCatalog.getCard('01088')!, 'res_1');
      state.players[0].hand = [firstAidInst, resCard];

      // Both players are damaged
      state.players[0].health = 7;
      state.players[1].health = 5;

      // Play First Aid with NO targetInstanceId
      const actionResult = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: 'fa_1',
        paymentCardInstanceIds: ['res_1'],
      });

      expect(actionResult.result.success).toBe(true);
      // Prompt should be enqueued
      expect(actionResult.state.pendingDecisionQueue?.length).toBe(1);
      const prompt = actionResult.state.pendingDecisionQueue![0];
      expect(prompt.options.length).toBe(2);
      expect(prompt.options.map((o) => o.id)).toContain('p1');
      expect(prompt.options.map((o) => o.id)).toContain('p2');

      // Now resolve the prompt choosing p2
      const promptRes = dispatchAction(actionResult.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'p2',
      });

      expect(promptRes.result.success).toBe(true);
      expect(promptRes.state.players[1].health).toBe(7); // Healed 5 -> 7
      expect(promptRes.state.players[0].health).toBe(7); // Unchanged
    });

    it('auto-targets the single damaged character when only 1 is damaged and target was omitted', () => {
      const state = createTwoPlayerGame();
      const firstAidCard = cardCatalog.getCard('01086')!;
      const firstAidInst = makeCard(firstAidCard, 'fa_1');
      const resCard = makeCard(cardCatalog.getCard('01088')!, 'res_1');
      state.players[0].hand = [firstAidInst, resCard];

      // Only p2 is damaged; p1 is full
      state.players[0].health = 10;
      state.players[1].health = 4;

      const actionResult = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: 'fa_1',
        paymentCardInstanceIds: ['res_1'],
      });

      expect(actionResult.result.success).toBe(true);
      // No prompt needed: auto-bound to single damaged character
      expect(actionResult.state.pendingDecisionQueue?.length || 0).toBe(0);
      expect(actionResult.state.players[1].health).toBe(6); // 4 + 2
    });
  });

  describe('5. Get Ready (CHOSEN_ALLY) & Helicarrier (CHOSEN_PLAYER) Multiplayer Targeting', () => {
    it('Get Ready readies the specified ally across players', () => {
      const state = createTwoPlayerGame();
      const getReadyCard = cardCatalog.getCard('01069')!;
      const getReadyInst = makeCard(getReadyCard, 'gr_1');
      state.players[0].hand = [getReadyInst];

      // Ally controlled by p2 is exhausted
      const daredevil = makeCard(cardCatalog.getCard('01011') as AllyCard, 'dd_1');
      daredevil.exhausted = true;
      state.players[1].allies.push(daredevil);

      const actionResult = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: 'gr_1',
        paymentCardInstanceIds: [],
        targetInstanceId: 'dd_1',
      });

      expect(actionResult.result.success).toBe(true);
      expect(actionResult.state.players[1].allies[0].exhausted).toBe(false);
    });

    it('Helicarrier reduces the resource cost for the chosen player in multiplayer', () => {
      const state = createTwoPlayerGame();
      const helicarrierCard = cardCatalog.getCard('01092')!;
      const heliInst = makeCard(helicarrierCard, 'heli_1');
      state.players[0].tableau.push(heliInst);

      // Player 1 activates Helicarrier targeting player 2 ('p2')
      const actionResult = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: 'heli_1',
        abilityId: 'helicarrier_action',
        targetInstanceId: 'p2',
      });

      expect(actionResult.result.success).toBe(true);
      expect(actionResult.state.players[1].costReductions).toBe(1);
      expect(actionResult.state.players[0].costReductions || 0).toBe(0);
    });

    it('Helicarrier enqueues decision prompt in multiplayer when target is omitted', () => {
      const state = createTwoPlayerGame();
      const helicarrierCard = cardCatalog.getCard('01092')!;
      const heliInst = makeCard(helicarrierCard, 'heli_1');
      state.players[0].tableau.push(heliInst);

      const actionResult = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: 'heli_1',
        abilityId: 'helicarrier_action',
      });

      expect(actionResult.result.success).toBe(true);
      expect(actionResult.state.pendingDecisionQueue?.length).toBe(1);
      expect(actionResult.state.pendingDecisionQueue![0].options.map((o) => o.id)).toEqual([
        'reduce_cost_p1',
        'reduce_cost_p2',
      ]);
    });
  });

  describe('6. Relentless Assault (CHOSEN_MINION) Minion-Only Targeting Enforcement', () => {
    it('fails initiation when attempting to attack the Villain with Relentless Assault', () => {
      const state = createTwoPlayerGame();
      const relentlessCard = cardCatalog.getCard('01053')!;
      const relentlessInst = makeCard(relentlessCard, 'ra_1');
      const doubleRes = makeCard(cardCatalog.getCard('01088')!, 'res_1');
      state.players[0].hand = [relentlessInst, doubleRes];

      // No minions in play
      const check = canPlayCard(state, 'p1', 'ra_1', ['res_1']);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('requires a minion in play');
    });
  });
});
