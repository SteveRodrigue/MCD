import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardType } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline';

describe('Bug #28 Regression: Interactive Defender Declaration during Enemy Attacks', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any, // Rhino I (ATK 2)
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
    state.players[0].hand = [];
  });

  it('opens a DEFENDER declaration modal when Villain attacks during Villain Phase on END_TURN', () => {
    expect(state.players[0].exhausted).toBe(false);

    // Player ends turn -> starts Villain Phase
    let res = dispatchAction(state, {
      type: 'END_PLAYER_TURN',
      playerId: 'p1',
    });

    // If Spider-Sense optional interrupt prompts first, pass it
    if (res.state.pendingDecisionPrompt?.title?.includes('Spider-Man')) {
      res = dispatchAction(res.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'pass',
      });
    }

    // The game must pause and present a decision prompt to declare a defender!
    expect(res.state.pendingDecisionPrompt).toBeDefined();
    expect(res.state.pendingDecisionPrompt?.playerId).toBe('p1');
    expect(res.state.pendingDecisionPrompt?.title).toContain('Enemy Attack: Rhino');

    const options = res.state.pendingDecisionPrompt!.options;
    expect(options.some((o) => o.id === 'defend_hero')).toBe(true);
    expect(options.some((o) => o.id === 'undefended')).toBe(true);
  });

  it('resolves Hero defense when player selects defend_hero via RESOLVE_DECISION_PROMPT', () => {
    const initialHp = state.players[0].health;
    const zeroBoostCard = cardCatalog.getCard('01097b')!;
    state.encounterDeck = Array(10)
      .fill(null)
      .map(() => createCardInstance(zeroBoostCard));

    // Start Villain Phase via END_PLAYER_TURN
    let endTurnRes = dispatchAction(state, {
      type: 'END_PLAYER_TURN',
      playerId: 'p1',
    });

    expect(endTurnRes.state.pendingDecisionPrompt).toBeDefined();

    // If Spider-Sense optional interrupt prompts first, pass it
    if (endTurnRes.state.pendingDecisionPrompt?.title?.includes('Spider-Man')) {
      endTurnRes = dispatchAction(endTurnRes.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'pass',
      });
    }

    // Player chooses to defend with Hero
    const resolveRes = dispatchAction(endTurnRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'defend_hero',
    });

    expect(resolveRes.result.success).toBe(true);
    // Hero was exhausted by defending
    // In round upkeep at end of villain phase, hero readies for the new player phase,
    // or during defense resolution hero was recorded as defended.
    // With Rhino ATK 2 and Spider-Man DEF 3, 0 damage was dealt
    expect(resolveRes.state.players[0].health).toBe(initialHp);
  });

  it('opens DEFENDER declaration modal when an engaged Minion attacks', () => {
    // Add an engaged minion (Hydra Mercenary or Armored Guard)
    const minionCard =
      cardCatalog.getCard('01110') || cardCatalog.getCardsByType(CardType.MINION)[0];
    const minionInstance = createCardInstance(minionCard);
    state.players[0].engagedMinions.push(minionInstance);

    // Also add an ally to test Ally blocking option in prompt
    const allyCard = cardCatalog.getCard('01058')!; // Daredevil
    const allyInstance = createCardInstance(allyCard);
    state.players[0].allies.push(allyInstance);

    let endTurnRes = dispatchAction(state, {
      type: 'END_PLAYER_TURN',
      playerId: 'p1',
    });

    // If Spider-Sense optional interrupt prompts first, pass it
    if (endTurnRes.state.pendingDecisionPrompt?.title?.includes('Spider-Man')) {
      endTurnRes = dispatchAction(endTurnRes.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'pass',
      });
    }

    // Prompt for villain attack opens first
    expect(endTurnRes.state.pendingDecisionPrompt).toBeDefined();
    expect(
      endTurnRes.state.pendingDecisionPrompt?.options.some(
        (o) => o.id === `defend_ally_${allyInstance.instanceId}`,
      ),
    ).toBe(true);

    // Resolve villain attack with undefended
    const afterVillainAttack = dispatchAction(endTurnRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: 'undefended',
    });

    // Next, the engaged minion attack triggers and opens a defender prompt for minion!
    expect(afterVillainAttack.state.pendingDecisionPrompt).toBeDefined();
    expect(afterVillainAttack.state.pendingDecisionPrompt?.title).toContain(minionCard.name);
    expect(
      afterVillainAttack.state.pendingDecisionPrompt?.options.some(
        (o) => o.id === `defend_ally_${allyInstance.instanceId}`,
      ),
    ).toBe(true);

    // Block with Daredevil
    const afterMinionBlock = dispatchAction(afterVillainAttack.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: `defend_ally_${allyInstance.instanceId}`,
    });

    expect(afterMinionBlock.result.success).toBe(true);
  });
});
