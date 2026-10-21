import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  CardInstance,
  GamePhase,
  getActiveVillain,
} from '../../src/engine/models';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import { canInitiateAbility } from '../../src/engine/pipeline/legality-checker';
import { getLegalActionsForPlayer } from '../../src/engine/pipeline/legal-actions-generator';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';

describe('Villain & Encounter Card Action Discovery & Legality (Issue #314 / RR v1.8 p. 5, 23)', () => {
  let state: GameState;
  let spiderManHero: HeroCard;
  let peterParkerAlterEgo: AlterEgoCard;
  let ironManHero: HeroCard;
  let tonyStarkAlterEgo: AlterEgoCard;

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
    state.activePlayerIndex = 0;
  });

  it('1. Active player can trigger Hero Action on villain attachment to discard it by paying resources', () => {
    const p1 = state.players[0];
    p1.currentForm = 'hero';
    p1.activeFormCard = spiderManHero;

    // Ivory Horn (01100) or Armored Suit attachment with Hero Action: Spend physical resources -> discard
    const hornCard = cardCatalog.getCard('01100')!;
    const hornInstance: CardInstance = createCardInstance(hornCard);
    getActiveVillain(state).attachments = [hornInstance];

    // Give player physical resource cards
    const phys1 = createCardInstance(cardCatalog.getCard('01003')!);
    const phys2 = createCardInstance(cardCatalog.getCard('01003')!);
    const phys3 = createCardInstance(cardCatalog.getCard('01003')!);
    p1.hand = [phys1, phys2, phys3];

    const report = getLegalActionsForPlayer(state, 'p1');
    expect(report.villainActionItems).toBeDefined();
    expect(report.villainActionCount).toBeGreaterThanOrEqual(1);

    const hornAction = report.villainActionItems.find(
      (item) => (item.action as any).cardInstanceId === hornInstance.instanceId,
    );
    expect(hornAction).toBeDefined();
    expect(hornAction?.category).toBe('villain');
    expect(hornAction?.requiresModal).toBe('payment');

    // Dispatch USE_CARD_ABILITY to discard
    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: hornInstance.instanceId,
      abilityId: 'ivory_horn_discard_action',
      paymentCardInstanceIds: [phys1.instanceId, phys2.instanceId, phys3.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(
      getActiveVillain(res.state).attachments.some((a) => a.instanceId === hornInstance.instanceId),
    ).toBe(false);
  });

  it('2. Active player can trigger Hero Action on player attachment (Caught in a Web 01104) to discard it', () => {
    const p1 = state.players[0];
    p1.currentForm = 'hero';
    p1.activeFormCard = spiderManHero;

    // Caught in a Web: Attach to identity. Hero Action: Spend physical, mental, energy -> discard
    const caughtInWeb: CardInstance = {
      instanceId: 'caught_in_web_1',
      card: {
        code: '01104_mock',
        name: 'Caught in a Web',
        type: 'attachment',
        enrichment: {
          abilities: [
            {
              id: 'caught_in_a_web_action',
              timing: 'HERO_ACTION',
              cost: {
                resourceCost: {
                  physical: 1,
                  energy: 1,
                  mental: 1,
                },
              },
              steps: [
                {
                  effect: 'DISCARD',
                  effectParams: { source: 'SELF' },
                },
              ],
            },
          ],
        },
      } as any,
      exhausted: false,
    };
    p1.attachments = [caughtInWeb];

    // Give player physical, mental, energy resources
    const phys = createCardInstance(cardCatalog.getCard('01003')!);
    const energy = createCardInstance(cardCatalog.getCard('01004')!);
    const mental = createCardInstance(cardCatalog.getCard('01005')!);
    p1.hand = [phys, energy, mental];

    const report = getLegalActionsForPlayer(state, 'p1');
    const webAction = report.villainActionItems.find(
      (item) => (item.action as any).cardInstanceId === caughtInWeb.instanceId,
    );
    expect(webAction).toBeDefined();
    expect(webAction?.category).toBe('villain');

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: caughtInWeb.instanceId,
      abilityId: 'caught_in_a_web_action',
      paymentCardInstanceIds: [phys.instanceId, energy.instanceId, mental.instanceId],
    });

    expect(res.result.success).toBe(true);
    expect(
      res.state.players[0].attachments?.some((a) => a.instanceId === caughtInWeb.instanceId),
    ).toBe(false);
  });

  it('3. Active player in Alter-Ego can trigger obligation Action in their own play area to discard it', () => {
    const p1 = state.players[0];
    p1.currentForm = 'alter_ego';
    p1.activeFormCard = peterParkerAlterEgo;

    // Obligation with Action ability in p1's obligations
    const obligationCard: CardInstance = {
      instanceId: 'ob_1',
      card: {
        code: '01101_mock',
        name: 'Eviction Notice',
        type: 'obligation',
        enrichment: {
          abilities: [
            {
              id: 'eviction_discard_action',
              timing: 'ALTER_EGO_ACTION',
              cost: {
                exhaustCard: 'SELF_IDENTITY',
              },
              steps: [
                {
                  effect: 'DISCARD',
                  effectParams: { source: 'SELF' },
                },
              ],
            },
          ],
        },
      } as any,
      exhausted: false,
    };
    p1.obligations = [obligationCard];

    const report = getLegalActionsForPlayer(state, 'p1');
    const obAction = report.villainActionItems.find(
      (item) => (item.action as any).cardInstanceId === obligationCard.instanceId,
    );
    expect(obAction).toBeDefined();
    expect(obAction?.category).toBe('villain');

    const check = canInitiateAbility(
      state,
      'p1',
      obligationCard.card.enrichment!.abilities![0],
      obligationCard,
    );
    expect(check.allowed).toBe(true);

    const res = dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: 'p1',
      cardInstanceId: obligationCard.instanceId,
      abilityId: 'eviction_discard_action',
    });

    expect(res.result.success).toBe(true);
    expect(
      res.state.players[0].obligations?.some((o) => o.instanceId === obligationCard.instanceId),
    ).toBe(false);
  });

  it("4. Player CANNOT trigger obligation Action in another player's play area (RR v1.8 p. 5)", () => {
    const p1 = state.players[0];
    const p2 = state.players[1];
    p1.currentForm = 'alter_ego';
    p2.currentForm = 'alter_ego';

    const obligationCard: CardInstance = {
      instanceId: 'ob_2',
      card: {
        code: '01101_mock',
        name: 'Eviction Notice',
        type: 'obligation',
        enrichment: {
          abilities: [
            {
              id: 'eviction_discard_action',
              timing: 'ALTER_EGO_ACTION',
              steps: [{ effect: 'DISCARD', effectParams: { source: 'SELF' } }],
            },
          ],
        },
      } as any,
      exhausted: false,
    };

    // Place in p2's obligations
    p2.obligations = [obligationCard];

    // p1 attempts to initiate or trigger obligation in p2's area
    const check = canInitiateAbility(
      state,
      'p1',
      obligationCard.card.enrichment!.abilities![0],
      obligationCard,
    );
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/obligation/i);

    // p1's legal action generator must NOT surface p2's obligation
    const report = getLegalActionsForPlayer(state, 'p1');
    expect(
      report.villainActionItems.some(
        (item) => (item.action as any).cardInstanceId === obligationCard.instanceId,
      ),
    ).toBe(false);
  });

  it('5. villainActionItems correctly isolates encounter actions from player tableau actions', () => {
    const p1 = state.players[0];
    p1.currentForm = 'hero';
    p1.activeFormCard = spiderManHero;

    // Player tableau card with Action ability (Avengers Mansion 01091)
    const avengersMansion = createCardInstance(cardCatalog.getCard('01091')!);
    p1.tableau.push(avengersMansion);

    // Villain attachment
    const hornCard = cardCatalog.getCard('01100')!;
    const hornInstance: CardInstance = createCardInstance(hornCard);
    getActiveVillain(state).attachments = [hornInstance];
    p1.hand = [
      createCardInstance(cardCatalog.getCard('01003')!),
      createCardInstance(cardCatalog.getCard('01003')!),
      createCardInstance(cardCatalog.getCard('01003')!),
    ];

    const report = getLegalActionsForPlayer(state, 'p1');

    // boardActions has Avengers Mansion, but NOT Ivory Horn
    expect(
      report.boardActions.some(
        (item) => (item.action as any).cardInstanceId === avengersMansion.instanceId,
      ),
    ).toBe(true);
    expect(
      report.boardActions.some(
        (item) => (item.action as any).cardInstanceId === hornInstance.instanceId,
      ),
    ).toBe(false);

    // villainActionItems has Ivory Horn, but NOT Avengers Mansion
    expect(
      report.villainActionItems.some(
        (item) => (item.action as any).cardInstanceId === hornInstance.instanceId,
      ),
    ).toBe(true);
    expect(
      report.villainActionItems.some(
        (item) => (item.action as any).cardInstanceId === avengersMansion.instanceId,
      ),
    ).toBe(false);
  });
});
