import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  getEffectivePlayerTraits,
  getEffectivePlayerTraitsDetails,
  hasPlayerTrait,
} from '@engine/pipeline/stat-calculator';

describe('Conditional (gated) ADD_TRAIT (Issue #154, RR v1.8)', () => {
  let state: GameState;
  let captainMarvel: HeroCard;
  let carolDanvers: AlterEgoCard;

  beforeEach(() => {
    captainMarvel = cardCatalog.getCard('01010a') as HeroCard;
    carolDanvers = cardCatalog.getCard('01010b') as AlterEgoCard;
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Carol',
          hero: captainMarvel,
          alterEgo: carolDanvers,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
  });

  function setForm(form: 'hero' | 'alter_ego') {
    const p = state.players[0];
    p.currentForm = form;
    p.activeFormCard = form === 'hero' ? captainMarvel : carolDanvers;
  }

  function syntheticTrait(gate?: string, gateParams?: Record<string, unknown>): CardInstance {
    const inst = createCardInstance(cardCatalog.getCard('01093')!);
    inst.card = {
      ...inst.card,
      enrichment: {
        abilities: [
          {
            id: 'gated_trait',
            timing: 'CONSTANT',
            steps: [{ effect: 'ADD_TRAIT', gate, gateParams, effectParams: { trait: 'Flying' } }],
          },
        ],
      },
    } as any;
    return inst;
  }

  it('Cosmic Flight (01017) grants Aerial in Hero form', () => {
    state.players[0].tableau.push(createCardInstance(cardCatalog.getCard('01017')!));
    setForm('hero');
    const player = state.players[0];
    expect(getEffectivePlayerTraits(player)).toContain('Aerial');
    expect(hasPlayerTrait(player, 'Aerial')).toBe(true);
  });

  it('Cosmic Flight (01017) does NOT grant Aerial in Alter-Ego form', () => {
    state.players[0].tableau.push(createCardInstance(cardCatalog.getCard('01017')!));
    setForm('alter_ego');
    const player = state.players[0];
    expect(getEffectivePlayerTraits(player)).not.toContain('Aerial');
    expect(hasPlayerTrait(player, 'Aerial')).toBe(false);
    expect(getEffectivePlayerTraitsDetails(player).dynamicTraits).toEqual([]);
  });

  it('a gated ADD_TRAIT only applies in the gated form (engine, independent of data)', () => {
    state.players[0].tableau.push(syntheticTrait('IF_FORM', { form: 'alter_ego' }));
    setForm('hero');
    expect(hasPlayerTrait(state.players[0], 'Flying')).toBe(false);
    setForm('alter_ego');
    expect(hasPlayerTrait(state.players[0], 'Flying')).toBe(true);
  });

  it('state gates are evaluated when state is supplied, skipped otherwise', () => {
    state.players[0].tableau.push(syntheticTrait('IF_CARD_IN_PLAY', { cardCode: '01064' }));
    const player = state.players[0];
    expect(hasPlayerTrait(player, 'Flying', state)).toBe(false);
    player.tableau.push(createCardInstance(cardCatalog.getCard('01064')!));
    expect(hasPlayerTrait(player, 'Flying', state)).toBe(true);
    expect(hasPlayerTrait(player, 'Flying')).toBe(false);
  });

  it('ungated ADD_TRAIT still applies in both forms', () => {
    state.players[0].tableau.push(syntheticTrait());
    setForm('hero');
    expect(hasPlayerTrait(state.players[0], 'Flying')).toBe(true);
    setForm('alter_ego');
    expect(hasPlayerTrait(state.players[0], 'Flying')).toBe(true);
  });
});
