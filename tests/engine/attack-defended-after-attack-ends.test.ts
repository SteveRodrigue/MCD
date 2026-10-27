import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { spyKernel } from '../helpers/kernel-spy';
import { GameState, HeroCard, AlterEgoCard, getActiveVillain } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { executeEnemyAttackSynchronously } from '@engine/pipeline';

// RR v1.8 Defend: "Abilities that trigger after a character defends an attack resolve after that
// attack ends." Attack step 6: forced abilities (Retaliate, ...) before non-forced ones (#402).

interface DefendedSnapshot {
  villainHealth: number;
  chargeAttached: boolean;
  triggersBefore: string[];
}

describe('#402 ATTACK_DEFENDED fires after the attack has fully ended', () => {
  let state: GameState;
  let seen: string[];
  let atDefended: DefendedSnapshot[];

  beforeEach(() => {
    const hero = cardCatalog.getCard('01040a') as HeroCard;
    const alterEgo = cardCatalog.getCard('01040b') as AlterEgoCard;
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: hero.name,
          hero,
          alterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as never,
      mainScheme: cardCatalog.getCard('01097b') as never,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = hero;
    state.players[0].exhausted = false;
    state.players[0].hand = [];
    state.encounterDeck = [];
    getActiveVillain(state).attachments.push(createCardInstance(cardCatalog.getCard('01099')!));

    seen = [];
    atDefended = [];
    spyKernel('dispatchTrigger', (original) => (s, trigger, context) => {
      if (trigger === 'ATTACK_DEFENDED') {
        atDefended.push({
          villainHealth: getActiveVillain(s).health,
          chargeAttached: getActiveVillain(s).attachments.some((a) => a.card.code === '01099'),
          triggersBefore: [...seen],
        });
      }
      seen.push(trigger);
      return original(s, trigger, context);
    });
  });

  it('applies Retaliate and discards Charge before ATTACK_DEFENDED is dispatched', () => {
    const healthBefore = getActiveVillain(state).health;

    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'HERO_IF_READY');

    expect(atDefended).toHaveLength(1);
    expect(atDefended[0].villainHealth).toBeLessThan(healthBefore);
    expect(atDefended[0].chargeAttached).toBe(false);
  });

  it('dispatches ATTACK_RESOLVED before ATTACK_DEFENDED', () => {
    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'HERO_IF_READY');

    expect(atDefended).toHaveLength(1);
    expect(atDefended[0].triggersBefore).toContain('ATTACK_RESOLVED');
  });
});
