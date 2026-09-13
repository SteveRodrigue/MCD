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
  InfiniteLoopError,
} from '../engine';
import { ScenarioSelector, SetupSelection } from './components/setup/ScenarioSelector';
import { MulliganScreen } from './components/setup/MulliganScreen';
import { GameBoard } from './components/board/GameBoard';
import { logGameStateSnapshot } from './services/gamestate-logger-service';

import { GameSettingsProvider } from './context/GameSettingsProvider';
import { SupplementalEditorScreen } from './components/editor/SupplementalEditorScreen';

export const AppContent: React.FC = () => {
  const [catalog] = useState(() => new CardCatalog([...corePack, ...coreEncounterPack]));
  const [stage, setStage] = useState<'SETUP' | 'MULLIGAN' | 'IN_GAME' | 'EDITOR'>(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const search = window.location.search;
      if (pathname.startsWith('/editor') || search.includes('view=editor')) {
        return 'EDITOR';
      }
    }
    return 'SETUP';
  });
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loopError, setLoopError] = useState<InfiniteLoopError | null>(null);

  // Handle browser popstate
  React.useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;
      const search = window.location.search;
      if (pathname.startsWith('/editor') || search.includes('view=editor')) {
        setStage('EDITOR');
      } else if (stage === 'EDITOR') {
        setStage(gameState ? 'IN_GAME' : 'SETUP');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [stage, gameState]);

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
    try {
      const { state: nextState } = dispatchAction(gameState, action);
      setGameState(nextState);
    } catch (err) {
      if (err instanceof InfiniteLoopError) {
        setLoopError(err);
      } else {
        throw err;
      }
    }
  };

  const handleReset = () => {
    setGameState(null);
    setLoopError(null);
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

        {stage === 'EDITOR' && (
          <SupplementalEditorScreen
            onBackToGame={() => {
              if (window.location.pathname.startsWith('/editor')) {
                window.history.pushState({}, '', '/');
              }
              setStage(gameState ? 'IN_GAME' : 'SETUP');
            }}
          />
        )}

        {/* Infinite Loop Detected Modal (ADR-0053, Issue #48) */}
        {loopError && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
            <div className="relative max-w-lg w-full bg-yellow-300 border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black">
              <div className="bg-red-600 text-white font-black text-2xl px-4 py-2 uppercase border-2 border-black tracking-wider text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] mb-4 rotate-[-1deg]">
                💥 Infinite Loop Detected!
              </div>
              <p className="font-bold text-sm mb-3">
                The game engine halted an infinite trigger recursion loop between forced abilities
                to protect the table state:
              </p>
              <div className="bg-white border-2 border-black p-3 font-mono text-xs rounded mb-4 overflow-x-auto shadow-inner whitespace-pre-wrap">
                {loopError.formattedCycle || loopError.message}
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setLoopError(null)}
                  className="px-4 py-2 bg-white border-2 border-black font-black uppercase text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                >
                  Dismiss &amp; Continue
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-red-500 text-white border-2 border-black font-black uppercase text-sm shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-red-600 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                >
                  Reset Game
                </button>
              </div>
            </div>
          </div>
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
