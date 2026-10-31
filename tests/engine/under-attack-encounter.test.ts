import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '@data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  AllyCard,
  StatusCard,
  setupGame,
  resetInstanceCounter,
  createCardInstance,
  dispatchAction,
  peekDecisionPrompt,
  step4_revealEncounterCards,
  getActiveVillain,
  executeEnemyAttackSynchronously,
} from '@engine/index';
import { kernel } from '@engine/kernel';
import { runMatch } from '@engine/simulation/match-simulator';

const UNDER_ATTACK = '01151';
const VIBRANIUM_ARMOR = '01152';
const CONCUSSION_BLASTERS = '01153';
const CONCUSSIVE_BLAST = '01154';

// Resource fillers
const ENERGY_CARD = '01088'; // Energy (2 energy resources)
const PHYSICAL_CARD = '01090'; // Strength (2 physical resources)
const SPIDER_MAN_ALLY = '01011'; // Black Cat

describe('Under Attack modular set (#354)', () => {
  let state: GameState;

  beforeEach(() => {
    resetInstanceCounter();
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: cardCatalog.getCard('01001a') as HeroCard,
          alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
        {
          id: 'p2',
          name: 'Iron Man',
          hero: cardCatalog.getCard('01029a') as HeroCard,
          alterEgo: cardCatalog.getCard('01029b') as AlterEgoCard,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    for (const p of state.players) {
      p.currentForm = 'hero';
      p.activeFormCard = p.hero;
      p.exhausted = false;
    }
  });

  const p1 = () => state.players[0];
  const p2 = () => state.players[1];

  const revealFor = (playerId: string, code: string) => {
    state.players
      .find((p) => p.id === playerId)!
      .dealtEncounterCards.push(createCardInstance(cardCatalog.getCard(code)!));
    state = step4_revealEncounterCards(state);
  };

  const choosePromptOption = (playerId: string, optionId: string) => {
    const res = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId,
      selectedOptionId: optionId,
    });
    state = res.state;
    return res;
  };

  describe('01151 Under Attack (Side Scheme)', () => {
    it('reveals in solo and places 2 threat when threat option chosen', () => {
      state.players = [state.players[0]];
      revealFor('p1', UNDER_ATTACK);

      const prompt = peekDecisionPrompt(state);
      expect(prompt).toBeDefined();
      expect(prompt?.playerId).toBe('p1');
      expect(prompt?.options.map((o) => o.id)).toEqual(['place_threat', 'deal_damage']);

      choosePromptOption('p1', 'place_threat');

      const underAttackScheme = state.sideSchemes.find((s) => s.card.code === UNDER_ATTACK);
      expect(underAttackScheme).toBeDefined();
      // Base threat 3 + 2 placed = 5
      expect(underAttackScheme?.threat).toBe(5);
      expect(p1().health).toBe(p1().maxHealth);
    });

    it('reveals in 2-player and prompts each player sequentially', () => {
      revealFor('p1', UNDER_ATTACK);

      // First prompt is for p1
      const prompt1 = peekDecisionPrompt(state);
      expect(prompt1?.playerId).toBe('p1');
      choosePromptOption('p1', 'place_threat');

      // Second prompt is for p2
      const prompt2 = peekDecisionPrompt(state);
      expect(prompt2?.playerId).toBe('p2');

      const initialP2Health = p2().health;
      choosePromptOption('p2', 'deal_damage');

      // P2 hero took 3 damage
      expect(p2().health).toBe(initialP2Health - 3);

      const underAttackScheme = state.sideSchemes.find((s) => s.card.code === UNDER_ATTACK);
      // Base threat 3 + 2 placed from p1 = 5
      expect(underAttackScheme?.threat).toBe(5);
    });

    it('deals 0 damage if alter-ego chooses to deal 3 damage to their hero', () => {
      state.players = [state.players[0]];
      p1().currentForm = 'alter_ego';
      p1().activeFormCard = p1().alterEgo;

      revealFor('p1', UNDER_ATTACK);
      const initialHealth = p1().health;

      choosePromptOption('p1', 'deal_damage');

      expect(p1().health).toBe(initialHealth);
    });
  });

  describe('01153 Concussion Blasters (Attachment)', () => {
    it('attaches to villain and grants Retaliate 1 on hero attacks', () => {
      revealFor('p1', CONCUSSION_BLASTERS);

      const villain = getActiveVillain(state);
      expect(villain.attachments?.some((a) => a.card.code === CONCUSSION_BLASTERS)).toBe(true);

      const p1InitialHealth = p1().health;
      const attackRes = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'villain',
      });
      state = attackRes.state;

      // Retaliate 1 from Concussion Blasters damages p1 hero
      expect(p1().health).toBe(p1InitialHealth - 1);
    });

    it('discards via hero action by exhausting hero and spending 2 energy resources', () => {
      revealFor('p1', CONCUSSION_BLASTERS);
      const villain = getActiveVillain(state);

      // Give p1 an Energy resource card in hand (has 2 energy resources)
      const energyCard = createCardInstance(cardCatalog.getCard(ENERGY_CARD)!);
      p1().hand.push(energyCard);

      const attachment = (villain.attachments || []).find(
        (a) => a.card.code === CONCUSSION_BLASTERS,
      )!;
      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: attachment.instanceId,
        abilityId: 'concussion_blasters_discard',
        paymentCardInstanceIds: [energyCard.instanceId],
      });
      state = res.state;

      expect(res.result.success).toBe(true);
      expect(p1().exhausted).toBe(true);
      expect(
        getActiveVillain(state).attachments?.some((a) => a.card.code === CONCUSSION_BLASTERS),
      ).toBe(false);
      expect(state.encounterDiscard.some((c) => c.card.code === CONCUSSION_BLASTERS)).toBe(true);
    });
  });

  describe('01154 Concussive Blast (Treachery)', () => {
    it('deals 1 damage to each friendly character when revealed', () => {
      // Add an ally to p1
      const ally = createCardInstance(cardCatalog.getCard(SPIDER_MAN_ALLY) as AllyCard);
      p1().allies.push(ally);

      // Put p2 in alter-ego
      p2().currentForm = 'alter_ego';
      p2().activeFormCard = p2().alterEgo;

      const p1InitialHealth = p1().health;
      const p2InitialHealth = p2().health;

      revealFor('p1', CONCUSSIVE_BLAST);

      expect(p1().health).toBe(p1InitialHealth - 1);
      expect(p2().health).toBe(p2InitialHealth - 1);
      expect(ally.tokens?.damage).toBe(1);
    });

    it('deals 1 damage to each character controlled by the defender on Boost', () => {
      // Add an ally to p1 and an ally to p2
      const p1Ally = createCardInstance(cardCatalog.getCard(SPIDER_MAN_ALLY) as AllyCard);
      const p2Ally = createCardInstance(cardCatalog.getCard(SPIDER_MAN_ALLY) as AllyCard);
      p1().allies.push(p1Ally);
      p2().allies.push(p2Ally);

      const p2InitialHealth = p2().health;

      // Set Concussive Blast as the facedown boost card for an enemy attack on p1
      const boostCard = createCardInstance(cardCatalog.getCard(CONCUSSIVE_BLAST)!);
      state.encounterDeck = [boostCard];

      state = executeEnemyAttackSynchronously(
        state,
        { type: 'VILLAIN', villainId: getActiveVillain(state).instanceId },
        'p1',
      );

      // P1 ally took 1 damage from the star boost effect
      expect(p1Ally.tokens?.damage).toBe(1);
      // P2 characters must be completely untouched by the boost effect
      expect(p2().health).toBe(p2InitialHealth);
      expect(p2Ally.tokens?.damage ?? 0).toBe(0);
    });
  });

  describe('01152 Vibranium Armor (Attachment)', () => {
    it('gives villain Tough after villain takes damage', () => {
      revealFor('p1', VIBRANIUM_ARMOR);

      const villain = getActiveVillain(state);
      expect(villain.attachments?.some((a) => a.card.code === VIBRANIUM_ARMOR)).toBe(true);
      expect(villain.statusCards).not.toContain(StatusCard.TOUGH);

      // Deal 2 damage to villain via basic attack
      const attackRes = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'villain',
      });
      state = attackRes.state;

      // Villain took damage and triggered Vibranium Armor's Forced Response -> gains Tough
      const currentVillain = getActiveVillain(state);
      expect(currentVillain.statusCards).toContain(StatusCard.TOUGH);
    });

    it('does not give multiple Tough status cards when villain already has Tough', () => {
      revealFor('p1', VIBRANIUM_ARMOR);
      const villain = getActiveVillain(state);
      villain.statusCards.push(StatusCard.TOUGH);

      const attachment = (villain.attachments || []).find((a) => a.card.code === VIBRANIUM_ARMOR)!;
      const toughAbility = (attachment.card.enrichment?.abilities || []).find(
        (a) => a.id === 'vibranium_armor_tough',
      )!;

      // Execute ability effect while villain already has Tough
      kernel.executeEffect(state, toughAbility, {
        playerId: 'p1',
        sourceCardInstance: attachment,
      });

      const toughCount = villain.statusCards.filter((s) => s === StatusCard.TOUGH).length;
      expect(toughCount).toBe(1);
    });

    it('discards via Hero Action by exhausting hero and spending 2 physical resources', () => {
      revealFor('p1', VIBRANIUM_ARMOR);
      const villain = getActiveVillain(state);

      // Provide Strength card (2 physical resources) in hand
      const strengthCard = createCardInstance(cardCatalog.getCard(PHYSICAL_CARD)!);
      p1().hand.push(strengthCard);

      const attachment = (villain.attachments || []).find((a) => a.card.code === VIBRANIUM_ARMOR)!;
      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: attachment.instanceId,
        abilityId: 'vibranium_armor_discard',
        paymentCardInstanceIds: [strengthCard.instanceId],
      });
      state = res.state;

      expect(res.result.success).toBe(true);
      expect(p1().exhausted).toBe(true);
      expect(
        getActiveVillain(state).attachments?.some((a) => a.card.code === VIBRANIUM_ARMOR),
      ).toBe(false);
      expect(state.encounterDiscard.some((c) => c.card.code === VIBRANIUM_ARMOR)).toBe(true);
    });
  });

  describe('Full modular set simulation integration', () => {
    it('plays a match with Under Attack modular set to completion without unhandled errors', () => {
      const simState = setupGame({
        catalog: cardCatalog,
        scenarioId: 'rhino',
        modularSetCodes: ['under_attack'],
        players: [
          {
            id: 'p1',
            name: 'Spider-Man',
            hero: cardCatalog.getCard('01001a') as HeroCard,
            alterEgo: cardCatalog.getCard('01001b') as AlterEgoCard,
            deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
          },
        ],
        skipMulligan: true,
      });

      const match = runMatch(simState, { maxRounds: 3 });

      expect(['HEROES', 'VILLAIN', 'TIMEOUT']).toContain(match.winner);
      expect(match.roundsPlayed).toBeGreaterThan(0);
    });
  });
});
