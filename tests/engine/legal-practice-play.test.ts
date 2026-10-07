import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '../../src/engine/models';
import { setupGame } from '../../src/engine/state/game-setup';
import { dispatchAction } from '../../src/engine/pipeline';
import { peekDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';

// 01023 Legal Practice: "Alter-Ego Action (thwart): Choose and discard up to 5 cards from your
// hand -> remove 1 threat from a scheme for each card discarded this way."
// Played from hand with PLAY_CARD (the real game path), not from the tableau.
describe('01023 Legal Practice played from hand (#277)', () => {
  let state: GameState;

  const hand = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      instanceId: `h${i + 1}`,
      card: { name: `Card ${i + 1}` } as any,
      exhausted: false,
    }));

  const play = (discardIds: string[], handSize: number, s: GameState = state) => {
    const p = s.players[0];
    p.hand = [
      { instanceId: 'lp', card: cardCatalog.getCard('01023')!, exhausted: false },
      ...hand(handSize),
    ];
    p.discard = [];
    return dispatchAction(s, {
      type: 'PLAY_CARD',
      playerId: p.id,
      cardInstanceId: 'lp',
      discardCardInstanceIds: discardIds,
    } as any);
  };

  beforeEach(() => {
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Jennifer Walters',
          hero: cardCatalog.getCard('01019a') as HeroCard,
          alterEgo: cardCatalog.getCard('01019b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'alter_ego';
    state.players[0].activeFormCard = state.players[0].alterEgo;
    state.mainScheme.threat = 8;
  });

  it('pays the chosen discards and removes one threat per discarded card', () => {
    const res = play(['h1', 'h2', 'h3'], 3);
    expect(res.result.success).toBe(true);
    const p = res.state.players[0];
    expect(res.state.mainScheme.threat).toBe(5);
    expect(p.hand).toHaveLength(0);
    expect(p.discard.map((c) => c.instanceId).sort()).toEqual(['h1', 'h2', 'h3', 'lp']);
  });

  it('removes 5 threat with 5 cards and rejects a sixth', () => {
    const ok = play(['h1', 'h2', 'h3', 'h4', 'h5'], 6);
    expect(ok.result.success).toBe(true);
    expect(ok.state.mainScheme.threat).toBe(3);

    const tooMany = play(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'], 6);
    expect(tooMany.result.success).toBe(false);
    expect(tooMany.state.mainScheme.threat).toBe(8);
    expect(tooMany.state.players[0].hand).toHaveLength(7);
  });

  it('rejects discarding no card: the play would change nothing', () => {
    const res = play([], 3);
    expect(res.result.success).toBe(false);
    expect(res.state.players[0].hand).toHaveLength(4);
    expect(res.state.mainScheme.threat).toBe(8);
  });

  it('is not playable in hero form', () => {
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = state.players[0].hero;
    const res = play(['h1'], 3);
    expect(res.result.success).toBe(false);
    expect(res.state.players[0].hand).toHaveLength(4);
  });

  it('rejects the played card as its own discard and unknown cards, paying nothing', () => {
    const self = play(['lp'], 3);
    expect(self.result.success).toBe(false);
    expect(self.state.players[0].hand).toHaveLength(4);

    const unknown = play(['nope'], 3);
    expect(unknown.result.success).toBe(false);
    expect(unknown.state.players[0].hand).toHaveLength(4);
    expect(unknown.state.mainScheme.threat).toBe(8);
  });

  describe('with two schemes', () => {
    beforeEach(() => {
      state.sideSchemes.push({
        instanceId: 'ss_legal',
        card: cardCatalog.getCard('01109')!,
        threat: 4,
      } as any);
    });

    it('discards after the scheme is chosen and removes threat from that scheme only', () => {
      const res = play(['h1', 'h2', 'h3'], 3);
      expect(res.result.success).toBe(true);
      const prompt = peekDecisionPrompt(res.state)!;
      expect(prompt).toBeDefined();
      const chosen = res.state.sideSchemes.find((s) => s.instanceId === 'ss_legal')!;
      expect(res.state.players[0].hand).toHaveLength(3);

      const resolved = dispatchAction(res.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: chosen.instanceId,
      } as any);
      expect(resolved.result.success).toBe(true);
      expect(resolved.state.sideSchemes.find((s) => s.instanceId === 'ss_legal')?.threat ?? 0).toBe(
        1,
      );
      expect(resolved.state.mainScheme.threat).toBe(8);
      const p = resolved.state.players[0];
      expect(p.hand).toHaveLength(0);
      expect(p.discard.map((c) => c.instanceId).sort()).toEqual(['h1', 'h2', 'h3', 'lp']);
    });

    it('cancelling the scheme choice returns Legal Practice and keeps the hand', () => {
      const res = play(['h1', 'h2', 'h3'], 3);
      const cancel = dispatchAction(res.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'cancel_target',
      } as any);
      const p = cancel.state.players[0];
      expect(p.hand.map((c) => c.instanceId).sort()).toEqual(['h1', 'h2', 'h3', 'lp']);
      expect(p.discard).toHaveLength(0);
    });
  });
});
