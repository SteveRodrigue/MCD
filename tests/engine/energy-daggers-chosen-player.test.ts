import { describe, it, expect } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { executeEffect } from '@engine/effects';
import { dispatchAction, peekDecisionPrompt } from '@engine/pipeline';
import { StatusCard } from '@engine/models';

const WF_ABILITY = {
  id: 'wf_test',
  timing: 'HERO_ACTION' as const,
  steps: [{ effect: 'EXECUTE_SPECIAL' as const, effectParams: { specialId: 'WAKANDA_FOREVER' } }],
};

function buildGame(playerCount: 1 | 2) {
  const players: any[] = [
    {
      id: 'p1',
      name: 'Black Panther',
      hero: cardCatalog.getCard('01040a')!,
      alterEgo: cardCatalog.getCard('01040b')!,
      deckCards: [cardCatalog.getCard('01044')!],
    },
  ];
  if (playerCount === 2) {
    players.push({
      id: 'p2',
      name: 'Spider-Man',
      hero: cardCatalog.getCard('01001a')!,
      alterEgo: cardCatalog.getCard('01001b')!,
      deckCards: [cardCatalog.getCard('01044')!],
    });
  }
  const state = setupGame({
    scenarioId: 'rhino',
    players,
    villain: cardCatalog.getCard('01094')! as any,
    mainScheme: cardCatalog.getCard('01097')! as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });
  state.players[0].currentForm = 'hero';
  state.players[0].activeFormCard = cardCatalog.getCard('01040a')!;
  return state;
}

function giveMinions(state: ReturnType<typeof buildGame>) {
  const m1 = createCardInstance(cardCatalog.getCard('01096')!);
  const m2 = createCardInstance(cardCatalog.getCard('01096')!);
  state.players[0].engagedMinions = [m1];
  if (state.players[1]) state.players[1].engagedMinions = [m2];
  return { m1, m2 };
}

function playDaggersOnly(state: ReturnType<typeof buildGame>) {
  const daggers = createCardInstance(cardCatalog.getCard('01046')!);
  state.players[0].tableau = [daggers];
  const wf = createCardInstance(cardCatalog.getCard('01043a')!);
  return executeEffect(state, WF_ABILITY, { playerId: 'p1', sourceCardInstance: wf });
}

describe('Energy Daggers 01046: villain + enemies engaged with the CHOSEN player', () => {
  it('multiplayer: prompts for a player and damages only that player’s engaged minions', () => {
    const state = buildGame(2);
    const { m1, m2 } = giveMinions(state);
    const villainHp = state.villain.health;

    const res = playDaggersOnly(state);
    expect(res.success).toBe(true);

    const prompt = peekDecisionPrompt(res.state);
    expect(prompt).toBeDefined();
    expect(prompt!.options.map((o) => o.label).join(' ')).toContain('Spider-Man');

    const p2Option = prompt!.options.find((o) => (o.params as any)?.targetPlayerId === 'p2')!;
    const resolved = dispatchAction(res.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: p2Option.id,
    } as any);
    expect(resolved.result.success).toBe(true);

    const after = resolved.state;
    // Single upgrade in play: final step, so 2 damage
    expect(after.villain.health).toBe(villainHp - 2);
    expect(
      after.players[1].engagedMinions.find((m) => m.instanceId === m2.instanceId)?.tokens?.damage,
    ).toBe(2);
    expect(
      after.players[0].engagedMinions.find((m) => m.instanceId === m1.instanceId)?.tokens?.damage ??
        0,
    ).toBe(0);
  });

  it('solo: no prompt, hits the villain and own engaged minions', () => {
    const state = buildGame(1);
    const { m1 } = giveMinions(state);
    const villainHp = state.villain.health;

    const res = playDaggersOnly(state);

    expect(peekDecisionPrompt(res.state)).toBeUndefined();
    expect(res.state.villain.health).toBe(villainHp - 2);
    expect(
      res.state.players[0].engagedMinions.find((m) => m.instanceId === m1.instanceId)?.tokens
        ?.damage,
    ).toBe(2);
  });

  it('removes Tough instead of dealing damage to a Tough minion', () => {
    const state = buildGame(1);
    const { m1 } = giveMinions(state);
    m1.statusCards = [StatusCard.TOUGH];

    const res = playDaggersOnly(state);

    const minion = res.state.players[0].engagedMinions.find((m) => m.instanceId === m1.instanceId)!;
    expect(minion.statusCards ?? []).not.toContain(StatusCard.TOUGH);
    expect(minion.tokens?.damage ?? 0).toBe(0);
  });

  it('defeats an engaged minion whose HP is reached and discards it', () => {
    const state = buildGame(1);
    const { m1 } = giveMinions(state);
    const hp = (m1.card as any).health as number;
    m1.tokens = { ...m1.tokens, damage: hp - 1 };

    const res = playDaggersOnly(state);

    expect(res.state.players[0].engagedMinions.some((m) => m.instanceId === m1.instanceId)).toBe(
      false,
    );
    expect(res.state.encounterDiscard.some((c) => c.instanceId === m1.instanceId)).toBe(true);
  });

  it('chosen player with no engaged minions: only the villain is damaged', () => {
    const state = buildGame(1);
    state.players[0].engagedMinions = [];
    const villainHp = state.villain.health;

    const res = playDaggersOnly(state);

    expect(res.state.villain.health).toBe(villainHp - 2);
  });
});
