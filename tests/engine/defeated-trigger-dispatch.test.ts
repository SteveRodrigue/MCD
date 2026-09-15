import { describe, expect, it } from 'vitest';
import { setupGame } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { dispatchTrigger } from '../../src/engine/triggers/trigger-dispatcher';

function createState() {
  return setupGame({
    scenarioId: 'rhino',
    players: [
      {
        id: 'p1',
        name: 'Spider-Man',
        hero: cardCatalog.getCard('01001a')! as any,
        alterEgo: cardCatalog.getCard('01001b')! as any,
        deckCards: [cardCatalog.getCard('01005')!],
      },
    ],
    villain: cardCatalog.getCard('01094')! as any,
    mainScheme: cardCatalog.getCard('01097')! as any,
    encounterCards: cardCatalog.getCardsBySet('rhino'),
    skipMulligan: true,
  });
}

describe('Canonical defeat trigger dispatch (ADR-0058)', () => {
  it('resolves universal and character defeat triggers with the canonical event context', () => {
    const state = createState();
    const activeForm = state.players[0].activeFormCard as any;
    activeForm.enrichment = {
      ...(activeForm.enrichment || {}),
      abilities: [
        {
          id: 'canonical_defeat_counter',
          timing: 'FORCED_RESPONSE',
          trigger: 'DEFEATED',
          steps: [{ effect: 'ADD_COUNTERS', effectParams: { target: 'IDENTITY', amount: 1 } }],
        },
        {
          id: 'canonical_character_defeat_counter',
          timing: 'FORCED_RESPONSE',
          trigger: 'CHARACTER_DEFEATED',
          steps: [{ effect: 'ADD_COUNTERS', effectParams: { target: 'IDENTITY', amount: 1 } }],
        },
      ],
    };

    dispatchTrigger(state, 'DEFEATED', {
      targetPlayerId: 'p1',
      sourceInstanceId: 'minion_1',
      entityType: 'CHARACTER',
    });
    dispatchTrigger(state, 'CHARACTER_DEFEATED', {
      targetPlayerId: 'p1',
      sourceInstanceId: 'minion_1',
      entityType: 'CHARACTER',
    });

    expect(state.players[0].counters?.all_purpose).toBe(2);
  });

  it('accepts canonical scheme defeat context without replacing legacy trigger vocabulary', () => {
    const state = createState();
    const activeForm = state.players[0].activeFormCard as any;
    activeForm.enrichment = {
      ...(activeForm.enrichment || {}),
      abilities: [
        {
          id: 'canonical_scheme_defeat_counter',
          timing: 'FORCED_RESPONSE',
          trigger: 'SCHEME_DEFEATED',
          steps: [{ effect: 'ADD_COUNTERS', effectParams: { target: 'IDENTITY', amount: 1 } }],
        },
      ],
    };

    dispatchTrigger(state, 'SCHEME_DEFEATED', {
      targetPlayerId: 'p1',
      sourceInstanceId: state.mainScheme.instanceId,
      entityType: 'SCHEME',
    });

    expect(state.players[0].counters?.all_purpose).toBe(1);
  });

  it('filters enemy attack triggers by attacker kind and target scope', () => {
    const state = createState();
    const activeForm = state.players[0].activeFormCard as any;
    activeForm.enrichment = {
      ...(activeForm.enrichment || {}),
      abilities: [
        {
          id: 'spider_sense',
          timing: 'FORCED_RESPONSE',
          trigger: 'ENEMY_INITIATES_ATTACK',
          triggerFilter: {
            attackerKind: 'VILLAIN',
            targetPlayerScope: 'SELF',
          },
          steps: [{ effect: 'ADD_COUNTERS', effectParams: { target: 'IDENTITY', amount: 1 } }],
        },
      ],
    };

    dispatchTrigger(state, 'ENEMY_INITIATES_ATTACK', {
      targetPlayerId: 'p1',
      attackerType: 'VILLAIN',
      sourceInstanceId: 'villain_1',
      targetType: 'villain',
    });
    expect(state.players[0].counters?.all_purpose).toBe(1);

    dispatchTrigger(state, 'ENEMY_INITIATES_ATTACK', {
      targetPlayerId: 'p1',
      attackerType: 'MINION',
      sourceInstanceId: 'minion_1',
      targetType: 'minion',
    });
    expect(state.players[0].counters?.all_purpose).toBe(1);
  });
});
