import { describe, it, expect } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { initiateEnemyAttack } from '@engine/pipeline/combat-pipeline';
import { step4_revealEncounterCards } from '@engine/pipeline/villain-phase';
import { dispatchTrigger } from '@engine/triggers/trigger-dispatcher';

const SPIDER_MAN_HERO = '01001a';
const SPIDER_MAN_AE = '01001b';
const SHE_HULK_HERO = '01019a';
const SHE_HULK_AE = '01019b';
const CAPTAIN_MARVEL_HERO = '01010a';
const CAPTAIN_MARVEL_AE = '01010b';

const BACKFLIP = '01003';
const ENHANCED_SPIDER_SENSE = '01004';
const GET_BEHIND_ME = '01078';
const COUNTER_PUNCH = '01077';
const ONE_TWO_PUNCH = '01024';
const FALSE_ALARM = '01112'; // Treachery: When Revealed confuses hero
const RESOURCE_CARD = '01005'; // Swinging Web-Kick, used as 1 resource payment

function createTestGame(
  playerConfigs: { heroCode: string; aeCode: string; handCodes: string[] }[],
  options: { firstPlayerIndex?: number } = {},
): GameState {
  resetInstanceCounter();
  const state = setupGame({
    scenarioId: 'rhino',
    players: playerConfigs.map((cfg, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      hero: cardCatalog.getCard(cfg.heroCode) as HeroCard,
      alterEgo: cardCatalog.getCard(cfg.aeCode) as AlterEgoCard,
      deckCards: Array(10).fill(cardCatalog.getCard(RESOURCE_CARD)!),
    })),
    villain: cardCatalog.getCard('01094') as any,
    mainScheme: cardCatalog.getCard('01097b') as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
    skipScenarioPlugin: true,
  });

  state.players.forEach((p, i) => {
    p.currentForm = 'hero';
    p.activeFormCard = p.hero;
    p.hand = playerConfigs[i].handCodes.map((c) => createCardInstance(cardCatalog.getCard(c)!));
    p.discard = [];
    p.usedAbilitiesThisRound = {};
  });

  if (options.firstPlayerIndex !== undefined) {
    state.firstPlayerIndex = options.firstPlayerIndex;
  }
  state.encounterDeck = [];
  return state;
}

function answerPrompt(
  state: GameState,
  playerId: string,
  optionId: string,
  paymentCardIds?: string[],
): GameState {
  const res = dispatchAction(state, {
    type: 'RESOLVE_DECISION_PROMPT',
    playerId,
    selectedOptionId: optionId,
    paymentCardInstanceIds: paymentCardIds,
  });
  expect(res.result.success).toBe(true);
  return res.state;
}

function acceptPrompt(state: GameState, paymentCardIds?: string[]): GameState {
  const prompt = peekDecisionPrompt(state);
  expect(prompt).toBeDefined();
  const yesOption = prompt!.options.find((o) => o.effect === 'EXECUTE_OPTIONAL_TRIGGER');
  expect(yesOption).toBeDefined();
  return answerPrompt(state, prompt!.playerId, yesOption!.id, paymentCardIds);
}

function passPrompt(state: GameState): GameState {
  const prompt = peekDecisionPrompt(state);
  expect(prompt).toBeDefined();
  return answerPrompt(state, prompt!.playerId, 'pass');
}

/**
 * Initiates an enemy attack against a player and clears any attack-initiation prompts (e.g. Spider-Sense)
 * so tests isolate the damage prevention interrupt window.
 */
function initiateAttackToDefense(state: GameState, targetPlayerId: string): GameState {
  initiateEnemyAttack(state, { type: 'VILLAIN' }, targetPlayerId);
  if (
    peekDecisionPrompt(state)?.options.some(
      (o) => (o.params?.ability as any)?.id === 'spider_sense',
    )
  ) {
    state = passPrompt(state);
  }
  return answerPrompt(state, targetPlayerId, 'undefended');
}

describe('Issue #267: Hand reactions offer all eligible cards in first-player order', () => {
  describe('1. DAMAGE_WOULD_BE_TAKEN (Option B: pendingDamagePlacements)', () => {
    it('queues both copies of Backflip in hand, linked to damagePlacementId', () => {
      let state = createTestGame([
        { heroCode: SPIDER_MAN_HERO, aeCode: SPIDER_MAN_AE, handCodes: [BACKFLIP, BACKFLIP] },
      ]);

      // Rhino (ATK 2) attacks Player 1 undefended
      state = initiateAttackToDefense(state, 'p1');

      // Both copies must be queued
      expect(state.pendingDecisionQueue?.length).toBe(2);
      expect(state.pendingDamagePlacements?.length).toBe(1);

      const placement = state.pendingDamagePlacements![0];
      expect(placement.amount).toBe(2);
      expect(placement.initialAmount).toBe(2);
      expect(placement.sourceType).toBe('ATTACK');

      // Both prompts linked to the same placement
      const p1Opt = state.pendingDecisionQueue![0].options.find(
        (o) => o.effect === 'EXECUTE_OPTIONAL_TRIGGER',
      );
      const p2Opt = state.pendingDecisionQueue![1].options.find(
        (o) => o.effect === 'EXECUTE_OPTIONAL_TRIGGER',
      );
      expect((p1Opt?.params?.context as any)?.damagePlacementId).toBe(placement.id);
      expect((p2Opt?.params?.context as any)?.damagePlacementId).toBe(placement.id);
    });

    it('accepting Backflip copy 1 prevents all damage, prunes copy 2, copy 2 stays in hand', () => {
      let state = createTestGame([
        { heroCode: SPIDER_MAN_HERO, aeCode: SPIDER_MAN_AE, handCodes: [BACKFLIP, BACKFLIP] },
      ]);

      state = initiateAttackToDefense(state, 'p1');
      expect(state.pendingDecisionQueue?.length).toBe(2);

      // Accept copy 1
      state = acceptPrompt(state);

      // Copy 2 should have been pruned
      expect(peekDecisionPrompt(state)).toBeUndefined();
      expect(state.pendingDecisionQueue?.length ?? 0).toBe(0);

      // Damage was completely prevented
      expect(state.players[0].health).toBe(10);
      expect(state.lastCombatOutcome?.finalDamage).toBe(0);

      // Copy 1 is in discard, Copy 2 is still in hand!
      expect(state.players[0].hand.length).toBe(1);
      expect(state.players[0].hand[0].card.code).toBe(BACKFLIP);
      expect(state.players[0].discard.length).toBe(1);
      expect(state.players[0].discard[0].card.code).toBe(BACKFLIP);
    });

    it('passing Backflip copy 1 offers copy 2, accepting copy 2 prevents damage', () => {
      let state = createTestGame([
        { heroCode: SPIDER_MAN_HERO, aeCode: SPIDER_MAN_AE, handCodes: [BACKFLIP, BACKFLIP] },
      ]);

      state = initiateAttackToDefense(state, 'p1');
      expect(state.pendingDecisionQueue?.length).toBe(2);

      // Pass copy 1
      state = passPrompt(state);

      // Prompt for copy 2 is now the active prompt
      expect(peekDecisionPrompt(state)).toBeDefined();
      expect(state.pendingDecisionQueue?.length).toBe(1);
      // Health is still 10 while interrupt window is open
      expect(state.players[0].health).toBe(10);

      // Accept copy 2
      state = acceptPrompt(state);

      expect(peekDecisionPrompt(state)).toBeUndefined();
      expect(state.players[0].health).toBe(10);
      expect(state.lastCombatOutcome?.finalDamage).toBe(0);

      // Copy 1 remains in hand (was passed), Copy 2 is in discard
      expect(state.players[0].hand.length).toBe(1);
      expect(state.players[0].hand[0].card.code).toBe(BACKFLIP);
      expect(state.players[0].discard.length).toBe(1);
      expect(state.players[0].discard[0].card.code).toBe(BACKFLIP);
    });

    it('passing both copies of Backflip applies incoming damage', () => {
      let state = createTestGame([
        { heroCode: SPIDER_MAN_HERO, aeCode: SPIDER_MAN_AE, handCodes: [BACKFLIP, BACKFLIP] },
      ]);

      state = initiateAttackToDefense(state, 'p1');

      // Pass both
      state = passPrompt(state);
      state = passPrompt(state);

      expect(peekDecisionPrompt(state)).toBeUndefined();
      // Took 2 damage from Rhino ATK 2 (10 - 2 = 8)
      expect(state.players[0].health).toBe(8);
      expect(state.lastCombatOutcome?.finalDamage).toBe(2);

      // Both copies remain in hand
      expect(state.players[0].hand.length).toBe(2);
      expect(state.players[0].discard.length).toBe(0);
    });

    it('live reduction across prompts: partial prevention reduces live amount', () => {
      let state = createTestGame([
        { heroCode: SPIDER_MAN_HERO, aeCode: SPIDER_MAN_AE, handCodes: [BACKFLIP] },
      ]);

      // Give player a card with partial damage prevention (amount: 1)
      const partialCard = createCardInstance({
        code: 'custom_partial_prevent',
        name: 'Partial Block',
        type: 'event',
        enrichment: {
          abilities: [
            {
              id: 'partial_prevent',
              timing: 'HERO_INTERRUPT',
              trigger: 'DAMAGE_WOULD_BE_TAKEN',
              zone: 'HAND',
              steps: [
                {
                  effect: 'PREVENT_DAMAGE',
                  effectParams: { amount: 1 },
                },
              ],
            },
          ],
        },
      } as any);

      // Hand has: partialCard first, Backflip second
      state.players[0].hand = [partialCard, state.players[0].hand[0]];

      state = initiateAttackToDefense(state, 'p1');

      expect(peekDecisionPrompt(state)?.kind).toBe('ORDER_SIMULTANEOUS_ABILITIES');
      state = answerPrompt(state, 'p1', 'confirm_order');

      expect(state.pendingDecisionQueue?.length).toBe(2);
      const placement = state.pendingDamagePlacements![0];
      expect(placement.amount).toBe(2);

      // Accept Partial Block (prevents 1)
      state = acceptPrompt(state);

      // Live amount is now 1
      expect(state.pendingDamagePlacements![0].amount).toBe(1);
      expect(state.activeAttackContext?.pendingDamage).toBe(1);

      // Backflip prompt is still open (since amount 1 > 0)
      expect(peekDecisionPrompt(state)).toBeDefined();
      expect(peekDecisionPrompt(state)?.sourceCardName).toBe('Backflip');

      // Accept Backflip (prevents remaining 1)
      state = acceptPrompt(state);

      expect(peekDecisionPrompt(state)).toBeUndefined();
      expect(state.players[0].health).toBe(10);
      expect(state.lastCombatOutcome?.finalDamage).toBe(0);
    });

    it('multiplayer with firstPlayerIndex: 1 prompts in first-player order for DAMAGE_WOULD_BE_TAKEN', () => {
      // Both players have cards reacting to DAMAGE_WOULD_BE_TAKEN with ANY scope
      const createScopeAnyCard = (id: string, name: string) =>
        createCardInstance({
          code: id,
          name,
          type: 'event',
          enrichment: {
            abilities: [
              {
                id: `${id}_ability`,
                timing: 'HERO_INTERRUPT',
                trigger: 'DAMAGE_WOULD_BE_TAKEN',
                triggerFilter: { targetPlayerScope: 'ANY' },
                zone: 'HAND',
                steps: [{ effect: 'PREVENT_DAMAGE', effectParams: { amount: 1 } }],
              },
            ],
          },
        } as any);

      let state = createTestGame(
        [
          { heroCode: SPIDER_MAN_HERO, aeCode: SPIDER_MAN_AE, handCodes: [] },
          { heroCode: CAPTAIN_MARVEL_HERO, aeCode: CAPTAIN_MARVEL_AE, handCodes: [] },
        ],
        { firstPlayerIndex: 1 },
      );

      state.players[0].hand = [createScopeAnyCard('p1_card', 'P1 Intercept')];
      state.players[1].hand = [createScopeAnyCard('p2_card', 'P2 Intercept')];

      // Trigger DAMAGE_WOULD_BE_TAKEN
      dispatchTrigger(state, 'DAMAGE_WOULD_BE_TAKEN', {
        targetPlayerId: 'p1',
        damageAmount: 3,
        damageSource: 'ATTACK',
        targetPlayerScope: 'ANY',
      });

      // Player 2 must receive ordering prompt first because firstPlayerIndex === 1
      expect(peekDecisionPrompt(state)?.kind).toBe('ORDER_SIMULTANEOUS_ABILITIES');
      expect(peekDecisionPrompt(state)?.playerId).toBe('p2');
      state = answerPrompt(state, 'p2', 'confirm_order');

      // Player 2 must be prompted first because firstPlayerIndex === 1
      expect(state.pendingDecisionQueue?.length).toBe(2);
      expect(state.pendingDecisionQueue![0].playerId).toBe('p2');
      expect(state.pendingDecisionQueue![1].playerId).toBe('p1');
    });
  });

  describe('2. ENCOUNTER_CARD_REVEALED / TREACHERY_REVEALED', () => {
    it('queues two copies of Enhanced Spider-Sense, accepting copy 1 prunes copy 2 via removeMootCancelPrompts', () => {
      const state = createTestGame([
        {
          heroCode: SPIDER_MAN_HERO,
          aeCode: SPIDER_MAN_AE,
          handCodes: [ENHANCED_SPIDER_SENSE, ENHANCED_SPIDER_SENSE, RESOURCE_CARD, RESOURCE_CARD],
        },
      ]);

      const falseAlarm = createCardInstance(cardCatalog.getCard(FALSE_ALARM)!);
      state.players[0].dealtEncounterCards.push(falseAlarm);

      // Reveal encounter cards
      let nextState = step4_revealEncounterCards(state);

      // Both copies queued
      expect(nextState.pendingDecisionQueue?.length).toBe(2);
      expect(nextState.pendingDecisionQueue![0].sourceCardCode).toBe(ENHANCED_SPIDER_SENSE);
      expect(nextState.pendingDecisionQueue![1].sourceCardCode).toBe(ENHANCED_SPIDER_SENSE);

      // Identify the resource card to pay the 1 cost of Enhanced Spider-Sense
      const paymentCard = nextState.players[0].hand.find((c) => c.card.code === RESOURCE_CARD)!;

      // Accept copy 1, explicitly paying with RESOURCE_CARD
      nextState = acceptPrompt(nextState, [paymentCard.instanceId]);

      // Copy 2 was pruned
      expect(peekDecisionPrompt(nextState)).toBeUndefined();
      expect(nextState.pendingDecisionQueue?.length ?? 0).toBe(0);

      // Not confused (reveal was cancelled)
      expect(nextState.players[0].statusCards).not.toContain(StatusCard.CONFUSED);

      // Copy 1 spent (in discard), copy 2 remains in hand
      const spiderSensesInHand = nextState.players[0].hand.filter(
        (c) => c.card.code === ENHANCED_SPIDER_SENSE,
      );
      expect(spiderSensesInHand.length).toBe(1);
    });

    it('multiplayer: Player 1 has Enhanced Spider-Sense, Player 2 has Get Behind Me!', () => {
      const state = createTestGame([
        {
          heroCode: SPIDER_MAN_HERO,
          aeCode: SPIDER_MAN_AE,
          handCodes: [ENHANCED_SPIDER_SENSE, RESOURCE_CARD],
        },
        {
          heroCode: CAPTAIN_MARVEL_HERO,
          aeCode: CAPTAIN_MARVEL_AE,
          handCodes: [GET_BEHIND_ME, RESOURCE_CARD],
        },
      ]);

      const falseAlarm = createCardInstance(cardCatalog.getCard(FALSE_ALARM)!);
      state.players[0].dealtEncounterCards.push(falseAlarm);

      // Reveal for Player 1
      let nextState = step4_revealEncounterCards(state);

      expect(peekDecisionPrompt(nextState)?.kind).toBe('ORDER_SIMULTANEOUS_ABILITIES');
      expect(peekDecisionPrompt(nextState)?.playerId).toBe('p1');
      nextState = answerPrompt(nextState, 'p1', 'confirm_order');

      // Both players have prompts: Player 1 (revealing) first, Player 2 second
      expect(nextState.pendingDecisionQueue?.length).toBe(2);
      expect(nextState.pendingDecisionQueue![0].playerId).toBe('p1');
      expect(nextState.pendingDecisionQueue![1].playerId).toBe('p2');

      const paymentCard = nextState.players[0].hand.find((c) => c.card.code === RESOURCE_CARD)!;

      // Case A: When Player 1 cancels, Player 2's prompt is pruned
      nextState = acceptPrompt(nextState, [paymentCard.instanceId]);
      expect(peekDecisionPrompt(nextState)).toBeUndefined();
      expect(nextState.players[1].hand.some((c) => c.card.code === GET_BEHIND_ME)).toBe(true);
    });

    it('multiplayer: when Player 1 passes, Player 2 Get Behind Me! prompt is presented', () => {
      const state = createTestGame([
        {
          heroCode: SPIDER_MAN_HERO,
          aeCode: SPIDER_MAN_AE,
          handCodes: [ENHANCED_SPIDER_SENSE, RESOURCE_CARD],
        },
        {
          heroCode: CAPTAIN_MARVEL_HERO,
          aeCode: CAPTAIN_MARVEL_AE,
          handCodes: [GET_BEHIND_ME, RESOURCE_CARD],
        },
      ]);

      const falseAlarm = createCardInstance(cardCatalog.getCard(FALSE_ALARM)!);
      state.players[0].dealtEncounterCards.push(falseAlarm);

      let nextState = step4_revealEncounterCards(state);

      expect(peekDecisionPrompt(nextState)?.kind).toBe('ORDER_SIMULTANEOUS_ABILITIES');
      expect(peekDecisionPrompt(nextState)?.playerId).toBe('p1');
      nextState = answerPrompt(nextState, 'p1', 'confirm_order');

      // Player 1 passes
      nextState = passPrompt(nextState);

      // Player 2's prompt is now active
      expect(peekDecisionPrompt(nextState)).toBeDefined();
      expect(peekDecisionPrompt(nextState)?.playerId).toBe('p2');
      expect(peekDecisionPrompt(nextState)?.sourceCardName).toBe('Get Behind Me!');

      const p2Payment = nextState.players[1].hand.find((c) => c.card.code === RESOURCE_CARD)!;

      // Player 2 accepts Get Behind Me!
      nextState = acceptPrompt(nextState, [p2Payment.instanceId]);

      // Reveal cancelled (Player 1 not confused)
      expect(nextState.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
      expect(nextState.players[1].discard.some((c) => c.card.code === GET_BEHIND_ME)).toBe(true);
    });

    it('non-revealing players are prompted in first-player order when firstPlayerIndex !== 0', () => {
      // 3 players: P1 reveals. P2 and P3 both hold cancel cards.
      // With firstPlayerIndex = 2 (P3), non-revealing order is P3, then P2.
      const state = createTestGame(
        [
          { heroCode: SPIDER_MAN_HERO, aeCode: SPIDER_MAN_AE, handCodes: [] },
          {
            heroCode: CAPTAIN_MARVEL_HERO,
            aeCode: CAPTAIN_MARVEL_AE,
            handCodes: [GET_BEHIND_ME, RESOURCE_CARD],
          },
          {
            heroCode: SHE_HULK_HERO,
            aeCode: SHE_HULK_AE,
            handCodes: [GET_BEHIND_ME, RESOURCE_CARD],
          },
        ],
        { firstPlayerIndex: 2 },
      );

      const falseAlarm = createCardInstance(cardCatalog.getCard(FALSE_ALARM)!);
      state.players[0].dealtEncounterCards.push(falseAlarm);

      let nextState = step4_revealEncounterCards(state);

      expect(peekDecisionPrompt(nextState)?.kind).toBe('ORDER_SIMULTANEOUS_ABILITIES');
      expect(peekDecisionPrompt(nextState)?.playerId).toBe('p3');
      nextState = answerPrompt(nextState, 'p3', 'confirm_order');

      // P1 has no cancel card. P3 and P2 both have GET_BEHIND_ME.
      // Since firstPlayerIndex is 2 (P3), P3 is prompted before P2!
      expect(nextState.pendingDecisionQueue?.length).toBe(2);
      expect(nextState.pendingDecisionQueue![0].playerId).toBe('p3');
      expect(nextState.pendingDecisionQueue![1].playerId).toBe('p2');
    });
  });

  describe('3. ATTACK_DEFENDED', () => {
    it('queues both copies of Counter-Punch, accepting copy 1 deals damage and leaves copy 2 available', () => {
      let state = createTestGame([
        {
          heroCode: SPIDER_MAN_HERO,
          aeCode: SPIDER_MAN_AE,
          handCodes: [COUNTER_PUNCH, COUNTER_PUNCH],
        },
      ]);

      const villainHp = state.villain.health;

      // Dispatch ATTACK_DEFENDED (Spider-Man base ATK is 2)
      dispatchTrigger(state, 'ATTACK_DEFENDED', {
        targetPlayerId: 'p1',
        defenderType: 'HERO',
        targetInstanceId: state.villain.instanceId,
      });

      // Both copies are queued
      expect(state.pendingDecisionQueue?.length).toBe(2);

      // Accept copy 1
      state = acceptPrompt(state);

      // Copy 1 dealt 2 damage
      expect(state.villain.health).toBe(villainHp - 2);

      // Prompt 2 is STILL presented (Response window does not close on trigger)
      expect(peekDecisionPrompt(state)).toBeDefined();
      expect(state.pendingDecisionQueue?.length).toBe(1);

      // Accept copy 2
      state = acceptPrompt(state);

      // Copy 2 dealt 2 damage again
      expect(state.villain.health).toBe(villainHp - 4);
      expect(peekDecisionPrompt(state)).toBeUndefined();

      // Both copies discarded
      expect(state.players[0].hand.length).toBe(0);
      expect(state.players[0].discard.length).toBe(2);
    });

    it('multiplayer: two defending players holding Counter-Punch prompted in first-player order', () => {
      let state = createTestGame(
        [
          { heroCode: SPIDER_MAN_HERO, aeCode: SPIDER_MAN_AE, handCodes: [COUNTER_PUNCH] },
          { heroCode: CAPTAIN_MARVEL_HERO, aeCode: CAPTAIN_MARVEL_AE, handCodes: [COUNTER_PUNCH] },
        ],
        { firstPlayerIndex: 1 },
      );

      // Both players defended (targetPlayerScope: 'ANY')
      dispatchTrigger(state, 'ATTACK_DEFENDED', {
        targetPlayerId: 'p2',
        defenderType: 'HERO',
        targetPlayerScope: 'ANY',
        targetInstanceId: state.villain.instanceId,
      });

      expect(peekDecisionPrompt(state)?.kind).toBe('ORDER_SIMULTANEOUS_ABILITIES');
      expect(peekDecisionPrompt(state)?.playerId).toBe('p2');
      state = answerPrompt(state, 'p2', 'confirm_order');

      // With firstPlayerIndex = 1, Player 2 is scanned first, Player 1 second
      expect(state.pendingDecisionQueue?.length).toBe(2);
      expect(state.pendingDecisionQueue![0].playerId).toBe('p2');
      expect(state.pendingDecisionQueue![1].playerId).toBe('p1');
    });
  });

  describe('4. BASIC_ATTACK_PERFORMED', () => {
    it('queues two copies of One-Two Punch and offers them in sequence', () => {
      let state = createTestGame([
        {
          heroCode: SHE_HULK_HERO,
          aeCode: SHE_HULK_AE,
          handCodes: [ONE_TWO_PUNCH, ONE_TWO_PUNCH, RESOURCE_CARD, RESOURCE_CARD],
        },
      ]);

      state.players[0].exhausted = true;

      // She-Hulk makes basic attack
      dispatchTrigger(state, 'BASIC_ATTACK_PERFORMED', {
        targetPlayerId: 'p1',
      });

      // Both copies are queued
      expect(state.pendingDecisionQueue?.length).toBe(2);
      expect(state.pendingDecisionQueue![0].sourceCardCode).toBe(ONE_TWO_PUNCH);
      expect(state.pendingDecisionQueue![1].sourceCardCode).toBe(ONE_TWO_PUNCH);

      const pay1 = state.players[0].hand.find((c) => c.card.code === RESOURCE_CARD)!;

      // Accept copy 1 (readies hero)
      state = acceptPrompt(state, [pay1.instanceId]);
      expect(state.players[0].exhausted).toBe(false);

      // Prompt 2 is now presented
      expect(peekDecisionPrompt(state)).toBeDefined();
      expect(state.pendingDecisionQueue?.length).toBe(1);

      // Hero gets exhausted again
      state.players[0].exhausted = true;

      const pay2 = state.players[0].hand.find((c) => c.card.code === RESOURCE_CARD)!;

      // Accept copy 2 (readies hero again)
      state = acceptPrompt(state, [pay2.instanceId]);
      expect(state.players[0].exhausted).toBe(false);
      expect(peekDecisionPrompt(state)).toBeUndefined();
    });
  });
});
