import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  CardAbility,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  executeEffect,
  endPlayerPhase,
  getEffectivePlayerTraits,
  step6_endVillainPhaseAndRound,
} from '@engine/index';

/**
 * ADD_TRAIT as an effect step (#131): lasts for its `duration`, or while the source card stays in
 * play when none is given. The CONSTANT form (Cosmic Flight) is covered by
 * conditional-trait-gating.test.ts.
 */
describe('ADD_TRAIT as an effect step (Issue #131)', () => {
  let state: GameState;
  const player = () => state.players[0];

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Iron Man',
          hero: cardCatalog.getCard('01029a') as HeroCard,
          alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    player().currentForm = 'hero';
    player().activeFormCard = player().hero;
  });

  const grant = (effectParams: Record<string, unknown>, inPlay = true) => {
    const source = createCardInstance(cardCatalog.getCard('01039')!);
    if (inPlay) player().tableau.push(source);
    const ability = {
      id: 'test_add_trait',
      timing: 'HERO_ACTION',
      steps: [{ effect: 'ADD_TRAIT', effectParams: { trait: 'Aerial', ...effectParams } }],
    } as unknown as CardAbility;
    const res = executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: source });
    return { source, res };
  };

  it('without a duration, lasts while the source card is in play', () => {
    const { source } = grant({});
    expect(getEffectivePlayerTraits(player(), state)).toContain('Aerial');

    // survives phase and round boundaries
    endPlayerPhase(state);
    expect(getEffectivePlayerTraits(player(), state)).toContain('Aerial');
    step6_endVillainPhaseAndRound(state);
    expect(getEffectivePlayerTraits(player(), state)).toContain('Aerial');

    // gone as soon as the source leaves play
    player().tableau = player().tableau.filter((c) => c.instanceId !== source.instanceId);
    expect(getEffectivePlayerTraits(player(), state)).not.toContain('Aerial');
  });

  it('a PHASE duration ends with the player phase even while the source stays in play', () => {
    grant({ duration: 'PHASE' });
    expect(getEffectivePlayerTraits(player(), state)).toContain('Aerial');
    endPlayerPhase(state);
    expect(getEffectivePlayerTraits(player(), state)).not.toContain('Aerial');
  });

  it('a ROUND duration survives the player phase and ends with the round', () => {
    grant({ duration: 'ROUND' });
    endPlayerPhase(state);
    expect(getEffectivePlayerTraits(player(), state)).toContain('Aerial');
    step6_endVillainPhaseAndRound(state);
    expect(getEffectivePlayerTraits(player(), state)).not.toContain('Aerial');
  });

  it('re-resolving the same grant does not duplicate it', () => {
    grant({ duration: 'PHASE' });
    const modifiers = player().activeTraitModifiers!.length;
    const source = player().tableau[0];
    executeEffect(
      state,
      {
        id: 'again',
        timing: 'HERO_ACTION',
        steps: [
          {
            effect: 'ADD_TRAIT',
            effectParams: { trait: 'Aerial', duration: 'PHASE', target: 'SELF_IDENTITY' },
          },
        ],
      } as unknown as CardAbility,
      { playerId: 'p1', sourceCardInstance: source },
    );
    expect(player().activeTraitModifiers).toHaveLength(modifiers);
  });

  it('grants nothing for an unsupported target or a missing trait', () => {
    grant({ target: 'ALL_ENEMIES' });
    grant({ trait: '  ' });
    expect(player().activeTraitModifiers ?? []).toHaveLength(0);
    expect(getEffectivePlayerTraits(player(), state)).not.toContain('Aerial');
  });
});
