import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEnemyAttackSynchronously } from '@engine/pipeline';

function syntheticEndOfAttackAttachment(id: string) {
  const base = cardCatalog.getCard('01099')!;
  return createCardInstance({
    ...base,
    code: 'TEST_ATTACK_END',
    name: 'Test End Of Attack',
    enrichment: {
      abilities: [
        {
          id,
          timing: 'FORCED_RESPONSE',
          trigger: 'HOST_ATTACK_ENDED',
          steps: [{ effect: 'DISCARD', effectParams: { source: 'SELF' } }],
        },
      ],
    },
  } as never);
}

describe('#294 HOST_ATTACK_ENDED: Charge (01099) discards at the end of the attack', () => {
  let state: GameState;

  beforeEach(() => {
    const hero = cardCatalog.getCard('01001a') as HeroCard;
    const alterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero,
          alterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = hero;
    state.players[0].hand = [];
    state.encounterDeck = [];
  });

  it('applies +3 ATK and Overkill during the attack, then discards Charge', () => {
    state.players[0].allies.push(createCardInstance(cardCatalog.getCard('01002')!));
    state.villain.attachments.push(createCardInstance(cardCatalog.getCard('01099')!));
    const initialHp = state.players[0].health;

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'ALLY_CHUMP_BLOCK');

    expect(state.players[0].allies.length).toBe(0);
    expect(state.players[0].health).toBe(initialHp - 3);
    expect(state.villain.attachments.some((a) => a.card.code === '01099')).toBe(false);
    expect(state.encounterDiscard.some((a) => a.card.code === '01099')).toBe(true);
  });

  it('the second Rhino attack has base ATK and no Overkill', () => {
    state.villain.attachments.push(createCardInstance(cardCatalog.getCard('01099')!));
    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

    state.players[0].allies.push(createCardInstance(cardCatalog.getCard('01002')!));
    const hpBefore = state.players[0].health;
    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'ALLY_CHUMP_BLOCK');

    // Base ATK 2 is fully absorbed by the ally; no spill without Overkill.
    expect(state.players[0].health).toBe(hpBefore);
  });

  it('a stunned Rhino does not attack and Charge stays attached', () => {
    state.villain.attachments.push(createCardInstance(cardCatalog.getCard('01099')!));
    state.villain.statusCards = [StatusCard.STUNNED];

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

    expect(state.villain.attachments.some((a) => a.card.code === '01099')).toBe(true);
    expect(state.encounterDiscard.some((a) => a.card.code === '01099')).toBe(false);
  });

  it('discards a non-01099 attachment with a HOST_ATTACK_ENDED ability on the villain', () => {
    const att = syntheticEndOfAttackAttachment('test_end_villain');
    state.villain.attachments.push(att);

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

    expect(state.villain.attachments.length).toBe(0);
    expect(state.encounterDiscard.some((a) => a.card.code === 'TEST_ATTACK_END')).toBe(true);
  });

  it('fires a HOST_ATTACK_ENDED attachment on an attacking minion exactly once', () => {
    const minion = createCardInstance(cardCatalog.getCard('01108')!);
    minion.attachments = [syntheticEndOfAttackAttachment('test_end_minion')];
    state.players[0].engagedMinions.push(minion);

    executeEnemyAttackSynchronously(
      state,
      { type: 'MINION', card: minion },
      'p1',
      'TAKE_UNDEFENDED',
    );

    expect(minion.attachments.length).toBe(0);
    expect(state.encounterDiscard.filter((a) => a.card.code === 'TEST_ATTACK_END').length).toBe(1);
  });
});
