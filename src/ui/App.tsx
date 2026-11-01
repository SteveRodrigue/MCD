import React, { useState } from 'react';
import { cardCatalog } from '../data/importer/card-loader';
import { setupGame, dispatchAction, getStarterDeck, GameState, InfiniteLoopError } from '../engine';
import type { SetupSelection } from './components/setup/ScenarioSelector';
import { scheduleGameStateSnapshot } from './services/gamestate-logger-service';
import { resetSessionSyncTracking } from './services/stats-storage-service';

import { GameSettingsProvider } from './context/GameSettingsProvider';
import { useGameSettings } from './context/useGameSettings';
import { BuildVersionBadge } from './components/BuildVersionBadge';
import { InfiniteLoopModal } from './components/board/InfiniteLoopModal';
import { GameThemeRoot } from './theme/GameThemeRoot';
import { isGameStage } from './theme/game-stage';
import { ThemeProvider } from './theme/ThemeProvider';
import { useGameTheme } from './theme/useGameTheme';
import { GameSessionProvider } from './context/GameStateContext';
import { ScenarioRegistry } from '../engine/scenarios';

const ScenarioSelector = React.lazy(() =>
  import('./components/setup/ScenarioSelector').then((m) => ({ default: m.ScenarioSelector })),
);
const WelcomeScreen = React.lazy(() =>
  import('./components/setup/WelcomeScreen').then((m) => ({ default: m.WelcomeScreen })),
);
const ContentScreen = React.lazy(() =>
  import('./components/setup/ContentScreen').then((m) => ({ default: m.ContentScreen })),
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
// The design lab (`/templates`) is a dev tool: it and its fonts are built only for the dev server.
const ModalTemplatesScreen = import.meta.env.DEV
  ? React.lazy(() =>
      import('./components/templates/ModalTemplatesScreen').then((m) => ({
        default: m.ModalTemplatesScreen,
      })),
    )
  : null;

const isTemplatesUrl = (pathname: string, search: string): boolean =>
  ModalTemplatesScreen !== null &&
  (pathname.startsWith('/templates') || search.includes('view=templates'));

const AppContent: React.FC = () => {
  const { settings } = useGameSettings();
  const { rollGameTheme } = useGameTheme();
  const [stage, setStage] = useState<
    'SETUP' | 'CONTENT' | 'MULLIGAN' | 'IN_GAME' | 'EDITOR' | 'TEMPLATES'
  >(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const search = window.location.search;
      if (isTemplatesUrl(pathname, search)) {
        return 'TEMPLATES';
      }
      if (pathname.startsWith('/editor') || search.includes('view=editor')) {
        return 'EDITOR';
      }
    }
    return 'SETUP';
  });
  const [rawGameState, setGameState] = useState<GameState | null>(null);
  const [loopError, setLoopError] = useState<InfiniteLoopError | null>(null);

  // The engine reads two UI settings from state.options; the state it is handed always carries them
  const withUiOptions = React.useCallback(
    (state: GameState): GameState => {
      const villainPhaseStepping = settings.villainPhasePacing !== 'instant';
      if (
        state.options?.autoResolveUnambiguous === settings.autoResolveUnambiguous &&
        state.options?.villainPhaseStepping === villainPhaseStepping
      ) {
        return state;
      }
      return {
        ...state,
        options: {
          ...state.options,
          autoResolveUnambiguous: settings.autoResolveUnambiguous,
          villainPhaseStepping,
        },
      };
    },
    [settings.autoResolveUnambiguous, settings.villainPhasePacing],
  );

  // A settings change applies to the game in progress
  const gameState = React.useMemo(
    () => (rawGameState ? withUiOptions(rawGameState) : null),
    [rawGameState, withUiOptions],
  );

  // Handle browser popstate
  React.useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;
      const search = window.location.search;
      if (isTemplatesUrl(pathname, search)) {
        setStage('TEMPLATES');
      } else if (pathname.startsWith('/editor') || search.includes('view=editor')) {
        setStage('EDITOR');
      } else if (stage === 'EDITOR' || stage === 'TEMPLATES') {
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
      catalog: cardCatalog,
      scenarioId: selection.scenarioId,
      players,
      difficulty: selection.difficulty,
      heroicLevel: selection.heroicLevel,
      modularSetCodes: selection.selectedModularSetCodes,
    });

    // The game's theme is decided once, here, and stays for the whole game
    rollGameTheme();
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
    setGameState(nextState);
  };

  const handleResolveSetupPrompt = (playerId: string, selectedOptionId: string) => {
    if (!gameState) return;
    const { state: nextState } = dispatchAction(gameState, {
      type: 'RESOLVE_DECISION_PROMPT',
      playerId,
      selectedOptionId,
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
    // A player Setup ability may still wait for a decision: the mulligan screen shows it first.
    if (currentState.setupState?.stage !== 'PLAYER_SETUP') {
      setStage('IN_GAME');
    }
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
    <GameThemeRoot
      active={isGameStage(stage)}
      className="relative min-h-screen w-full flex flex-col items-center justify-start overflow-x-clip"
    >
      {/* Screen Render Switcher */}
      <div className="relative z-content w-full">
        <React.Suspense
          fallback={
            <div className="flex items-center justify-center h-screen">
              <div className="font-comic text-2xl animate-pulse">Loading...</div>
            </div>
          }
        >
          {stage === 'SETUP' &&
            (ScenarioRegistry.getAll().length === 0 ? (
              <WelcomeScreen onOpenContent={() => setStage('CONTENT')} />
            ) : (
              <ScenarioSelector
                onStartSetup={handleStartSetup}
                onOpenContent={() => setStage('CONTENT')}
              />
            ))}

          {stage === 'CONTENT' && <ContentScreen onBack={() => setStage('SETUP')} />}

          {stage === 'MULLIGAN' && gameState && (
            <MulliganScreen
              gameState={gameState}
              onResolveHeroMulligan={handleResolveHeroMulligan}
              onStartScenario={handleStartScenario}
              onResolvePrompt={handleResolveSetupPrompt}
            />
          )}

          {stage === 'IN_GAME' && gameState && (
            <GameSessionProvider state={gameState} dispatch={handleDispatchAction}>
              <GameBoard onReset={handleReset} />
            </GameSessionProvider>
          )}
        </React.Suspense>

        {stage === 'EDITOR' && (
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center h-screen">
                <div className="font-comic text-2xl animate-pulse">Loading Editor...</div>
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

        {stage === 'TEMPLATES' && ModalTemplatesScreen && (
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center h-screen">
                <div className="font-comic text-2xl animate-pulse">Loading Modal Templates...</div>
              </div>
            }
          >
            <ModalTemplatesScreen
              onExit={() => {
                window.history.pushState({}, '', '/');
                setStage(gameState ? 'IN_GAME' : 'SETUP');
              }}
            />
          </React.Suspense>
        )}

        {/* Infinite Loop Detected Modal (ADR-0053, Issue #48) */}
        {loopError && (
          <InfiniteLoopModal
            message={loopError.message}
            cycle={loopError.cycle}
            onDismiss={() => setLoopError(null)}
            onReset={handleReset}
          />
        )}
      </div>
      <BuildVersionBadge />
    </GameThemeRoot>
  );
};

export const App: React.FC = () => {
  return (
    <GameSettingsProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </GameSettingsProvider>
  );
};

export default App;
