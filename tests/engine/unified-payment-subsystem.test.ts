import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { step4_revealEncounterCards } from '@engine/pipeline/villain-phase';
import {
  enqueueDecisionPrompt,
  peekDecisionPrompt,
  resolveDecisionPrompt,
} from '@engine/pipeline/prompt-queue';
import { step6_endVillainPhaseAndRound } from '@engine/pipeline/round-upkeep';
import { executePlayerCleanup } from '@engine/pipeline/player-phase-cleanup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { dispatchTrigger } from '@engine/triggers';

describe('Unified Payment Subsystem & Exhaust Lifecycle Invariants (Issue #155)', () => {
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

  it('1. Web-Shooter paid during Villain Phase exhausts, decrements uses, and remains exhausted across round upkeep into next Player Phase', () => {
    // Hand has Enhanced Spider-Sense (01004) - Hero Interrupt, cost: 1 resource, discardSelf: true
    const spiderSense = createCardInstance(cardCatalog.getCard('01004')!);
    state.players[0].hand = [spiderSense];

    // Tableau has Web-Shooter (01008) - Ready with 3 web counters
    const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.counters = { web: 3 };
    webShooter.tokens = { counters: 3 };
    webShooter.exhausted = false;
    state.players[0].tableau = [webShooter];

    // Dealt encounter treachery False Alarm (01112)
    const falseAlarm = createCardInstance(cardCatalog.getCard('01112')!);
    state.players[0].dealtEncounterCards.push(falseAlarm);

    // Reveal encounter card -> prompts Enhanced Spider-Sense
    const promptState = step4_revealEncounterCards(state);
    expect(peekDecisionPrompt(promptState)).toBeDefined();
    expect(peekDecisionPrompt(promptState)?.sourceCardName).toBe('Enhanced Spider-Sense');

    const yesOption = peekDecisionPrompt(promptState)!.options.find((o) => o.id !== 'pass')!;
    expect(yesOption).toBeDefined();

    // Resolve decision prompt using Web-Shooter as resource generator
    const { state: resolvedState } = resolveDecisionPrompt(promptState, 'p1', yesOption.id, {
      generatorInstanceIds: [webShooter.instanceId],
    });

    // 1A. Enhanced Spider-Sense was discarded
    expect(resolvedState.players[0].hand.some((c) => c.instanceId === spiderSense.instanceId)).toBe(
      false,
    );
    expect(
      resolvedState.players[0].discard.some((c) => c.instanceId === spiderSense.instanceId),
    ).toBe(true);

    // 1B. Web-Shooter MUST BE EXHAUSTED and counter decremented (3 -> 2)
    const shooterInTableau = resolvedState.players[0].tableau.find(
      (c) => c.instanceId === webShooter.instanceId,
    )!;
    expect(shooterInTableau).toBeDefined();
    expect(shooterInTableau.exhausted).toBe(true);
    expect(shooterInTableau.counters?.web).toBe(2);
    expect(shooterInTableau.tokens?.counters).toBe(2);

    // 1C. Advance through Step 6: End of Villain Phase & Round Upkeep (RR v1.8 p. 47)
    const nextRoundState = step6_endVillainPhaseAndRound(resolvedState);
    expect(nextRoundState.roundNumber).toBe(2);
    expect(nextRoundState.phase).toBe('PLAYER_PHASE');

    // 1D. CRUCIAL INVARIANT: Web-Shooter MUST REMAIN EXHAUSTED in the new Player Phase!
    const shooterInNextRound = nextRoundState.players[0].tableau.find(
      (c) => c.instanceId === webShooter.instanceId,
    )!;
    expect(shooterInNextRound.exhausted).toBe(true);

    // 1E. ONLY at the End of Player Phase cleanup does Web-Shooter ready (RR v1.8 p. 10, 23)
    const cleanedUpState = executePlayerCleanup(nextRoundState, 'p1', []);
    const shooterAfterCleanup = cleanedUpState.players[0].tableau.find(
      (c) => c.instanceId === webShooter.instanceId,
    )!;
    expect(shooterAfterCleanup.exhausted).toBe(false);
  });

  it('2. SPEND_RESOURCES_TO_DISCARD_ATTACHMENT forwards and exhausts generators (e.g. Web-Shooter)', () => {
    // Add Web-Shooter ready to tableau (generates wild, satisfying physical requirement)
    const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.counters = { web: 3 };
    webShooter.tokens = { counters: 3 };
    webShooter.exhausted = false;
    state.players[0].tableau = [webShooter];

    // Add Ivory Horn (01100) attachment to villain (costs 3 physical to discard)
    const ivoryHorn = createCardInstance(cardCatalog.getCard('01100')!);
    if (!state.villain.attachments) state.villain.attachments = [];
    state.villain.attachments.push(ivoryHorn);

    // Player needs 3 physical resources: 2 physical cards in hand + Web-Shooter (wild)
    const card1 = createCardInstance({
      code: 'phys_1',
      name: 'Physical Card 1',
      type: 'event',
      resources: { physical: 1, total: 1 },
    } as any);
    const card2 = createCardInstance({
      code: 'phys_2',
      name: 'Physical Card 2',
      type: 'event',
      resources: { physical: 1, total: 1 },
    } as any);
    state.players[0].hand = [card1, card2];

    // Dispatch SPEND_RESOURCES_TO_DISCARD_ATTACHMENT with both payment cards and generator
    const actionResult = dispatchAction(state, {
      type: 'SPEND_RESOURCES_TO_DISCARD_ATTACHMENT',
      playerId: 'p1',
      attachmentInstanceId: ivoryHorn.instanceId,
      paymentCardInstanceIds: [card1.instanceId, card2.instanceId],
      generatorInstanceIds: [webShooter.instanceId],
    });

    expect(actionResult.result.success).toBe(true);
    // Attachment is discarded
    expect(
      (actionResult.state.villain.attachments || []).some(
        (a) => a.instanceId === ivoryHorn.instanceId,
      ),
    ).toBe(false);

    // Web-Shooter MUST BE EXHAUSTED and counter decremented
    const shooterAfter = actionResult.state.players[0].tableau.find(
      (c) => c.instanceId === webShooter.instanceId,
    )!;
    expect(shooterAfter.exhausted).toBe(true);
    expect(shooterAfter.counters?.web).toBe(2);
  });

  it('3. Synthetic / choice decision prompts execute payment and exhaust generators', () => {
    const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.counters = { web: 3 };
    webShooter.tokens = { counters: 3 };
    webShooter.exhausted = false;
    state.players[0].tableau = [webShooter];

    // Queue a synthetic prompt representing a card or encounter effect with payment
    state = enqueueDecisionPrompt(state, {
      promptId: 'prompt_synthetic_payment_test',
      playerId: 'p1',
      title: 'Pay 1 Resource',
      description: 'Spend 1 resource to remove 1 threat',
      sourceCardName: 'Test Scheme Effect',
      options: [
        {
          id: 'pay_resource_option',
          label: 'Spend 1 Resource',
          effect: 'REMOVE_THREAT',
          params: { amount: 1, target: 'MAIN_SCHEME', requiresPayment: true },
        },
        {
          id: 'pass',
          label: 'Pass',
          effect: 'PASS',
        },
      ],
    });

    const { state: resolvedState } = resolveDecisionPrompt(state, 'p1', 'pay_resource_option', {
      generatorInstanceIds: [webShooter.instanceId],
    });

    const shooterAfter = resolvedState.players[0].tableau.find(
      (c) => c.instanceId === webShooter.instanceId,
    )!;
    expect(shooterAfter.exhausted).toBe(true);
    expect(shooterAfter.counters?.web).toBe(2);
  });

  it('4. DAMAGE_WOULD_BE_TAKEN with in-hand interrupt event having cost populates payment params and exhausts generator', () => {
    // Web-Shooter ready in tableau
    const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.counters = { web: 3 };
    webShooter.tokens = { counters: 3 };
    webShooter.exhausted = false;
    state.players[0].tableau = [webShooter];

    // Synthetic in-hand defense card with cost 1
    const defenseCard = createCardInstance({
      code: 'test_defense_event',
      name: 'Test Defense Event',
      type: 'event',
      cost: 1,
      enrichment: {
        abilities: [
          {
            id: 'test_defense_ability',
            timing: 'HERO_INTERRUPT',
            trigger: 'DAMAGE_WOULD_BE_TAKEN',
            zone: 'HAND',
            cost: { discardSelf: true },
            steps: [{ effect: 'PREVENT_DAMAGE', effectParams: { amount: 2 } }],
          },
        ],
      },
    } as any);
    state.players[0].hand = [defenseCard];

    // Dispatch trigger DAMAGE_WOULD_BE_TAKEN
    const triggerRes = dispatchTrigger(state, 'DAMAGE_WOULD_BE_TAKEN', {
      targetPlayerId: 'p1',
      damageAmount: 3,
    });

    expect(triggerRes.hasPendingPrompt).toBe(true);
    expect(peekDecisionPrompt(state)).toBeDefined();
    const yesOption = peekDecisionPrompt(state)!.options.find((o) => o.id !== 'pass')!;
    expect(yesOption).toBeDefined();
    expect((yesOption.params as any).requiresPayment).toBe(true);
    expect((yesOption.params as any).resourceCost?.amount).toBe(1);

    // Resolve prompt with generator
    const { state: resolvedState } = resolveDecisionPrompt(state, 'p1', yesOption.id, {
      generatorInstanceIds: [webShooter.instanceId],
    });

    // Generator is exhausted and counter decremented
    const shooterAfter = resolvedState.players[0].tableau.find(
      (c) => c.instanceId === webShooter.instanceId,
    )!;
    expect(shooterAfter.exhausted).toBe(true);
    expect(shooterAfter.counters?.web).toBe(2);
    // Card is discarded
    expect(resolvedState.players[0].hand.length).toBe(0);
  });
});
