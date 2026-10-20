import { describe, it, expect, beforeEach } from 'vitest';
import { overrideCard } from '../support/card-overrides';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GamePhase,
  GameState,
  HeroCard,
  AlterEgoCard,
  CardInstance,
} from '../../src/engine/models';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { canInitiateAbility } from '../../src/engine/pipeline/legality-checker';
import { getLegalActionsForPlayer } from '../../src/engine/pipeline/legal-actions-generator';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';

describe('Call for Action Legality & Generator (Issue #314 / RR v1.8 p. 5, 23)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;
  let avengersMansion: CardInstance;

  beforeEach(() => {
    spiderManHero = cardCatalog.getCard('01001a') as HeroCard;
    peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;
    ironManHero = cardCatalog.getCard('01029a') as HeroCard;
    tonyStarkAlterEgo = cardCatalog.getCard('01029b') as AlterEgoCard;

    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Peter Parker',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Tony Stark',
          hero: ironManHero,
          alterEgo: tonyStarkAlterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.phase = GamePhase.PLAYER_PHASE;
    state.activePlayerIndex = 0; // p1 is active player
    state.mainScheme.threat = 2;

    // Give p2 Avengers Mansion (01091) in tableau: Action: Exhaust Avengers Mansion -> choose a player to draw 1 card
    avengersMansion = createCardInstance(cardCatalog.getCard('01091')!);
    state.players[1].tableau.push(avengersMansion);
  });

  it('1. Non-active player can legally trigger an Action ability on their tableau during active player turn in PLAYER_PHASE', () => {
    const mansionAb = avengersMansion.card.enrichment!.abilities![0];

    // canInitiateAbility must allow p2 to initiate action during p1 turn
    const check = canInitiateAbility(state, 'p2', mansionAb, avengersMansion);
    expect(check.allowed).toBe(true);

    // dispatchAction must succeed for p2
    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p2',
      cardInstanceId: avengersMansion.instanceId,
      abilityId: mansionAb.id,
    });

    expect(res.result.success).toBe(true);
    expect(
      res.state.players[1].usedAbilitiesThisRound?.[
        `${avengersMansion.instanceId}_${mansionAb.id}`
      ],
    ).toBe(1);
    const mansionInState = res.state.players[1].tableau.find(
      (c) => c.instanceId === avengersMansion.instanceId,
    );
    expect(mansionInState?.exhausted).toBe(true);
  });

  it('2. Action abilities remain prohibited during VILLAIN_PHASE', () => {
    state.phase = GamePhase.VILLAIN_PHASE;
    const mansionAb = avengersMansion.card.enrichment!.abilities![0];

    const check = canInitiateAbility(state, 'p2', mansionAb, avengersMansion);
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/player phase/i);
  });

  it('3. getLegalActionsForPlayer generates callForActionItems with correct teammate attribution and action payload', () => {
    const report = getLegalActionsForPlayer(state, 'p1');

    expect(report.callForActionItems).toBeDefined();
    expect(report.callForActionCount).toBe(2); // Avengers Mansion (tableau) + Tony Stark Futurist (identity)

    const mansionAction = report.callForActionItems.find(
      (item) =>
        item.action.type === 'USE_CARD_ABILITY' &&
        (item.action as any).cardInstanceId === avengersMansion.instanceId,
    );
    expect(mansionAction).toBeDefined();
    expect(mansionAction?.action.playerId).toBe('p2');
    expect(mansionAction?.ownerName).toBe('Tony Stark');
    expect(mansionAction?.category).toBe('call_for_action');

    const futuristAction = report.callForActionItems.find(
      (item) =>
        item.action.type === 'USE_CARD_ABILITY' && (item.action as any).abilityId === 'futurist',
    );
    expect(futuristAction).toBeDefined();
    expect(futuristAction?.action.playerId).toBe('p2');
    expect(futuristAction?.ownerName).toBe('Tony Stark');
    expect(futuristAction?.category).toBe('call_for_action');

    // activeActionCount must NOT include teammate call-for-actions so end-turn auto-prompts are not blocked
    expect(report.activeActionCount).not.toBeGreaterThanOrEqual(
      report.identityActions.length +
        report.handCardActions.length +
        report.boardActions.length +
        (report.villainActionItems?.length || 0) +
        1,
    );
  });

  it('4. Form requirements and usage limits are respected for teammate cards', () => {
    // Add a Hero Action card to p2's tableau (Powered Gauntlets 01037)
    const gauntlets = createCardInstance(cardCatalog.getCard('01037')!); // Hero Action: deal 1 damage
    state.players[1].tableau.push(gauntlets);

    // Case A: p2 is in Alter-Ego form -> Powered Gauntlets (Hero Action) must NOT be available
    state.players[1].currentForm = 'alter_ego';
    state.players[1].activeFormCard = tonyStarkAlterEgo;

    let report = getLegalActionsForPlayer(state, 'p1');
    expect(
      report.callForActionItems.some(
        (item) => (item.action as any).cardInstanceId === gauntlets.instanceId,
      ),
    ).toBe(false);

    // Case B: p2 is in Hero form -> Powered Gauntlets IS available
    state.players[1].currentForm = 'hero';
    state.players[1].activeFormCard = ironManHero;

    report = getLegalActionsForPlayer(state, 'p1');
    expect(
      report.callForActionItems.some(
        (item) => (item.action as any).cardInstanceId === gauntlets.instanceId,
      ),
    ).toBe(true);

    // Case C: Usage limit ONCE_PER_ROUND exhausted on Avengers Mansion -> removed from callForActionItems
    const [firstAbility, ...otherAbilities] = avengersMansion.card.enrichment!.abilities!;
    const mansionAb = { ...firstAbility, limit: 'ONCE_PER_ROUND' as const };
    overrideCard(state, avengersMansion.card, {
      enrichment: { ...avengersMansion.card.enrichment, abilities: [mansionAb, ...otherAbilities] },
    });
    state.players[1].usedAbilitiesThisRound = {
      [`${avengersMansion.instanceId}_${mansionAb.id}`]: 1,
    };

    report = getLegalActionsForPlayer(state, 'p1');
    expect(
      report.callForActionItems.some(
        (item) => (item.action as any).cardInstanceId === avengersMansion.instanceId,
      ),
    ).toBe(false);
  });

  it('5. Teammate identity in-play actions (Carol Danvers Commander) appear in callForActionItems and can be dispatched (Issue #317)', () => {
    const captainMarvelHero = cardCatalog.getCard('01010a') as HeroCard;
    const carolDanversAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;

    state.players[1].hero = captainMarvelHero;
    state.players[1].alterEgo = carolDanversAlterEgo;
    state.players[1].currentForm = 'alter_ego';
    state.players[1].activeFormCard = carolDanversAlterEgo;
    state.players[1].name = 'Carol Danvers';

    const report = getLegalActionsForPlayer(state, 'p1');
    const commanderAction = report.callForActionItems.find(
      (item) =>
        item.action.type === 'USE_CARD_ABILITY' && (item.action as any).abilityId === 'commander',
    );

    expect(commanderAction).toBeDefined();
    expect(commanderAction?.category).toBe('call_for_action');
    expect(commanderAction?.ownerName).toBe('Carol Danvers');
    expect(commanderAction?.action.playerId).toBe('p2');
    expect((commanderAction?.action as any).cardInstanceId).toBe('01010b');
    expect(commanderAction?.headline).toBe('Carol Danvers: COMMANDER');
    expect(commanderAction?.badge).toBe('ACTION');

    // Trigger ability during Player 1's active turn
    const res = dispatchAction(state, commanderAction!.action);
    expect(res.result.success).toBe(true);
    expect(res.state.players[1].usedAbilitiesThisRound?.['commander']).toBe(1);

    // After triggering, commander should no longer be in callForActionItems (limit ONCE_PER_ROUND)
    const updatedReport = getLegalActionsForPlayer(res.state, 'p1');
    expect(
      updatedReport.callForActionItems.some(
        (item) => (item.action as any).abilityId === 'commander',
      ),
    ).toBe(false);
  });
});
