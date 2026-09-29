import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, GamePhase, CardAbility } from '../../src/engine/models';
import { setupGame, createCardInstance } from '../../src/engine/state/game-setup';
import {
  evaluateCardPlayability,
  canPlayCard,
  canInitiateAbility,
  canBasicAttack,
  canBasicThwart,
  canBasicRecover,
  canChangeForm,
  canAllyAttack,
  canAllyThwart,
} from '../../src/engine/pipeline/legality-checker';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import {
  step2_villainActivations,
  step5_revealEncounterCards,
} from '../../src/engine/pipeline/villain-phase';

describe('Villain Phase Card Play and Action Restrictions (Issue #182)', () => {
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
          name: 'Spider-Man',
          hero: spiderManHero,
          alterEgo: peterParkerAlterEgo,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });

    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderManHero;
  });

  describe('Card Play Restrictions during Villain Phase', () => {
    it('evaluateCardPlayability returns isPlayable: false and includes reason during Villain Phase', () => {
      state.phase = GamePhase.VILLAIN_PHASE;
      const cardInst = createCardInstance(cardCatalog.getCard('01005')!);
      state.players[0].hand = [cardInst];

      const playability = evaluateCardPlayability(state, 'p1', cardInst);
      expect(playability.isPlayable).toBe(false);
      expect(playability.reasons).toContain('Cannot play cards during the Villain Phase');
    });

    it('canPlayCard returns allowed: false with Villain Phase reason', () => {
      state.phase = GamePhase.VILLAIN_PHASE;
      const cardInst = createCardInstance(cardCatalog.getCard('01005')!);
      state.players[0].hand = [cardInst];

      const check = canPlayCard(state, 'p1', cardInst.instanceId, []);
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('Cannot play cards during the Villain Phase.');
    });

    it('dispatching PLAY_CARD action fails during Villain Phase', () => {
      state.phase = GamePhase.VILLAIN_PHASE;
      const cardInst = createCardInstance(cardCatalog.getCard('01005')!);
      state.players[0].hand = [cardInst];

      const result = dispatchAction(state, {
        type: 'PLAY_CARD',
        playerId: 'p1',
        cardInstanceId: cardInst.instanceId,
        paymentCardInstanceIds: [],
      });

      expect(result.result.success).toBe(false);
      expect(result.result.error).toBe('Cannot play cards during the Villain Phase.');
    });
  });

  describe('Action Ability and Basic Action Restrictions during Villain Phase', () => {
    it('canInitiateAbility returns allowed: false for action abilities during Villain Phase', () => {
      state.phase = GamePhase.VILLAIN_PHASE;

      const actionAbility: CardAbility = {
        id: 'test_action',
        timing: 'ACTION',
        steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 1 } }],
      };
      const heroActionAbility: CardAbility = {
        id: 'test_hero_action',
        timing: 'HERO_ACTION',
        steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 1 } }],
      };
      const alterEgoActionAbility: CardAbility = {
        id: 'test_ae_action',
        timing: 'ALTER_EGO_ACTION',
        steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 1 } }],
      };

      const resAction = canInitiateAbility(state, 'p1', actionAbility);
      expect(resAction.allowed).toBe(false);
      expect(resAction.reason).toBe('Action abilities can only be used during the Player Phase.');

      const resHeroAction = canInitiateAbility(state, 'p1', heroActionAbility);
      expect(resHeroAction.allowed).toBe(false);
      expect(resHeroAction.reason).toBe(
        'Action abilities can only be used during the Player Phase.',
      );

      const resAlterEgoAction = canInitiateAbility(state, 'p1', alterEgoActionAbility);
      expect(resAlterEgoAction.allowed).toBe(false);
      expect(resAlterEgoAction.reason).toBe(
        'Action abilities can only be used during the Player Phase.',
      );
    });

    it('basic actions and ally actions return allowed: false during Villain Phase', () => {
      state.phase = GamePhase.VILLAIN_PHASE;
      const allyInst = createCardInstance(cardCatalog.getCard('01011')!);
      state.players[0].allies = [allyInst];

      const expectedReason = 'Actions can only be taken during the Player Phase.';

      expect(canBasicAttack(state, 'p1', 'villain')).toEqual({
        allowed: false,
        reason: expectedReason,
      });
      expect(canBasicThwart(state, 'p1', 'main_scheme')).toEqual({
        allowed: false,
        reason: expectedReason,
      });
      expect(canBasicRecover(state, 'p1')).toEqual({
        allowed: false,
        reason: expectedReason,
      });
      expect(canChangeForm(state, 'p1')).toEqual({
        allowed: false,
        reason: expectedReason,
      });
      expect(canAllyAttack(state, 'p1', allyInst.instanceId, 'villain')).toEqual({
        allowed: false,
        reason: expectedReason,
      });
      expect(canAllyThwart(state, 'p1', allyInst.instanceId, 'main_scheme')).toEqual({
        allowed: false,
        reason: expectedReason,
      });
    });
  });

  describe('Reactive Interrupts during Villain Phase remain triggerable via prompt', () => {
    it('Backflip (01003) defense interrupt triggers and prevents damage during Villain Phase attack', () => {
      state.phase = GamePhase.VILLAIN_PHASE;
      state.players[0].currentForm = 'hero';
      state.players[0].activeFormCard = spiderManHero;

      const backflipCard = cardCatalog.getCard('01003')!;
      const backflipInst = createCardInstance(backflipCard);
      state.players[0].hand = [backflipInst];

      const initialHealth = state.players[0].health;

      step2_villainActivations(state, {
        synchronousPolicy: 'TAKE_UNDEFENDED',
        acceptOptionalTriggers: false,
      });

      // Pass Spider-Sense if triggered on attack declaration
      if (state.pendingDecisionPrompt?.title?.includes('Spider-Man')) {
        state = dispatchAction(state, {
          type: 'RESOLVE_DECISION_PROMPT',
          playerId: 'p1',
          selectedOptionId: 'pass',
        }).state;
      }

      // Backflip prompt should be enqueued at damage step
      const prompt = state.pendingDecisionPrompt;
      expect(prompt).toBeDefined();
      expect(prompt?.title).toContain('Backflip');
      expect(prompt?.description).toContain('DAMAGE_WOULD_BE_TAKEN');

      // Resolve prompt with 'Yes'
      const yesOption = prompt!.options.find((o) => o.label === 'Yes')!;
      const res = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: yesOption.id,
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].health).toBe(initialHealth);
      expect(res.state.players[0].discard.some((c) => c.card.code === '01003')).toBe(true);
    });

    it('Enhanced Spider-Sense (01004) triggers via prompt during encounter reveal in Villain Phase', () => {
      state.phase = GamePhase.VILLAIN_PHASE;
      state.players[0].currentForm = 'hero';
      state.players[0].activeFormCard = spiderManHero;

      const spiderSenseInst = createCardInstance(cardCatalog.getCard('01004')!);
      const payCard = createCardInstance(cardCatalog.getCard('01005')!);
      state.players[0].hand = [spiderSenseInst, payCard];

      // False Alarm (01112): When Revealed -> Player is confused
      const falseAlarm = createCardInstance(cardCatalog.getCard('01112')!);
      state.players[0].dealtEncounterCards = [falseAlarm];

      // Reveal encounter cards without automatic trigger acceptance
      const intermediateState = step5_revealEncounterCards(state, {
        acceptOptionalTriggers: false,
      });

      // Enhanced Spider-Sense prompt should be pending
      const prompt = intermediateState.pendingDecisionPrompt;
      expect(prompt).toBeDefined();
      expect(prompt?.title).toContain('Enhanced Spider-Sense');

      // Resolve with the trigger option (non-pass)
      const triggerOption = prompt!.options.find((o) => o.id !== 'pass')!;
      expect(triggerOption).toBeDefined();
      const finalState = dispatchAction(intermediateState, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: triggerOption.id,
      }).state;

      // Status card should not contain confused, and spider sense is discarded
      expect(finalState.players[0].statusCards).not.toContain('confused');
      expect(finalState.players[0].discard.some((c) => c.card.code === '01004')).toBe(true);
      expect(finalState.encounterDiscard.some((c) => c.card.code === '01112')).toBe(true);
    });
  });
});
