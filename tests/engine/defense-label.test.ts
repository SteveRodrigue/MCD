import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  executeEnemyAttackSynchronously,
  peekDecisionPrompt,
  resolveDecisionPrompt,
} from '@engine/pipeline';

describe('DEFENSE Labeled Ability Resolution (#270)', () => {
  let state: GameState;
  let spiderMan: HeroCard;
  let peterParker: AlterEgoCard;

  beforeEach(() => {
    spiderMan = cardCatalog.getCard('01001a') as HeroCard;
    peterParker = cardCatalog.getCard('01001b') as AlterEgoCard;

    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: spiderMan,
          alterEgo: peterParker,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderMan;
    state.players[0].hand = [];
    state.players[0].discard = [];
    state.encounterDeck = [];
  });

  const give = (code: string) => {
    const inst = createCardInstance(cardCatalog.getCard(code)!, 'p1');
    state.players[0].hand.push(inst);
    return inst;
  };

  it('Backflip (01003) prevents damage and marks the hero as defender when undefended', () => {
    give('01003'); // Backflip
    const initialHp = state.players[0].health;

    state = executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

    // Backflip prevented all damage
    expect(state.players[0].health).toBe(initialHp);
    // Backflip discarded
    expect(state.players[0].discard.some((c) => c.card.code === '01003')).toBe(true);
    // Hero was marked as defender
    expect(state.lastCombatOutcome?.defenderType).toBe('HERO');
  });

  it('Counter-Punch (01077) successfully triggers after Backflip is played against an enemy attack', () => {
    give('01003'); // Backflip
    give('01077'); // Counter-Punch (Reaction: After your hero defends against an attack, deal damage equal to your ATK to attacking enemy)

    const initialVillainHp = state.villain.health;

    state = executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

    // If Counter-Punch prompted as an optional reaction:
    const prompt = peekDecisionPrompt(state);
    if (
      prompt &&
      prompt.options.some(
        (o) =>
          o.id === '01077' || o.params?.cardCode === '01077' || o.label.includes('Counter-Punch'),
      )
    ) {
      const opt = prompt.options.find(
        (o) =>
          o.id === '01077' || o.params?.cardCode === '01077' || o.label.includes('Counter-Punch'),
      )!;
      const res = resolveDecisionPrompt(state, prompt.promptId, opt.id);
      state = res.state;
    }

    // Counter-Punch should be triggered or executed, dealing Spider-Man ATK (2 damage) to Rhino
    expect(state.villain.health).toBe(initialVillainHp - 2);
    expect(state.players[0].discard.some((c) => c.card.code === '01077')).toBe(true);
  });
});
