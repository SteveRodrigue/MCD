import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  executeEnemyAttackSynchronously,
  dispatchAction,
  peekDecisionPrompt,
  type DefensePolicy,
} from '@engine/pipeline';
import { getCardEnrichment } from '../../src/data/supplemental';

const ELECTRIC_WHIP = '01173';
const ARMORED_VEST = '01081'; // upgrade
const SUPPORT_CARD = '01080'; // Med Team, support

describe('Electric Whip Attack (01173): boost discards an upgrade only on an undefended villain attack', () => {
  let state: GameState;

  const inTableau = (inst: CardInstance) =>
    state.players[0].tableau.some((t) => t.instanceId === inst.instanceId);
  const addToTableau = (code: string) => {
    const inst = createCardInstance(cardCatalog.getCard(code)!);
    state.players[0].tableau.push(inst);
    return inst;
  };
  const villainAttack = (policy: DefensePolicy) => {
    state.encounterDeck = [
      createCardInstance(cardCatalog.getCard(ELECTRIC_WHIP)!),
      ...state.encounterDeck,
    ];
    executeEnemyAttackSynchronously(state, { type: 'VILLAIN' }, 'p1', policy);
  };

  beforeEach(() => {
    const spiderMan = cardCatalog.getCard('01001a') as HeroCard;
    const peter = cardCatalog.getCard('01001b') as AlterEgoCard;
    state = setupGame({
      scenarioId: 'rhino',
      players: [
        {
          id: 'p1',
          name: 'Spider-Man',
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
    state.players[0].tableau = [];
  });

  it('discards the only upgrade and keeps a support, on an undefended villain attack', () => {
    const upgrade = addToTableau(ARMORED_VEST);
    const support = addToTableau(SUPPORT_CARD);

    villainAttack('TAKE_UNDEFENDED');

    expect(inTableau(upgrade)).toBe(false);
    expect(inTableau(support)).toBe(true);
    expect(state.players[0].discard.map((c) => c.instanceId)).toContain(upgrade.instanceId);
  });

  it('offers only upgrades when there are several, and discards the chosen one', () => {
    const upgradeA = addToTableau(ARMORED_VEST);
    const upgradeB = addToTableau(ARMORED_VEST);
    const support = addToTableau(SUPPORT_CARD);

    villainAttack('TAKE_UNDEFENDED');

    const prompt = peekDecisionPrompt(state)!;
    expect(prompt).toBeDefined();
    const ids = prompt.options.map((o) => o.id);
    expect(ids).toContain(upgradeA.instanceId);
    expect(ids).toContain(upgradeB.instanceId);
    expect(ids).not.toContain(support.instanceId);

    state = dispatchAction(state, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId: 'p1',
      selectedOptionId: upgradeB.instanceId,
    }).state;

    expect(inTableau(upgradeA)).toBe(true);
    expect(inTableau(upgradeB)).toBe(false);
    expect(inTableau(support)).toBe(true);
  });

  it('discards nothing when the hero defends', () => {
    const upgrade = addToTableau(ARMORED_VEST);

    villainAttack('HERO_IF_READY');

    expect(inTableau(upgrade)).toBe(true);
  });

  it('does nothing, and does not crash, when the player controls no upgrade', () => {
    const support = addToTableau(SUPPORT_CARD);

    villainAttack('TAKE_UNDEFENDED');

    expect(inTableau(support)).toBe(true);
    expect(peekDecisionPrompt(state)).toBeUndefined();
  });

  it('has no abilities beyond the printed When Revealed and boost (no invented CONSTANT +1 ATTACK)', () => {
    const abilities = getCardEnrichment(ELECTRIC_WHIP)!.abilities ?? [];
    expect(abilities.map((a) => a.timing).sort()).toEqual(['BOOST', 'WHEN_REVEALED']);
    expect(JSON.stringify(abilities)).not.toContain('MODIFY_STAT');
  });
});
