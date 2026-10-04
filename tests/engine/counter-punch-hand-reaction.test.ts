import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, MinionCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  dispatchAction,
  initiateEnemyAttack,
  peekDecisionPrompt,
  resolveDefenderDeclaration,
} from '@engine/pipeline';
import { dispatchTrigger } from '@engine/triggers/trigger-dispatcher';

const COUNTER_PUNCH = '01077';
const HERO_ATK = 2; // Spider-Man base ATK

describe('Counter-Punch (01077): hand reaction after your hero defends', () => {
  let state: GameState;

  const give = (playerIndex: number, code: string) => {
    const inst = createCardInstance(cardCatalog.getCard(code)!);
    state.players[playerIndex].hand.push(inst);
    return inst;
  };

  beforeEach(() => {
    const spiderMan = cardCatalog.getCard('01001a') as HeroCard;
    const peter = cardCatalog.getCard('01001b') as AlterEgoCard;
    const captainMarvel = cardCatalog.getCard('01010a') as HeroCard;
    const carol = cardCatalog.getCard('01010b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: spiderMan,
          alterEgo: peter,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Player 2',
          hero: captainMarvel,
          alterEgo: carol,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    for (const [i, hero] of [spiderMan, captainMarvel].entries()) {
      state.players[i].currentForm = 'hero';
      state.players[i].activeFormCard = hero;
      state.players[i].hand = [];
      state.players[i].discard = [];
    }
    state.encounterDeck = [];
  });

  it('costs nothing: playable with Counter-Punch as the only card in hand, damages the villain attacker', () => {
    const cp = give(0, COUNTER_PUNCH);
    const villainHp = state.villain.health;

    initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1', { acceptOptionalTriggers: true });
    resolveDefenderDeclaration(state, { type: 'HERO', playerId: 'p1' }, state.activeAttackContext!);

    expect(state.villain.health).toBe(villainHp - HERO_ATK);
    // Spider-Sense draws one card when the attack starts, so the hand is not empty.
    expect(state.players[0].hand.map((c) => c.instanceId)).not.toContain(cp.instanceId);
    expect(state.players[0].discard.map((c) => c.instanceId)).toContain(cp.instanceId);
  });

  it('damages the attacking minion, not the villain', () => {
    give(0, COUNTER_PUNCH);
    const minion = createCardInstance(cardCatalog.getCard('01101') as MinionCard);
    state.players[0].engagedMinions.push(minion);
    const villainHp = state.villain.health;

    initiateEnemyAttack(state, { type: 'MINION', card: minion }, 'p1', {
      acceptOptionalTriggers: true,
    });
    resolveDefenderDeclaration(state, { type: 'HERO', playerId: 'p1' }, state.activeAttackContext!);

    expect(minion.tokens?.damage ?? 0).toBe(HERO_ATK);
    expect(state.villain.health).toBe(villainHp);
  });

  it('does not discard another card as payment', () => {
    const cp = give(0, COUNTER_PUNCH);
    const other1 = give(0, '01005');
    const other2 = give(0, '01005');

    initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1', { acceptOptionalTriggers: true });
    resolveDefenderDeclaration(state, { type: 'HERO', playerId: 'p1' }, state.activeAttackContext!);

    // Spider-Sense draws one card when the attack starts; the other two cards stay untouched.
    const handIds = state.players[0].hand.map((c) => c.instanceId);
    expect(handIds).toContain(other1.instanceId);
    expect(handIds).toContain(other2.instanceId);
    expect(handIds).not.toContain(cp.instanceId);
    expect(state.players[0].discard.map((c) => c.instanceId)).toEqual([cp.instanceId]);
  });

  it('offers an optional prompt with no payment, and accepting damages the attacker', () => {
    give(0, COUNTER_PUNCH);
    const villainHp = state.villain.health;

    dispatchTrigger(state, 'ATTACK_DEFENDED', {
      targetPlayerId: 'p1',
      defenderType: 'HERO',
      targetInstanceId: state.villain.instanceId,
    });

    const prompt = peekDecisionPrompt(state)!;
    expect(prompt).toBeDefined();
    const yes = prompt.options.find((o) => o.id === 'trigger_counter_punch_response')!;
    expect(yes.params?.requiresPayment).toBe(false);

    const res = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: yes.id,
    });
    expect(res.result.success).toBe(true);
    expect(res.state.villain.health).toBe(villainHp - HERO_ATK);
    expect(res.state.players[0].hand).toHaveLength(0);
  });

  it('is not offered when an ally defends (the card says "your hero defends")', () => {
    give(0, COUNTER_PUNCH);

    dispatchTrigger(state, 'ATTACK_DEFENDED', {
      targetPlayerId: 'p1',
      defenderType: 'ALLY',
      targetInstanceId: state.villain.instanceId,
      acceptOptionalTriggers: true,
    });

    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(state.players[0].hand).toHaveLength(1);
  });

  it("is not offered to another player's hand when a different hero defends", () => {
    give(1, COUNTER_PUNCH);

    dispatchTrigger(state, 'ATTACK_DEFENDED', {
      targetPlayerId: 'p1',
      defenderType: 'HERO',
      targetInstanceId: state.villain.instanceId,
      acceptOptionalTriggers: true,
    });

    expect(state.players[1].hand).toHaveLength(1);
    expect(state.players[1].discard).toHaveLength(0);
  });
});
