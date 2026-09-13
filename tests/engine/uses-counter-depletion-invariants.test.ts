import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GamePhase, GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { createCardInstance } from '../../src/engine/state/card-instance';
import { dispatchAction } from '../../src/engine/pipeline';
import { step5_revealEncounterCards } from '../../src/engine/pipeline/villain-phase';
import { resolveDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';
import { dispatchTrigger } from '../../src/engine/triggers/trigger-dispatcher';

describe('Universal Uses (X) Counter Depletion & Discard Lifecycle Invariants (ADR-0057)', () => {
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
        {
          id: 'p2',
          name: 'Carol Danvers',
          hero: cardCatalog.getCard('01010b') as HeroCard,
          alterEgo: cardCatalog.getCard('01010a') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.phase = GamePhase.PLAYER_PHASE;
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[0].exhausted = false;
  });

  describe('1. Web-Shooter (01008): Generator Counter Depletion & Discard Invariant', () => {
    it('exhausts Web-Shooter and decrements counter when tapped as generator with > 1 counters', () => {
      const p1 = state.players[0];
      const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
      p1.tableau.push(webShooter);

      // 1-cost card to play using 1 generator resource
      const playableCard = createCardInstance({
        code: 'test_1cost_upgrade',
        name: 'Test 1-Cost Upgrade',
        type: 'upgrade',
        faction: 'basic',
        cost: 1,
        text: 'A test upgrade.',
        enrichment: { abilities: [] },
      } as any);
      p1.hand = [playableCard];

      const res = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: p1.id,
        cardInstanceId: playableCard.instanceId,
        paymentCardInstanceIds: [],
        generatorInstanceIds: [webShooter.instanceId],
      });

      expect(res.result.success).toBe(true);
      const remainingWs = res.state.players[0].tableau.find(
        (c) => c.instanceId === webShooter.instanceId,
      );
      expect(remainingWs).toBeDefined();
      expect(remainingWs?.exhausted).toBe(true);
      expect(remainingWs?.tokens?.counters).toBe(2);
      expect(remainingWs?.counters?.web).toBe(2);
      expect(res.state.players[0].discard.some((c) => c.instanceId === webShooter.instanceId)).toBe(
        false,
      );
    });

    it('removes counter and moves Web-Shooter to player.discard with trigger and log when tapped at 1 counter', () => {
      const p1 = state.players[0];
      const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
      // Set to exactly 1 counter
      webShooter.tokens = { ...webShooter.tokens, counters: 1 };
      webShooter.counters = { web: 1 };
      p1.tableau.push(webShooter);

      const playableCard = createCardInstance({
        code: 'test_1cost_upgrade',
        name: 'Test 1-Cost Upgrade',
        type: 'upgrade',
        faction: 'basic',
        cost: 1,
        text: 'A test upgrade.',
        enrichment: { abilities: [] },
      } as any);
      p1.hand = [playableCard];

      const res = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: p1.id,
        cardInstanceId: playableCard.instanceId,
        paymentCardInstanceIds: [],
        generatorInstanceIds: [webShooter.instanceId],
      });

      expect(res.result.success).toBe(true);

      // Web-Shooter must NO LONGER be in tableau
      const inTableau = res.state.players[0].tableau.find(
        (c) => c.instanceId === webShooter.instanceId,
      );
      expect(inTableau).toBeUndefined();

      // Web-Shooter MUST be in player's discard pile
      const inDiscard = res.state.players[0].discard.find(
        (c) => c.instanceId === webShooter.instanceId,
      );
      expect(inDiscard).toBeDefined();
      expect(inDiscard?.tokens?.counters).toBe(0);
      expect(inDiscard?.counters?.web).toBe(0);

      // Comic log entry must be present with onomatopoeia 'USES EXHAUSTED!'
      const exhaustedLog = res.state.log.find(
        (entry) =>
          entry.key === 'card.discarded.uses_exhausted' && entry.onomatopoeia === 'USES EXHAUSTED!',
      );
      expect(exhaustedLog).toBeDefined();
      expect(exhaustedLog?.params?.card).toBe('Web-Shooter');
    });
  });

  describe('2. Tac Team (01056) & Med Team (01080): USE_CARD_ABILITY Depletion Invariants', () => {
    it('Tac Team: spending counter when > 0 remain stays in tableau', () => {
      const p1 = state.players[0];
      const tacTeam = createCardInstance(cardCatalog.getCard('01056')!);
      p1.tableau.push(tacTeam);

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: tacTeam.instanceId,
        abilityId: 'tac_team_action',
        targetInstanceId: state.villain.instanceId,
      });

      expect(res.result.success).toBe(true);
      const inTableau = res.state.players[0].tableau.find(
        (c) => c.instanceId === tacTeam.instanceId,
      );
      expect(inTableau).toBeDefined();
      expect(inTableau?.tokens?.counters).toBe(2);
      expect(inTableau?.counters?.attack).toBe(2);
      expect(res.state.players[0].discard.some((c) => c.instanceId === tacTeam.instanceId)).toBe(
        false,
      );
    });

    it('Tac Team: spending last counter via USE_CARD_ABILITY discards card to discard pile with log', () => {
      const p1 = state.players[0];
      const tacTeam = createCardInstance(cardCatalog.getCard('01056')!);
      tacTeam.tokens = { ...tacTeam.tokens, counters: 1 };
      tacTeam.counters = { attack: 1 };
      p1.tableau.push(tacTeam);

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: tacTeam.instanceId,
        abilityId: 'tac_team_action',
        targetInstanceId: state.villain.instanceId,
      });

      expect(res.result.success).toBe(true);
      // Removed from tableau
      expect(res.state.players[0].tableau.some((c) => c.instanceId === tacTeam.instanceId)).toBe(
        false,
      );
      // Placed in player.discard
      expect(res.state.players[0].discard.some((c) => c.instanceId === tacTeam.instanceId)).toBe(
        true,
      );

      // Comic log
      const exhaustedLog = res.state.log.find(
        (entry) =>
          entry.key === 'card.discarded.uses_exhausted' && entry.onomatopoeia === 'USES EXHAUSTED!',
      );
      expect(exhaustedLog).toBeDefined();
      expect(exhaustedLog?.params?.card).toBe('Tac Team');
    });

    it('Med Team: spending last medical counter heals target and discards Med Team', () => {
      const p1 = state.players[0];
      p1.health = 8; // Max 10
      const medTeam = createCardInstance(cardCatalog.getCard('01080')!);
      medTeam.tokens = { ...medTeam.tokens, counters: 1 };
      medTeam.counters = { medical: 1 };
      p1.tableau.push(medTeam);

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: medTeam.instanceId,
        abilityId: 'med_team_heal',
        targetInstanceId: p1.id,
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].health).toBe(10); // Healed 2 damage
      expect(res.state.players[0].tableau.some((c) => c.instanceId === medTeam.instanceId)).toBe(
        false,
      );
      expect(res.state.players[0].discard.some((c) => c.instanceId === medTeam.instanceId)).toBe(
        true,
      );

      const exhaustedLog = res.state.log.find(
        (entry) =>
          entry.key === 'card.discarded.uses_exhausted' && entry.onomatopoeia === 'USES EXHAUSTED!',
      );
      expect(exhaustedLog).toBeDefined();
      expect(exhaustedLog?.params?.card).toBe('Med Team');
    });
  });

  describe('3. Hawkeye (01066): Non-Uses Ally Counter Depletion Guard Invariant', () => {
    it('Hawkeye enters with 4 counters; spending 4th counter reaches 0 but DOES NOT discard Hawkeye', () => {
      const p1 = state.players[0];
      const hawkeye = createCardInstance(cardCatalog.getCard('01066')!);
      // Set to 1 remaining arrow counter
      hawkeye.tokens = { ...hawkeye.tokens, counters: 1 };
      hawkeye.counters = { arrow: 1 };
      p1.allies.push(hawkeye);

      // Deal Weapons Runner (01121, HP 2) to Player 1 and reveal in villain phase
      const weaponsRunner = createCardInstance(cardCatalog.getCard('01121')!);
      p1.dealtEncounterCards = [weaponsRunner];

      state.phase = GamePhase.VILLAIN_PHASE;
      let nextState = step5_revealEncounterCards(state);

      expect(nextState.pendingDecisionPrompt).toBeDefined();
      expect(nextState.pendingDecisionPrompt?.sourceCardName).toContain('Hawkeye');

      // Resolve prompt to shoot the arrow
      nextState = resolveDecisionPrompt(nextState, 'p1', 'trigger_hawkeye_arrow_response').state;

      // Hawkeye's counters must be 0
      const hawkeyeInPlay = nextState.players[0].allies.find((a) => a.card.code === '01066');
      expect(hawkeyeInPlay).toBeDefined();
      expect(hawkeyeInPlay?.tokens?.counters).toBe(0);
      expect(hawkeyeInPlay?.counters?.arrow).toBe(0);

      // Hawkeye MUST NOT be in discard!
      expect(nextState.players[0].discard.some((c) => c.card.code === '01066')).toBe(false);

      // Hawkeye remains ready and can perform basic attack/thwart
      nextState.phase = GamePhase.PLAYER_PHASE;
      hawkeyeInPlay!.exhausted = false;

      const attackRes = dispatchAction(nextState, {
        type: 'ALLY_ATTACK',
        playerId: 'p1',
        allyInstanceId: hawkeyeInPlay!.instanceId,
        targetType: 'villain',
      });

      expect(attackRes.result.success).toBe(true);
      expect(attackRes.state.players[0].allies.some((a) => a.card.code === '01066')).toBe(true);
      expect(
        attackRes.state.players[0].allies.find((a) => a.card.code === '01066')?.exhausted,
      ).toBe(true);
    });
  });

  describe('4. Decision Prompt Optional Trigger: DiscardOnEmpty Cleanup Invariant', () => {
    it('cleanly discards host card when decision prompt optional trigger spends the final counter', () => {
      const p1 = state.players[0];
      // Create a test card with uses and an optional response ability spending 1 counter
      const testCard = createCardInstance({
        code: 'test_charge_card',
        name: 'Test Charge Device',
        type: 'upgrade',
        faction: 'basic',
        cost: 1,
        text: 'Uses (1 charge counter). Response: After hero attacks, spend 1 charge counter -> deal 1 damage.',
        enrichment: {
          uses: {
            type: 'charge',
            count: 1,
            discardOnEmpty: true,
          },
          abilities: [
            {
              id: 'charge_response',
              timing: 'RESPONSE',
              trigger: 'BASIC_ATTACK_PERFORMED',
              cost: {
                spendCounters: {
                  counterType: 'charge',
                  amount: 1,
                },
              },
              steps: [
                {
                  effect: 'DEAL_DAMAGE',
                  params: {
                    amount: 1,
                    target: 'VILLAIN',
                  },
                },
              ],
            },
          ],
        },
      } as any);

      testCard.tokens = { ...testCard.tokens, counters: 1 };
      testCard.counters = { charge: 1 };
      p1.tableau.push(testCard);

      // Dispatch BASIC_ATTACK_PERFORMED trigger to enqueue decision prompt
      let nextState = dispatchTrigger(state, 'BASIC_ATTACK_PERFORMED', {
        targetPlayerId: p1.id,
      }).state;

      expect(nextState.pendingDecisionPrompt).toBeDefined();
      expect(
        nextState.pendingDecisionPrompt?.options.some((o) => o.id === 'trigger_charge_response'),
      ).toBe(true);

      // Resolve prompt
      nextState = resolveDecisionPrompt(nextState, p1.id, 'trigger_charge_response').state;

      // Card must be cleanly discarded from tableau to player.discard
      expect(nextState.players[0].tableau.some((c) => c.instanceId === testCard.instanceId)).toBe(
        false,
      );
      expect(nextState.players[0].discard.some((c) => c.instanceId === testCard.instanceId)).toBe(
        true,
      );

      // Comic log entry emitted
      const exhaustedLog = nextState.log.find(
        (entry) =>
          entry.key === 'card.discarded.uses_exhausted' && entry.onomatopoeia === 'USES EXHAUSTED!',
      );
      expect(exhaustedLog).toBeDefined();
    });
  });

  describe('5. Attachment & Tucked Card Cascading Invariants (RR v1.8 p. 5, 6)', () => {
    it('cascades encounter attachments, player attachments, and tucked cards when Uses host is discarded', () => {
      const p1 = state.players[0];
      const p2 = state.players[1];

      const hostCard = createCardInstance(cardCatalog.getCard('01056')!); // Tac Team
      hostCard.tokens = { ...hostCard.tokens, counters: 1 };
      hostCard.counters = { attack: 1 };
      p1.tableau.push(hostCard);

      // Attach encounter attachment
      const encounterAttachment = createCardInstance(cardCatalog.getCard('01109')!); // Armored Rhino Suit
      // Attach player card belonging to p2
      const playerAttachment = createCardInstance(cardCatalog.getCard('01005')!); // Haymaker owned by p2
      playerAttachment.ownerId = p2.id;
      hostCard.attachments = [encounterAttachment, playerAttachment];

      // Tuck encounter card and player card underneath
      const tuckedEncounter = createCardInstance(cardCatalog.getCard('01101')!); // Hydra Mercenary
      const tuckedPlayer = createCardInstance(cardCatalog.getCard('01009')!); // Enhanced Spider-Sense owned by p1
      tuckedPlayer.ownerId = p1.id;
      hostCard.cardsUnderneath = [tuckedEncounter, tuckedPlayer];

      // Spend last counter via USE_CARD_ABILITY
      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: p1.id,
        cardInstanceId: hostCard.instanceId,
        abilityId: 'tac_team_action',
        targetInstanceId: state.villain.instanceId,
      });

      expect(res.result.success).toBe(true);

      // 1. Host card is in p1.discard
      expect(res.state.players[0].tableau.some((c) => c.instanceId === hostCard.instanceId)).toBe(
        false,
      );
      expect(res.state.players[0].discard.some((c) => c.instanceId === hostCard.instanceId)).toBe(
        true,
      );

      // 2. Encounter attachment cascaded to state.encounterDiscard
      expect(
        res.state.encounterDiscard.some((c) => c.instanceId === encounterAttachment.instanceId),
      ).toBe(true);

      // 3. Player attachment cascaded to owner p2's discard
      expect(
        res.state.players[1].discard.some((c) => c.instanceId === playerAttachment.instanceId),
      ).toBe(true);

      // 4. Tucked encounter card cascaded to state.encounterDiscard
      expect(
        res.state.encounterDiscard.some((c) => c.instanceId === tuckedEncounter.instanceId),
      ).toBe(true);

      // 5. Tucked player card cascaded to owner p1's discard
      expect(
        res.state.players[0].discard.some((c) => c.instanceId === tuckedPlayer.instanceId),
      ).toBe(true);

      // 6. Host attachments and cardsUnderneath arrays were cleared on the discarded host card
      const discardedHost = res.state.players[0].discard.find(
        (c) => c.instanceId === hostCard.instanceId,
      );
      expect(discardedHost?.attachments).toEqual([]);
      expect(discardedHost?.cardsUnderneath).toEqual([]);
    });
  });
});
