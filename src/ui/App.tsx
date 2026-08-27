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
  GamePhase,
} from '../engine';
import { ScenarioSelector, SetupSelection } from './components/setup/ScenarioSelector';
import { MulliganScreen } from './components/setup/MulliganScreen';
import { GameBoard } from './components/board/GameBoard';

export const App: React.FC = () => {
  const [catalog] = useState(() => new CardCatalog([...corePack, ...coreEncounterPack]));
  const [stage, setStage] = useState<'SETUP' | 'MULLIGAN' | 'IN_GAME'>('SETUP');
  const [gameState, setGameState] = useState<GameState | null>(null);

  const handleStartSetup = (selection: SetupSelection) => {
    const scenario = getScenario(selection.scenarioId) || getScenario('rhino')!;
    const { villain, mainScheme, encounterCards } = scenario.createEncounterDeck(catalog);

    // Override villain stage for Expert difficulty if selected
    if (selection.difficulty === 'expert') {
      const expertVillain = catalog.getCard(scenario.stages.expert[0]) as any;
      if (expertVillain) villain.health = expertVillain.health;
    }

    const starterDeck = getStarterDeck('spider_man_justice')!;

    const players = Array.from({ length: selection.playerCount }).map((_, index) => {
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
      players,
      villain,
      mainScheme,
      encounterCards,
    });

    setGameState(newGameState);
    setStage('MULLIGAN');
  };

  const handleConfirmMulligan = (playerId: string, discardIds: string[]) => {
    if (!gameState) return;

    const { state: nextState } = dispatchAction(gameState, {
      type: 'RESOLVE_MULLIGAN',
      playerId,
      discardCardInstanceIds: discardIds,
    });

    setGameState(nextState);

    // If all players completed mulligan, move to in-game
    if (nextState.phase === GamePhase.PLAYER_PHASE) {
      setStage('IN_GAME');
    }
  };

  const handleReset = () => {
    setGameState(null);
    setStage('SETUP');
  };

  return (
    <div className="relative min-h-screen w-full bg-comic-paper flex flex-col items-center justify-start overflow-x-hidden font-sans">
      {/* Halftone Dot Overlay */}
      <div className="fixed inset-0 bg-bendy-dots pointer-events-none z-0" />

      {/* Screen Render Switcher */}
      <div className="relative z-10 w-full">
        {stage === 'SETUP' && <ScenarioSelector onStartSetup={handleStartSetup} />}

        {stage === 'MULLIGAN' && gameState && (
          <MulliganScreen
            gameState={gameState}
            onConfirmMulligan={handleConfirmMulligan}
          />
        )}

        {stage === 'IN_GAME' && gameState && (
          <GameBoard gameState={gameState} onReset={handleReset} />
        )}
      </div>
    </div>
  );
};

export default App;
