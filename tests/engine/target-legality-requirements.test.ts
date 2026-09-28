import { describe, it, expect } from 'vitest';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import {
  canPlayCard,
  evaluateCardPlayability,
  canInitiateAbility,
} from '../../src/engine/pipeline/legality-checker';
import { getLegalActionsForPlayer } from '../../src/engine/pipeline/legal-actions-generator';
import {
  HeroCard,
  AlterEgoCard,
  SideSchemeCard,
  MinionCard,
  Keyword,
} from '../../src/engine/models';

describe('Target Legality & Game State Potential Requirements (RR v1.8 p. 15, 29, 30; Issue #101)', () => {
  const smHero = cardCatalog.getCard('01001a') as HeroCard;
  const peterParkerAlterEgo = cardCatalog.getCard('01001b') as AlterEgoCard;

  it('1. Rejects Surveillance Team (01064) activation when no scheme has threat (RR v1.8 p. 15-16, 29)', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];

    // Main scheme starts with 0 threat
    heroState.mainScheme.threat = 0;
    heroState.sideSchemes = [];

    // Add Surveillance Team to player tableau with 3 snoop counters
    const survTeam = createCardInstance(cardCatalog.getCard('01064')!);
    survTeam.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(survTeam);

    const survAbility = survTeam.card.enrichment!.abilities![0];

    // canInitiateAbility check
    const abilityCheck = canInitiateAbility(heroState, player.id, survAbility, survTeam);
    expect(abilityCheck.allowed).toBe(false);
    expect(abilityCheck.reason).toMatch(/no scheme/i);

    // Attempt to dispatch USE_CARD_ABILITY
    const res = dispatchAction(heroState, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: survTeam.instanceId,
      abilityId: 'surveillance_team_action',
    });

    // Action must be rejected
    expect(res.result.success).toBe(false);
    expect(res.result.error).toMatch(/no scheme/i);

    // Surveillance Team must remain unexhausted with 3 counters intact
    const inPlayCard = res.state.players[0].tableau.find(
      (c) => c.instanceId === survTeam.instanceId,
    )!;
    expect(inPlayCard.exhausted).toBeFalsy();
    expect(inPlayCard.tokens?.counters).toBe(3);
  });

  it('2. Excludes Surveillance Team from legal actions when no schemes have threat', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];

    heroState.mainScheme.threat = 0;
    heroState.sideSchemes = [];

    const survTeam = createCardInstance(cardCatalog.getCard('01064')!);
    survTeam.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(survTeam);

    const legalActions = getLegalActionsForPlayer(heroState, player.id).allActions;
    const survAction = legalActions.find(
      (a) =>
        a.action.type === 'USE_CARD_ABILITY' &&
        (a.action as any).cardInstanceId === survTeam.instanceId,
    );
    expect(survAction).toBeUndefined();
  });

  it('3. Rejects playing For Justice! (01060) from hand when no schemes have threat', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];

    heroState.mainScheme.threat = 0;
    heroState.sideSchemes = [];

    const forJustice = createCardInstance(cardCatalog.getCard('01060')!);
    const resource1 = createCardInstance(cardCatalog.getCard('01053')!);
    const resource2 = createCardInstance(cardCatalog.getCard('01053')!);
    player.hand = [forJustice, resource1, resource2];

    const playability = evaluateCardPlayability(heroState, player.id, forJustice);
    expect(playability.isPlayable).toBe(false);
    expect(playability.reasons.some((r) => /no scheme/i.test(r))).toBe(true);

    const playCheck = canPlayCard(heroState, player.id, forJustice.instanceId, [
      resource1.instanceId,
      resource2.instanceId,
    ]);
    expect(playCheck.allowed).toBe(false);
    expect(playCheck.reason).toMatch(/no scheme/i);
  });

  it('4. Allows Surveillance Team activation and removes threat when main scheme has threat > 0', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];

    heroState.mainScheme.threat = 3;
    heroState.sideSchemes = [];

    const survTeam = createCardInstance(cardCatalog.getCard('01064')!);
    survTeam.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(survTeam);

    const res = dispatchAction(heroState, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: survTeam.instanceId,
      abilityId: 'surveillance_team_action',
    });

    expect(res.result.success).toBe(true);
    expect(res.state.mainScheme.threat).toBe(2);

    const inPlayCard = res.state.players[0].tableau.find(
      (c) => c.instanceId === survTeam.instanceId,
    )!;
    expect(inPlayCard.exhausted).toBe(true);
    expect(inPlayCard.tokens?.counters).toBe(2);
  });

  it('5. Rejects threat removal targeting main scheme when a Crisis side scheme is in play with 0 threat', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];

    heroState.mainScheme.threat = 3;

    // Add Bomb Scare (01108) with Crisis icon, but with 0 threat
    const bombScareCard = cardCatalog.getCard('01108') as SideSchemeCard;
    heroState.sideSchemes = [
      {
        instanceId: 'side_crisis',
        card: bombScareCard,
        threat: 0,
      },
    ];

    const survTeam = createCardInstance(cardCatalog.getCard('01064')!);
    survTeam.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(survTeam);

    const survAbility = survTeam.card.enrichment!.abilities![0];
    const abilityCheck = canInitiateAbility(heroState, player.id, survAbility, survTeam);
    expect(abilityCheck.allowed).toBe(false);
    expect(abilityCheck.reason).toMatch(/no scheme/i);
  });

  it('6. Rejects threat removal targeting main scheme when player is engaged with a Patrol minion and no side schemes have threat', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];

    heroState.mainScheme.threat = 3;
    heroState.sideSchemes = [];

    // Engage minion with Patrol
    const baseMinion = cardCatalog.getCard('01109') as MinionCard;
    const patrolMinion = createCardInstance({
      ...baseMinion,
      keywords: [Keyword.PATROL],
    });
    player.engagedMinions = [patrolMinion];

    const survTeam = createCardInstance(cardCatalog.getCard('01064')!);
    survTeam.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(survTeam);

    const survAbility = survTeam.card.enrichment!.abilities![0];
    const abilityCheck = canInitiateAbility(heroState, player.id, survAbility, survTeam);
    expect(abilityCheck.allowed).toBe(false);
    expect(abilityCheck.reason).toMatch(/no scheme/i);
  });

  it('7. Allows threat removal targeting a side scheme with threat even when Crisis is in play', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];

    heroState.mainScheme.threat = 3;

    // Bomb Scare (01108) with Crisis icon, with 2 threat
    const bombScareCard = cardCatalog.getCard('01108') as SideSchemeCard;
    heroState.sideSchemes = [
      {
        instanceId: 'side_crisis',
        card: bombScareCard,
        threat: 2,
      },
    ];

    const survTeam = createCardInstance(cardCatalog.getCard('01064')!);
    survTeam.tokens = { damage: 0, threat: 0, counters: 3 };
    player.tableau.push(survTeam);

    const survAbility = survTeam.card.enrichment!.abilities![0];
    const abilityCheck = canInitiateAbility(heroState, player.id, survAbility, survTeam);
    expect(abilityCheck.allowed).toBe(true);
  });

  it('8. Rejects attack ability targeting villain when player is engaged with a Guard minion', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];

    // Engage minion with Guard
    const baseMinion = cardCatalog.getCard('01109') as MinionCard;
    const guardMinion = createCardInstance({
      ...baseMinion,
      keywords: [Keyword.GUARD],
    });
    player.engagedMinions = [guardMinion];

    // Card ability targeting villain
    const villainAttackAbility = {
      id: 'villain_attack_test',
      timing: 'HERO_ACTION' as const,
      steps: [
        {
          effect: 'DEAL_DAMAGE',
          effectParams: {
            amount: 4,
            target: 'VILLAIN',
          },
        },
      ],
    };

    const abilityCheck = canInitiateAbility(heroState, player.id, villainAttackAbility as any);
    expect(abilityCheck.allowed).toBe(false);
    expect(abilityCheck.reason).toMatch(/guard/i);
  });

  it('9. First Aid (01086, Event) is unplayable when no character is damaged, and playable when damaged', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];
    player.health = 10; // Full health (10/10)

    const firstAid = createCardInstance(cardCatalog.getCard('01086')!);
    const payment = createCardInstance(cardCatalog.getCard('01005')!);
    player.hand = [firstAid, payment];

    // 1. Unplayable in hand when no characters are damaged
    const playabilityUndamaged = evaluateCardPlayability(heroState, player.id, firstAid);
    expect(playabilityUndamaged.isPlayable).toBe(false);
    expect(playabilityUndamaged.reasons.some((r) => /damage to heal/i.test(r))).toBe(true);

    const playCheckUndamaged = canPlayCard(heroState, player.id, firstAid.instanceId, [
      payment.instanceId,
    ]);
    expect(playCheckUndamaged.allowed).toBe(false);
    expect(playCheckUndamaged.reason).toMatch(/damage to heal/i);

    // 2. Playable and accepted when a character has sustained damage
    player.health = 8; // Sustained 2 damage (8/10)

    const playabilityDamaged = evaluateCardPlayability(heroState, player.id, firstAid);
    expect(playabilityDamaged.isPlayable).toBe(true);

    const playCheckDamaged = canPlayCard(heroState, player.id, firstAid.instanceId, [
      payment.instanceId,
    ]);
    expect(playCheckDamaged.allowed).toBe(true);

    const playRes = dispatchAction(heroState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: firstAid.instanceId,
      paymentCardInstanceIds: [payment.instanceId],
    });
    expect(playRes.result.success).toBe(true);
    expect(playRes.state.players[0].health).toBe(10);
  });

  it('10. Med Team (01080, Support) is playable from hand at full health, enters tableau with 3 counters, and its action is rejected when undamaged', () => {
    const state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: smHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
    });

    const heroState = dispatchAction(state, { type: 'CHANGE_FORM', playerId: 'p1' }).state;
    const player = heroState.players[0];
    player.health = 10; // Full health (10/10)

    const medTeam = createCardInstance(cardCatalog.getCard('01080')!);
    const p1 = createCardInstance(cardCatalog.getCard('01005')!);
    const p2 = createCardInstance(cardCatalog.getCard('01005')!);
    const p3 = createCardInstance(cardCatalog.getCard('01005')!);
    player.hand = [medTeam, p1, p2, p3];

    // 1. Playable from hand at full health
    const playability = evaluateCardPlayability(heroState, player.id, medTeam);
    expect(playability.isPlayable).toBe(true);

    const playCheck = canPlayCard(heroState, player.id, medTeam.instanceId, [
      p1.instanceId,
      p2.instanceId,
      p3.instanceId,
    ]);
    expect(playCheck.allowed).toBe(true);

    // 2. Enters tableau with 3 counters
    const playRes = dispatchAction(heroState, {
      type: 'PLAY_CARD',
      playerId: 'p1',
      cardInstanceId: medTeam.instanceId,
      paymentCardInstanceIds: [p1.instanceId, p2.instanceId, p3.instanceId],
    });
    expect(playRes.result.success).toBe(true);

    const inPlayMedTeam = playRes.state.players[0].tableau.find(
      (c) => c.instanceId === medTeam.instanceId,
    )!;
    expect(inPlayMedTeam).toBeDefined();
    expect(inPlayMedTeam.tokens?.counters).toBe(3);
    expect(inPlayMedTeam.counters?.medical).toBe(3);
    expect(inPlayMedTeam.exhausted).toBeFalsy();

    // 3. Ability is rejected when undamaged
    const medTeamAbility = inPlayMedTeam.card.enrichment!.abilities![0];
    const abilityCheck = canInitiateAbility(
      playRes.state,
      player.id,
      medTeamAbility,
      inPlayMedTeam,
    );
    expect(abilityCheck.allowed).toBe(false);
    expect(abilityCheck.reason).toMatch(/damage to heal/i);

    const actionRes = dispatchAction(playRes.state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: inPlayMedTeam.instanceId,
      abilityId: 'med_team_heal',
    });
    expect(actionRes.result.success).toBe(false);
    expect(actionRes.result.error).toMatch(/damage to heal/i);
    expect(inPlayMedTeam.exhausted).toBeFalsy();
    expect(inPlayMedTeam.tokens?.counters).toBe(3);
  });
});
