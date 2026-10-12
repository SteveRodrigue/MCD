import { describe, it, expect, beforeEach } from 'vitest';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { GameState, HeroCard, AlterEgoCard, CardInstance } from '@engine/models';
import { setupGame, createCardInstance } from '@engine/state/game-setup';
import {
  executeEnemyAttackSynchronously,
  dispatchAction,
  peekDecisionPrompt,
  step4_revealEncounterCards,
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
    expect(prompt.title).toBe('Discard Upgrade');
    expect(prompt.description).toBe('Choose an upgrade you control to discard:');
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

    const discardLog = state.log.find((l) => l.key === 'player.tableau.discarded');
    expect(discardLog).toBeDefined();
    expect(discardLog!.params?.player).toBe('Spider-Man');
    expect(discardLog!.params?.card).toBe('Armored Vest');
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

  describe('When Revealed two-stage choice', () => {
    it('revealing Electric Whip Attack enqueues PLAYER_CHOICE, and selecting discard_upgrade enqueues secondary Discard Upgrade prompt if 2+ upgrades exist', () => {
      const upgradeA = addToTableau(ARMORED_VEST);
      const upgradeB = addToTableau(ARMORED_VEST);
      const support = addToTableau(SUPPORT_CARD);

      state.players[0].dealtEncounterCards.push(
        createCardInstance(cardCatalog.getCard(ELECTRIC_WHIP)!),
      );
      state = step4_revealEncounterCards(state);

      const firstPrompt = peekDecisionPrompt(state)!;
      expect(firstPrompt).toBeDefined();
      expect(firstPrompt.title).toBe('Electric Whip Attack');
      expect(firstPrompt.options.map((o) => o.id)).toContain('discard_upgrade');

      // Player selects discard_upgrade option
      state = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'discard_upgrade',
      }).state;

      // Second prompt for selecting which upgrade to discard
      const secondPrompt = peekDecisionPrompt(state)!;
      expect(secondPrompt).toBeDefined();
      expect(secondPrompt.title).toBe('Discard Upgrade');
      expect(secondPrompt.description).toBe('Choose an upgrade you control to discard:');
      expect(secondPrompt.sourceCardName).toBe('Electric Whip Attack');
      expect(secondPrompt.options.map((o) => o.id)).toContain(upgradeA.instanceId);
      expect(secondPrompt.options.map((o) => o.id)).toContain(upgradeB.instanceId);
      expect(secondPrompt.options.map((o) => o.id)).not.toContain(support.instanceId);

      // Player selects upgradeB
      state = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: upgradeB.instanceId,
      }).state;

      expect(inTableau(upgradeA)).toBe(true);
      expect(inTableau(upgradeB)).toBe(false);
      expect(inTableau(support)).toBe(true);

      const discardLog = state.log.find((l) => l.key === 'player.tableau.discarded');
      expect(discardLog).toBeDefined();
      expect(discardLog!.params?.player).toBe('Spider-Man');
      expect(discardLog!.params?.card).toBe('Armored Vest');
    });

    it('selecting discard_upgrade with exactly 1 upgrade auto-discards without second prompt and logs card name', () => {
      const upgradeA = addToTableau(ARMORED_VEST);
      const support = addToTableau(SUPPORT_CARD);

      state.players[0].dealtEncounterCards.push(
        createCardInstance(cardCatalog.getCard(ELECTRIC_WHIP)!),
      );
      state = step4_revealEncounterCards(state);

      const firstPrompt = peekDecisionPrompt(state)!;
      expect(firstPrompt).toBeDefined();

      state = dispatchAction(state, {
        type: 'RESOLVE_DECISION_PROMPT',
        playerId: 'p1',
        selectedOptionId: 'discard_upgrade',
      }).state;

      // Exactly 1 upgrade auto-discards -> no secondary prompt
      expect(peekDecisionPrompt(state)).toBeUndefined();
      expect(inTableau(upgradeA)).toBe(false);
      expect(inTableau(support)).toBe(true);

      const discardLog = state.log.find((l) => l.key === 'player.tableau.discarded');
      expect(discardLog).toBeDefined();
      expect(discardLog!.params?.player).toBe('Spider-Man');
      expect(discardLog!.params?.card).toBe('Armored Vest');
    });
  });
});
