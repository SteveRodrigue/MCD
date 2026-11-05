import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  Keyword,
  StatusCard,
  getActiveVillain,
  getActiveMainScheme,
  MinionCard,
  SideSchemeCard,
} from '@engine/models';
import { setupGame, createCardInstance, resetInstanceCounter } from '@engine/state/game-setup';
import {
  executeVillainSchemeAgainstPlayer,
  executeMinionActivationAgainstPlayer,
  peekDecisionPrompt,
  dispatchAction,
} from '@engine/pipeline';

const TIGER_SHARK = '01131'; // Boost: Give the villain a tough status card. (1 boost icon)
const WHIRLWIND = '01130'; // Boost: Deal 1 damage to each hero. (0 boost icons)
const STANDARD_NON_STAR = '01107'; // Charge: 1 boost icon, no star
const HYDRA_SOLDIER = '01170'; // SCH 1
const MADAME_HYDRA = '01181'; // SCH 2, Forced Response: After Madame Hydra schemes or attacks, place 2 threat on Legions of Hydra (01180)
const LEGIONS_OF_HYDRA = '01180';

describe('Scheme Boost Reveal Prompt & Stepping Resumption (Issue #527)', () => {
  let state: GameState;

  const player = (id: string, hero: string, alterEgo: string) => ({
    id,
    name: id,
    hero: cardCatalog.getCard(hero) as HeroCard,
    alterEgo: cardCatalog.getCard(alterEgo) as AlterEgoCard,
    deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
  });

  const setup = (playerDefs?: { id: string; hero: string; alterEgo: string }[]) => {
    resetInstanceCounter();
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: (playerDefs || [{ id: 'p1', hero: '01010a', alterEgo: '01010b' }]).map((p) =>
        player(p.id, p.hero, p.alterEgo),
      ),
      villain: cardCatalog.getCard('01094') as any, // Rhino I (SCH 1)
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    for (const p of state.players) {
      p.currentForm = 'alter_ego';
      p.activeFormCard = p.alterEgo;
      p.hand = [];
    }
    state.encounterDeck = [];
    state.encounterDiscard = [];
    state.options = {
      ...state.options,
      villainPhaseStepping: true,
    };
  };

  beforeEach(() => {
    setup();
  });

  it('pauses and enqueues BOOST_ABILITY_REVEAL prompt before resolving a star boost ability on villain scheme', () => {
    const tigerShark = createCardInstance(cardCatalog.getCard(TIGER_SHARK)!, 'encounter');
    state.encounterDeck = [tigerShark];

    const initialThreat = getActiveMainScheme(state).threat;
    executeVillainSchemeAgainstPlayer(state, state.players[0]);

    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();
    expect(prompt?.kind).toBe('BOOST_ABILITY_REVEAL');
    expect(prompt?.sourceCardCode).toBe(TIGER_SHARK);
    expect(prompt?.description).toBe('Rhino revealed boost card: Tiger Shark');
    expect(prompt?.sourceCardInstance?.card.boostText).toBe(
      'Give the villain a tough status card.',
    );

    // Crucial: Effect must NOT have resolved yet, and threat must NOT be placed yet
    expect(getActiveVillain(state).statusCards ?? []).not.toContain(StatusCard.TOUGH);
    expect(getActiveMainScheme(state).threat).toBe(initialThreat);

    // Continue
    const s2 = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: prompt!.options[0].id,
    }).state;

    // Villain receives Tough and threat placed includes Rhino SCH (1) + Tiger Shark icon (0) = 1
    expect(getActiveVillain(s2).statusCards).toContain(StatusCard.TOUGH);
    expect(getActiveMainScheme(s2).threat).toBe(initialThreat + 1);
    expect(peekDecisionPrompt(s2)).toBeUndefined();
    expect(s2.encounterDiscard.some((c) => c.card.code === TIGER_SHARK)).toBe(true);
    expect(s2.activeSchemeContext).toBeUndefined();
  });

  it('prompts sequentially for multiple star boost cards on villain scheme (Klaw / additional boost cards)', () => {
    const tigerShark = createCardInstance(cardCatalog.getCard(TIGER_SHARK)!, 'encounter');
    const whirlwind = createCardInstance(cardCatalog.getCard(WHIRLWIND)!, 'encounter');
    state.encounterDeck = [tigerShark, whirlwind];

    // Give villain 1 additional boost card so 2 are dealt
    getActiveVillain(state).card = {
      ...getActiveVillain(state).card,
      enrichment: {
        abilities: [
          {
            id: 'extra_boost',
            timing: 'FORCED_INTERRUPT',
            trigger: 'INITIATES_ACTIVATION',
            steps: [{ effect: 'GIVE_ADDITIONAL_BOOST_CARD' }],
          },
        ],
      },
    };

    const initialThreat = getActiveMainScheme(state).threat;
    const initialHp = state.players[0].health;
    executeVillainSchemeAgainstPlayer(state, state.players[0]);

    // 1st pause: Tiger Shark
    const prompt1 = peekDecisionPrompt(state);
    expect(prompt1?.kind).toBe('BOOST_ABILITY_REVEAL');
    expect(prompt1?.sourceCardCode).toBe(TIGER_SHARK);
    expect(getActiveVillain(state).statusCards ?? []).not.toContain(StatusCard.TOUGH);

    // Resolve 1st prompt
    const s2 = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: prompt1!.options[0].id,
    }).state;

    // Villain now has Tough
    expect(getActiveVillain(s2).statusCards).toContain(StatusCard.TOUGH);

    // 2nd pause: Whirlwind
    const prompt2 = peekDecisionPrompt(s2);
    expect(prompt2?.kind).toBe('BOOST_ABILITY_REVEAL');
    expect(prompt2?.sourceCardCode).toBe(WHIRLWIND);

    // Resolve 2nd prompt
    const s3 = dispatchAction(s2, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: prompt2!.options[0].id,
    }).state;

    // Whirlwind resolved (deals 1 damage to each hero; Peter Parker is alter-ego so takes 0)
    expect(s3.players[0].health).toBe(initialHp);

    // Scheme completes: Rhino SCH (1) + Tiger Shark icon (0) + Whirlwind icon (0) = 1 threat
    expect(getActiveMainScheme(s3).threat).toBe(initialThreat + 1);
    expect(peekDecisionPrompt(s3)).toBeUndefined();
    expect(s3.encounterDiscard.some((c) => c.card.code === TIGER_SHARK)).toBe(true);
    expect(s3.encounterDiscard.some((c) => c.card.code === WHIRLWIND)).toBe(true);
    expect(s3.activeSchemeContext).toBeUndefined();
  });

  it('pauses and enqueues BOOST_ABILITY_REVEAL prompt for Villainous minion scheme', () => {
    const minionCard = cardCatalog.getCard(HYDRA_SOLDIER) as MinionCard;
    const minion = createCardInstance(minionCard, 'encounter');
    minion.card = { ...minion.card, keywords: [Keyword.VILLAINOUS] };
    state.players[0].engagedMinions.push(minion);

    const tigerShark = createCardInstance(cardCatalog.getCard(TIGER_SHARK)!, 'encounter');
    state.encounterDeck = [tigerShark];

    const initialThreat = getActiveMainScheme(state).threat;
    executeMinionActivationAgainstPlayer(state, minion, state.players[0]);

    const prompt = peekDecisionPrompt(state);
    expect(prompt).toBeDefined();
    expect(prompt?.kind).toBe('BOOST_ABILITY_REVEAL');
    expect(prompt?.sourceCardCode).toBe(TIGER_SHARK);
    expect(getActiveMainScheme(state).threat).toBe(initialThreat);

    // Continue
    const s2 = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: prompt!.options[0].id,
    }).state;

    // Villain receives Tough, minion placed SCH (1) + boost icon (0) = 1 threat
    expect(getActiveVillain(s2).statusCards).toContain(StatusCard.TOUGH);
    expect(getActiveMainScheme(s2).threat).toBe(initialThreat + 1);
    expect(peekDecisionPrompt(s2)).toBeUndefined();
    expect(s2.activeSchemeContext).toBeUndefined();
  });

  it('resolves MINION_SCHEMED response after threat is placed from minion scheme', () => {
    const madameCard = cardCatalog.getCard(MADAME_HYDRA) as MinionCard;
    const madameHydra = createCardInstance(madameCard, 'encounter');
    madameHydra.card = { ...madameHydra.card, keywords: [Keyword.VILLAINOUS] };
    state.players[0].engagedMinions.push(madameHydra);

    const legionsCard = cardCatalog.getCard(LEGIONS_OF_HYDRA) as SideSchemeCard;
    state.sideSchemes.push({
      instanceId: 'side_legions',
      card: legionsCard,
      threat: 0,
    });

    const tigerShark = createCardInstance(cardCatalog.getCard(TIGER_SHARK)!, 'encounter');
    state.encounterDeck = [tigerShark];

    const initialMainThreat = getActiveMainScheme(state).threat;
    executeMinionActivationAgainstPlayer(state, madameHydra, state.players[0]);

    const prompt = peekDecisionPrompt(state);
    expect(prompt?.kind).toBe('BOOST_ABILITY_REVEAL');

    // Continue
    const s2 = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: prompt!.options[0].id,
    }).state;

    // Main scheme received Madame Hydra SCH (2) + Tiger Shark icon (0) = 2 threat
    expect(getActiveMainScheme(s2).threat).toBe(initialMainThreat + 2);

    // Forced Response MINION_SCHEMED placed 2 threat on Legions of Hydra
    const legionsScheme = s2.sideSchemes.find((s) => s.card.code === LEGIONS_OF_HYDRA);
    expect(legionsScheme?.threat).toBe(2);
  });

  it('resolves non-star boost cards immediately without opening a prompt on scheme', () => {
    const nonStarCard = createCardInstance(cardCatalog.getCard(STANDARD_NON_STAR)!, 'encounter');
    state.encounterDeck = [nonStarCard];

    const initialThreat = getActiveMainScheme(state).threat;
    executeVillainSchemeAgainstPlayer(state, state.players[0]);

    // No prompt
    expect(peekDecisionPrompt(state)).toBeUndefined();
    // Rhino SCH (1) + Charge icon (2) = 3 threat
    expect(getActiveMainScheme(state).threat).toBe(initialThreat + 3);
    expect(state.activeSchemeContext).toBeUndefined();
  });

  it('executes scheme synchronously to completion in headless mode (villainPhaseStepping: false)', () => {
    state.options = {
      ...state.options,
      villainPhaseStepping: false,
    };
    const tigerShark = createCardInstance(cardCatalog.getCard(TIGER_SHARK)!, 'encounter');
    state.encounterDeck = [tigerShark];

    const initialThreat = getActiveMainScheme(state).threat;
    executeVillainSchemeAgainstPlayer(state, state.players[0]);

    // Headless mode should not pause
    expect(peekDecisionPrompt(state)).toBeUndefined();
    expect(getActiveVillain(state).statusCards).toContain(StatusCard.TOUGH);
    expect(getActiveMainScheme(state).threat).toBe(initialThreat + 1);
    expect(state.activeSchemeContext).toBeUndefined();
  });
});
