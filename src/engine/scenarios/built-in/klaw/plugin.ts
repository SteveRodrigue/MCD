import {
  GameState,
  VillainState,
  MainSchemeState,
  SideSchemeCard,
  StatusCard,
  VillainCard,
  NormalizedCard,
} from '@engine/models';
import { cardCatalog } from '../../../../data/importer/card-loader';
import { createCardInstance } from '../../../state/game-setup';
import { ScenarioPlugin, ScenarioDefinition, ScenarioGameSetupOptions } from '../../types';
import definitionData from './definition.json';

export const klawDefinition: ScenarioDefinition = definitionData as ScenarioDefinition;

/**
 * Klaw Scenario Plugin implementation.
 * Encapsulates setup, multi-stage villain transitions (I -> II -> III),
 * Stage 1A (Defense Network search & starting minion discard/deal),
 * Stage 1B -> 2B progression, and victory/defeat evaluation.
 */
export class KlawScenarioPlugin implements ScenarioPlugin {
  definition = klawDefinition;

  onGameSetup(state: GameState, options: ScenarioGameSetupOptions): GameState {
    const difficulty = options.difficulty || 'STANDARD';
    state.difficulty = difficulty;
    state.heroicLevel = options.heroicLevel || 0;
    state.scenarioId = this.definition.id;
    state.scenarioCardCode = this.definition.scenarioCardCode;

    const numPlayers = state.players.length || 1;

    // 1. Determine Starting Villain Stage based on Difficulty
    const startingStageCode = this.definition.villainSetup.stages[difficulty][0];
    const villainCard = cardCatalog.getCard(startingStageCode) as VillainCard;
    if (!villainCard) {
      throw new Error(
        `Villain card '${startingStageCode}' not found in catalog for scenario '${this.definition.id}'.`,
      );
    }

    const hpPerPlayer = this.definition.villainSetup.healthPerPlayer[startingStageCode] || 12;
    const maxHealth = hpPerPlayer * numPlayers;

    const initialVillain: VillainState = {
      instanceId: `villain_${Date.now()}_${startingStageCode}`,
      card: villainCard,
      health: maxHealth,
      maxHealth,
      exhausted: false,
      statusCards: startingStageCode === '01115' ? [StatusCard.TOUGH] : [],
      attachments: [],
    };

    state.villains = [initialVillain];
    state.activeVillainIndex = 0;
    state.villain = initialVillain;

    // 2. Setup Main Scheme (Underground Distribution Stage 1B)
    const mainSchemeCard = cardCatalog.getMainSchemeByStage('klaw', '1B');
    if (!mainSchemeCard) {
      throw new Error(`Main scheme stage '1B' not found in catalog for scenario 'klaw'.`);
    }

    const targetThreat =
      (mainSchemeCard.targetThreat || this.definition.mainSchemeSetup.targetThreatPerPlayer) *
      numPlayers;
    const initialMainScheme: MainSchemeState = {
      instanceId: `main_scheme_${Date.now()}_${mainSchemeCard.code}`,
      card: mainSchemeCard,
      threat: mainSchemeCard.baseThreat || this.definition.mainSchemeSetup.startingThreat,
      targetThreat,
      stage: '1B',
    };

    state.mainSchemes = [initialMainScheme];
    state.activeMainSchemeIndex = 0;
    state.mainScheme = initialMainScheme;

    // 3. Build Encounter Deck based on Difficulty
    const modularSetCodes =
      options.modularSetCodes || this.definition.modularEncounterSets.defaults[difficulty];
    const allEncounterCards: NormalizedCard[] = [];

    // Add scenario cards (Klaw set)
    allEncounterCards.push(...cardCatalog.getCardsBySet('klaw'));

    // Add Standard set
    allEncounterCards.push(...cardCatalog.getCardsBySet('standard'));

    // Add Expert set if difficulty is EXPERT
    if (difficulty === 'EXPERT') {
      allEncounterCards.push(...cardCatalog.getCardsBySet('expert'));
    }

    // Add modular sets
    for (const setCode of modularSetCodes) {
      if (setCode !== 'standard' && setCode !== 'expert') {
        allEncounterCards.push(...cardCatalog.getCardsBySet(setCode));
      }
    }

    // Filter out villain cards and main scheme cards from encounter deck
    const deckCards = allEncounterCards.filter(
      (c: NormalizedCard) =>
        c.type !== 'villain' &&
        c.type !== 'main_scheme' &&
        c.code !== '01113' &&
        c.code !== '01114' &&
        c.code !== '01115' &&
        c.code !== '01116a' &&
        c.code !== '01116b' &&
        c.code !== '01117a' &&
        c.code !== '01117b',
    );

    // Shuffle and create instances
    const shuffled = [...deckCards].sort(() => Math.random() - 0.5);
    state.encounterDeck = shuffled.map((c) => createCardInstance(c));
    state.encounterDiscard = [];
    state.sideSchemes = [];

    // 4. Resolve Stage 1A Declarative Setup Hook
    this.resolveStage1ASetup(state, options);

    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      category: 'phase',
      key: 'scenario.setup',
      params: {
        scenario: this.definition.name,
        difficulty,
        villain: villainCard.name,
        health: maxHealth,
        threatTarget: targetThreat,
      },
      onomatopoeia: 'UNDERGROUND DISTRIBUTION COMMENCES!',
    });

    return state;
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

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
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
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          category: 'combat',
          key: 'scenario.setup.minion',
          params: { player: firstPlayer.name, minion: minionInstance.card.name },
          onomatopoeia: 'MINION ENGAGES!',
        });
      }
    }

    return state;
  }

  onVillainDefeated(
    state: GameState,
    defeatedVillainInstanceId: string,
  ): {
    state: GameState;
    advancedStage?: boolean;
    victory?: boolean;
  } {
    const villain =
      state.villains.find((v) => v.instanceId === defeatedVillainInstanceId) || state.villain;
    const currentCode = villain.card.code;
    const difficulty = state.difficulty || 'STANDARD';
    const numPlayers = state.players.length || 1;

    // Skirmish Mode: Stage I defeated -> Immediate Victory
    if (difficulty === 'SKIRMISH') {
      state.winner = 'HEROES';
      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        category: 'combat',
        key: 'scenario.victory',
        params: { mode: 'SKIRMISH', villain: villain.card.name },
        onomatopoeia: 'KLAW DEFEATED! HERO VICTORY!',
      });
      return { state, victory: true };
    }

    // Standard Mode: Stage I -> Stage II, Stage II -> Victory
    if (difficulty === 'STANDARD') {
      if (currentCode === '01113') {
        return this.advanceToStage(state, '01114', numPlayers * 18, () => {
          this.resolveStageIIWhenRevealed(state);
        });
      } else {
        state.winner = 'HEROES';
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          category: 'combat',
          key: 'scenario.victory',
          params: { mode: 'STANDARD', villain: villain.card.name },
          onomatopoeia: 'KLAW STAGE II DEFEATED! HERO VICTORY!',
        });
        return { state, victory: true };
      }
    }

    // Expert Mode: Stage II -> Stage III, Stage III -> Victory
    if (difficulty === 'EXPERT') {
      if (currentCode === '01114') {
        return this.advanceToStage(state, '01115', numPlayers * 22, (newVillain) => {
          newVillain.statusCards.push(StatusCard.TOUGH);
        });
      } else {
        state.winner = 'HEROES';
        state.log.push({
          id: `log_${Date.now()}`,
          timestamp: Date.now(),
          category: 'combat',
          key: 'scenario.victory',
          params: { mode: 'EXPERT', villain: villain.card.name },
          onomatopoeia: 'KLAW STAGE III DEFEATED! HERO VICTORY!',
        });
        return { state, victory: true };
      }
    }

    return { state };
  }

  private advanceToStage(
    state: GameState,
    nextStageCode: string,
    nextStageMaxHealth: number,
    onRevealedCallback?: (newVillain: VillainState) => void,
  ): { state: GameState; advancedStage: boolean } {
    const nextCard = cardCatalog.getCard(nextStageCode) as VillainCard;
    if (!nextCard) {
      throw new Error(`Villain stage card '${nextStageCode}' not found in catalog.`);
    }

    const newVillain: VillainState = {
      instanceId: `villain_${Date.now()}_${nextStageCode}`,
      card: nextCard,
      health: nextStageMaxHealth,
      maxHealth: nextStageMaxHealth,
      exhausted: false,
      statusCards: [],
      attachments: [],
    };

    state.villains = [newVillain];
    state.activeVillainIndex = 0;
    state.villain = newVillain;

    if (onRevealedCallback) {
      onRevealedCallback(newVillain);
    }

    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      category: 'phase',
      key: 'scenario.stageAdvance',
      params: {
        stage: nextCard.stage,
        villain: nextCard.name,
        health: nextStageMaxHealth,
      },
      onomatopoeia: `KLAW ADVANCES TO STAGE ${nextCard.stage}!`,
    });

    return { state, advancedStage: true };
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
      state.villain.attachments.push(immortalCard);
      // Immortal Klaw grants +10 health per player
      const bonusHealth = 10 * (state.players.length || 1);
      state.villain.health += bonusHealth;
      state.villain.maxHealth += bonusHealth;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        category: 'status',
        key: 'attachment.attached',
        params: { attachment: immortalCard.card.name, target: state.villain.card.name },
        onomatopoeia: 'IMMORTAL KLAW ATTACHES!',
      });
    }
  }

  onMainSchemeCompleted(
    state: GameState,
    _completedSchemeInstanceId: string,
  ): {
    state: GameState;
    advancedStage?: boolean;
    defeat?: boolean;
  } {
    const numPlayers = state.players.length || 1;
    const currentStage = state.mainScheme.stage;

    if (currentStage === '1B') {
      // Advance to Stage 2B (Secret Rendezvous)
      const nextSchemeCard = cardCatalog.getMainSchemeByStage('klaw', '2B');
      if (!nextSchemeCard) {
        throw new Error(`Main scheme stage '2B' not found in catalog for scenario 'klaw'.`);
      }
      const targetThreat = (nextSchemeCard.targetThreat || 8) * numPlayers;

      const nextMainScheme: MainSchemeState = {
        instanceId: `main_scheme_${Date.now()}_${nextSchemeCard.code}`,
        card: nextSchemeCard,
        threat: nextSchemeCard.baseThreat || 0,
        targetThreat,
        stage: '2B',
      };

      state.mainSchemes = [nextMainScheme];
      state.activeMainSchemeIndex = 0;
      state.mainScheme = nextMainScheme;

      state.log.push({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        category: 'scheme',
        key: 'scenario.mainSchemeAdvance',
        params: { stage: '2B', scheme: 'Secret Rendezvous', targetThreat },
        onomatopoeia: 'SCHEME ADVANCES TO SECRET RENDEZVOUS!',
      });

      return { state, advancedStage: true };
    }

    // Stage 2B completed -> Defeat
    state.winner = 'VILLAIN';
    state.log.push({
      id: `log_${Date.now()}`,
      timestamp: Date.now(),
      category: 'scheme',
      key: 'scenario.defeat',
      params: { scheme: 'Secret Rendezvous' },
      onomatopoeia: 'SECRET RENDEZVOUS COMPLETED! HEROES DEFEATED!',
    });

    return { state, defeat: true };
  }
}

export const klawPlugin = new KlawScenarioPlugin();
