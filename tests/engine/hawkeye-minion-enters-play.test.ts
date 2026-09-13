import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '@data/importer/card-loader';
import { createCardInstance } from '../../src/engine/state/card-instance';
import { step5_revealEncounterCards } from '../../src/engine/pipeline/villain-phase';
import { resolveDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';
import { GamePhase, GameState, PlayerState, SideSchemeState } from '../../src/engine/models';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Hawkeye (01066) Ally Response Trigger When Minion Enters Play (Issue #105)', () => {
  let catalog: CardCatalog;
  let state: GameState;
  let player1: PlayerState;
  let player2: PlayerState;

  beforeEach(() => {
    catalog = new CardCatalog([...corePack, ...coreEncounterPack]);

    player1 = {
      id: 'p1',
      name: 'Spider-Man',
      identity: 'Spider-Man',
      health: 10,
      maxHealth: 10,
      hand: [],
      deck: [],
      discard: [],
      tableau: [],
      allies: [],
      upgrades: [],
      supports: [],
      engagedMinions: [],
      dealtEncounterCards: [],
      resources: { physical: 0, energy: 0, mental: 0, wild: 0 },
      statusCards: [],
      exhausted: false,
      activeForm: 'HERO',
      activeFormCard: createCardInstance(catalog.getCard('01001a')!),
      ready: true,
    } as unknown as PlayerState;

    player2 = {
      id: 'p2',
      name: 'Captain Marvel',
      identity: 'Captain Marvel',
      health: 12,
      maxHealth: 12,
      hand: [],
      deck: [],
      discard: [],
      tableau: [],
      allies: [],
      upgrades: [],
      supports: [],
      engagedMinions: [],
      dealtEncounterCards: [],
      resources: { physical: 0, energy: 0, mental: 0, wild: 0 },
      statusCards: [],
      exhausted: false,
      activeForm: 'HERO',
      activeFormCard: createCardInstance(catalog.getCard('01010a')!),
      ready: true,
    } as unknown as PlayerState;

    state = {
      roundNumber: 1,
      phase: GamePhase.VILLAIN_PHASE,
      firstPlayerIndex: 0,
      activePlayerIndex: 0,
      players: [player1, player2],
      villain: {
        id: 'villain',
        instanceId: 'villain_inst',
        card: catalog.getCard('01094')!,
        health: 14,
        maxHealth: 14,
        stage: 1,
        attachments: [],
        statusCards: [],
      } as any,
      mainScheme: {
        id: 'main_scheme',
        instanceId: 'main_scheme_inst',
        card: catalog.getCard('01097')!,
        stage: 1,
        threat: 2,
        targetThreat: 7,
        accelerationTokens: 0,
      } as any,
      sideSchemes: [] as SideSchemeState[],
      encounterDeck: [],
      encounterDiscard: [],
      removedFromGame: [],
      log: [],
    } as unknown as GameState;
  });

  it('initializes Hawkeye with 4 arrow counters upon card creation', () => {
    const hawkeyeCard = catalog.getCard('01066')!;
    expect(hawkeyeCard).toBeDefined();
    const hawkeyeInstance = createCardInstance(hawkeyeCard);

    expect(hawkeyeInstance.counters?.arrow).toBe(4);
    expect(hawkeyeInstance.tokens?.counters).toBe(4);
  });

  it('prompts the player with Hawkeye Response when a minion enters play in Step 5', () => {
    // Player 1 controls Hawkeye
    const hawkeyeInstance = createCardInstance(catalog.getCard('01066')!);
    player1.allies.push(hawkeyeInstance);

    // Deal a minion (Hydra Mercenary 01101) to Player 1
    const minionInstance = createCardInstance(catalog.getCard('01101')!);
    player1.dealtEncounterCards = [minionInstance];

    const nextState = step5_revealEncounterCards(state);

    // Minion has entered play engaged with Player 1
    expect(nextState.players[0].engagedMinions.length).toBe(1);
    expect(nextState.players[0].engagedMinions[0].instanceId).toBe(minionInstance.instanceId);

    // Decision prompt must be queued for Hawkeye's Response
    expect(nextState.pendingDecisionPrompt).toBeDefined();
    expect(nextState.pendingDecisionPrompt?.sourceCardName).toContain('Hawkeye');
    expect(
      nextState.pendingDecisionPrompt?.options.some(
        (o) => o.id === 'trigger_hawkeye_arrow_response',
      ),
    ).toBe(true);
    expect(nextState.pendingDecisionPrompt?.options.some((o) => o.id === 'pass')).toBe(true);
  });

  it('removes 1 arrow counter from Hawkeye and deals 2 damage to the entering minion when "Yes" is chosen', () => {
    // Player 1 controls Hawkeye
    const hawkeyeInstance = createCardInstance(catalog.getCard('01066')!);
    player1.allies.push(hawkeyeInstance);

    // Deal a Hydra Mercenary (01101, HP 3) to Player 1
    const hydraMercenary = createCardInstance(catalog.getCard('01101')!);
    player1.dealtEncounterCards = [hydraMercenary];

    let nextState = step5_revealEncounterCards(state);

    expect(nextState.pendingDecisionPrompt).toBeDefined();

    // Player accepts the prompt
    nextState = resolveDecisionPrompt(nextState, 'p1', 'trigger_hawkeye_arrow_response').state;

    // Hawkeye must have 3 arrow counters left (4 - 1 = 3)
    const inPlayHawkeye = nextState.players[0].allies.find((a) => a.card.code === '01066');
    expect(inPlayHawkeye).toBeDefined();
    const remainingArrows = inPlayHawkeye?.counters?.arrow ?? inPlayHawkeye?.tokens?.counters;
    expect(remainingArrows).toBe(3);

    // Hydra Mercenary took 2 damage
    const minion = nextState.players[0].engagedMinions.find(
      (m) => m.instanceId === hydraMercenary.instanceId,
    );
    expect(minion).toBeDefined();
    expect(minion?.tokens?.damage).toBe(2);
  });

  it('defeats a minion with 2 or less HP when Hawkeye shoots it', () => {
    // Player 1 controls Hawkeye
    const hawkeyeInstance = createCardInstance(catalog.getCard('01066')!);
    player1.allies.push(hawkeyeInstance);

    // Deal a minion with HP <= 2 (Weapons Runner 01121, HP 2)
    const weaponsRunner = createCardInstance(catalog.getCard('01121')!);
    player1.dealtEncounterCards = [weaponsRunner];

    let nextState = step5_revealEncounterCards(state);
    expect(nextState.pendingDecisionPrompt).toBeDefined();

    // Player triggers Hawkeye
    nextState = resolveDecisionPrompt(nextState, 'p1', 'trigger_hawkeye_arrow_response').state;

    // Weapons Runner took 2 damage on 2 HP -> defeated!
    expect(nextState.players[0].engagedMinions.length).toBe(0);
    expect(nextState.encounterDiscard.some((c) => c.instanceId === weaponsRunner.instanceId)).toBe(
      true,
    );
  });

  it('leaves arrow counters and minion undamaged when player passes ("No")', () => {
    const hawkeyeInstance = createCardInstance(catalog.getCard('01066')!);
    player1.allies.push(hawkeyeInstance);

    const hydraMercenary = createCardInstance(catalog.getCard('01101')!);
    player1.dealtEncounterCards = [hydraMercenary];

    let nextState = step5_revealEncounterCards(state);
    expect(nextState.pendingDecisionPrompt).toBeDefined();

    // Player passes
    nextState = resolveDecisionPrompt(nextState, 'p1', 'pass').state;

    // Hawkeye still has 4 arrow counters
    const inPlayHawkeye = nextState.players[0].allies.find((a) => a.card.code === '01066');
    const remainingArrows = inPlayHawkeye?.counters?.arrow ?? inPlayHawkeye?.tokens?.counters;
    expect(remainingArrows).toBe(4);

    // Minion undamaged
    const minion = nextState.players[0].engagedMinions.find(
      (m) => m.instanceId === hydraMercenary.instanceId,
    );
    expect(minion?.tokens?.damage ?? 0).toBe(0);
  });

  it('prompts Player 2 when a minion enters play engaging Player 1 (Cross-Player trigger)', () => {
    // Player 2 controls Hawkeye!
    const hawkeyeInstance = createCardInstance(catalog.getCard('01066')!);
    player2.allies.push(hawkeyeInstance);

    // Minion is dealt to Player 1
    const minionInstance = createCardInstance(catalog.getCard('01101')!);
    player1.dealtEncounterCards = [minionInstance];

    const nextState = step5_revealEncounterCards(state);

    // Prompt should be addressed to Player 2 (who controls Hawkeye)
    expect(nextState.pendingDecisionPrompt).toBeDefined();
    expect(nextState.pendingDecisionPrompt?.playerId).toBe('p2');
    expect(nextState.pendingDecisionPrompt?.sourceCardName).toContain('Hawkeye');
  });

  it('does NOT prompt when Hawkeye has 0 arrow counters', () => {
    const hawkeyeInstance = createCardInstance(catalog.getCard('01066')!);
    // 0 arrow counters remaining
    hawkeyeInstance.counters = { arrow: 0 };
    hawkeyeInstance.tokens = { damage: 0, threat: 0, counters: 0 };
    player1.allies.push(hawkeyeInstance);

    const minionInstance = createCardInstance(catalog.getCard('01101')!);
    player1.dealtEncounterCards = [minionInstance];

    const nextState = step5_revealEncounterCards(state);

    // No prompt should be queued since cost cannot be paid
    expect(nextState.pendingDecisionPrompt).toBeUndefined();
  });
});
