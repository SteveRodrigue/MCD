import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  VillainCard,
  MainSchemeCard,
  CardInstance,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction } from '@engine/pipeline/action-dispatcher';
import { canInitiateAbility } from '@engine/pipeline/legality-checker';

describe('Stark Tower (01034): Cross-Player Targeting, Discard Legality & Auto-Resolution (Issue #14)', () => {
  let state: GameState;
  let tonyStarkAlterEgo: AlterEgoCard;
  let ironManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let spiderManHero: HeroCard;
  let rhinoVillain: VillainCard;
  let mainScheme: MainSchemeCard;

  beforeEach(() => {
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    rhinoVillain = cardCatalog.getCard('01094') as VillainCard;
    mainScheme = cardCatalog.getCard('01097b') as MainSchemeCard;

    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Tony Stark',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'alter_ego';
    state.players[0].activeFormCard = tonyStarkAlterEgo;
  });

  it('1. Legality check: cannot initiate Stark Tower when 0 Tech upgrades are in any accessible discard pile (RR v1.8 p. 2, 28)', () => {
    const player = state.players[0];
    const starkTower = createCardInstance(cardCatalog.getCard('01034')!);
    player.tableau.push(starkTower);

    // Discard pile has only non-Tech cards
    const nonTechCard = createCardInstance(cardCatalog.getCard('01005')!); // Haymaker
    player.discard = [nonTechCard];

    const ability = starkTower.card.enrichment!.abilities![0];
    const check = canInitiateAbility(state, 'p1', ability, starkTower);
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe(
      'Cannot trigger ability: No player has a matching card in their discard pile.',
    );

    // Attempting to dispatch USE_CARD_ABILITY fails
    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: starkTower.instanceId,
      abilityId: 'stark_tower_retrieve',
    });

    expect(res.result.success).toBe(false);
    expect(res.result.error).toContain(
      'Cannot trigger ability: No player has a matching card in their discard pile.',
    );
    expect(starkTower.exhausted).toBeFalsy();
    expect(player.hand.length).toBe(state.players[0].hand.length);
  });

  it('2. Topmost retrieval: retrieves the topmost Tech upgrade from discard pile to hand (RR v1.8 p. 10)', () => {
    const player = state.players[0];
    const starkTower = createCardInstance(cardCatalog.getCard('01034')!);
    player.tableau.push(starkTower);

    const techUpgradeBottom = createCardInstance(cardCatalog.getCard('01036')!); // Mark V Armor
    const nonTechMiddle = createCardInstance(cardCatalog.getCard('01005')!); // Haymaker
    const techUpgradeTop = createCardInstance(cardCatalog.getCard('01037')!); // Mark V Helmet

    // Discard array order: [bottom, middle, top]
    player.discard = [techUpgradeBottom, nonTechMiddle, techUpgradeTop];
    player.hand = [];

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: starkTower.instanceId,
      abilityId: 'stark_tower_retrieve',
    });

    expect(res.result.success).toBe(true);
    expect(res.state.pendingDecisionPrompt).toBeUndefined();

    // Topmost Tech upgrade (01037) returned to hand
    const updatedP1 = res.state.players[0];
    expect(updatedP1.hand.length).toBe(1);
    expect(updatedP1.hand[0].card.code).toBe('01037');

    // Bottom Tech upgrade (01036) and non-Tech card (01005) remain in discard
    expect(updatedP1.discard.length).toBe(2);
    expect(updatedP1.discard.map((c) => c.card.code)).toEqual(['01036', '01005']);
    expect(updatedP1.tableau.find((c) => c.card.code === '01034')?.exhausted).toBe(true);
  });

  describe('Multiplayer Cross-Player Scenarios (2 Players)', () => {
    let p1StarkTower: CardInstance;

    beforeEach(() => {
      // Add Player 2 (Spider-Man / Peter Parker)
      state.players.push({
        ...state.players[0],
        id: 'p2',
        name: 'Peter Parker',
        hero: spiderManHero,
        alterEgo: peterParkerAlterEgo,
        activeFormCard: peterParkerAlterEgo,
        currentForm: 'alter_ego',
        hand: [],
        deck: Array(10).fill(cardCatalog.getCard('01005')!),
        discard: [],
        tableau: [],
        allies: [],
        engagedMinions: [],
      });

      p1StarkTower = createCardInstance(cardCatalog.getCard('01034')!);
      state.players[0].tableau.push(p1StarkTower);
      state.players[0].hand = [];
      state.players[1].hand = [];
    });

    it('3A. Unambiguous auto-resolve: 2 players, only Player 1 has Tech upgrade -> auto-resolves for Player 1 without prompt', () => {
      const techUpgrade = createCardInstance(cardCatalog.getCard('01036')!);
      state.players[0].discard = [techUpgrade];
      state.players[1].discard = [createCardInstance(cardCatalog.getCard('01005')!)]; // Player 2 has NO Tech

      state.options = { autoResolveUnambiguous: true };

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: p1StarkTower.instanceId,
        abilityId: 'stark_tower_retrieve',
      });

      expect(res.result.success).toBe(true);
      // Auto-resolved: no prompt opened
      expect(res.state.pendingDecisionPrompt).toBeUndefined();

      // Card retrieved to Player 1's hand
      expect(res.state.players[0].hand.length).toBe(1);
      expect(res.state.players[0].hand[0].card.code).toBe('01036');
      expect(res.state.players[0].discard.length).toBe(0);

      // Player 2 unchanged
      expect(res.state.players[1].hand.length).toBe(0);
      expect(res.state.players[1].discard.length).toBe(1);
    });

    it('3B. Ambiguous multiplayer choice: both players have Tech upgrades -> enqueues Choose a Player prompt with both enabled', () => {
      const p1Tech = createCardInstance(cardCatalog.getCard('01036')!);
      const p2Tech = createCardInstance(cardCatalog.getCard('01037')!);

      state.players[0].discard = [p1Tech];
      state.players[1].discard = [p2Tech];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: p1StarkTower.instanceId,
        abilityId: 'stark_tower_retrieve',
      });

      expect(res.result.success).toBe(true);
      const prompt = res.state.pendingDecisionPrompt;
      expect(prompt).toBeDefined();
      expect(prompt!.title).toContain('Choose a Player');
      expect(prompt!.options.length).toBe(2);

      // Both options enabled
      expect(prompt!.options[0].disabled).toBeFalsy();
      expect(prompt!.options[1].disabled).toBeFalsy();

      // Resolve decision for Player 2
      const resolveRes = dispatchAction(res.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: prompt!.options[1].id, // choose_player_p2
      });

      expect(resolveRes.result.success).toBe(true);
      // Player 2 gets their Tech upgrade
      expect(resolveRes.state.players[1].hand.length).toBe(1);
      expect(resolveRes.state.players[1].hand[0].card.code).toBe('01037');
      expect(resolveRes.state.players[1].discard.length).toBe(0);

      // Player 1 still has their Tech upgrade in discard
      expect(resolveRes.state.players[0].hand.length).toBe(0);
      expect(resolveRes.state.players[0].discard.length).toBe(1);
    });

    it('4. Game Option disabled (autoResolveUnambiguous: false): forces prompt to open, with Player 2 disabled and explanatory reason', () => {
      const p1Tech = createCardInstance(cardCatalog.getCard('01036')!);
      state.players[0].discard = [p1Tech];
      state.players[1].discard = [createCardInstance(cardCatalog.getCard('01005')!)]; // No Tech

      // Set global game option to FALSE
      state.options = { autoResolveUnambiguous: false };

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: p1StarkTower.instanceId,
        abilityId: 'stark_tower_retrieve',
      });

      expect(res.result.success).toBe(true);
      // Even though only 1 player has Tech upgrade, prompt is forced open
      const prompt = res.state.pendingDecisionPrompt;
      expect(prompt).toBeDefined();
      expect(prompt!.title).toContain('Choose a Player');
      expect(prompt!.options.length).toBe(2);

      // Player 1 is enabled
      const p1Option = prompt!.options.find((o) => o.id === 'choose_player_p1');
      expect(p1Option).toBeDefined();
      expect(p1Option!.disabled).toBeFalsy();

      // Player 2 is disabled with explanatory reason (Option 1A)
      const p2Option = prompt!.options.find((o) => o.id === 'choose_player_p2');
      expect(p2Option).toBeDefined();
      expect(p2Option!.disabled).toBe(true);
      expect(p2Option!.disabledReason).toBe('No Tech upgrade in discard pile');

      // Resolving for Player 1 opens the card selection prompt (since autoResolveUnambiguous is false)
      const choosePlayerRes = dispatchAction(res.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: p1Option!.id,
      });

      expect(choosePlayerRes.result.success).toBe(true);
      const cardPrompt = choosePlayerRes.state.pendingDecisionPrompt;
      expect(cardPrompt).toBeDefined();
      expect(cardPrompt!.options[0].effect).toBe('SEARCH_AND_SELECT_RESOLUTION');

      // Resolving the card selection gives Player 1 their Tech upgrade
      const resolveCardRes = dispatchAction(choosePlayerRes.state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: cardPrompt!.options[0].id,
      });

      expect(resolveCardRes.result.success).toBe(true);
      expect(resolveCardRes.state.players[0].hand.length).toBe(1);
      expect(resolveCardRes.state.players[0].hand[0].card.code).toBe('01036');
      expect(resolveCardRes.state.players[0].discard.length).toBe(0);
    });
  });
});
