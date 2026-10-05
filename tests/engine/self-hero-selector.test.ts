import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  StatusCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  peekDecisionPrompt,
  step4_revealEncounterCards,
} from '@engine/index';
import { executeEffect } from '@engine/effects';
import { resolveTargets } from '@engine/effects/target-resolver';

/**
 * `SELF_HERO` (#222): printed "your hero" is the resolving player's hero identity, and only while
 * it is in hero form. In alter-ego form it resolves to nothing (never a fallback to the alter-ego),
 * and other players are never touched.
 */
describe('SELF_HERO selector (#222)', () => {
  let state: GameState;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
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
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
    }
  });

  const p1 = () => state.players[0];
  const p2 = () => state.players[1];
  const toAlterEgo = (index: number) => {
    state.players[index].currentForm = 'alter_ego';
    state.players[index].activeFormCard = state.players[index].alterEgo;
  };
  const run = (steps: any[], playerId = 'p1') =>
    executeEffect(
      state,
      { id: 'test_self_hero', timing: 'ACTION', steps } as any,
      { playerId } as any,
    );

  describe('resolver', () => {
    it('resolves to the resolving player in hero form only', () => {
      const heroTargets = resolveTargets(state, 'SELF_HERO', { playerId: 'p1' } as any);
      expect(heroTargets.map((t) => t.id)).toEqual(['p1']);

      toAlterEgo(0);
      expect(resolveTargets(state, 'SELF_HERO', { playerId: 'p1' } as any)).toEqual([]);
    });

    it('never returns another player, whatever their form', () => {
      const ids = resolveTargets(state, 'SELF_HERO', { playerId: 'p2' } as any).map((t) => t.id);
      expect(ids).toEqual(['p2']);
    });

    it('SELF_IDENTITY still resolves the identity in both forms (guard)', () => {
      toAlterEgo(0);
      expect(resolveTargets(state, 'SELF_IDENTITY', { playerId: 'p1' } as any)).toHaveLength(1);
    });
  });

  describe('DEAL_DAMAGE', () => {
    const damage = (amount: unknown) => [
      { effect: 'DEAL_DAMAGE', effectParams: { amount, target: 'SELF_HERO' } },
    ];

    it('damages the resolving player in hero form and nobody else', () => {
      const before = [p1().health, p2().health];
      run(damage(2), 'p1');
      expect(p1().health).toBe(before[0] - 2);
      expect(p2().health).toBe(before[1]);
    });

    it('does nothing in alter-ego form, with no fallback to the alter-ego', () => {
      toAlterEgo(0);
      const before = p1().health;
      const res = run(damage(2), 'p1');
      expect(res.success).toBe(true);
      expect(p1().health).toBe(before);
    });

    it('is absorbed by Tough like any damage to a hero', () => {
      p1().statusCards.push(StatusCard.TOUGH);
      const before = p1().health;
      run(damage(2), 'p1');
      expect(p1().health).toBe(before);
      expect(p1().statusCards).not.toContain(StatusCard.TOUGH);
    });

    it('accepts a formula amount (1 per upgrade you control)', () => {
      p1().tableau.push(
        createCardInstance(cardCatalog.getCard('01081')!),
        createCardInstance(cardCatalog.getCard('01081')!),
      );
      const before = p1().health;
      run(damage({ from: 'ENTITY_COUNT', filter: { types: ['upgrade'] } }), 'p1');
      expect(p1().health).toBe(before - 2);
    });
  });

  describe('ADD_STATUS', () => {
    const stun = [
      { effect: 'ADD_STATUS', effectParams: { status: 'STUNNED', target: 'SELF_HERO' } },
    ];

    it('stuns the resolving player in hero form only', () => {
      run(stun, 'p1');
      expect(p1().statusCards).toContain(StatusCard.STUNNED);
      expect(p2().statusCards).not.toContain(StatusCard.STUNNED);
    });

    it('does not stun the alter-ego', () => {
      toAlterEgo(0);
      run(stun, 'p1');
      expect(p1().statusCards).not.toContain(StatusCard.STUNNED);
    });
  });
});

/**
 * Selector hygiene shipped with #222: False Alarm used the ad-hoc `ACTIVE_IDENTITY`; it now uses
 * `SELF_IDENTITY` with the same behaviour ("You are confused", the identity in either form).
 */
describe('False Alarm (01112) confuses the resolving identity in either form', () => {
  const revealFalseAlarm = (alterEgo: boolean) => {
    resetInstanceCounter();
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    const p = state.players[0];
    p.currentForm = alterEgo ? 'alter_ego' : 'hero';
    p.activeFormCard = alterEgo ? p.alterEgo : p.hero;
    p.dealtEncounterCards.push(createCardInstance(cardCatalog.getCard('01112')!));
    const revealed = step4_revealEncounterCards(state);
    if (peekDecisionPrompt(revealed)) {
      throw new Error('False Alarm must not prompt');
    }
    return revealed.players[0];
  };

  it('in hero form', () => {
    expect(revealFalseAlarm(false).statusCards).toContain(StatusCard.CONFUSED);
  });

  it('in alter-ego form', () => {
    expect(revealFalseAlarm(true).statusCards).toContain(StatusCard.CONFUSED);
  });
});
