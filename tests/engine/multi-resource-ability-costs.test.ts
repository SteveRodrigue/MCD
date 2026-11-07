import path from 'node:path';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applyContent } from '@data/content/apply';
import { NodeFsDriver } from '@data/content/drivers/node-fs';
import { loadContent } from '@data/content/loader';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { getActiveVillain } from '@engine/models';
import type { CardAbility, CardInstance, GameState, PlayerState } from '@engine/models';
import { createCardInstance } from '@engine/state/game-setup';
import { dispatchAction, getLegalActionsForPlayer } from '../../src/engine/pipeline';
import { canPayAbilityCost, countResourcesTowardCost } from '../../src/engine/pipeline/cost-engine';
import { chooseBotAction } from '@engine/simulation/player-bot';
import { newRhinoGame } from '../support/game-fixtures';

type Icon = 'physical' | 'energy' | 'mental' | 'wild';

const iconCard = (id: string, icons: Icon[]): CardInstance => {
  const count = (type: Icon) => icons.filter((i) => i === type).length;
  return {
    ...createCardInstance({
      ...cardCatalog.getCard('01090')!,
      resources: {
        physical: count('physical'),
        energy: count('energy'),
        mental: count('mental'),
        wild: count('wild'),
        total: icons.length,
      },
    } as never),
    instanceId: id,
  };
};

const handOf = (icons: Icon[]) => icons.map((icon, i) => iconCard(`pay_${i}`, [icon]));

/** Real cards whose printed cost takes 2 or more resources of specific types. */
const CARDS: {
  name: string;
  code: string;
  abilityId: string;
  pays: Icon[];
  wrong: Icon[];
}[] = [
  {
    name: 'Program Transmitter',
    code: '01141',
    abilityId: 'program_transmitter_discard',
    pays: ['mental', 'mental'],
    wrong: ['energy', 'physical'],
  },
  {
    name: 'Vibranium Armor',
    code: '01152',
    abilityId: 'vibranium_armor_discard',
    pays: ['physical', 'physical'],
    wrong: ['energy', 'mental'],
  },
  {
    name: 'Concussion Blasters',
    code: '01153',
    abilityId: 'concussion_blasters_discard',
    pays: ['energy', 'energy'],
    wrong: ['mental', 'physical'],
  },
  {
    name: 'Enhanced Ivory Horn',
    code: '01100',
    abilityId: 'ivory_horn_discard_action',
    pays: ['physical', 'physical', 'physical'],
    wrong: ['physical', 'physical', 'energy'],
  },
  {
    name: 'All Tied Up',
    code: '02048',
    abilityId: 'all_tied_up_discard_action',
    pays: ['mental', 'physical'],
    wrong: ['mental', 'mental'],
  },
  {
    name: 'Upgraded Drones',
    code: '01142',
    abilityId: 'upgraded_drones_discard',
    pays: ['energy', 'mental', 'physical'],
    wrong: ['energy', 'energy', 'energy'],
  },
];

const abilityOf = (code: string, abilityId: string): CardAbility =>
  cardCatalog.getCard(code)!.enrichment!.abilities!.find((a) => a.id === abilityId)!;

describe('Abilities that cost 2 or more resources of specific types (#667)', () => {
  let state: GameState;
  let player: PlayerState;

  beforeAll(async () => {
    const root = path.resolve(__dirname, '../../content');
    applyContent(await loadContent(new NodeFsDriver(root), { packs: ['core', 'gob'] }));
  });

  const putInPlay = (code: string) => {
    const attachment = createCardInstance(cardCatalog.getCard(code)!);
    getActiveVillain(state).attachments.push(attachment);
    return attachment;
  };

  const payWith = (attachment: CardInstance, abilityId: string) =>
    dispatchAction(state, {
      type: 'USE_CARD_ABILITY',
      playerId: player.id,
      cardInstanceId: attachment.instanceId,
      abilityId,
      paymentCardInstanceIds: player.hand.map((c) => c.instanceId),
    });

  beforeEach(() => {
    state = newRhinoGame({ players: [{ hero: '01001a', form: 'hero' }] });
    player = state.players[0];
    player.tableau = [];
    player.hand = [];
    state.activePlayerIndex = 0;
  });

  describe.each(CARDS)('$name', ({ code, abilityId, pays, wrong }) => {
    it('is paid by exactly the printed resources, and is discarded', () => {
      const attachment = putInPlay(code);
      player.hand = handOf(pays);

      const res = payWith(attachment, abilityId);

      expect(res.result.error).toBeUndefined();
      expect(res.result.success).toBe(true);
      const next = res.state;
      expect(next.players[0].hand).toEqual([]);
      expect(next.players[0].discard.map((c) => c.instanceId)).toEqual(
        expect.arrayContaining(pays.map((_, i) => `pay_${i}`)),
      );
      expect(
        getActiveVillain(next).attachments.some((c) => c.instanceId === attachment.instanceId),
      ).toBe(false);
    });

    it('rejects one resource too few, and stays in play', () => {
      const attachment = putInPlay(code);
      player.hand = handOf(pays.slice(1));

      const res = payWith(attachment, abilityId);

      expect(res.result.success).toBe(false);
      expect(res.result.error).toMatch(/insufficient resources/i);
      expect(getActiveVillain(state).attachments).toContain(attachment);
    });

    it('rejects the right number of resources of the wrong types', () => {
      const attachment = putInPlay(code);
      player.hand = handOf(wrong);

      const res = payWith(attachment, abilityId);

      expect(res.result.success).toBe(false);
      expect(res.result.error).toMatch(/insufficient resources/i);
    });

    it('lets a wild resource fill one missing resource', () => {
      const attachment = putInPlay(code);
      player.hand = handOf([...pays.slice(1), 'wild']);

      expect(payWith(attachment, abilityId).result.success).toBe(true);
    });

    it('is not offered when the hand cannot make the printed resources', () => {
      putInPlay(code);
      player.hand = handOf(wrong);

      expect(canPayAbilityCost(state, player, abilityOf(code, abilityId)).allowed).toBe(false);
    });
  });

  it('The action list names all 3 resources of Upgraded Drones', () => {
    putInPlay('01142');
    player.hand = handOf(['energy', 'mental', 'physical']);

    const action = getLegalActionsForPlayer(state, player.id).allActions.find(
      (a) => a.headline === 'Discard: Upgraded Drones',
    );

    expect(action?.badge).toBe('1 ENERGY 1 MENTAL 1 PHYSICAL');
  });

  it('One card with 2 icons pays 2 different slots only if it has both types', () => {
    const ability = abilityOf('02048', 'all_tied_up_discard_action');
    player.hand = [iconCard('both', ['mental', 'physical'])];
    expect(
      canPayAbilityCost(state, player, ability, undefined, { paymentCardInstanceIds: ['both'] })
        .allowed,
    ).toBe(true);

    player.hand = [iconCard('same', ['mental', 'mental'])];
    expect(
      canPayAbilityCost(state, player, ability, undefined, { paymentCardInstanceIds: ['same'] })
        .allowed,
    ).toBe(false);
  });

  it('A printed-only cost refuses wild for every required type', () => {
    expect(countResourcesTowardCost(['mental', 'wild'], { mental: 1, physical: 1 }, true)).toBe(1);
  });

  describe('Intimidation (02035): spend 2 resources of any type', () => {
    const spendOption = (): CardAbility => ({
      id: 'intimidation_spend',
      timing: 'ACTION',
      steps: [],
      cost: (
        cardCatalog.getCard('02035')!.enrichment!.abilities![0].steps![0].effectParams as never as {
          options: { cost: CardAbility['cost'] }[];
        }
      ).options[0].cost,
    });

    it('any 2 resources pay it', () => {
      player.hand = handOf(['energy', 'mental']);
      expect(
        canPayAbilityCost(state, player, spendOption(), undefined, {
          paymentCardInstanceIds: ['pay_0', 'pay_1'],
        }).allowed,
      ).toBe(true);
    });

    it('1 resource does not pay it', () => {
      player.hand = handOf(['energy']);
      expect(
        canPayAbilityCost(state, player, spendOption(), undefined, {
          paymentCardInstanceIds: ['pay_0'],
        }).allowed,
      ).toBe(false);
    });
  });

  describe('The bot pays typed costs', () => {
    it('does not try Upgraded Drones with 3 energy cards', () => {
      const attachment = putInPlay('01142');
      player.hand = handOf(['energy', 'energy', 'energy']);

      const action = chooseBotAction({ state, playerId: player.id, scarcity: {} });

      expect(action).not.toMatchObject({ cardInstanceId: attachment.instanceId });
    });

    it('uses Upgraded Drones with one card of each type', () => {
      const attachment = putInPlay('01142');
      player.hand = handOf(['energy', 'mental', 'physical']);

      expect(chooseBotAction({ state, playerId: player.id, scarcity: {} })).toMatchObject({
        type: 'USE_CARD_ABILITY',
        cardInstanceId: attachment.instanceId,
      });
    });
  });
});
