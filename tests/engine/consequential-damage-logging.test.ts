import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';

describe('Ally consequential damage logging and Tigra rules verification (Issue #533)', () => {
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

  const minion = (code = '01110'): CardInstance => createCardInstance(cardCatalog.getCard(code)!);
  const tigraInPlay = () => {
    const tigra = createCardInstance(cardCatalog.getCard('01051')!, 'p1');
    state.players[0].allies = [tigra];
    return tigra;
  };

  const allyConsequentialLogs = () =>
    state.log.filter(
      (entry) =>
        entry.key === 'damage.applied.ally' &&
        (entry.params as { source?: string })?.source === 'Consequential Damage',
    );

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

  it('Ally attack logs damage.applied.ally for consequential damage', () => {
    const tigra = tigraInPlay();
    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: tigra.instanceId,
      targetType: 'villain',
    });
    state = res.state;

    const logs = allyConsequentialLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].params).toEqual(
      expect.objectContaining({
        target: 'Tigra',
        source: 'Consequential Damage',
        amount: 1,
        totalDamage: 1,
        health: 3,
      }),
    );
    expect(logs[0].onomatopoeia).toBe('CONSEQUENTIAL DAMAGE');
  });

  it('Ally thwart logs damage.applied.ally for consequential damage', () => {
    const tigra = tigraInPlay();
    const mainScheme = state.mainSchemes![state.activeMainSchemeIndex ?? 0];
    mainScheme.threat = 3;

    const res = dispatchAction(state, {
      type: 'ALLY_THWART',
      playerId: 'p1',
      allyInstanceId: tigra.instanceId,
      targetType: 'main_scheme',
      targetInstanceId: mainScheme.instanceId,
    });
    state = res.state;

    const logs = allyConsequentialLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].params).toEqual(
      expect.objectContaining({
        target: 'Tigra',
        source: 'Consequential Damage',
        amount: 1,
        totalDamage: 1,
        health: 3,
      }),
    );
  });

  it('Tigra at 0 damage defeats minion: no heal prompt, takes 1 consequential damage with log event', () => {
    const tigra = tigraInPlay();
    tigra.tokens = { ...tigra.tokens, damage: 0 };

    const m = minion('01110'); // 1 HP minion
    state.players[0].engagedMinions = [m];

    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: tigra.instanceId,
      targetType: 'minion',
      targetInstanceId: m.instanceId,
    });
    state = res.state;

    // At 0 damage, she cannot heal per target legality rules; no prompt offered
    expect(tigraPrompts()).toHaveLength(0);

    // Consequential damage is applied with log event
    const logs = allyConsequentialLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].params).toEqual(
      expect.objectContaining({
        target: 'Tigra',
        source: 'Consequential Damage',
        amount: 1,
        totalDamage: 1,
        health: 3,
      }),
    );

    // Tigra ends with 1 damage
    expect(state.players[0].allies[0].tokens?.damage).toBe(1);
  });

  it('Tigra at 1 damage defeats minion: prompts heal, heals 1, then takes 1 consequential damage with log event', () => {
    const tigra = tigraInPlay();
    tigra.tokens = { ...tigra.tokens, damage: 1 };

    const m = minion('01110');
    state.players[0].engagedMinions = [m];

    const res = dispatchAction(state, {
      type: 'ALLY_ATTACK',
      playerId: 'p1',
      allyInstanceId: tigra.instanceId,
      targetType: 'minion',
      targetInstanceId: m.instanceId,
    });
    state = res.state;

    // Defeated minion prompts Tigra's heal response before consequential damage
    expect(tigraPrompts()).toHaveLength(1);
    // Consequential damage deferred until prompts resolve
    expect(allyConsequentialLogs()).toHaveLength(0);

    // Accept heal
    answer('p1', 'trigger_tigra_defeat_heal');

    // Healed 1 damage (1 -> 0), then consequential damage applied (0 -> 1) with log
    const logs = allyConsequentialLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].params).toEqual(
      expect.objectContaining({
        target: 'Tigra',
        source: 'Consequential Damage',
        amount: 1,
        totalDamage: 1,
        health: 3,
      }),
    );
    expect(state.players[0].allies[0].tokens?.damage).toBe(1);
  });
});
