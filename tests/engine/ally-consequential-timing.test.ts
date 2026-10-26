import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';

describe('Ally consequential damage timing vs response abilities (Issue #385)', () => {
  let state: GameState;

  const player = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  beforeEach(() => {
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [player('p1', '01001a', '01001b')],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = state.players[0].hero;
  });

  const minion = (code = '01110'): CardInstance => createCardInstance(cardCatalog.getCard(code)!); // 01110: 1 HP
  const tigraInPlay = () => {
    const tigra = createCardInstance(cardCatalog.getCard('01051')!, 'p1'); // Tigra: 3 HP, 2 ATK, 1 consequential
    state.players[0].allies = [tigra];
    return tigra;
  };

  const damageOn = (instanceId: string) =>
    state.players[0].allies.find((a) => a.instanceId === instanceId)?.tokens?.damage ?? 0;
  const allyInPlay = (instanceId: string) =>
    state.players[0].allies.some((a) => a.instanceId === instanceId);
  const prompts = () => state.pendingDecisionQueue ?? [];
  const tigraPrompts = () => prompts().filter((p) => p.sourceCardCode === '01051');

  const answer = (playerId: string, optionId: string) => {
    const res = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId,
      selectedOptionId: optionId,
    });
    state = res.state;
    return res;
  };

  it('Tigra with 2 damage defeats a minion: heals before consequential damage and survives (FAQ Appendix 04)', () => {
    const tigra = tigraInPlay();
    tigra.tokens = { ...tigra.tokens, damage: 2 }; // 1 HP remaining out of 3

    const m = minion('01101'); // 3 HP minion
    m.tokens = { ...m.tokens, damage: 2 }; // 1 HP remaining
    state.players[0].engagedMinions = [m];

    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: tigra.instanceId,
      targetType: 'minion',
      targetInstanceId: m.instanceId,
    });
    state = res.state;

    // Defeated minion should trigger Tigra's response
    expect(tigraPrompts()).toHaveLength(1);

    // Consequential damage has NOT been applied yet; Tigra is still alive with 2 damage
    expect(allyInPlay(tigra.instanceId)).toBe(true);
    expect(damageOn(tigra.instanceId)).toBe(2);

    // Answer prompt to heal 1 damage
    answer('p1', 'trigger_tigra_defeat_heal');

    // Tigra healed 1 (2 -> 1), then consequential damage was dealt (1 -> 2).
    // Tigra survives with 2 damage (1 HP remaining).
    expect(allyInPlay(tigra.instanceId)).toBe(true);
    expect(damageOn(tigra.instanceId)).toBe(2);
  });

  it('Tigra with 2 damage passes response: consequential damage defeats her', () => {
    const tigra = tigraInPlay();
    tigra.tokens = { ...tigra.tokens, damage: 2 };

    const m = minion('01101');
    m.tokens = { ...m.tokens, damage: 2 };
    state.players[0].engagedMinions = [m];

    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: tigra.instanceId,
      targetType: 'minion',
      targetInstanceId: m.instanceId,
    });
    state = res.state;

    expect(tigraPrompts()).toHaveLength(1);
    expect(allyInPlay(tigra.instanceId)).toBe(true);
    expect(damageOn(tigra.instanceId)).toBe(2);

    // Pass the trigger
    answer('p1', 'pass');

    // Consequential damage is applied (2 + 1 = 3 damage >= 3 HP), defeating Tigra
    expect(allyInPlay(tigra.instanceId)).toBe(false);
    expect(state.players[0].discard.some((c) => c.instanceId === tigra.instanceId)).toBe(true);
  });

  it('Tigra with 0 damage defeats a minion: cannot heal, no prompt, takes 1 consequential damage', () => {
    const tigra = tigraInPlay();
    tigra.tokens = { ...tigra.tokens, damage: 0 };

    const m = minion('01110'); // 1 HP
    state.players[0].engagedMinions = [m];

    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: tigra.instanceId,
      targetType: 'minion',
      targetInstanceId: m.instanceId,
    });
    state = res.state;

    // At 0 damage, HEAL_DAMAGE is not allowed per target state rules; no prompt offered
    expect(tigraPrompts()).toHaveLength(0);

    // Consequential damage applied immediately
    expect(allyInPlay(tigra.instanceId)).toBe(true);
    expect(damageOn(tigra.instanceId)).toBe(1);
  });
});
