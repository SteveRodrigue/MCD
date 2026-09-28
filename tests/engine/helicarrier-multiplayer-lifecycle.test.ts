import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { HeroCard, AlterEgoCard, VillainCard, MainSchemeCard, GamePhase } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { getEffectiveCardCost } from '@engine/pipeline/cost-engine';

describe('Helicarrier Multiplayer Lifecycle & Prompt Clearance (#165)', () => {
  const spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
  const captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
  const carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;
  const rhinoVillain = cardCatalog.getCard('01094') as VillainCard;
  const mainScheme = cardCatalog.getCard('01097b') as MainSchemeCard;

  let gameState: ReturnType<typeof setupGame>;

  beforeEach(() => {
    gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
        {
          id: 'p2',
          name: 'Captain Marvel',
          hero: captainMarvelHero,
          alterEgo: carolDanversAlterEgo,
          deckCards: [],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      skipMulligan: true,
    });
    gameState.phase = GamePhase.PLAYER_PHASE;
    gameState.activePlayerIndex = 0;
    gameState.players[0].currentForm = 'hero';
    gameState.players[1].currentForm = 'hero';
  });

  it('Player 1 gives Helicarrier discount to Player 2; survives turn end; clears when Player 2 plays a card', () => {
    const p1 = gameState.players[0];
    const p2 = gameState.players[1];

    // Put Helicarrier into P1's tableau
    const helicarrierCard = cardCatalog.getCard('01092')!;
    const helicarrierInst = createCardInstance(helicarrierCard);
    p1.tableau.push(helicarrierInst);

    // 1. P1 activates Helicarrier -> prompts to choose player
    const useRes = dispatchAction(gameState, {
      type: 'USE_CARD_ABILITY',
      playerId: p1.id,
      cardInstanceId: helicarrierInst.instanceId,
      abilityId: 'helicarrier_action',
    });
    expect(useRes.result.success).toBe(true);
    expect(useRes.state.pendingDecisionQueue?.length).toBeGreaterThanOrEqual(1);

    const prompt = useRes.state.pendingDecisionQueue![0];
    const p2Option = prompt.options.find((o) => o.id.includes('p2'))!;

    // 2. Resolve prompt targeting Player 2
    const resolveRes = dispatchAction(useRes.state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: p1.id,
      selectedOptionId: p2Option.id,
    });
    expect(resolveRes.result.success).toBe(true);

    const stateAfterPrompt = resolveRes.state;
    expect(stateAfterPrompt.players[0].costReductions || 0).toBe(0);
    expect(stateAfterPrompt.players[1].costReductions).toBe(1);
    expect(stateAfterPrompt.players[1].activeCostReductions?.length).toBe(1);
    expect(stateAfterPrompt.players[1].activeCostReductions![0].duration).toBe('PHASE');

    // 3. Player 1 ends turn -> Player 2's turn begins
    const endTurnRes = dispatchAction(stateAfterPrompt, {
      type: 'END_PLAYER_TURN',
      playerId: p1.id,
    });
    expect(endTurnRes.result.success).toBe(true);
    expect(endTurnRes.state.activePlayerIndex).toBe(1);

    // Discount must persist across P1 turn end because duration is PHASE
    const stateP2Turn = endTurnRes.state;
    expect(stateP2Turn.players[1].costReductions).toBe(1);
    expect(stateP2Turn.players[1].activeCostReductions?.length).toBe(1);

    // 4. Setup card for Player 2 to play (Cost 2 card with 1 payment card in hand)
    const cost2Card = createCardInstance(cardCatalog.getCard('01087')!); // Haymaker (Cost 2)
    const resourceCard = createCardInstance(cardCatalog.getCard('01088')!); // Energy (Resource)
    stateP2Turn.players[1].hand = [cost2Card, resourceCard];

    // Effective cost should be 1
    const costCalc = getEffectiveCardCost(stateP2Turn, stateP2Turn.players[1], cost2Card);
    expect(costCalc.effectiveCost).toBe(1);

    // 5. Player 2 plays the card
    const playRes = dispatchAction(stateP2Turn, {
      type: 'PLAY_CARD',
      playerId: p2.id,
      cardInstanceId: cost2Card.instanceId,
      paymentCardInstanceIds: [resourceCard.instanceId],
    });
    expect(playRes.result.success).toBe(true);

    // Discount MUST be cleared immediately after playing the card!
    const stateAfterPlay = playRes.state;
    expect(stateAfterPlay.players[1].activeCostReductions?.length || 0).toBe(0);
    expect(stateAfterPlay.players[1].costReductions || 0).toBe(0);

    // 6. Player 2 ends turn -> player phase ends
    const endP2TurnRes = dispatchAction(stateAfterPlay, {
      type: 'END_PLAYER_TURN',
      playerId: p2.id,
    });
    expect(endP2TurnRes.result.success).toBe(true);
    // After both players end turn, player phase transitions
    expect(endP2TurnRes.state.phase).toBe(GamePhase.VILLAIN_PHASE);
  });

  it('Helicarrier discount clears even when played card triggers a target selection prompt', () => {
    const p1 = gameState.players[0];

    // Give P1 a Helicarrier discount directly
    p1.activeCostReductions = [
      {
        id: 'red_test_prompt',
        sourceCardName: 'Helicarrier',
        sourceCardCode: '01092',
        amount: 1,
        duration: 'PHASE',
        appliesTo: 'NEXT_CARD',
      },
    ];
    p1.costReductions = 1;

    // Create an event that requires target selection: Haymaker (01087, 2 cost) with 2 eligible targets
    const haymakerCard = cardCatalog.getCard('01087')!;
    const haymakerInst = createCardInstance(haymakerCard);
    const resCard = createCardInstance(cardCatalog.getCard('01088')!); // Energy (2 physical)
    p1.hand = [haymakerInst, resCard];

    // Add a minion so there are 2 eligible damage targets (Villain + Minion)
    const minionCard = cardCatalog.getCard('01099')!; // Armored Guard
    const minionInst = createCardInstance(minionCard);
    p1.engagedMinions.push(minionInst);

    // Play Haymaker -> should enqueue target prompt
    const playRes = dispatchAction(gameState, {
      type: 'PLAY_CARD',
      playerId: p1.id,
      cardInstanceId: haymakerInst.instanceId,
      paymentCardInstanceIds: [resCard.instanceId],
    });
    expect(playRes.result.success).toBe(true);
    expect(playRes.state.pendingDecisionPrompt).toBeDefined();

    // Discount MUST already be consumed upon payment / play, NOT left active!
    const stateDuringPrompt = playRes.state;
    expect(stateDuringPrompt.players[0].activeCostReductions?.length || 0).toBe(0);
    expect(stateDuringPrompt.players[0].costReductions || 0).toBe(0);
  });
});
