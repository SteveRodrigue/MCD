import React, { useState } from 'react';
import { Shield, RefreshCw, Skull, FileText } from 'lucide-react';
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
    <div className="relative min-h-screen w-full bg-comic-paper flex flex-col items-center justify-start p-4 md:p-6 overflow-x-hidden font-sans">
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
          <div className="max-w-5xl mx-auto my-6 space-y-6">
            {/* Top Navigation & Status Bar */}
            <div className="comic-panel p-4 flex items-center justify-between bg-amber-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-comic-red text-white flex items-center justify-center font-comic text-xl">
                  R{gameState.roundNumber}
                </div>
                <div>
                  <h2 className="font-comic text-2xl text-comic-black leading-tight">
                    ROUND {gameState.roundNumber} • {gameState.phase}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Active Player: {gameState.players[gameState.activePlayerIndex]?.name}
                  </p>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="px-4 py-2 bg-white border-2 border-comic-black font-comic text-sm rounded shadow-comic-sm hover:bg-rose-50 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>NEW SCENARIO</span>
              </button>
            </div>

            {/* In-Game Overview Board */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Villain & Main Scheme Panel */}
              <div className="md:col-span-6 comic-panel p-6 space-y-4">
                <div className="flex items-center justify-between border-b-2 border-comic-black pb-2">
                  <div className="flex items-center gap-2">
                    <Skull className="w-6 h-6 text-comic-red" />
                    <h3 className="font-comic text-2xl text-comic-black">
                      {gameState.villain.card.name}
                    </h3>
                  </div>
                  <span className="font-comic text-2xl text-comic-red">
                    {gameState.villain.health} / {gameState.villain.maxHealth} HP
                  </span>
                </div>

                <div className="p-3 bg-rose-50 border border-comic-black rounded space-y-1">
                  <div className="flex justify-between text-sm font-bold">
                    <span>Main Scheme: {gameState.mainScheme.card.name}</span>
                    <span className="text-comic-blue font-comic text-lg">
                      {gameState.mainScheme.threat} / {gameState.mainScheme.targetThreat} THREAT
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden border border-comic-black">
                    <div
                      className="bg-comic-red h-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (gameState.mainScheme.threat / gameState.mainScheme.targetThreat) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div>Encounter Deck: {gameState.encounterDeck.length} cards</div>
                  <div>Encounter Discard: {gameState.encounterDiscard.length} cards</div>
                </div>
              </div>

              {/* Heroes Summary Panel */}
              <div className="md:col-span-6 space-y-4">
                {gameState.players.map((p) => (
                  <div key={p.id} className="comic-panel p-6 space-y-3">
                    <div className="flex items-center justify-between border-b-2 border-comic-black pb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-6 h-6 text-comic-blue" />
                        <div>
                          <h3 className="font-comic text-2xl text-comic-black leading-tight">
                            {p.name}
                          </h3>
                          <span className="bg-amber-100 border border-comic-black px-2 py-0.5 text-[10px] font-bold uppercase rounded">
                            {p.currentForm.toUpperCase()} ({p.activeFormCard.name})
                          </span>
                        </div>
                      </div>
                      <span className="font-comic text-2xl text-comic-blue">
                        {p.health} / {p.maxHealth} HP
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 space-y-1">
                      <div>Hand: {p.hand.length} cards</div>
                      <div>Deck: {p.deck.length} cards remaining</div>
                      <div>Discard: {p.discard.length} cards</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action History & Event Log Panel */}
            <div className="comic-panel p-6">
              <div className="flex items-center gap-2 border-b-2 border-comic-black pb-3 mb-4">
                <FileText className="w-5 h-5 text-comic-black" />
                <h3 className="font-comic text-2xl text-comic-black">Action History & Combat Log</h3>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 text-xs font-mono bg-slate-900 text-emerald-400 p-4 rounded border border-comic-black">
                {gameState.log.map((entry, idx) => (
                  <div key={idx} className="leading-relaxed">
                    <span className="text-slate-500">[{idx + 1}]</span>{' '}
                    <span className="text-comic-yellow font-bold">
                      {entry.onomatopoeia ? `[${entry.onomatopoeia}]` : ''}
                    </span>{' '}
                    <span className="text-white">{entry.key}</span>{' '}
                    <span className="text-slate-400">
                      {entry.params ? JSON.stringify(entry.params) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
