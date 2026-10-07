import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, StatusCard } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  executeEnemyAttackSynchronously,
  dispatchAction,
  peekDecisionPrompt,
} from '@engine/pipeline';
import { executeEffect } from '@engine/effects';
import { dispatchTrigger } from '@engine/triggers/trigger-dispatcher';

describe('Sub-Milestone 2B-3: Damage Prevention, Overkill, Retaliate & Direct Damage Invariant', () => {
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
    state.players[0].hand = [];
  });

  describe('Damage Prevention & Tough Status Preservation (Step 6)', () => {
    it('preserves Tough status when incoming damage is mitigated or prevented to 0', () => {
      state.players[0].statusCards.push(StatusCard.TOUGH);
      // Give Backflip (01003) to player hand
      state.players[0].hand = [createCardInstance(cardCatalog.getCard('01003')!)];

      // Put a 2-boost card on encounter deck
      state.encounterDeck = [
        createCardInstance(cardCatalog.getCard('01103')!),
        ...state.encounterDeck,
      ];

      const initialHp = state.players[0].health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Backflip prevented all 4 damage
      expect(state.players[0].health).toBe(initialHp);
      // Tough status was PRESERVED because 0 damage reached the character
      expect(state.players[0].statusCards).toContain(StatusCard.TOUGH);
    });

    it('consumes Tough status only when unmitigated damage > 0', () => {
      state.players[0].statusCards.push(StatusCard.TOUGH);
      state.players[0].hand = []; // No Backflip

      const initialHp = state.players[0].health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Tough absorbed the attack damage
      expect(state.players[0].health).toBe(initialHp);
      expect(state.players[0].statusCards).not.toContain(StatusCard.TOUGH);
    });
  });

  describe('Bidirectional Overkill Routing', () => {
    it('Enemy -> Ally -> Hero: routes excess damage to Hero when enemy attack with Overkill defeats ally', () => {
      // Add an ally with 2 HP remaining
      const allyInst = createCardInstance(cardCatalog.getCard('01002')!); // Black Cat (HP 1 or 2)
      state.players[0].allies.push(allyInst);

      // Attach Charge (01099) to Rhino giving Overkill (+3 ATK on attack)
      const chargeCard = cardCatalog.getCard('01099')!;
      state.villain.attachments.push(createCardInstance(chargeCard));
      state.encounterDeck = []; // No extra boost icons

      const initialHp = state.players[0].health;

      // Rhino attacks with Overkill (Base ATK 2 + Charge 3 = 5 damage)
      // Ally Black Cat (01002) has health 2
      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'ALLY_CHUMP_BLOCK');

      // Ally defeated
      expect(state.players[0].allies.length).toBe(0);
      // Excess damage (5 - 2 = 3 damage) dealt to Hero!
      expect(state.players[0].health).toBe(initialHp - 3);
    });

    it('Player -> Minion -> Villain: routes excess damage to Villain when player attack with Overkill defeats minion', () => {
      // Spawn a minion with 1 HP (Hydra Mercenary 01108)
      const minionInst = createCardInstance(cardCatalog.getCard('01108')!);
      state.players[0].engagedMinions.push(minionInst);

      const initialVillainHp = state.villain.health;

      // Player plays Relentless Assault (01053) dealing 5 damage with Overkill
      const relentlessAssault = cardCatalog.getCard('01053')!;
      const ability = relentlessAssault.enrichment!.abilities![0];

      executeEffect(state, ability, {
        playerId: 'p1',
        chosenTargetInstanceId: minionInst.instanceId,
        resourcesSpent: ['physical'],
      });

      // Minion is defeated
      expect(state.players[0].engagedMinions.length).toBe(0);
      // Excess damage (5 - 1 = 4 damage) dealt to Villain!
      expect(state.villain.health).toBe(initialVillainHp - 4);
    });
  });

  describe('Retaliate X Return Damage (Step 7)', () => {
    it('deals Retaliate damage to attacking enemy when defending hero survives', () => {
      // Give Spider-Man hero a card with Retaliate 1 in tableau (or keyword)
      (state.players[0].hero as any).keywords = ['Retaliate 1'];

      const initialVillainHp = state.villain.health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'HERO_IF_READY');

      // Hero survived and dealt 1 Retaliate damage to Villain!
      expect(state.villain.health).toBe(initialVillainHp - 1);
    });

    it('does NOT trigger Retaliate if defending character is defeated', () => {
      (state.players[0].hero as any).keywords = ['Retaliate 1'];
      state.players[0].health = 1; // 1 HP left

      const initialVillainHp = state.villain.health;
      const hero = state.players[0];

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      // Hero defeated and eliminated (#246)
      expect(hero.health).toBe(0);
      // Villain took 0 retaliate damage because hero was defeated
      expect(state.villain.health).toBe(initialVillainHp);
    });

    it('deals Retaliate damage back to hero when hero attacks a minion with Retaliate 1 and minion survives', () => {
      // Whiplash has Retaliate 1 and 4 HP
      const whiplash = cardCatalog.getCard('01172')!;
      const whiplashInst = createCardInstance(whiplash);
      state.players[0].engagedMinions.push(whiplashInst);

      const initialHeroHp = state.players[0].health;

      // Deal 2 damage to Whiplash (survives with 2 HP left)
      const ability = {
        id: 'test_attack',
        timing: 'HERO_ACTION' as any,
        steps: [
          {
            effect: 'DEAL_DAMAGE' as any,
            effectParams: {
              amount: 2,
              target: 'minion',
              isAttack: true,
            },
          },
        ],
      };

      executeEffect(state, ability, {
        playerId: 'p1',
        chosenTargetInstanceId: whiplashInst.instanceId,
      });

      // Hero took 1 retaliate damage from Whiplash
      expect(state.players[0].health).toBe(initialHeroHp - 1);
    });
  });

  describe('Direct Damage Invariant (damage to the hero through the damage pipeline)', () => {
    const damageHero = (amount: number) =>
      executeEffect(
        state,
        {
          id: 'direct_damage',
          timing: 'ACTION',
          steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount, target: 'SELF_IDENTITY' } }],
        } as any,
        { playerId: 'p1' },
      );

    it('direct damage bypasses Hero DEF and cannot be blocked, but is absorbed by Tough', () => {
      state.players[0].statusCards.push(StatusCard.TOUGH);
      const initialHp = state.players[0].health;

      damageHero(3);

      expect(state.players[0].health).toBe(initialHp);
      expect(state.players[0].statusCards).not.toContain(StatusCard.TOUGH);
    });

    it('direct damage directly reduces hero health when Tough is not present', () => {
      const initialHp = state.players[0].health;

      damageHero(3);

      expect(state.players[0].health).toBe(initialHp - 3);
    });
  });

  describe('Promoted Core Set Cards (Wave 2C)', () => {
    it('executes Gamma Slam (01021) dealing damage equal to sustained damage (max 15)', () => {
      // Set hero max health to 15, current health to 5 (sustained 10 damage)
      (state.players[0].hero as any).health = 15;
      state.players[0].health = 5;

      const initialVillainHp = state.villain.health;

      const gammaSlam = cardCatalog.getCard('01021')!;
      const ability = gammaSlam.enrichment!.abilities![0];

      executeEffect(state, ability, {
        playerId: 'p1',
      });

      // Deals 10 damage to Villain!
      expect(state.villain.health).toBe(initialVillainHp - 10);
    });
  });

  describe('Issue #130: Explicit Attack Hit Logging & Incoming Damage Prompt Clarity', () => {
    it('records explicit villain.attack.hit log entry with who_attacks, target, damage, and remainingHp', () => {
      state.encounterDeck = []; // 0 boost icons
      const initialHp = state.players[0].health;

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED');

      const hitLog = state.log.find((l) => l.key === 'villain.attack.hit');
      expect(hitLog).toBeDefined();
      expect(hitLog?.params?.who_attacks).toBe('Rhino');
      expect(hitLog?.params?.who_is_taking_damage).toBe('Spider-Man');
      expect(hitLog?.params?.damage).toBe(2);
      expect(hitLog?.params?.remainingHp).toBe(initialHp - 2);
    });

    it('enqueues DAMAGE_WOULD_BE_TAKEN prompt with incomingDamage metadata and formatted title/desc', () => {
      // Put Backflip (01003) into player hand
      state.players[0].hand = [createCardInstance(cardCatalog.getCard('01003')!)];

      // Dispatch DAMAGE_WOULD_BE_TAKEN with 5 damage (interactive / optional prompt)
      dispatchTrigger(state, 'DAMAGE_WOULD_BE_TAKEN', {
        targetPlayerId: 'p1',
        damageAmount: 5,
        damageSource: 'ATTACK',
        targetType: 'hero',
      });

      expect(peekDecisionPrompt(state)).toBeDefined();
      expect(peekDecisionPrompt(state)?.incomingDamage).toBe(5);
      expect(peekDecisionPrompt(state)?.title).toContain('Incoming Damage: 5');
      expect(peekDecisionPrompt(state)?.description).toContain('Incoming Damage: 5');
    });
  });

  describe('Issue #152: In-Play Damage Prevention & Provenance (Cosmic Flight 01017)', () => {
    let cmHero: HeroCard;
    let cmAlterEgo: AlterEgoCard;
    let cmState: GameState;

    beforeEach(() => {
      cmHero = cardCatalog.getCard('01010a') as HeroCard;
      cmAlterEgo = cardCatalog.getCard('01010b') as AlterEgoCard;

      cmState = setupGame({
        scenarioId: 'rhino',
        players: [
          {
            id: 'p1',
            name: 'Captain Marvel',
            hero: cmHero,
            alterEgo: cmAlterEgo,
            deckCards: Array(10).fill(cardCatalog.getCard('01017')!),
          },
        ],
        villain: cardCatalog.getCard('01094') as any,
        mainScheme: cardCatalog.getCard('01097b') as any,
        encounterCards: cardCatalog.getCardsBySet('rhino'),
        skipMulligan: true,
      });

      cmState.players[0].currentForm = 'hero';
      cmState.players[0].activeFormCard = cmHero;
      cmState.players[0].hand = [];
      cmState.players[0].tableau = [createCardInstance(cardCatalog.getCard('01017')!)];
    });

    it('prompts Cosmic Flight with full combat provenance when Villain attacks Captain Marvel undefended for 4 damage', () => {
      // Put a 2-boost card on top of encounter deck (Rhino base ATK 2 + 2 = 4)
      cmState.encounterDeck = [createCardInstance(cardCatalog.getCard('01103')!)];

      executeEnemyAttackSynchronously(cmState, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED', {
        acceptOptionalTriggers: false,
      });

      expect(peekDecisionPrompt(cmState)).toBeDefined();
      expect(peekDecisionPrompt(cmState)?.incomingDamage).toBe(4);
      expect(peekDecisionPrompt(cmState)?.preventAmount).toBe(3);
      expect(peekDecisionPrompt(cmState)?.attackerName).toBe('Rhino');
      expect(peekDecisionPrompt(cmState)?.targetCurrentHp).toBe(cmState.players[0].health);
      expect(peekDecisionPrompt(cmState)?.targetCardCode).toBe('01010a');
    });

    it("choosing 'Yes' discards Cosmic Flight and applies 1 remaining damage", () => {
      cmState.encounterDeck = [createCardInstance(cardCatalog.getCard('01103')!)];
      const initialHp = cmState.players[0].health;

      executeEnemyAttackSynchronously(cmState, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED', {
        acceptOptionalTriggers: false,
      });

      const yesOptionId = peekDecisionPrompt(cmState)?.options.find((o) => o.label === 'Yes')?.id;
      expect(yesOptionId).toBeDefined();

      const res = dispatchAction(cmState, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: yesOptionId!,
      });

      expect(res.state.players[0].tableau.some((c) => c.card.code === '01017')).toBe(false);
      expect(res.state.players[0].discard.some((c) => c.card.code === '01017')).toBe(true);
      expect(res.state.players[0].health).toBe(initialHp - 1);
    });

    it("choosing 'No' retains Cosmic Flight in tableau and applies 4 damage", () => {
      cmState.encounterDeck = [createCardInstance(cardCatalog.getCard('01103')!)];
      const initialHp = cmState.players[0].health;

      executeEnemyAttackSynchronously(cmState, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED', {
        acceptOptionalTriggers: false,
      });

      const res = dispatchAction(cmState, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'pass',
      });

      expect(res.state.players[0].tableau.some((c) => c.card.code === '01017')).toBe(true);
      expect(res.state.players[0].health).toBe(initialHp - 4);
    });

    it('does NOT prompt Cosmic Flight when an Ally defends the attack', () => {
      const ally = createCardInstance(cardCatalog.getCard('01002')!);
      cmState.players[0].allies.push(ally);
      cmState.encounterDeck = [createCardInstance(cardCatalog.getCard('01103')!)];

      executeEnemyAttackSynchronously(cmState, { type: 'VILLAIN' }, 'p1', 'ALLY_CHUMP_BLOCK', {
        acceptOptionalTriggers: false,
      });

      expect(peekDecisionPrompt(cmState)).toBeUndefined();
    });

    it('does NOT prompt Cosmic Flight when incoming damage is 0 (DEF >= total attack)', () => {
      // Captain Marvel defends with Armored Vest (+1 DEF -> DEF 2)
      cmState.players[0].tableau.push(createCardInstance(cardCatalog.getCard('01081')!));
      cmState.encounterDeck = []; // 0 boost cards (Rhino total attack = 2)

      executeEnemyAttackSynchronously(cmState, { type: 'VILLAIN' }, 'p1', 'HERO_IF_READY', {
        acceptOptionalTriggers: false,
      });

      expect(peekDecisionPrompt(cmState)).toBeUndefined();
    });

    it('does NOT prompt Cosmic Flight when in Alter-Ego form', () => {
      cmState.players[0].currentForm = 'alter_ego';
      cmState.players[0].activeFormCard = cmAlterEgo;

      cmState.encounterDeck = [createCardInstance(cardCatalog.getCard('01103')!)];

      executeEnemyAttackSynchronously(cmState, { type: 'VILLAIN' }, 'p1', 'TAKE_UNDEFENDED', {
        acceptOptionalTriggers: false,
      });

      expect(peekDecisionPrompt(cmState)).toBeUndefined();
    });
  });
});
