import React, { useState } from 'react';
import corePack from '../../data/upstream/pack/core.json';
import coreEncounterPack from '../../data/upstream/pack/core_encounter.json';
import { CardCatalog } from '../data/importer/card-loader';
import {
  setupGame,
  dispatchAction,
  getScenario,
  getStarterDeck,
  GameState,
} from '../engine';
import { ScenarioSelector, SetupSelection } from './components/setup/ScenarioSelector';
import { MulliganScreen } from './components/setup/MulliganScreen';
import { GameBoard } from './components/board/GameBoard';
import { logGameStateSnapshot } from './services/gamestate-logger-service';

import { GameSettingsProvider } from './context/GameSettingsContext';

export const AppContent: React.FC = () => {
  const [catalog] = useState(() => new CardCatalog([...corePack, ...coreEncounterPack]));
  const [stage, setStage] = useState<'SETUP' | 'MULLIGAN' | 'IN_GAME'>('SETUP');
  const [gameState, setGameState] = useState<GameState | null>(null);

  // Automatically snapshot game state changes to logs/gamestates/
  React.useEffect(() => {
    if (gameState) {
      logGameStateSnapshot(gameState);
    }
  }, [gameState]);

  const handleStartSetup = (selection: SetupSelection) => {
    const scenario = getScenario(selection.scenarioId) || getScenario('rhino')!;
    const { villain, mainScheme, encounterCards } = scenario.createEncounterDeck(catalog);

    // Override villain stage for Expert difficulty if selected
    if (selection.difficulty === 'EXPERT') {
      const expertVillain = catalog.getCard(scenario.stages.expert[0]) as any;
      if (expertVillain) villain.health = expertVillain.health;
    }

    const players = Array.from({ length: selection.playerCount }).map((_, index) => {
      const deckId = selection.deckIds[index] || 'spider_man_justice';
      const starterDeck = getStarterDeck(deckId) || getStarterDeck('spider_man_justice')!;
      const deck = starterDeck.loadDeck(catalog);
      return {
        id: `player_${index + 1}`,
        name: `Hero Seat ${index + 1} (${deck.hero.name})`,
        hero: deck.hero,
        alterEgo: deck.alterEgo,
        deckCards: deck.deckCards,
        obligation: deck.obligation,
        nemesisCards: deck.nemesisCards,
      };
    });

    const newGameState = setupGame({
      scenarioId: selection.scenarioId,
      players,
      villain,
      mainScheme,
      encounterCards,
      difficulty: selection.difficulty,
      heroicLevel: selection.heroicLevel,
      modularSetCodes: selection.selectedModularSetCodes,
    });

    setGameState(newGameState);
    setStage('MULLIGAN');
  };

  const handleResolveHeroMulligan = (playerId: string, discardIds: string[]) => {
    if (!gameState) return;

    const { state: nextState } = dispatchAction(gameState, {
      type: 'RESOLVE_MULLIGAN',
      playerId,
      discardCardInstanceIds: discardIds,
    });

    setGameState(nextState);
  };

  const handleStartScenario = () => {
    if (!gameState) return;
    let currentState = gameState;

    // Auto-resolve any remaining unconfirmed players (keeping full hands)
    for (const player of currentState.players) {
      if (!currentState.setupState?.mulliganCompleted[player.id]) {
        const { state: nextState } = dispatchAction(currentState, {
          type: 'RESOLVE_MULLIGAN',
          playerId: player.id,
          discardCardInstanceIds: [],
        });
        currentState = nextState;
      }
    }

    setGameState(currentState);
    setStage('IN_GAME');
  };

  const handleDispatchAction = (action: any) => {
    if (!gameState) return;
    const { state: nextState } = dispatchAction(gameState, action);
    setGameState(nextState);
  };

  const handleReset = () => {
    setGameState(null);
    setStage('SETUP');
  };

  return (
    <div className="relative min-h-screen w-full bg-comic-paper flex flex-col items-center justify-start overflow-x-hidden overflow-y-auto font-sans">
      {/* Halftone Dot Overlay */}
      <div className="fixed inset-0 bg-bendy-dots pointer-events-none z-0" />

      {/* Screen Render Switcher */}
      <div className="relative z-10 w-full">
        {stage === 'SETUP' && (
          <ScenarioSelector catalog={catalog} onStartSetup={handleStartSetup} />
        )}

        {stage === 'MULLIGAN' && gameState && (
          <MulliganScreen
            gameState={gameState}
            onResolveHeroMulligan={handleResolveHeroMulligan}
            onStartScenario={handleStartScenario}
          />
        )}

        {stage === 'IN_GAME' && gameState && (
          <GameBoard
            gameState={gameState}
            onReset={handleReset}
            onDispatchAction={handleDispatchAction}
          />
        )}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <GameSettingsProvider>
      <AppContent />
    </GameSettingsProvider>
  );
};

export default App;
