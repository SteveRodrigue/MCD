import { describe, it, expect, beforeEach } from 'vitest';
import { CardCatalog } from '@data/importer/card-loader';
import {
  setupGame,
  resetInstanceCounter,
  VillainCard,
  MainSchemeCard,
  createCardInstance,
  GamePhase,
  VillainPhaseStep,
  advanceVillainPhaseStep,
  step2_villainAndMinionActivations,
  peekDecisionPrompt,
  resolveDecisionPrompt,
} from '@engine/index';

import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';

describe('Issue #264: Villain attack resumes after declining/accepting Spider-Sense (01001a)', () => {
  const catalog = new CardCatalog([...corePack, ...coreEncounterPack]);
  let gameState: ReturnType<typeof setupGame>;

  beforeEach(() => {
    resetInstanceCounter();

    const identity = catalog.getHeroIdentity('spider_man')!;
    const signatureCards = catalog.getCardsBySet('spider_man').flatMap((c) => {
      if (c.type === 'hero' || c.type === 'alter_ego') return [];
      return Array(c.quantity).fill(c);
    });
    const justiceCards = catalog
      .getCardsByFaction('justice' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const basicCards = catalog
      .getCardsByFaction('basic' as any)
      .flatMap((c) => Array(c.quantity).fill(c));
    const deck = [...signatureCards, ...justiceCards, ...basicCards].slice(0, 40);

    const rhinoCards = catalog.getCardsBySet('rhino').filter((c) => c.type !== 'villain');
    const standardCards = catalog.getCardsBySet('standard');
    const bombScareCards = catalog.getCardsBySet('bomb_scare');
    const encounterCards = [...rhinoCards, ...standardCards, ...bombScareCards].flatMap((c) =>
      Array(c.quantity).fill(c),
    );

    const villain = catalog.getCard('01094') as VillainCard; // Rhino I (ATK 2, SCH 1, HP 14)
    const mainScheme = catalog.getCard('01097b') as MainSchemeCard; // The Break-In! (Threat 0, Target 7)

    gameState = setupGame({
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: identity.hero,
          alterEgo: identity.alterEgo,
          deckCards: deck,
        },
      ],
      villain,
      mainScheme,
      encounterCards,
      shuffleFn: (arr) => arr,
    });

    gameState.phase = GamePhase.VILLAIN_PHASE;
    gameState.villainPhaseStep = VillainPhaseStep.VILLAIN_ACTIVATIONS;
    gameState.players[0].currentForm = 'hero';
    gameState.players[0].activeFormCard = gameState.players[0].hero;
    gameState.players[0].hand = [];
  });

  it('1. Stepped flow (advanceVillainPhaseStep): decline Spider-Sense opens defender prompt and finishes attack', () => {
    // Provide a known boost card (0 boost icons) to make math deterministic
    const boostCard = createCardInstance({
      ...catalog.getCard('01107')!,
      boostIcons: 0,
    });
    gameState.encounterDeck = [boostCard];

    const initialHealth = gameState.players[0].health;

    // advanceVillainPhaseStep initiates Rhino attack and pauses on Spider-Sense prompt
    const pausedState = advanceVillainPhaseStep(gameState);
    const ssPrompt = peekDecisionPrompt(pausedState);
    expect(ssPrompt).toBeDefined();
    expect(ssPrompt?.title).toContain('Spider-Man');
    expect(pausedState.activeAttackContext?.phase).toBe('INITIATION');

    // Decline Spider-Sense ('pass')
    const afterPass = resolveDecisionPrompt(pausedState, 'p1', 'pass').state;

    // Verifies defender prompt (prompt_defend_...) is now active
    const defenderPrompt = peekDecisionPrompt(afterPass);
    expect(defenderPrompt).toBeDefined();
    expect(defenderPrompt?.promptId).toMatch(/^prompt_defend_/);
    expect(afterPass.activeAttackContext?.phase).toBe('DECLARE_DEFENDER');

    // Resolve defender prompt ('undefended')
    const afterDefend = resolveDecisionPrompt(afterPass, 'p1', 'undefended').state;

    // Verifies damage is dealt to Spider-Man (Rhino ATK 2 + 0 boost), lastCombatOutcome populated
    expect(afterDefend.lastCombatOutcome).toBeDefined();
    expect(afterDefend.lastCombatOutcome?.finalDamage).toBe(2);
    expect(afterDefend.players[0].health).toBe(initialHealth - 2);
    expect(afterDefend.villainPhaseStepEvent?.amount).toBe(2);
    expect(afterDefend.activeAttackContext).toBeUndefined();

    // Next call to advanceVillainPhaseStep executes deal encounter cards
    const nextStepState = advanceVillainPhaseStep(afterDefend);
    expect(nextStepState.villainPhaseStepEvent?.type).toBe('DEAL_ENCOUNTER_CARD');
    expect(nextStepState.villainPhaseStep).toBe(VillainPhaseStep.REVEAL_ENCOUNTER_CARDS);
  });

  it('2. Stepped flow (advanceVillainPhaseStep): accept Spider-Sense draws 1 card, opens defender prompt, and finishes attack', () => {
    const boostCard = createCardInstance({
      ...catalog.getCard('01107')!,
      boostIcons: 0,
    });
    gameState.encounterDeck = [boostCard];

    const initialHealth = gameState.players[0].health;
    const initialDeckCount = gameState.players[0].deck.length;

    const pausedState = advanceVillainPhaseStep(gameState);
    const ssPrompt = peekDecisionPrompt(pausedState);
    expect(ssPrompt).toBeDefined();

    // Accept Spider-Sense
    const yesOption = ssPrompt!.options.find((o) => o.id !== 'pass' && o.label === 'Yes')!;
    const afterAccept = resolveDecisionPrompt(pausedState, 'p1', yesOption.id).state;

    // Verifies player drew 1 card
    expect(afterAccept.players[0].hand.length).toBe(1);
    expect(afterAccept.players[0].deck.length).toBe(initialDeckCount - 1);

    // Verifies defender prompt is active
    const defenderPrompt = peekDecisionPrompt(afterAccept);
    expect(defenderPrompt).toBeDefined();
    expect(defenderPrompt?.promptId).toMatch(/^prompt_defend_/);

    // Resolve defense ('undefended')
    const afterDefend = resolveDecisionPrompt(afterAccept, 'p1', 'undefended').state;

    expect(afterDefend.lastCombatOutcome).toBeDefined();
    expect(afterDefend.lastCombatOutcome?.finalDamage).toBe(2);
    expect(afterDefend.players[0].health).toBe(initialHealth - 2);
    expect(afterDefend.activeAttackContext).toBeUndefined();
  });

  it('3. Synchronous flow (step2_villainAndMinionActivations): decline Spider-Sense resolves attack synchronously', () => {
    const boostCard = createCardInstance({
      ...catalog.getCard('01107')!,
      boostIcons: 1,
    });
    gameState.encounterDeck = [boostCard];

    const initialHealth = gameState.players[0].health;

    // Halts with Spider-Sense prompt pending when acceptOptionalTriggers is false
    const pausedState = step2_villainAndMinionActivations(gameState, {
      synchronousPolicy: 'TAKE_UNDEFENDED',
      acceptOptionalTriggers: false,
    });
    const ssPrompt = peekDecisionPrompt(pausedState);
    expect(ssPrompt).toBeDefined();
    expect(ssPrompt?.title).toContain('Spider-Man');

    // Decline Spider-Sense
    const afterPass = resolveDecisionPrompt(pausedState, 'p1', 'pass').state;

    // Attack immediately resolves synchronously with TAKE_UNDEFENDED policy
    expect(afterPass.lastCombatOutcome).toBeDefined();
    expect(afterPass.lastCombatOutcome?.finalDamage).toBe(3); // ATK 2 + Boost 1
    expect(afterPass.players[0].health).toBe(initialHealth - 3);
    expect(afterPass.activeAttackContext).toBeUndefined();
    expect(peekDecisionPrompt(afterPass)).toBeUndefined();
  });

  it('4. Synchronous flow (step2_villainAndMinionActivations): accept Spider-Sense draws card and resolves synchronously', () => {
    const boostCard = createCardInstance({
      ...catalog.getCard('01107')!,
      boostIcons: 1,
    });
    gameState.encounterDeck = [boostCard];

    const initialHealth = gameState.players[0].health;
    const initialDeckCount = gameState.players[0].deck.length;

    const pausedState = step2_villainAndMinionActivations(gameState, {
      synchronousPolicy: 'TAKE_UNDEFENDED',
      acceptOptionalTriggers: false,
    });
    const ssPrompt = peekDecisionPrompt(pausedState);
    expect(ssPrompt).toBeDefined();

    const yesOption = ssPrompt!.options.find((o) => o.id !== 'pass' && o.label === 'Yes')!;
    const afterAccept = resolveDecisionPrompt(pausedState, 'p1', yesOption.id).state;

    // Card drawn and attack resolved
    expect(afterAccept.players[0].hand.length).toBe(1);
    expect(afterAccept.players[0].deck.length).toBe(initialDeckCount - 1);
    expect(afterAccept.lastCombatOutcome).toBeDefined();
    expect(afterAccept.lastCombatOutcome?.finalDamage).toBe(3);
    expect(afterAccept.players[0].health).toBe(initialHealth - 3);
    expect(afterAccept.activeAttackContext).toBeUndefined();
    expect(peekDecisionPrompt(afterAccept)).toBeUndefined();
  });

  it('5. Multi-activation queue resumption: minion activation executes after resumed villain attack completes', () => {
    const minionCard = catalog.getCard('01101')!; // Hydra Mercenary (ATK 1, HP 3)
    const minionInstance = createCardInstance(minionCard);
    gameState.players[0].engagedMinions.push(minionInstance);

    const boostCard1 = createCardInstance({
      ...catalog.getCard('01107')!,
      boostIcons: 0,
    });
    const boostCard2 = createCardInstance({
      ...catalog.getCard('01107')!,
      boostIcons: 0,
    });
    gameState.encounterDeck = [boostCard1, boostCard2];

    const initialHealth = gameState.players[0].health;

    // Advance 1: Rhino attacks -> pauses on Spider-Sense
    const pausedState = advanceVillainPhaseStep(gameState);
    expect(peekDecisionPrompt(pausedState)?.title).toContain('Spider-Man');

    // Decline Spider-Sense
    const afterPass = resolveDecisionPrompt(pausedState, 'p1', 'pass').state;
    expect(peekDecisionPrompt(afterPass)?.promptId).toMatch(/^prompt_defend_/);

    // Resolve defense for Rhino attack
    const afterDefend = resolveDecisionPrompt(afterPass, 'p1', 'undefended').state;
    expect(afterDefend.lastCombatOutcome?.attackerName).toBe('Rhino');
    expect(afterDefend.players[0].health).toBe(initialHealth - 2);

    // Advance 2: Next activation in queue is Hydra Mercenary!
    const minionAttackState = advanceVillainPhaseStep(afterDefend);
    expect(peekDecisionPrompt(minionAttackState)?.promptId).toMatch(/^prompt_defend_/);
    expect(peekDecisionPrompt(minionAttackState)?.attackerName).toBe('Hydra Mercenary');

    // Resolve defense for minion attack
    const afterMinionDefend = resolveDecisionPrompt(minionAttackState, 'p1', 'undefended').state;
    expect(afterMinionDefend.lastCombatOutcome?.attackerName).toBe('Hydra Mercenary');
    expect(afterMinionDefend.players[0].health).toBe(initialHealth - 2 - 1); // 2 from Rhino, 1 from Minion

    // Advance 3: All activations complete -> executes deal encounter cards
    const afterAll = advanceVillainPhaseStep(afterMinionDefend);
    expect(afterAll.villainPhaseStepEvent?.type).toBe('DEAL_ENCOUNTER_CARD');
    expect(afterAll.villainPhaseStep).toBe(VillainPhaseStep.REVEAL_ENCOUNTER_CARDS);
  });
});
