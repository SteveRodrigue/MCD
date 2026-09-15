import { describe, it, expect, beforeEach } from 'vitest';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { NormalizedCard } from '@engine/models';
import { executeEffect } from '@engine/effects';
import { SearchAndSelectParamsSchema } from '../../src/data/supplemental/schema';

describe('SEARCH Multi-Zone, ALL / 0 Pool & Non-Negative Validation (Issue #115)', () => {
  let spiderManHero: any;
  let peterParkerAlterEgo: any;
  let rhinoVillain: any;
  let mainScheme: any;
  let breakinTakinCard: NormalizedCard;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a')!;
    peterParkerAlterEgo = cardCatalog.getCard('01001b')!;
    rhinoVillain = cardCatalog.getCard('01095') || cardCatalog.getCard('01094')!;
    mainScheme = cardCatalog.getCard('01097')!;
    breakinTakinCard = cardCatalog.getCard('01107')!;
  });

  it('multi-zone search finds target in encounter deck, splices it, and shuffles deck', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const breakinInst = createCardInstance(breakinTakinCard);
    const dummyEncounterCard = createCardInstance(cardCatalog.getCard('01110')!); // Armored Rhino Suit
    state.encounterDeck = [dummyEncounterCard, breakinInst];
    state.encounterDiscard = [];
    state.sideSchemes = [];

    const result = executeEffect(
      state,
      {
        effect: 'SEARCH',
        effectParams: {
          source: ['ENCOUNTER_DECK', 'ENCOUNTER_DISCARD'],
          filter: { targetCardCode: '01107' },
          takeCount: 1,
          selectedDestination: 'TABLEAU',
          shuffleAfter: true,
          autoSelectIfUnambiguous: true,
        },
      },
      { playerId: 'p1' },
    );

    expect(result.success).toBe(true);
    // Breakin' & Takin' should have been spliced from encounter deck
    expect(state.encounterDeck.some((c) => c.instanceId === breakinInst.instanceId)).toBe(false);
    // Placed in state.sideSchemes
    expect(state.sideSchemes.some((s) => s.instanceId === breakinInst.instanceId)).toBe(true);
  });

  it('multi-zone search finds target in encounter discard pile, splices it, and shuffles encounter deck', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const breakinInst = createCardInstance(breakinTakinCard);
    const dummyCard = createCardInstance(cardCatalog.getCard('01110')!);
    state.encounterDeck = [dummyCard];
    state.encounterDiscard = [breakinInst];
    state.sideSchemes = [];

    const result = executeEffect(
      state,
      {
        effect: 'SEARCH',
        effectParams: {
          source: ['ENCOUNTER_DECK', 'ENCOUNTER_DISCARD'],
          filter: { targetCardCode: '01107' },
          takeCount: 1,
          selectedDestination: 'REVEAL',
          shuffleAfter: true,
          autoSelectIfUnambiguous: true,
        },
      },
      { playerId: 'p1' },
    );

    expect(result.success).toBe(true);
    expect(state.encounterDiscard.some((c) => c.instanceId === breakinInst.instanceId)).toBe(false);
    // Revealed as side scheme into state.sideSchemes with base threat (2) + when revealed (1) = 3
    const sideScheme = state.sideSchemes.find((s) => s.instanceId === breakinInst.instanceId);
    expect(sideScheme).toBeDefined();
    expect(sideScheme!.threat).toBe(3);
  });

  it('Rhino Stage II When Revealed searches deck & discard and reveals Breakin & Takin with threat', () => {
    const rhinoStage2Card = cardCatalog.getCard('01095')! as any;
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
      ],
      villain: rhinoStage2Card,
      mainScheme,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    const breakinInst = createCardInstance(breakinTakinCard);
    state.encounterDeck = [createCardInstance(cardCatalog.getCard('01110')!)];
    state.encounterDiscard = [breakinInst];
    state.sideSchemes = [];

    // Execute Rhino Stage II When Revealed ability from its enrichment
    const ability = rhinoStage2Card.enrichment?.abilities?.find(
      (a: any) => a.id === 'rhino_stage_ii_when_revealed',
    )!;
    expect(ability).toBeDefined();

    const result = executeEffect(state, ability, { playerId: 'p1' });
    expect(result.success).toBe(true);
    expect(state.encounterDiscard.some((c) => c.instanceId === breakinInst.instanceId)).toBe(false);
    expect(state.sideSchemes.some((s) => s.instanceId === breakinInst.instanceId)).toBe(true);
    const placed = state.sideSchemes.find((s) => s.instanceId === breakinInst.instanceId);
    expect(placed!.threat).toBe(3);
  });

  it('lookCount: 0 searches entire pile while lookCount: 3 looks at top 3 only', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      skipMulligan: true,
    });

    const player = state.players[0];
    const techCard: NormalizedCard = {
      ...cardCatalog.getCard('01009')!,
      traits: ['Tech'],
    };
    const nonTechCard = cardCatalog.getCard('01005')!;

    const instNonTech1 = createCardInstance(nonTechCard);
    const instNonTech2 = createCardInstance(nonTechCard);
    const instNonTech3 = createCardInstance(nonTechCard);
    const instTech4 = createCardInstance(techCard); // Position 4

    // Top 3 do not contain Tech; Position 4 contains Tech
    player.deck = [instNonTech1, instNonTech2, instNonTech3, instTech4];
    player.hand = [];

    // 1) lookCount: 3 should look at top 3 and find NO match
    const resultLook3 = executeEffect(
      state,
      {
        effect: 'SEARCH',
        effectParams: {
          source: 'PLAYER_DECK',
          lookCount: 3,
          filter: { trait: 'Tech' },
          takeCount: 1,
          selectedDestination: 'HAND',
          unselectedDestination: 'LEAVE_IN_PLACE',
          autoSelectIfUnambiguous: true,
        },
      },
      { playerId: 'p1' },
    );
    expect(resultLook3.onomatopoeia).toBe('NO MATCHING TARGET FOUND');
    expect(player.hand.length).toBe(0);

    // 2) lookCount: 0 searches entire deck and finds instTech4
    const resultLook0 = executeEffect(
      state,
      {
        effect: 'SEARCH',
        effectParams: {
          source: 'PLAYER_DECK',
          lookCount: 0,
          filter: { trait: 'Tech' },
          takeCount: 1,
          selectedDestination: 'HAND',
          autoSelectIfUnambiguous: true,
        },
      },
      { playerId: 'p1' },
    );
    expect(resultLook0.success).toBe(true);
    expect(player.hand.some((c) => c.instanceId === instTech4.instanceId)).toBe(true);
  });

  it('takeCount: 0 / takeCount: "ALL" takes all matching cards without prompt', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      skipMulligan: true,
    });

    const player = state.players[0];
    const techCard: NormalizedCard = {
      ...cardCatalog.getCard('01009')!,
      traits: ['Tech'],
    };
    const inst1 = createCardInstance(techCard);
    const inst2 = createCardInstance(techCard);
    const inst3 = createCardInstance(techCard);
    player.discard = [inst1, inst2, inst3];
    player.hand = [];

    // takeCount: 0
    const result = executeEffect(
      state,
      {
        effect: 'SEARCH',
        effectParams: {
          source: 'PLAYER_DISCARD',
          lookCount: 0,
          takeCount: 0,
          filter: { trait: 'Tech' },
          selectedDestination: 'HAND',
        },
      },
      { playerId: 'p1' },
    );

    expect(result.success).toBe(true);
    expect(state.pendingDecisionQueue?.length || 0).toBe(0);
    expect(player.hand.length).toBe(3);
    expect(player.discard.length).toBe(0);

    // Also verify takeCount: 'ALL'
    player.discard = [inst1, inst2];
    player.hand = [];
    const resultAll = executeEffect(
      state,
      {
        effect: 'SEARCH',
        effectParams: {
          source: 'PLAYER_DISCARD',
          lookCount: 'ALL',
          takeCount: 'ALL',
          filter: { trait: 'Tech' },
          selectedDestination: 'HAND',
        },
      },
      { playerId: 'p1' },
    );
    expect(resultAll.success).toBe(true);
    expect(state.pendingDecisionQueue?.length || 0).toBe(0);
    expect(player.hand.length).toBe(2);
  });

  it('voluntary player action search provides "Pass" option, while forced trigger enforces selection', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: [],
        },
      ],
      villain: rhinoVillain,
      mainScheme,
      skipMulligan: true,
    });

    const player = state.players[0];
    const techCard: NormalizedCard = {
      ...cardCatalog.getCard('01009')!,
      traits: ['Tech'],
    };
    const inst1 = createCardInstance(techCard);
    const inst2 = createCardInstance(techCard);
    player.deck = [inst1, inst2];

    // Voluntary Action ability (timing: 'HERO_ACTION')
    const actionResult = executeEffect(
      state,
      {
        id: 'action_search',
        timing: 'HERO_ACTION',
        steps: [
          {
            effect: 'SEARCH',
            effectParams: {
              source: 'PLAYER_DECK',
              takeCount: 1,
              filter: { trait: 'Tech' },
              autoSelectIfUnambiguous: false,
            },
          },
        ],
      },
      { playerId: 'p1' },
    );

    const prompt1 = actionResult.state.pendingDecisionQueue?.[0];
    expect(prompt1).toBeDefined();
    expect(prompt1?.options.some((o) => o.id === 'pass_search')).toBe(true);

    // Forced trigger ability (timing: 'WHEN_REVEALED')
    state.pendingDecisionQueue = [];
    const forcedResult = executeEffect(
      state,
      {
        id: 'forced_search',
        timing: 'WHEN_REVEALED',
        trigger: 'WHEN_REVEALED',
        steps: [
          {
            effect: 'SEARCH',
            effectParams: {
              source: 'PLAYER_DECK',
              takeCount: 1,
              filter: { trait: 'Tech' },
              autoSelectIfUnambiguous: false,
            },
          },
        ],
      },
      { playerId: 'p1' },
    );

    const prompt2 = forcedResult.state.pendingDecisionQueue?.[0];
    expect(prompt2).toBeDefined();
    expect(prompt2?.options.some((o) => o.id === 'pass_search')).toBe(false);
  });

  it('schema strictly rejects negative lookCount and takeCount', () => {
    expect(SearchAndSelectParamsSchema.safeParse({ lookCount: -1 }).success).toBe(false);
    expect(SearchAndSelectParamsSchema.safeParse({ takeCount: -2 }).success).toBe(false);
    expect(SearchAndSelectParamsSchema.safeParse({ lookCount: 0 }).success).toBe(true);
    expect(SearchAndSelectParamsSchema.safeParse({ takeCount: 0 }).success).toBe(true);
    expect(SearchAndSelectParamsSchema.safeParse({ lookCount: 'ALL' }).success).toBe(true);
    expect(SearchAndSelectParamsSchema.safeParse({ takeCount: 'ALL' }).success).toBe(true);
    expect(
      SearchAndSelectParamsSchema.safeParse({
        source: ['ENCOUNTER_DECK', 'ENCOUNTER_DISCARD'],
      }).success,
    ).toBe(true);
  });
});
