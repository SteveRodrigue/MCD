import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { step5_revealEncounterCards } from '@engine/pipeline/villain-phase';
import { resolveDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { canPayAbilityCost } from '@engine/pipeline/cost-engine';

describe('Encounter Cancellation & CANCEL_WHEN_REVEALED Primitive (Issue #1)', () => {
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

  it('Enhanced Spider-Sense (01004) cancels When Revealed effect of False Alarm treachery (acceptOptionalTriggers: true)', () => {
    const spiderSense = createCardInstance(cardCatalog.getCard('01004')!);
    state.players[0].hand.push(spiderSense);

    // False Alarm (01112): When Revealed -> player is confused
    const falseAlarm = createCardInstance(cardCatalog.getCard('01112')!);
    state.players[0].dealtEncounterCards.push(falseAlarm);

    expect(state.players[0].statusCards).not.toContain(StatusCard.CONFUSED);

    // Execute encounter card reveal with automatic interrupt trigger acceptance
    const nextState = step5_revealEncounterCards(state, { acceptOptionalTriggers: true });

    // Treachery was cancelled: player is NOT confused
    expect(nextState.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
    // Enhanced Spider-Sense was discarded from hand as cost
    expect(nextState.players[0].hand.some((c) => c.card.code === '01004')).toBe(false);
    expect(nextState.players[0].discard.some((c) => c.card.code === '01004')).toBe(true);
    // Treachery falseAlarm was discarded to encounter discard
    expect(nextState.encounterDiscard.some((c) => c.card.code === '01112')).toBe(true);
  });

  it('Enhanced Spider-Sense (01004) enqueues decision prompt during reveal and cancels when confirmed', () => {
    const spiderSense = createCardInstance(cardCatalog.getCard('01004')!);
    state.players[0].hand.push(spiderSense);

    const falseAlarm = createCardInstance(cardCatalog.getCard('01112')!);
    state.players[0].dealtEncounterCards.push(falseAlarm);

    // Reveal encounter cards without auto-accept -> should enqueue decision prompt
    const nextState = step5_revealEncounterCards(state);

    expect(nextState.pendingDecisionPrompt).toBeDefined();
    expect(nextState.pendingDecisionPrompt?.sourceCardName).toBe('Enhanced Spider-Sense');

    // Confirm using the trigger
    const yesOption = nextState.pendingDecisionPrompt?.options.find((o) => o.id !== 'pass');
    expect(yesOption).toBeDefined();

    const { state: resolvedState } = resolveDecisionPrompt(nextState, 'p1', yesOption!.id);

    // Cancellation applied: player is NOT confused
    expect(resolvedState.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
    // Enhanced Spider-Sense was paid/discarded
    expect(resolvedState.players[0].hand.some((c) => c.card.code === '01004')).toBe(false);
    expect(resolvedState.players[0].discard.some((c) => c.card.code === '01004')).toBe(true);
    expect(resolvedState.encounterDiscard.some((c) => c.card.code === '01112')).toBe(true);
  });

  it('Enhanced Spider-Sense (01004) prompt passed allows treachery When Revealed to execute normally', () => {
    const spiderSense = createCardInstance(cardCatalog.getCard('01004')!);
    state.players[0].hand.push(spiderSense);

    const falseAlarm = createCardInstance(cardCatalog.getCard('01112')!);
    state.players[0].dealtEncounterCards.push(falseAlarm);

    // Reveal encounter cards without auto-accept -> should enqueue decision prompt
    const nextState = step5_revealEncounterCards(state);
    expect(nextState.pendingDecisionPrompt).toBeDefined();

    // Player chooses "pass"
    const { state: resolvedState } = resolveDecisionPrompt(nextState, 'p1', 'pass');

    // Treachery When Revealed effect DID execute: player becomes confused
    expect(resolvedState.players[0].statusCards).toContain(StatusCard.CONFUSED);
    // Enhanced Spider-Sense remains in hand
    expect(resolvedState.players[0].hand.some((c) => c.card.code === '01004')).toBe(true);
    expect(resolvedState.players[0].discard.some((c) => c.card.code === '01004')).toBe(false);
    expect(resolvedState.encounterDiscard.some((c) => c.card.code === '01112')).toBe(true);
  });

  it('Cancelling a Minion When Revealed effect prevents effect but still enters play engaged with player (RR v1.8 p. 31)', () => {
    // Synthetic interrupt card that cancels WHEN_REVEALED on any encounter card
    const cancelCardInstance = createCardInstance({
      code: 'test_cancel_when_revealed',
      name: 'Test Cancel When Revealed',
      type: 'event',
      enrichment: {
        abilities: [
          {
            id: 'test_cancel_wr_ability',
            timing: 'INTERRUPT',
            trigger: 'WHEN_REVEALED',
            zone: 'HAND',
            cost: { discardSelf: true },
            steps: [
              {
                effect: 'CANCEL_WHEN_REVEALED',
                effectParams: {},
              },
            ],
          },
        ],
      },
    } as any);
    state.players[0].hand.push(cancelCardInstance);

    // Shocker (01103): Minion with When Revealed: Deal 1 damage to each hero.
    const shocker = createCardInstance(cardCatalog.getCard('01103')!);
    state.players[0].dealtEncounterCards.push(shocker);

    const initialHp = state.players[0].health;

    const nextState = step5_revealEncounterCards(state, { acceptOptionalTriggers: true });

    // Shocker's When Revealed damage was cancelled: hero HP unchanged
    expect(nextState.players[0].health).toBe(initialHp);

    // Shocker minion STILL enters play engaged with the player per RR v1.8 p. 31
    expect(nextState.players[0].engagedMinions.some((m) => m.card.code === '01103')).toBe(true);
    expect(nextState.encounterDiscard.some((m) => m.card.code === '01103')).toBe(false);
  });

  it('Enhanced Spider-Sense prompt is suppressed when player has 0 extra cards and 0 generators (cannot pay for itself)', () => {
    const spiderSense = createCardInstance(cardCatalog.getCard('01004')!);
    // Hand has ONLY Enhanced Spider-Sense; no other cards, no generators
    state.players[0].hand = [spiderSense];
    state.players[0].tableau = [];

    const ability = spiderSense.card.enrichment!.abilities![0];
    const costCheck = canPayAbilityCost(state, state.players[0], ability, spiderSense);
    expect(costCheck.allowed).toBe(false);

    const falseAlarm = createCardInstance(cardCatalog.getCard('01112')!);
    state.players[0].dealtEncounterCards.push(falseAlarm);

    const nextState = step5_revealEncounterCards(state);

    // Prompt is suppressed: cannot afford cost
    expect(nextState.pendingDecisionPrompt).toBeUndefined();
    // Treachery executed normally: player is confused
    expect(nextState.players[0].statusCards).toContain(StatusCard.CONFUSED);
  });

  it('canPayAbilityCost returns false when only non-matching resources are available for a required resource type', () => {
    const spiderSense = createCardInstance(cardCatalog.getCard('01004')!);
    const physicalOnlyCard = createCardInstance({
      code: 'test_physical',
      name: 'Physical Card',
      type: 'event',
      cost: 1,
      resources: { physical: 1, total: 1 },
    } as any);

    state.players[0].hand = [spiderSense, physicalOnlyCard];
    state.players[0].tableau = [];

    // Synthetic ability requiring mental resource
    const mentalReqAbility = {
      ...spiderSense.card.enrichment!.abilities![0],
      cost: {
        discardSelf: true,
        resourceCost: { mental: 1 },
      },
    };

    const costCheck = canPayAbilityCost(state, state.players[0], mentalReqAbility, spiderSense);
    expect(costCheck.allowed).toBe(false);
  });

  it('resolving decision prompt with paymentCardInstanceIds correctly consumes the payment card and discards Enhanced Spider-Sense', () => {
    const spiderSense = createCardInstance(cardCatalog.getCard('01004')!);
    const paymentCard = createCardInstance(cardCatalog.getCard('01005')!);
    state.players[0].hand = [spiderSense, paymentCard];
    state.players[0].tableau = [];

    const falseAlarm = createCardInstance(cardCatalog.getCard('01112')!);
    state.players[0].dealtEncounterCards.push(falseAlarm);

    const nextState = step5_revealEncounterCards(state);
    expect(nextState.pendingDecisionPrompt).toBeDefined();

    const yesOption = nextState.pendingDecisionPrompt!.options.find((o) => o.id !== 'pass')!;
    expect(yesOption).toBeDefined();

    const { state: resolvedState } = resolveDecisionPrompt(nextState, 'p1', yesOption.id, {
      paymentCardInstanceIds: [paymentCard.instanceId],
    });

    // Hand is now empty (both spiderSense and paymentCard consumed)
    expect(resolvedState.players[0].hand.length).toBe(0);
    // Both cards in discard
    expect(
      resolvedState.players[0].discard.some((c) => c.instanceId === spiderSense.instanceId),
    ).toBe(true);
    expect(
      resolvedState.players[0].discard.some((c) => c.instanceId === paymentCard.instanceId),
    ).toBe(true);
    // Treachery was cancelled
    expect(resolvedState.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
  });

  it('resolving decision prompt with generatorInstanceIds exhausts the generator and discards Enhanced Spider-Sense', () => {
    const spiderSense = createCardInstance(cardCatalog.getCard('01004')!);
    // Hand has ONLY spiderSense
    state.players[0].hand = [spiderSense];

    // Tableau has ready Web-Shooter generator (01008)
    const webShooter = createCardInstance(cardCatalog.getCard('01008')!);
    webShooter.counters = { web: 3 };
    webShooter.tokens = { counters: 3 };
    webShooter.exhausted = false;
    state.players[0].tableau = [webShooter];

    const falseAlarm = createCardInstance(cardCatalog.getCard('01112')!);
    state.players[0].dealtEncounterCards.push(falseAlarm);

    const nextState = step5_revealEncounterCards(state);
    expect(nextState.pendingDecisionPrompt).toBeDefined();

    const yesOption = nextState.pendingDecisionPrompt!.options.find((o) => o.id !== 'pass')!;
    expect(yesOption).toBeDefined();

    const { state: resolvedState } = resolveDecisionPrompt(nextState, 'p1', yesOption.id, {
      generatorInstanceIds: [webShooter.instanceId],
    });

    // Generator was exhausted
    const resolvedGen = resolvedState.players[0].tableau.find(
      (c) => c.instanceId === webShooter.instanceId,
    )!;
    expect(resolvedGen.exhausted).toBe(true);
    // Hand is now empty (spiderSense discarded)
    expect(resolvedState.players[0].hand.length).toBe(0);
    expect(
      resolvedState.players[0].discard.some((c) => c.instanceId === spiderSense.instanceId),
    ).toBe(true);
    // Treachery was cancelled
    expect(resolvedState.players[0].statusCards).not.toContain(StatusCard.CONFUSED);
  });
});
