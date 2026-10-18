import React, { useState } from 'react';
import { ModalLayer } from './components/layout/ModalLayer';
import { cardCatalog } from '../data/importer/card-loader';
import { setupGame, dispatchAction, getStarterDeck, GameState, InfiniteLoopError } from '../engine';
import type { SetupSelection } from './components/setup/ScenarioSelector';
import { scheduleGameStateSnapshot } from './services/gamestate-logger-service';
import { resetSessionSyncTracking } from './services/stats-storage-service';

import { GameSettingsProvider } from './context/GameSettingsProvider';
import { useGameSettings } from './context/useGameSettings';

const ScenarioSelector = React.lazy(() =>
  import('./components/setup/ScenarioSelector').then((m) => ({ default: m.ScenarioSelector })),
);
const MulliganScreen = React.lazy(() =>
  import('./components/setup/MulliganScreen').then((m) => ({ default: m.MulliganScreen })),
);
const GameBoard = React.lazy(() =>
  import('./components/board/GameBoard').then((m) => ({ default: m.GameBoard })),
);
const SupplementalEditorScreen = React.lazy(() =>
  import('./components/editor/SupplementalEditorScreen').then((m) => ({
    default: m.SupplementalEditorScreen,
  })),
);

export const AppContent: React.FC = () => {
  const { settings } = useGameSettings();
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

  // Sync game settings (e.g. autoResolveUnambiguous, villainPhaseStepping) to active gameState.options
  React.useEffect(() => {
    const shouldStep = settings.villainPhasePacing !== 'instant';
    setGameState((prev) => {
      if (
        !prev ||
        (prev.options?.autoResolveUnambiguous === settings.autoResolveUnambiguous &&
          prev.options?.villainPhaseStepping === shouldStep)
      ) {
        return prev;
      }
      return {
        ...prev,
        options: {
          ...prev.options,
          autoResolveUnambiguous: settings.autoResolveUnambiguous,
          villainPhaseStepping: shouldStep,
        },
      };
    });
  }, [settings.autoResolveUnambiguous, settings.villainPhasePacing]);

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

  // Dev Mode on the dev server: snapshot each state change to logs/gamestates/ for problem reports
  React.useEffect(() => {
    if (!gameState || !import.meta.env.DEV || !settings.devMode) return;
    return scheduleGameStateSnapshot(gameState);
  }, [gameState, settings.devMode]);

  const handleStartSetup = (selection: SetupSelection) => {
    const players = Array.from({ length: selection.playerCount }).map((_, index) => {
      const deckId = selection.deckIds[index] || 'spider_man_justice';
      const starterDeck = getStarterDeck(deckId) || getStarterDeck('spider_man_justice')!;
      const deck = starterDeck.loadDeck(cardCatalog);
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

    // The scenario plugin builds the villain, main scheme and encounter deck (ADR-0033)
    const newGameState = setupGame({
      scenarioId: selection.scenarioId,
      players,
      difficulty: selection.difficulty,
      heroicLevel: selection.heroicLevel,
      modularSetCodes: selection.selectedModularSetCodes,
    });

    newGameState.options = {
      ...newGameState.options,
      autoResolveUnambiguous: settings.autoResolveUnambiguous,
      villainPhaseStepping: settings.villainPhasePacing !== 'instant',
    };

    resetSessionSyncTracking();
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
    nextState.options = {
      ...nextState.options,
      autoResolveUnambiguous: settings.autoResolveUnambiguous,
      villainPhaseStepping: settings.villainPhasePacing !== 'instant',
    };

    setGameState(nextState);
  };

  const handleResolveSetupPrompt = (playerId: string, selectedOptionId: string) => {
    if (!gameState) return;
    const { state: nextState } = dispatchAction(gameState, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId,
      selectedOptionId,
    });
    nextState.options = {
      ...nextState.options,
      autoResolveUnambiguous: settings.autoResolveUnambiguous,
      villainPhaseStepping: settings.villainPhasePacing !== 'instant',
    };
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
    currentState.options = {
      ...currentState.options,
      autoResolveUnambiguous: settings.autoResolveUnambiguous,
      villainPhaseStepping: settings.villainPhasePacing !== 'instant',
    };

    setGameState(currentState);
    // A player Setup ability may still wait for a decision: the mulligan screen shows it first.
    if (currentState.setupState?.stage !== 'PLAYER_SETUP') {
      setStage('IN_GAME');
    }
  };

  const handleDispatchAction = (action: any) => {
    if (!gameState) return;
    try {
      const { state: nextState } = dispatchAction(gameState, action);
      nextState.options = {
        ...nextState.options,
        autoResolveUnambiguous: settings.autoResolveUnambiguous,
        villainPhaseStepping: settings.villainPhasePacing !== 'instant',
      };
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
    <div className="relative min-h-screen w-full bg-comic-paper flex flex-col items-center justify-start overflow-x-clip font-sans">
      {/* Halftone Dot Overlay */}
      <div className="fixed inset-0 bg-bendy-dots pointer-events-none z-table" />

      {/* Screen Render Switcher */}
      <div className="relative z-content w-full">
        <React.Suspense
          fallback={
            <div className="flex items-center justify-center h-screen bg-comic-paper">
              <div className="font-bangers text-2xl text-black animate-pulse">Loading...</div>
            </div>
          }
        >
          {stage === 'SETUP' && <ScenarioSelector onStartSetup={handleStartSetup} />}

          {stage === 'MULLIGAN' && gameState && (
            <MulliganScreen
              gameState={gameState}
              onResolveHeroMulligan={handleResolveHeroMulligan}
              onStartScenario={handleStartScenario}
              onResolvePrompt={handleResolveSetupPrompt}
            />
          )}

          {stage === 'IN_GAME' && gameState && (
            <GameBoard
              gameState={gameState}
              onReset={handleReset}
              onDispatchAction={handleDispatchAction}
            />
          )}
        </React.Suspense>

        {stage === 'EDITOR' && (
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center h-screen bg-comic-paper">
                <div className="font-bangers text-2xl text-black animate-pulse">
                  Loading Editor...
                </div>
              </div>
            }
          >
            <SupplementalEditorScreen
              onBackToGame={() => {
                if (window.location.pathname.startsWith('/editor')) {
                  window.history.pushState({}, '', '/');
                }
                setStage(gameState ? 'IN_GAME' : 'SETUP');
              }}
            />
          </React.Suspense>
        )}

        {/* Infinite Loop Detected Modal (ADR-0053, Issue #48) */}
        {loopError && (
          <ModalLayer
            layer="critical"
            className="inset-0 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          >
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
          </ModalLayer>
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
