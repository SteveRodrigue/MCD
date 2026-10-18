import { GameState, SideSchemeCard, getActiveVillain, getPerPlayerCount } from '@engine/models';
import { cardCatalog } from '../../../../data/importer/card-loader';
import { createCardInstance } from '../../../state/card-instance';
import { appendLog } from '../../../state/game-log';
import { DeclarativeScenarioPlugin } from '../../declarative-plugin';
import type { ScenarioDefinition, ScenarioGameSetupOptions } from '../../types';
import definitionData from './definition.json';

/**
 * Klaw (Underground Distribution). Stage 1A setup and the Klaw II reveal are still code, not
 * supplemental data (Gate 2 card integration).
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
      const card = cardCatalog.getCard('01124');
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
        params: { scheme: defenseNetworkCard.card.name, threat },
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
          params: { player: firstPlayer.name, minion: minionInstance.card.name },
          onomatopoeia: 'MINION ENGAGES!',
        });
      }
    }

    return state;
  }

  protected onVillainStageAdvanced(state: GameState, stageCode: string): void {
    if (stageCode === '01114') this.resolveStageIIWhenRevealed(state);
  }

  private resolveStageIIWhenRevealed(state: GameState): void {
    // Search encounter deck and discard for The "Immortal" Klaw (01127) and attach it to Klaw
    const immortalKlawCode = '01127';
    let immortalCard = null;

    const deckIdx = state.encounterDeck.findIndex((c) => c.card.code === immortalKlawCode);
    if (deckIdx !== -1) {
      immortalCard = state.encounterDeck.splice(deckIdx, 1)[0];
    } else {
      const discardIdx = state.encounterDiscard.findIndex((c) => c.card.code === immortalKlawCode);
      if (discardIdx !== -1) {
        immortalCard = state.encounterDiscard.splice(discardIdx, 1)[0];
      }
    }

    if (!immortalCard) {
      const raw = cardCatalog.getCard(immortalKlawCode);
      if (raw) immortalCard = createCardInstance(raw);
    }

    if (immortalCard) {
      getActiveVillain(state).attachments.push(immortalCard);
      // Immortal Klaw grants +10 health per player
      const bonusHealth = 10 * (getPerPlayerCount(state) || 1);
      getActiveVillain(state).health += bonusHealth;
      getActiveVillain(state).maxHealth += bonusHealth;

      appendLog(state, {
        category: 'status',
        key: 'attachment.attached',
        params: { attachment: immortalCard.card.name, target: getActiveVillain(state).card.name },
        onomatopoeia: 'IMMORTAL KLAW ATTACHES!',
      });
    }
  }
}

export const klawPlugin = new KlawScenarioPlugin();
