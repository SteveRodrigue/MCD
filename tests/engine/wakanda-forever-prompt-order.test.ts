import { describe, it, expect } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { executeEffect } from '@engine/effects';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { enqueueDecisionPrompt, popDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { resumePendingSpecialSequence } from '@engine/specials/special-registry';
import { GameState, StatusCard, getActiveVillain, getActiveMainScheme } from '@engine/models';

/**
 * Wakanda Forever! resolves each Black Panther upgrade's Special as an ordered step (RR v1.8 p. 28,
 * ADR-0038). A step that needs a decision (Energy Daggers: "choose a player" in multiplayer) must
 * pause the sequence; later steps wait for the answer (#207).
 */
function buildGame(): GameState {
  const state = setupGame({
    scenarioId: 'rhino',
    players: [
      {
        id: 'p1',
        name: 'Black Panther',
        hero: cardCatalog.getCard('01040a')!,
        alterEgo: cardCatalog.getCard('01040b')!,
        deckCards: [cardCatalog.getCard('01044')!],
      },
      {
        id: 'p2',
        name: 'Spider-Man',
        hero: cardCatalog.getCard('01001a')!,
        alterEgo: cardCatalog.getCard('01001b')!,
        deckCards: [cardCatalog.getCard('01044')!],
      },
    ] as any,
    villain: cardCatalog.getCard('01094')! as any,
    mainScheme: cardCatalog.getCard('01097')! as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });
  state.players[0].currentForm = 'hero';
  state.players[0].activeFormCard = cardCatalog.getCard('01040a')!;
  state.players[1].engagedMinions = [createCardInstance(cardCatalog.getCard('01096')!)];
  return state;
}

const upgrade = (code: string) => createCardInstance(cardCatalog.getCard(code)!);

function playWakandaForever(state: GameState, order: string[]) {
  const wf = createCardInstance(cardCatalog.getCard('01043a')!);
  return executeEffect(
    state,
    {
      id: 'wf_test',
      timing: 'HERO_ACTION',
      steps: [{ effect: 'EXECUTE_WAKANDA_FOREVER', effectParams: { sequenceOrder: order } }],
    } as any,
    { playerId: 'p1', sourceCardInstance: wf },
  );
}

function choosePlayer(state: GameState, targetPlayerId: string) {
  const prompt = peekDecisionPrompt(state)!;
  const option = prompt.options.find((o) => (o.params as any)?.targetPlayerId === targetPlayerId)!;
  return dispatchAction(state, {
    type: 'RESOLVE_DECISION_PROMPT',
    playerId: 'p1',
    selectedOptionId: option.id,
  } as any).state;
}

describe('Wakanda Forever! pauses for a mid-sequence decision (Issue #207)', () => {
  it('Daggers then Claws vs a Tough villain: Daggers removes Tough first, Claws deals the 4-damage finisher', () => {
    const state = buildGame();
    const daggers = upgrade('01046');
    const claws = upgrade('01047');
    state.players[0].tableau = [daggers, claws];
    const villain = getActiveVillain(state);
    villain.statusCards = [StatusCard.TOUGH];
    const hp = villain.health;

    const res = playWakandaForever(state, [daggers.instanceId, claws.instanceId]);

    // Paused on Daggers' prompt: Claws has not resolved yet.
    expect(peekDecisionPrompt(res.state)).toBeDefined();
    expect(getActiveVillain(res.state).health).toBe(hp);
    expect(getActiveVillain(res.state).statusCards).toContain(StatusCard.TOUGH);

    const after = choosePlayer(res.state, 'p2');
    expect(getActiveVillain(after).statusCards ?? []).not.toContain(StatusCard.TOUGH);
    expect(getActiveVillain(after).health).toBe(hp - 4);
    expect(peekDecisionPrompt(after)).toBeUndefined();
  });

  it('Daggers in the middle of three: earlier steps resolve first, later steps wait for the answer', () => {
    const state = buildGame();
    const claws = upgrade('01047');
    const daggers = upgrade('01046');
    const genius = upgrade('01048');
    state.players[0].tableau = [claws, daggers, genius];
    getActiveMainScheme(state).threat = 5;
    const hp = getActiveVillain(state).health;

    const res = playWakandaForever(state, [
      claws.instanceId,
      daggers.instanceId,
      genius.instanceId,
    ]);

    // Claws (step 1, base 2 damage) resolved; Tactical Genius (final) has not.
    expect(peekDecisionPrompt(res.state)).toBeDefined();
    expect(getActiveVillain(res.state).health).toBe(hp - 2);
    expect(getActiveMainScheme(res.state).threat).toBe(5);

    const after = choosePlayer(res.state, 'p2');
    // Daggers (step 2, base 1 damage), then Tactical Genius finisher (2 threat).
    expect(getActiveVillain(after).health).toBe(hp - 3);
    expect(getActiveMainScheme(after).threat).toBe(3);
  });

  it('completes cleanly: no prompt and no leftover pending sequence', () => {
    const state = buildGame();
    const daggers = upgrade('01046');
    const claws = upgrade('01047');
    state.players[0].tableau = [daggers, claws];
    const res = playWakandaForever(state, [daggers.instanceId, claws.instanceId]);
    const after = choosePlayer(res.state, 'p2');
    expect(peekDecisionPrompt(after)).toBeUndefined();
    expect((after as any).pendingSpecialSequence).toBeUndefined();
  });

  it('a prompt-free sequence still resolves immediately (no pending state)', () => {
    const state = buildGame();
    const claws = upgrade('01047');
    const genius = upgrade('01048');
    state.players[0].tableau = [claws, genius];
    getActiveMainScheme(state).threat = 5;
    const hp = getActiveVillain(state).health;
    const res = playWakandaForever(state, [claws.instanceId, genius.instanceId]);
    expect(peekDecisionPrompt(res.state)).toBeUndefined();
    expect(getActiveVillain(res.state).health).toBe(hp - 2);
    expect(getActiveMainScheme(res.state).threat).toBe(3);
    expect((res.state as any).pendingSpecialSequence).toBeUndefined();
  });
  it('does not resume early while an unrelated prompt is still queued, then completes once it is gone', () => {
    const state = buildGame();
    const claws = upgrade('01047');
    const daggers = upgrade('01046');
    const genius = upgrade('01048');
    state.players[0].tableau = [claws, daggers, genius];
    getActiveMainScheme(state).threat = 5;

    const res = playWakandaForever(state, [
      claws.instanceId,
      daggers.instanceId,
      genius.instanceId,
    ]);
    const afterDaggersPrompt = res.state;
    // Another prompt arrives behind Daggers' prompt.
    enqueueDecisionPrompt(afterDaggersPrompt, {
      promptId: 'unrelated',
      playerId: 'p1',
      title: 'Unrelated',
      description: 'Unrelated prompt',
      sourceCardName: 'Test',
      options: [{ id: 'ok', label: 'OK', effect: 'NOOP' }],
      isVoluntary: false,
    } as any);

    const answered = choosePlayer(afterDaggersPrompt, 'p2');
    expect(peekDecisionPrompt(answered)?.promptId).toBe('unrelated');
    expect(answered.pendingSpecialSequence?.remainingUpgradeIds).toEqual([genius.instanceId]);
    expect(getActiveMainScheme(answered).threat).toBe(5);

    popDecisionPrompt(answered);
    const resumed = resumePendingSpecialSequence(answered);
    expect(getActiveMainScheme(resumed).threat).toBe(3);
    expect(resumed.pendingSpecialSequence).toBeUndefined();
  });
});
