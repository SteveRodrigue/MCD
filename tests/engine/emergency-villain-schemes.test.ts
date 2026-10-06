import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, SideSchemeCard } from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import { applyThreatPlacement } from '@engine/pipeline/threat-pipeline';
import {
  executeVillainSchemeAgainstPlayer,
  step1_placeThreat,
} from '@engine/pipeline/villain-phase';
import { peekDecisionPrompt } from '@engine/pipeline/prompt-queue';
import { dispatchTrigger, matchesTriggerFilter } from '@engine/triggers/trigger-dispatcher';
import { executeEffect } from '@engine/effects';

/**
 * Issue #240: Emergency (01085) reads "When the villain schemes, reduce the amount of threat
 * placed on the scheme by 1". It must only be offered when the placement comes from the villain's
 * scheme activation (RR v1.8 glossary "Scheme (Enemy Activation)"), not for every threat placement.
 */
describe('Emergency 01085 is scoped to the villain scheme (Issue #240)', () => {
  let state: GameState;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      shuffleFn: (arr) => arr,
      skipMulligan: true,
      skipScenarioPlugin: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = state.players[0].hero;
    // Known filler on top of the encounter deck: a boost card with no star effect.
    state.encounterDeck = [
      createCardInstance(cardCatalog.getCard('01005')!),
      ...state.encounterDeck,
    ];
    state.players[0].hand = [createCardInstance(cardCatalog.getCard('01085')!)];
  });

  function emergencyPrompt(s: GameState) {
    const prompt = peekDecisionPrompt(s);
    return prompt?.sourceCardCode === '01085' ? prompt : undefined;
  }

  it('offers Emergency when the villain schemes and Emergency is discarded when accepted', () => {
    executeVillainSchemeAgainstPlayer(state, state.players[0]);
    expect(emergencyPrompt(state)).toBeDefined();

    // Accepting: the trigger reduces the placed amount by 1 and discards Emergency.
    const res = dispatchTrigger(state, 'THREAT_WOULD_BE_PLACED', {
      targetPlayerId: 'p1',
      threatAmount: 3,
      threatSource: 'VILLAIN_SCHEME',
      acceptOptionalTriggers: true,
    });
    expect(res.threatAmount).toBe(2);
    expect(res.state.players[0].discard.some((c) => c.card.code === '01085')).toBe(true);
  });

  it('does not offer Emergency for the villain phase step 1 threat', () => {
    step1_placeThreat(state);
    expect(emergencyPrompt(state)).toBeUndefined();
  });

  it("does not offer Emergency for a minion's scheme", () => {
    applyThreatPlacement(state, {
      targetType: 'main_scheme',
      amount: 2,
      sourceType: 'MINION_SCHEME',
      sourcePlayerId: 'p1',
    });
    expect(emergencyPrompt(state)).toBeUndefined();
  });

  it('does not offer Emergency for a When Revealed placing threat (Breakin & Takin)', () => {
    const card = cardCatalog.getCard('01107') as SideSchemeCard;
    const inst = createCardInstance(card);
    state.sideSchemes.push({ instanceId: inst.instanceId, card, threat: 0 });
    const ability = card.enrichment!.abilities!.find((a) => a.trigger === 'WHEN_REVEALED')!;
    const before = state.mainScheme.threat;
    executeEffect(state, ability, { playerId: 'p1', sourceCardInstance: inst });
    expect(emergencyPrompt(state)).toBeUndefined();
    expect(state.players[0].hand.some((c) => c.card.code === '01085')).toBe(true);
    expect(state.mainScheme.threat).toBeGreaterThanOrEqual(before);
  });

  it('does not offer Emergency for a card effect or Incite placement', () => {
    for (const sourceType of ['CARD_EFFECT', 'INCITE'] as const) {
      applyThreatPlacement(state, {
        targetType: 'main_scheme',
        amount: 2,
        sourceType,
        sourcePlayerId: 'p1',
      });
      expect(emergencyPrompt(state)).toBeUndefined();
    }
  });

  it('still offers Great Responsibility for a CARD_EFFECT placement (any threat)', () => {
    state.players[0].hand = [
      createCardInstance(cardCatalog.getCard('01061')!),
      createCardInstance(cardCatalog.getCard('01005')!),
      createCardInstance(cardCatalog.getCard('01005')!),
    ];
    applyThreatPlacement(state, {
      targetType: 'main_scheme',
      amount: 2,
      sourceType: 'CARD_EFFECT',
      sourcePlayerId: 'p1',
    });
    expect(peekDecisionPrompt(state)?.sourceCardCode).toBe('01061');
  });

  describe('matchesTriggerFilter threatSource', () => {
    const base = { targetPlayerId: 'p1' };

    it('matches the same source', () => {
      expect(
        matchesTriggerFilter(
          { threatSource: 'VILLAIN_SCHEME' },
          { ...base, threatSource: 'VILLAIN_SCHEME' },
        ),
      ).toBe(true);
    });

    it('rejects a different source', () => {
      expect(
        matchesTriggerFilter(
          { threatSource: 'VILLAIN_SCHEME' },
          { ...base, threatSource: 'CARD_EFFECT' },
        ),
      ).toBe(false);
    });

    it('rejects when the context has no source', () => {
      expect(matchesTriggerFilter({ threatSource: 'VILLAIN_SCHEME' }, base)).toBe(false);
    });

    it('does not constrain when the filter has no threatSource', () => {
      expect(matchesTriggerFilter({}, { ...base, threatSource: 'CARD_EFFECT' })).toBe(true);
    });
  });
});
