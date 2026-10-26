import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import {
  GameState,
  HeroCard,
  AlterEgoCard,
  MinionCard,
  StatusCard,
  getActiveVillain,
} from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import { dispatchAction, initiateEnemyAttack, resolveDefenderDeclaration } from '@engine/pipeline';
import { formatComicLogEntry } from '../../src/ui/utils/comic-log-formatter';

/** Issues #328 and #330: damage and Tough loss are sentences in the combat log, naming their source. */
describe('Damage in the combat log', () => {
  let state: GameState;

  const sentencesSince = (from: number, lang: 'en' | 'fr' = 'en') =>
    state.log.slice(from).map((entry) => formatComicLogEntry(entry, lang, state).narrativeAction);

  const giveCounterPunch = () =>
    state.players[0].hand.push(createCardInstance(cardCatalog.getCard('01077')!));

  /** Spider-Man (ATK 2) defends a villain or minion attack, then Counter-Punch answers. */
  const defendWithCounterPunch = (attacker: Parameters<typeof initiateEnemyAttack>[1]) => {
    const from = state.log.length;
    initiateEnemyAttack(state, attacker, 'p1', { acceptOptionalTriggers: true });
    resolveDefenderDeclaration(state, { type: 'HERO', playerId: 'p1' }, state.activeAttackContext!);
    return from;
  };

  beforeEach(() => {
    const spiderMan = cardCatalog.getCard('01001a') as HeroCard;
    const peter = cardCatalog.getCard('01001b') as AlterEgoCard;
    state = setupGame({
      catalog: cardCatalog,
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Player 1',
          hero: spiderMan,
          alterEgo: peter,
          deckCards: Array(10).fill(cardCatalog.getCard('01005')!),
        },
      ],
      villain: cardCatalog.getCard('01094') as any,
      mainScheme: cardCatalog.getCard('01097b') as any,
      encounterCards: cardCatalog.getCardsBySet('rhino'),
      skipMulligan: true,
    });
    state.players[0].currentForm = 'hero';
    state.players[0].activeFormCard = spiderMan;
    state.players[0].hand = [];
    state.players[0].discard = [];
    state.encounterDeck = [];
  });

  it('#328: Counter-Punch damage to the villain reads "Counter-Punch dealt 2 damage to Rhino."', () => {
    giveCounterPunch();
    const from = defendWithCounterPunch({ type: 'VILLAIN' });

    expect(sentencesSince(from)).toContain('Counter-Punch dealt 2 damage to Rhino.');
    expect(sentencesSince(from, 'fr')).toContain('Counter-Punch a infligé 2 dégât(s) à Rhino.');
  });

  it('a hero basic attack names the hero as the source', () => {
    const from = state.log.length;
    const villain = getActiveVillain(state);
    const res = dispatchAction(state, {
      type: 'BASIC_ATTACK',
      playerId: 'p1',
      targetType: 'villain',
      targetInstanceId: villain.instanceId,
    });
    state = res.state;

    expect(sentencesSince(from)).toContain('Spider-Man dealt 2 damage to Rhino.');
  });

  it('a hit on a minion is one sentence, not one from the handler and one from the pipeline', () => {
    giveCounterPunch();
    const minion = createCardInstance(cardCatalog.getCard('01101') as MinionCard);
    state.players[0].engagedMinions.push(minion);
    const from = defendWithCounterPunch({ type: 'MINION', card: minion });

    const hits = sentencesSince(from).filter((s) => / damage to /.test(s));
    expect(hits).toEqual([`Counter-Punch dealt 2 damage to ${minion.card.name}.`]);
  });

  it('#330: a hit that removes Tough says so and deals no damage sentence', () => {
    giveCounterPunch();
    const minion = createCardInstance(cardCatalog.getCard('01101') as MinionCard);
    minion.statusCards = [StatusCard.TOUGH];
    state.players[0].engagedMinions.push(minion);
    const from = defendWithCounterPunch({ type: 'MINION', card: minion });

    const sentences = sentencesSince(from);
    expect(sentences).toContain(`${minion.card.name} loses Tough and takes no damage.`);
    expect(sentences.filter((s) => / damage to /.test(s))).toEqual([]);
  });
});
