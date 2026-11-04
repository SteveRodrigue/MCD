import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import { createCardInstance } from '../../src/engine/state/card-instance';
import { GameState, CardInstance } from '../../src/engine/models';
import { getActiveVillain } from '../../src/engine/models/state';
import { step4_revealEncounterCards } from '../../src/engine/pipeline/villain-phase';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import {
  getEffectiveRetaliate,
  getEffectiveVillainStats,
} from '../../src/engine/pipeline/stat-calculator';

describe('Issue #607: Klaw villain-modifier and heal cards (01119, 01124)', () => {
  let state: GameState;

  const fillerEncounterCard = (): CardInstance =>
    createCardInstance({
      code: `filler-${Math.random()}`,
      name: 'Filler Treachery',
      type: 'treachery',
      boostIcons: 0,
    } as any);

  beforeEach(() => {
    const spiderMan = cardCatalog.getHeroIdentity('spider_man')!;
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'klaw',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
          hero: spiderMan.hero,
          alterEgo: spiderMan.alterEgo,
          deckCards: Array(15).fill(cardCatalog.getCard('01005')!),
        },
      ],
      skipMulligan: true,
      shuffleFn: (arr) => arr,
    });
    // Start in hero form
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = state.players[0].hero;
    state.players[0].exhausted = false;
    state.players[0].engagedMinions = [];
    // Provide encounter deck cards
    state.encounterDeck = Array.from({ length: 10 }, () => fillerEncounterCard());
  });

  describe('01119 Solid-Sound Body', () => {
    it('grants Klaw retaliate 1 while attached', () => {
      const villain = getActiveVillain(state);
      expect(getEffectiveRetaliate(villain, state)).toBe(0);

      const solidSoundBody = createCardInstance(cardCatalog.getCard('01119')!);
      villain.attachments = [solidSoundBody];

      expect(getEffectiveRetaliate(villain, state)).toBe(1);
      const villainStats = getEffectiveVillainStats(state, villain);
      expect(villainStats.keywords).toContain('Retaliate');
    });

    it('Scenario 1: Klaw retaliates 1 when attacked and survives', () => {
      const player = state.players[0];
      const villain = getActiveVillain(state);
      const solidSoundBody = createCardInstance(cardCatalog.getCard('01119')!);
      villain.attachments = [solidSoundBody];

      const heroHpBefore = player.health;
      const villainHpBefore = villain.health;

      // Spider-Man (Hero) performs basic attack (ATK 2) against Klaw
      const res = dispatchAction(state, {
        type: 'BASIC_ATTACK',
        playerId: 'p1',
        targetType: 'villain',
      });

      expect(res.result.success).toBe(true);
      // Klaw took 2 damage
      expect(getActiveVillain(res.state).health).toBe(villainHpBefore - 2);
      // Spider-Man took 1 retaliate damage from Klaw
      expect(res.state.players[0].health).toBe(heroHpBefore - 1);
    });

    it('Scenario 2: Hero Action discards Solid-Sound Body when paying E M P resources', () => {
      const player = state.players[0];
      const villain = getActiveVillain(state);
      const solidSoundBody = createCardInstance(cardCatalog.getCard('01119')!);
      villain.attachments = [solidSoundBody];

      expect(getEffectiveRetaliate(villain, state)).toBe(1);

      // Provide 1 Energy (01088), 1 Mental (01089), 1 Physical (01090) in hand
      const energyCard = createCardInstance(cardCatalog.getCard('01088')!);
      const mentalCard = createCardInstance(cardCatalog.getCard('01089')!);
      const physicalCard = createCardInstance(cardCatalog.getCard('01090')!);
      player.hand = [energyCard, mentalCard, physicalCard];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: solidSoundBody.instanceId,
        abilityId: 'solid_sound_body_discard_action',
        paymentCardInstanceIds: [
          energyCard.instanceId,
          mentalCard.instanceId,
          physicalCard.instanceId,
        ],
      });

      expect(res.result.success).toBe(true);
      const activeVillain = getActiveVillain(res.state);
      expect(activeVillain.attachments.some((a) => a.card.code === '01119')).toBe(false);
      expect(res.state.encounterDiscard.some((c) => c.card.code === '01119')).toBe(true);
      // Klaw no longer has Retaliate 1
      expect(getEffectiveRetaliate(activeVillain, res.state)).toBe(0);
    });

    it('Hero Action is rejected while in Alter-Ego form', () => {
      const player = state.players[0];
      player.currentForm = 'alter_ego';
      player.activeFormCard = player.alterEgo;

      const villain = getActiveVillain(state);
      const solidSoundBody = createCardInstance(cardCatalog.getCard('01119')!);
      villain.attachments = [solidSoundBody];

      const energyCard = createCardInstance(cardCatalog.getCard('01088')!);
      const mentalCard = createCardInstance(cardCatalog.getCard('01089')!);
      const physicalCard = createCardInstance(cardCatalog.getCard('01090')!);
      player.hand = [energyCard, mentalCard, physicalCard];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: solidSoundBody.instanceId,
        abilityId: 'solid_sound_body_discard_action',
        paymentCardInstanceIds: [
          energyCard.instanceId,
          mentalCard.instanceId,
          physicalCard.instanceId,
        ],
      });

      expect(res.result.success).toBe(false);
      expect(getActiveVillain(res.state).attachments.some((a) => a.card.code === '01119')).toBe(
        true,
      );
    });
  });

  describe('01124 Sound Manipulation', () => {
    it('Scenario 3: When Revealed in Alter-Ego heals 4 damage on Klaw (no surge when damage healed)', () => {
      const player = state.players[0];
      player.currentForm = 'alter_ego';
      player.activeFormCard = player.alterEgo;

      const villain = getActiveVillain(state);
      const maxHp = villain.maxHealth;
      // Put Klaw at maxHp - 4
      villain.health = maxHp - 4;

      const soundManipulation = createCardInstance(cardCatalog.getCard('01124')!);
      player.dealtEncounterCards = [soundManipulation];

      state = step4_revealEncounterCards(state);

      // Klaw was healed by 4 up to maxHp
      expect(getActiveVillain(state).health).toBe(maxHp);
      // Damage was healed, so no surge was triggered (no extra cards dealt)
      expect(player.dealtEncounterCards.length).toBe(0);
      expect(state.encounterDiscard.some((c) => c.card.code === '01124')).toBe(true);
    });

    it('Scenario 4: When Revealed in Alter-Ego surges when Klaw is at full HP (0 damage healed)', () => {
      const player = state.players[0];
      player.currentForm = 'alter_ego';
      player.activeFormCard = player.alterEgo;

      const villain = getActiveVillain(state);
      const maxHp = villain.maxHealth;
      villain.health = maxHp; // 0 damage on Klaw

      const soundManipulation = createCardInstance(cardCatalog.getCard('01124')!);
      player.dealtEncounterCards = [soundManipulation];

      const deckCountBefore = state.encounterDeck.length;

      state = step4_revealEncounterCards(state);

      // Klaw remains at maxHp
      expect(getActiveVillain(state).health).toBe(maxHp);
      // 0 damage healed -> surge triggered!
      // In step4_revealEncounterCards, surge deals an additional card and reveals it in the loop
      // Verify an encounter card was drawn from the deck due to surge
      expect(state.encounterDeck.length).toBe(deckCountBefore - 1);
      expect(state.encounterDiscard.some((c) => c.card.code === '01124')).toBe(true);
    });

    it('When Revealed in Alter-Ego caps healing at max HP and does not surge if at least 1 HP healed', () => {
      const player = state.players[0];
      player.currentForm = 'alter_ego';
      player.activeFormCard = player.alterEgo;

      const villain = getActiveVillain(state);
      const maxHp = villain.maxHealth;
      // Klaw has only 1 damage taken
      villain.health = maxHp - 1;

      const soundManipulation = createCardInstance(cardCatalog.getCard('01124')!);
      player.dealtEncounterCards = [soundManipulation];

      const deckCountBefore = state.encounterDeck.length;

      state = step4_revealEncounterCards(state);

      expect(getActiveVillain(state).health).toBe(maxHp);
      // 1 HP was healed (> 0), so no surge occurred
      expect(state.encounterDeck.length).toBe(deckCountBefore);
    });

    it('Scenario 5: When Revealed in Hero deals 2 damage to hero and heals 2 damage on Klaw (no surge)', () => {
      const player = state.players[0];
      player.currentForm = 'hero';
      player.activeFormCard = player.hero;
      player.health = 10;

      const villain = getActiveVillain(state);
      const maxHp = villain.maxHealth;
      villain.health = maxHp - 3; // 3 damage on Klaw

      const soundManipulation = createCardInstance(cardCatalog.getCard('01124')!);
      player.dealtEncounterCards = [soundManipulation];

      const deckCountBefore = state.encounterDeck.length;

      state = step4_revealEncounterCards(state);

      // Hero takes 2 damage: 10 -> 8
      expect(state.players[0].health).toBe(8);
      // Klaw heals 2 damage: maxHp - 3 -> maxHp - 1
      expect(getActiveVillain(state).health).toBe(maxHp - 1);
      // Hero form does NOT surge, even if Klaw were at full HP
      expect(state.encounterDeck.length).toBe(deckCountBefore);
    });

    it('When Revealed in Hero does not surge even if Klaw is at full HP', () => {
      const player = state.players[0];
      player.currentForm = 'hero';
      player.activeFormCard = player.hero;
      player.health = 10;

      const villain = getActiveVillain(state);
      const maxHp = villain.maxHealth;
      villain.health = maxHp; // Klaw at full HP

      const soundManipulation = createCardInstance(cardCatalog.getCard('01124')!);
      player.dealtEncounterCards = [soundManipulation];

      const deckCountBefore = state.encounterDeck.length;

      state = step4_revealEncounterCards(state);

      // Hero takes 2 damage
      expect(state.players[0].health).toBe(8);
      // Klaw stays at maxHp
      expect(getActiveVillain(state).health).toBe(maxHp);
      // Hero form does NOT surge
      expect(state.encounterDeck.length).toBe(deckCountBefore);
    });
  });
});
