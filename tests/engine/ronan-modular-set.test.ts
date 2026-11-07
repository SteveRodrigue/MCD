import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { applyContent } from '@data/content/apply';
import { NodeFsDriver } from '@data/content/drivers/node-fs';
import { loadContent } from '@data/content/loader';
import { kernel } from '@engine/kernel';
import {
  AlterEgoCard,
  CardInstance,
  GameState,
  HeroCard,
  StatusCard,
  getActiveMainScheme,
} from '@engine/models';
import {
  executeEnemyAttackSynchronously,
  initiateEnemyAttack,
  resolveDefenderDeclaration,
} from '@engine/pipeline/combat-pipeline';
import {
  applyDamageToTarget,
  defeatMinionsBeyondHitPoints,
} from '@engine/pipeline/damage-pipeline';
import { peekDecisionPrompt, resolveDecisionPrompt } from '@engine/pipeline/prompt-queue';
import {
  dispatchVillainPhaseBegan,
  executeVillainSchemeAgainstPlayer,
} from '@engine/pipeline/villain-phase';
import { listEncounterSets } from '@engine/scenarios';
import { createCardInstance } from '@engine/state/card-instance';
import { resetInstanceCounter, setupGame } from '@engine/state/game-setup';
import { cardCatalog } from '../../src/data/importer/card-loader';

const RONAN = '90001';
const JUDGE = '90002';
const ACCUSED = '90003';
const HAMMER = '90004';
const YOU_DARE = '90005';
const HYDRA_FILLER = '01103'; // Not in the Kree Fanatic set, 2 boost icons and no star ability.

const instance = (code: string): CardInstance => createCardInstance(cardCatalog.getCard(code)!);

const hero = (id: string, heroCode: string, alterEgoCode: string) => ({
  id,
  name: id,
  hero: cardCatalog.getCard(heroCode) as HeroCard,
  alterEgo: cardCatalog.getCard(alterEgoCode) as AlterEgoCard,
  deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
});

const createGame = (playerCount: 1 | 2 = 1): GameState => {
  resetInstanceCounter();
  const state = setupGame({
    catalog: cardCatalog,
    scenarioId: 'rhino',
    difficulty: 'STANDARD',
    modularSetCodes: ['kree_fanatic'],
    players:
      playerCount === 1
        ? [hero('p1', '01001a', '01001b')]
        : [hero('p1', '01001a', '01001b'), hero('p2', '01010a', '01010b')],
  });
  for (const player of state.players) player.currentForm = 'hero';
  return state;
};

const ronanOn = (state: GameState, index: number): CardInstance => {
  const ronan = instance(RONAN);
  state.players[index].engagedMinions.push(ronan);
  return ronan;
};

const engagedCodes = (state: GameState, index: number) =>
  state.players[index].engagedMinions.map((m) => m.card.code);

/** An attack by Rhino that only an ally with `allyHealth` hit points stands in front of. */
const defendWithAlly = (state: GameState, allyHealth = 1): CardInstance => {
  const ally = instance('01002');
  ally.tokens = { damage: 2 - allyHealth };
  state.players[0].allies.push(ally);
  initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
  resolveDefenderDeclaration(state, {
    type: 'ALLY',
    playerId: 'p1',
    allyInstanceId: ally.instanceId,
  });
  return ally;
};

describe('Ronan Modular Set (Kree Fanatic, #621)', () => {
  beforeAll(async () => {
    const root = path.resolve(__dirname, '../../content');
    applyContent(await loadContent(new NodeFsDriver(root), { packs: ['core', 'ron', 'gob'] }));
  });

  let state: GameState;
  beforeEach(() => {
    state = createGame();
    state.encounterDeck = [];
    state.encounterDiscard = [];
  });

  it('The set is built from CANNOT_HAVE_STATUS, ENGAGE_MINION and IF_ACTIVATION_DEFEATED_CHARACTER', () => {
    const stepsOf = (code: string) =>
      (cardCatalog.getCard(code)!.enrichment?.abilities ?? []).flatMap((a) => a.steps ?? []);

    expect(stepsOf(RONAN).map((s) => s.effect)).toEqual(
      expect.arrayContaining(['CANNOT_HAVE_STATUS', 'ENGAGE_MINION']),
    );
    expect(stepsOf(HAMMER).map((s) => s.gate)).toContain('IF_ACTIVATION_DEFEATED_CHARACTER');
  });

  describe('Choosing the set', () => {
    it('Kree Fanatic is offered in the Rhino modular slot and adds 7 cards', () => {
      expect(listEncounterSets(cardCatalog, 'modular').map((s) => s.code)).toContain(
        'kree_fanatic',
      );

      const game = createGame();
      const inDeck = game.encounterDeck.filter((c) => c.card.setCode === 'kree_fanatic');
      expect(inDeck).toHaveLength(7);
    });
  });

  describe('Ronan the Accuser', () => {
    it('Ronan engages the hero with the fewest hit points as the villain phase begins', () => {
      state = createGame(2);
      ronanOn(state, 0);
      state.players[0].health = 8;
      state.players[1].health = 5;

      dispatchVillainPhaseBegan(state);

      expect(engagedCodes(state, 0)).not.toContain(RONAN);
      expect(engagedCodes(state, 1)).toContain(RONAN);
    });

    it('Ronan stays engaged when no player is in hero form', () => {
      state = createGame(2);
      ronanOn(state, 0);
      state.players[0].currentForm = 'alter_ego';
      state.players[1].currentForm = 'alter_ego';

      dispatchVillainPhaseBegan(state);

      expect(engagedCodes(state, 0)).toContain(RONAN);
    });

    it('The first player chooses when two heroes tie for fewest hit points', () => {
      state = createGame(2);
      ronanOn(state, 1);
      state.players[0].health = 6;
      state.players[1].health = 6;
      state.firstPlayerIndex = 1;

      dispatchVillainPhaseBegan(state);

      const prompt = peekDecisionPrompt(state)!;
      expect(prompt.playerId).toBe('p2');
      expect(prompt.options).toHaveLength(2);

      resolveDecisionPrompt(state, 'p2', prompt.options.find((o) => o.id.endsWith('p1'))!.id);

      expect(engagedCodes(state, 0)).toContain(RONAN);
      expect(engagedCodes(state, 1)).not.toContain(RONAN);
    });

    it('Mad Genius asks the first player when two heroes tie for fewest hit points', () => {
      state = createGame(2);
      state.encounterDeck = [];
      state.players[0].health = 6;
      state.players[1].health = 6;
      state.firstPlayerIndex = 1;

      kernel.executeEffect(
        state,
        {
          id: 'test',
          timing: 'WHEN_REVEALED',
          steps: [
            {
              effect: 'VILLAIN_ATTACKS',
              effectParams: { targetPlayer: 'HERO_WITH_FEWEST_HIT_POINTS' },
            },
          ],
        },
        { playerId: 'p1' },
      );

      const prompt = peekDecisionPrompt(state)!;
      expect(prompt.playerId).toBe('p2');
      expect(prompt.options.map((o) => o.id)).toEqual(['choose_player_p1', 'choose_player_p2']);
    });

    it('A stun does not stick to Ronan and a confuse does', () => {
      const ronan = ronanOn(state, 0);
      const apply = (status: string) =>
        kernel.executeEffect(
          state,
          {
            id: 'test',
            timing: 'SPECIAL',
            steps: [{ effect: 'ADD_STATUS', effectParams: { status, target: 'CHOSEN_MINION' } }],
          },
          { playerId: 'p1', chosenTargetInstanceId: ronan.instanceId },
        );

      apply('STUNNED');
      expect(ronan.statusCards).not.toContain(StatusCard.STUNNED);

      apply('CONFUSED');
      expect(ronan.statusCards).toContain(StatusCard.CONFUSED);
    });

    it('Ronan enters play tough when boosted into play', () => {
      const ronan = instance(RONAN);
      state.villains[0].facedownBoostCards = [ronan];
      state.encounterDeck = [instance(HYDRA_FILLER)];

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1');

      expect(engagedCodes(state, 0)).toContain(RONAN);
      expect(ronan.statusCards).toContain(StatusCard.TOUGH);
    });
  });

  describe('Judge, Jury, Executioner', () => {
    it('An ally defeated by an enemy attack places 2 threat with Judge, Jury, Executioner', () => {
      kernel.resolveActiveEncounterCardAfterInterrupt(
        state,
        instance(JUDGE),
        state.players[0],
        false,
      );
      const before = getActiveMainScheme(state)!.threat;
      state.encounterDeck = [instance(HYDRA_FILLER)];

      defendWithAlly(state);

      expect(state.players[0].allies).toHaveLength(0);
      expect(getActiveMainScheme(state)!.threat).toBe(before + 2);
    });

    it('A character defeated without an enemy attack places no threat', () => {
      kernel.resolveActiveEncounterCardAfterInterrupt(
        state,
        instance(JUDGE),
        state.players[0],
        false,
      );
      const before = getActiveMainScheme(state)!.threat;
      const ally = instance('01002');
      state.players[0].allies.push(ally);

      applyDamageToTarget(state, {
        target: {
          type: 'ally',
          entity: ally,
          instanceId: ally.instanceId,
          name: ally.card.name,
          targetPlayerId: 'p1',
          attachments: ally.attachments,
          statusCards: ally.statusCards,
        },
        amount: 5,
        sourceType: 'CARD_EFFECT',
      });

      expect(state.players[0].allies).toHaveLength(0);
      expect(getActiveMainScheme(state)!.threat).toBe(before);
    });
  });

  describe('The Accused', () => {
    const attached = (game: GameState, index: number) =>
      (game.players[index].attachments ?? []).filter((a) => a.card.code === ACCUSED);

    it('The Accused gives +1 ATK when an ally defends the attached hero', () => {
      kernel.resolveActiveEncounterCardAfterInterrupt(
        state,
        instance(ACCUSED),
        state.players[0],
        false,
      );
      expect(attached(state, 0)).toHaveLength(1);
      state.encounterDeck = [];
      state.villains[0].facedownBoostCards = [];

      const ally = instance('01020'); // Hellcat, 3 hit points
      state.players[0].allies.push(ally);
      state.encounterDeck = [
        createCardInstance({ ...cardCatalog.getCard(HYDRA_FILLER)!, boostIcons: 0 }),
      ];
      initiateEnemyAttack(state, { type: 'VILLAIN' }, 'p1');
      resolveDefenderDeclaration(state, {
        type: 'ALLY',
        playerId: 'p1',
        allyInstanceId: ally.instanceId,
      });

      // Rhino ATK 2, +1 from The Accused, no boost icons.
      expect(state.lastCombatOutcome?.finalDamage).toBe(3);
    });

    it('The Accused is discarded when Ronan is defeated, on any player', () => {
      state = createGame(2);
      state.encounterDiscard = [];
      kernel.resolveActiveEncounterCardAfterInterrupt(
        state,
        instance(ACCUSED),
        state.players[0],
        false,
      );
      const ronan = ronanOn(state, 1);
      ronan.statusCards = [];
      ronan.tokens = { damage: 99 };

      defeatMinionsBeyondHitPoints(state);

      expect(engagedCodes(state, 1)).not.toContain(RONAN);
      expect(attached(state, 0)).toHaveLength(0);
      expect(state.encounterDiscard.map((c) => c.card.code)).toContain(ACCUSED);
    });

    it('The Accused attaches instead of going to the discard pile when boosted', () => {
      state.villains[0].facedownBoostCards = [instance(ACCUSED)];
      state.encounterDeck = [instance(HYDRA_FILLER)];

      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1');

      expect(attached(state, 0)).toHaveLength(1);
      expect(state.encounterDiscard.map((c) => c.card.code)).not.toContain(ACCUSED);
    });
  });

  describe('Bring the Hammer Down', () => {
    it('Bring the Hammer Down activates Ronan against the player he is engaged with', () => {
      state = createGame(2);
      state.encounterDeck = [];
      ronanOn(state, 1);
      const p1Health = state.players[0].health;
      const p2Health = state.players[1].health;

      kernel.resolveActiveEncounterCardAfterInterrupt(
        state,
        instance(HAMMER),
        state.players[0],
        false,
      );
      const context = state.activeAttackContext;
      if (context) {
        resolveDefenderDeclaration(state, { type: 'UNDEFENDED', playerId: 'p2' });
      }

      expect(state.players[0].health).toBe(p1Health);
      expect(state.players[1].health).toBeLessThan(p2Health);
    });

    it('Bring the Hammer Down gains surge when Ronan is not in play', () => {
      const filler = instance(HYDRA_FILLER);
      state.encounterDeck = [filler, instance(HYDRA_FILLER)];

      kernel.resolveActiveEncounterCardAfterInterrupt(
        state,
        instance(HAMMER),
        state.players[0],
        false,
      );

      expect(state.players[0].dealtEncounterCards.map((c) => c.instanceId)).toContain(
        filler.instanceId,
      );
    });

    it('The Hammer boost deals the first player a card only when the activation defeats a character', () => {
      state.villains[0].facedownBoostCards = [instance(HAMMER)];
      state.encounterDeck = [
        instance(HYDRA_FILLER),
        instance(HYDRA_FILLER),
        instance(HYDRA_FILLER),
      ];

      defendWithAlly(state);
      expect(state.players[0].dealtEncounterCards).toHaveLength(1);

      state = createGame();
      state.villains[0].facedownBoostCards = [instance(HAMMER)];
      state.encounterDeck = [
        instance(HYDRA_FILLER),
        instance(HYDRA_FILLER),
        instance(HYDRA_FILLER),
      ];
      executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1');
      expect(state.players[0].dealtEncounterCards).toHaveLength(0);
    });
  });

  describe('You Dare Oppose Me?', () => {
    it('You Dare Oppose Me deals only Kree Fanatic cards facedown', () => {
      const ronan = instance(RONAN);
      const filler = instance(HYDRA_FILLER);
      state.encounterDeck = [
        ronan,
        filler,
        instance(HYDRA_FILLER),
        instance(HYDRA_FILLER),
        instance(HYDRA_FILLER),
        instance(HYDRA_FILLER),
      ];

      kernel.resolveActiveEncounterCardAfterInterrupt(
        state,
        instance(YOU_DARE),
        state.players[0],
        false,
      );

      expect(state.players[0].dealtEncounterCards.map((c) => c.instanceId)).toEqual([
        ronan.instanceId,
      ]);
      expect(state.encounterDiscard.map((c) => c.instanceId)).toContain(filler.instanceId);
      expect(state.encounterDiscard.map((c) => c.instanceId)).not.toContain(ronan.instanceId);
      expect(state.encounterDeck).toHaveLength(1);
    });

    it('You Dare Oppose Me stops at an empty deck and still deals what it discarded', () => {
      const ronan = instance(RONAN);
      state.encounterDeck = [instance(HYDRA_FILLER), ronan];
      const acceleration = state.accelerationTokens;

      kernel.resolveActiveEncounterCardAfterInterrupt(
        state,
        instance(YOU_DARE),
        state.players[0],
        false,
      );

      expect(state.players[0].dealtEncounterCards.map((c) => c.instanceId)).toEqual([
        ronan.instanceId,
      ]);
      expect(state.encounterDeck.map((c) => c.instanceId)).not.toContain(ronan.instanceId);
      expect(state.encounterDiscard.map((c) => c.instanceId)).not.toContain(ronan.instanceId);
      expect(state.accelerationTokens).toBe(acceleration + 1);
    });

    it('The overkill boost lets an attack spill onto the hero', () => {
      state.villains[0].facedownBoostCards = [instance(YOU_DARE)];
      state.encounterDeck = [
        createCardInstance({ ...cardCatalog.getCard(HYDRA_FILLER)!, boostIcons: 0 }),
      ];
      const health = state.players[0].health;

      defendWithAlly(state);

      expect(state.players[0].allies).toHaveLength(0);
      // Rhino ATK 2 + 2 boost icons on a 1 hit point ally: the 3 excess is dealt to the hero.
      expect(state.players[0].health).toBe(health - 3);
    });

    it('The overkill boost has no effect on a scheme activation', () => {
      const threat = getActiveMainScheme(state)!.threat;
      state.players[0].currentForm = 'alter_ego';
      state.villains[0].facedownBoostCards = [instance(YOU_DARE)];
      state.encounterDeck = [
        createCardInstance({ ...cardCatalog.getCard(HYDRA_FILLER)!, boostIcons: 0 }),
      ];

      executeVillainSchemeAgainstPlayer(state, state.players[0]);

      // Rhino SCH 1, You Dare Oppose Me? has 2 boost icons.
      expect(getActiveMainScheme(state)!.threat).toBeGreaterThan(threat);
      expect(state.players[0].health).toBe(state.players[0].maxHealth);
    });
  });
});
