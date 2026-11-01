import { GameState, SideSchemeCard, getCatalog } from '@engine/models';
import { createCardInstance } from '../../../state/card-instance';
import { appendLog } from '../../../state/game-log';
import { DeclarativeScenarioPlugin } from '../../declarative-plugin';
import type { ScenarioDefinition, ScenarioGameSetupOptions } from '../../types';
import definitionData from '../../../../../content/packs/core/scenarios/klaw/definition.json';

/**
 * Klaw (Underground Distribution). Stage 1A setup is scenario code; Klaw II When Revealed
 * and The "Immortal" Klaw are supplemental data.
 */
export class KlawScenarioPlugin extends DeclarativeScenarioPlugin {
  constructor() {
    super(definitionData as ScenarioDefinition, 'UNDERGROUND DISTRIBUTION COMMENCES!');
  }

  resolveStage1ASetup(state: GameState, _options?: ScenarioGameSetupOptions): GameState {
    const numPlayers = state.players.length || 1;

    // Search for Defense Network (01124) side scheme and reveal it
    const defenseNetworkIdx = state.encounterDeck.findIndex((c) => c.card.code === '01124');
    let defenseNetworkCard =
      defenseNetworkIdx !== -1 ? state.encounterDeck.splice(defenseNetworkIdx, 1)[0] : null;
    if (!defenseNetworkCard) {
      const card = getCatalog(state).getCard('01124');
      if (card) defenseNetworkCard = createCardInstance(card);
    }

    if (defenseNetworkCard) {
      const threat = ((defenseNetworkCard.card as SideSchemeCard).baseThreat || 2) * numPlayers;
      state.sideSchemes.push({
        instanceId: defenseNetworkCard.instanceId,
        card: defenseNetworkCard.card as SideSchemeCard,
        threat,
      });

      appendLog(state, {
        category: 'scheme',
        key: 'scenario.setup.sideScheme',
        params: { card: defenseNetworkCard.card.name, amount: threat },
        onomatopoeia: 'DEFENSE NETWORK ONLINE!',
      });
    }

    // 1B When Revealed: Discard cards from encounter deck until a minion is discarded. Put into play engaged with Player 1.
    const firstPlayer = state.players[0];
    if (firstPlayer) {
      let minionInstance = null;
      while (state.encounterDeck.length > 0) {
        const top = state.encounterDeck.shift()!;
        if (top.card.type === 'minion') {
          minionInstance = top;
          break;
        } else {
          state.encounterDiscard.push(top);
        }
      }

      if (minionInstance) {
        firstPlayer.engagedMinions.push(minionInstance);
        appendLog(state, {
          category: 'combat',
          key: 'scenario.setup.minion',
          params: { actor: firstPlayer.name, card: minionInstance.card.name },
          onomatopoeia: 'MINION ENGAGES!',
        });
      }
    }

    return state;
  }
}

export const klawPlugin = new KlawScenarioPlugin();
