import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { setupGame } from '../../src/engine/state/game-setup';
import { createCardInstance } from '../../src/engine/state/card-instance';
import { GameState, CardInstance, StatusCard } from '../../src/engine/models';
import { getActiveVillain, getActiveMainScheme } from '../../src/engine/models/state';
import { step4_revealEncounterCards } from '../../src/engine/pipeline/villain-phase';
import { executeEnemyAttackSynchronously } from '../../src/engine/pipeline/combat-pipeline';
import { dispatchAction } from '../../src/engine/pipeline/action-dispatcher';
import { peekDecisionPrompt } from '../../src/engine/pipeline/prompt-queue';

describe('Issue #606: Klaw "attack dealt damage" cards (01118, 01122, 01123)', () => {
  let state: GameState;

  const fillerBoost = (boostIcons = 0): CardInstance =>
    createCardInstance({
      code: `filler-${Math.random()}`,
      name: 'Filler',
      type: 'treachery',
      boostIcons,
    } as any);

  const stackBoosts = (...cards: CardInstance[]) => {
    state.encounterDeck = [...cards, ...state.encounterDeck];
  };

  const answer = (selectedOptionId: string) => {
    const prompt = peekDecisionPrompt(state);
    if (!prompt) throw new Error('Expected prompt to be open');
    const res = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId,
    });
    state = res.state;
  };

  const declineSpiderSense = () => {
    if (peekDecisionPrompt(state)?.options.some((o) => o.id === 'trigger_spider_sense')) {
      answer('pass');
    }
  };

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
    // Provide plenty of 0-boost cards in encounter deck so Klaw doesn't reshuffle or add random icons
    state.encounterDeck = Array.from({ length: 10 }, () => fillerBoost(0));
  });

  describe('01118 Sonic Converter', () => {
    it('gives Klaw +1 ATK while attached', () => {
      const villain = getActiveVillain(state);
      const sonicConverter = createCardInstance(cardCatalog.getCard('01118')!);
      villain.attachments = [sonicConverter];

      const hpBefore = state.players[0].health;
      state = executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Klaw I has base ATK 0, Sonic Converter gives +1 ATK, boost gives 0 -> deals 1 damage
      expect(state.players[0].health).toBe(hpBefore - 1);
    });

    it('stuns hero when Klaw attacks and deals damage', () => {
      const player = state.players[0];
      const villain = getActiveVillain(state);
      const sonicConverter = createCardInstance(cardCatalog.getCard('01118')!);
      villain.attachments = [sonicConverter];

      const hpBefore = player.health;
      state = executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      expect(state.players[0].health).toBe(hpBefore - 1);
      expect(state.players[0].statusCards).toContain(StatusCard.STUNNED);
    });

    it('does NOT stun hero when attack damage is prevented (Tough status absorbs hit)', () => {
      const player = state.players[0];
      player.statusCards = [StatusCard.TOUGH];
      const villain = getActiveVillain(state);
      const sonicConverter = createCardInstance(cardCatalog.getCard('01118')!);
      villain.attachments = [sonicConverter];

      const hpBefore = player.health;
      state = executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Tough absorbed the damage
      expect(state.players[0].health).toBe(hpBefore);
      expect(state.players[0].statusCards).not.toContain(StatusCard.STUNNED);
    });

    it('stuns defending ally when ally takes the damage', () => {
      const player = state.players[0];
      const ally = createCardInstance(cardCatalog.getCard('01011')!, 'p1'); // Daredevil, 4 HP
      player.allies = [ally];

      const villain = getActiveVillain(state);
      const sonicConverter = createCardInstance(cardCatalog.getCard('01118')!);
      villain.attachments = [sonicConverter];

      state = executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'ALLY_CHUMP_BLOCK');

      // Ally took 1 damage and is stunned
      const allyAfter = state.players[0].allies.find((a) => a.instanceId === ally.instanceId)!;
      expect(allyAfter.tokens?.damage ?? 0).toBe(1);
      expect(allyAfter.statusCards).toContain(StatusCard.STUNNED);
      // Hero was not damaged and not stunned
      expect(state.players[0].statusCards).not.toContain(StatusCard.STUNNED);
    });

    it('Hero Action discards Sonic Converter when paying E M P resources', () => {
      const player = state.players[0];
      const villain = getActiveVillain(state);
      const sonicConverter = createCardInstance(cardCatalog.getCard('01118')!);
      villain.attachments = [sonicConverter];

      // Provide 1 Energy (01088), 1 Mental (01089), 1 Physical (01090) in hand
      const energyCard = createCardInstance(cardCatalog.getCard('01088')!);
      const mentalCard = createCardInstance(cardCatalog.getCard('01089')!);
      const physicalCard = createCardInstance(cardCatalog.getCard('01090')!);

      player.hand = [energyCard, mentalCard, physicalCard];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: sonicConverter.instanceId,
        abilityId: 'sonic_converter_discard_action',
        paymentCardInstanceIds: [
          energyCard.instanceId,
          mentalCard.instanceId,
          physicalCard.instanceId,
        ],
      });

      expect(res.result.success).toBe(true);
      expect(getActiveVillain(res.state).attachments.some((a) => a.card.code === '01118')).toBe(
        false,
      );
      expect(res.state.encounterDiscard.some((c) => c.card.code === '01118')).toBe(true);
    });

    it('Hero Action is rejected in Alter-Ego form', () => {
      const player = state.players[0];
      player.currentForm = 'alter_ego';
      player.activeFormCard = player.alterEgo;

      const villain = getActiveVillain(state);
      const sonicConverter = createCardInstance(cardCatalog.getCard('01118')!);
      villain.attachments = [sonicConverter];

      const res = dispatchAction(state, {
        type: 'USE_CARD_ABILITY',
        playerId: 'p1',
        cardInstanceId: sonicConverter.instanceId,
        abilityId: 'sonic_converter_discard_action',
      });

      expect(res.result.success).toBe(false);
      expect(res.result.error).toMatch(/hero form/i);
    });
  });

  describe("01122 Klaw's Vengeance", () => {
    it('Alter-Ego: discards 1 card at random from hand and does not attack', () => {
      const player = state.players[0];
      player.currentForm = 'alter_ego';
      player.activeFormCard = player.alterEgo;

      const cardA = createCardInstance(cardCatalog.getCard('01005')!);
      const cardB = createCardInstance(cardCatalog.getCard('01006')!);
      player.hand = [cardA, cardB];

      const klawsVengeance = createCardInstance(cardCatalog.getCard('01122')!);
      player.dealtEncounterCards = [klawsVengeance];

      state = step4_revealEncounterCards(state);

      expect(state.players[0].hand.length).toBe(1);
      expect(state.players[0].discard.length).toBe(1);
      expect(state.activeAttackContext).toBeUndefined();
    });

    it('Hero: Klaw attacks, dealing damage places 1 threat on main scheme', () => {
      const player = state.players[0];
      const mainScheme = getActiveMainScheme(state);
      const threatBefore = mainScheme.threat;

      // Give Klaw +1 ATK via Sonic Converter so damage is > 0
      const villain = getActiveVillain(state);
      const sonicConverter = createCardInstance(cardCatalog.getCard('01118')!);
      villain.attachments = [sonicConverter];

      const klawsVengeance = createCardInstance(cardCatalog.getCard('01122')!);
      player.dealtEncounterCards = [klawsVengeance];

      state = step4_revealEncounterCards(state);
      declineSpiderSense();

      // Klaw's attack prompts for defender declaration
      expect(peekDecisionPrompt(state)).toBeDefined();
      answer('undefended');

      // 1 damage was dealt, 1 threat placed on main scheme
      expect(state.players[0].health).toBe(player.maxHealth - 1);
      expect(getActiveMainScheme(state).threat).toBe(threatBefore + 1);
    });

    it('Hero: Klaw attacks, if damage prevented, places NO threat on main scheme', () => {
      const player = state.players[0];
      player.statusCards = [StatusCard.TOUGH];
      const mainScheme = getActiveMainScheme(state);
      const threatBefore = mainScheme.threat;

      const villain = getActiveVillain(state);
      const sonicConverter = createCardInstance(cardCatalog.getCard('01118')!);
      villain.attachments = [sonicConverter];

      const klawsVengeance = createCardInstance(cardCatalog.getCard('01122')!);
      player.dealtEncounterCards = [klawsVengeance];

      state = step4_revealEncounterCards(state);
      declineSpiderSense();

      expect(peekDecisionPrompt(state)).toBeDefined();
      answer('undefended');

      // Tough absorbed the damage, finalDamage = 0
      expect(state.players[0].health).toBe(player.maxHealth);
      expect(getActiveMainScheme(state).threat).toBe(threatBefore);
    });
  });

  describe('01123 Sonic Boom', () => {
    it('When Revealed: opens PLAYER_CHOICE prompt', () => {
      const player = state.players[0];
      const sonicBoom = createCardInstance(cardCatalog.getCard('01123')!);
      player.dealtEncounterCards = [sonicBoom];

      state = step4_revealEncounterCards(state);

      const prompt = peekDecisionPrompt(state);
      expect(prompt).toBeDefined();
      expect(prompt?.options.map((o) => o.id)).toEqual(['spend_resources', 'exhaust_characters']);
    });

    it('When Revealed: choosing exhaust_characters exhausts identity and all controlled allies', () => {
      const player = state.players[0];
      const ally = createCardInstance(cardCatalog.getCard('01011')!, 'p1');
      player.allies = [ally];
      player.exhausted = false;
      ally.exhausted = false;

      const sonicBoom = createCardInstance(cardCatalog.getCard('01123')!);
      player.dealtEncounterCards = [sonicBoom];

      state = step4_revealEncounterCards(state);

      const prompt = peekDecisionPrompt(state);
      expect(prompt).toBeDefined();

      const res = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'exhaust_characters',
      });

      expect(res.state.players[0].exhausted).toBe(true);
      expect(res.state.players[0].allies[0].exhausted).toBe(true);
    });

    it('When Revealed: choosing spend_resources pays resources and does not exhaust characters', () => {
      const player = state.players[0];
      player.exhausted = false;

      // Provide resources (01088 Energy, 01089 Genius, 01090 Strength)
      const energyCard = createCardInstance(cardCatalog.getCard('01088')!);
      const mentalCard = createCardInstance(cardCatalog.getCard('01089')!);
      const physicalCard = createCardInstance(cardCatalog.getCard('01090')!);
      player.hand = [energyCard, mentalCard, physicalCard];

      const sonicBoom = createCardInstance(cardCatalog.getCard('01123')!);
      player.dealtEncounterCards = [sonicBoom];

      state = step4_revealEncounterCards(state);

      const prompt = peekDecisionPrompt(state);
      expect(prompt).toBeDefined();

      const res = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'spend_resources',
        paymentCardInstanceIds: [
          energyCard.instanceId,
          mentalCard.instanceId,
          physicalCard.instanceId,
        ],
      });

      expect(res.result.success).toBe(true);
      expect(res.state.players[0].exhausted).toBe(false);
    });

    it('Boost: exhausts hero if activation deals damage to hero', () => {
      const player = state.players[0];
      player.exhausted = false;

      // Attach Sonic Converter to Klaw so Klaw ATK is 1
      const villain = getActiveVillain(state);
      const sonicConverter = createCardInstance(cardCatalog.getCard('01118')!);
      villain.attachments = [sonicConverter];

      const sonicBoom = createCardInstance(cardCatalog.getCard('01123')!);
      // Stack Sonic Boom as the first boost card (and 0-boost filler as the second)
      stackBoosts(sonicBoom, fillerBoost(0));

      const hpBefore = player.health;
      state = executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      expect(state.players[0].health).toBe(hpBefore - 1);
      expect(state.players[0].exhausted).toBe(true);
    });

    it('Boost: does NOT exhaust hero if ally defends and takes the damage', () => {
      const player = state.players[0];
      player.exhausted = false;
      const ally = createCardInstance(cardCatalog.getCard('01011')!, 'p1'); // 4 HP
      player.allies = [ally];

      const villain = getActiveVillain(state);
      const sonicConverter = createCardInstance(cardCatalog.getCard('01118')!);
      villain.attachments = [sonicConverter];

      const sonicBoom = createCardInstance(cardCatalog.getCard('01123')!);
      stackBoosts(sonicBoom, fillerBoost(0));

      state = executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'ALLY_CHUMP_BLOCK');

      // Ally took the 1 damage
      const allyAfter = state.players[0].allies.find((a) => a.instanceId === ally.instanceId)!;
      expect(allyAfter.tokens?.damage ?? 0).toBe(1);
      // Hero was not damaged, so boost "damage to you" does not exhaust hero
      expect(state.players[0].exhausted).toBe(false);
    });

    it('Boost: does NOT exhaust hero if attack damage is prevented', () => {
      const player = state.players[0];
      player.exhausted = false;
      player.statusCards = [StatusCard.TOUGH];

      const villain = getActiveVillain(state);
      const sonicConverter = createCardInstance(cardCatalog.getCard('01118')!);
      villain.attachments = [sonicConverter];

      const sonicBoom = createCardInstance(cardCatalog.getCard('01123')!);
      stackBoosts(sonicBoom, fillerBoost(0));

      const hpBefore = player.health;
      state = executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      expect(state.players[0].health).toBe(hpBefore);
      expect(state.players[0].exhausted).toBe(false);
    });
  });
});
