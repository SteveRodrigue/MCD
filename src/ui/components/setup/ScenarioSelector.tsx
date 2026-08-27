import React, { useState } from 'react';
import { Shield, Users, Flame, Zap, Play, Info } from 'lucide-react';
import { listScenarios } from '../../../engine/scenarios';
import { listStarterDecks } from '../../../engine/decks';
import { CardView } from '../cards/CardView';

export interface SetupSelection {
  scenarioId: string;
  difficulty: 'standard' | 'expert';
  playerCount: number;
  deckIds: string[];
}

interface ScenarioSelectorProps {
  onStartSetup: (selection: SetupSelection) => void;
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({ onStartSetup }) => {
  const scenarios = listScenarios();
  const starterDecks = listStarterDecks();

  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(scenarios[0]?.id || 'rhino');
  const [difficulty, setDifficulty] = useState<'standard' | 'expert'>('standard');
  const [playerCount, setPlayerCount] = useState<number>(1);
  const [selectedDeckIds] = useState<string[]>([
    starterDecks[0]?.id || 'spider_man_justice',
    starterDecks[0]?.id || 'spider_man_justice',
    starterDecks[0]?.id || 'spider_man_justice',
    starterDecks[0]?.id || 'spider_man_justice',
  ]);

  const handleStart = () => {
    onStartSetup({
      scenarioId: selectedScenarioId,
      difficulty,
      playerCount,
      deckIds: selectedDeckIds.slice(0, playerCount),
    });
  };

  return (
    <div className="relative max-w-4xl w-full mx-auto my-6 p-6">
      {/* Top Banner */}
      <div className="text-center mb-8 relative">
        <div className="inline-block bg-comic-yellow border-comic border-comic-black px-6 py-2 font-comic text-2xl tracking-wider text-comic-red shadow-comic transform -rotate-1 mb-2">
          MISSION CONTROL • SCENARIO SELECTION
        </div>
        <h1 className="font-comic text-5xl md:text-6xl text-comic-red tracking-wide drop-shadow-md">
          MARVEL CHAMPIONS
        </h1>
        <p className="font-comic text-xl text-comic-blue tracking-widest uppercase">
          Solo & Multi-Hero Setup Phase
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Scenario & Difficulty */}
        <div className="md:col-span-7 space-y-6">
          {/* Scenario Card Panel */}
          <div className="comic-panel p-6 relative">
            <div className="flex items-center justify-between border-b-2 border-comic-black pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-6 h-6 text-comic-red" />
                <h2 className="font-comic text-2xl text-comic-black">1. Choose Scenario</h2>
              </div>
              <span className="bg-amber-100 border border-comic-black px-2 py-0.5 text-xs font-bold uppercase rounded">
                Core Set
              </span>
            </div>

            <div className="space-y-3">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  onClick={() => setSelectedScenarioId(scenario.id)}
                  className={`w-full text-left p-4 rounded border-2 transition-all ${
                    selectedScenarioId === scenario.id
                      ? 'border-comic-black bg-amber-50 shadow-comic'
                      : 'border-slate-300 bg-white hover:border-comic-black'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-comic text-2xl text-comic-black tracking-wide">
                        {scenario.name}
                      </h3>
                      <p className="font-medium text-sm text-comic-red">{scenario.subtitle}</p>
                    </div>
                    <span className="bg-slate-900 text-white font-bold text-xs px-2 py-1 rounded">
                      STAGE {difficulty === 'standard' ? 'I' : 'II'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                    {scenario.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Modular Set Info */}
            <div className="mt-4 p-3 bg-sky-50 border border-comic-black rounded text-xs flex items-start gap-2">
              <Info className="w-4 h-4 text-comic-blue shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-comic-blue uppercase">Recommended Modular: </span>
                <span className="font-semibold">Bomb Scare</span> (Included in encounter deck)
              </div>
            </div>

            {/* Scenario Card Art Previews */}
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Scenario Preview:
              </div>
              <div className="flex items-center justify-center gap-4">
                {/* Villain Stage I/II Card */}
                <div className="text-center">
                  <CardView
                    card={
                      {
                        code: difficulty === 'standard' ? '01094' : '01095',
                        name: `Rhino (Stage ${difficulty === 'standard' ? 'I' : 'II'})`,
                        type: 'villain' as any,
                        faction: 'encounter' as any,
                        packCode: 'core',
                        position: 94,
                        quantity: 1,
                        deckLimit: 1,
                        isUnique: true,
                        text: 'Rhino charges through the facility!',
                        traits: ['Brute.', 'Criminal.'],
                        resources: { physical: 0, energy: 0, mental: 0, wild: 0, total: 0 },
                        boostIcons: 0,
                        boostStar: false,
                        errata: undefined,
                        isLandscape: false,
                        orientation: 'portrait',
                        raw: {} as any,
                      }
                    }
                    size="sm"
                  />
                  <span className="font-comic text-xs text-comic-black block mt-1">
                    VILLAIN STAGE {difficulty === 'standard' ? 'I' : 'II'}
                  </span>
                </div>

                {/* Main Scheme 1B */}
                <div className="text-center">
                  <CardView
                    card={
                      {
                        code: '01097b',
                        name: 'The Break-In! (1B)',
                        type: 'main_scheme' as any,
                        faction: 'encounter' as any,
                        packCode: 'core',
                        position: 97,
                        quantity: 1,
                        deckLimit: 1,
                        isUnique: false,
                        text: 'If 7 threat per player is on this scheme, the players lose the game.',
                        traits: [],
                        resources: { physical: 0, energy: 0, mental: 0, wild: 0, total: 0 },
                        boostIcons: 0,
                        boostStar: false,
                        errata: undefined,
                        isLandscape: true,
                        orientation: 'landscape',
                        raw: {} as any,
                      }
                    }
                    size="sm"
                  />
                  <span className="font-comic text-xs text-comic-black block mt-1">
                    MAIN SCHEME 1B
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Difficulty Mode Selection */}
          <div className="comic-panel p-6">
            <div className="flex items-center gap-2 border-b-2 border-comic-black pb-3 mb-4">
              <Zap className="w-5 h-5 text-comic-yellow" />
              <h2 className="font-comic text-2xl text-comic-black">2. Select Difficulty</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setDifficulty('standard')}
                className={`p-3 rounded border-2 text-center transition-all ${
                  difficulty === 'standard'
                    ? 'border-comic-black bg-comic-yellow text-comic-black shadow-comic font-bold'
                    : 'border-slate-300 bg-white hover:border-comic-black'
                }`}
              >
                <div className="font-comic text-lg">STANDARD</div>
                <div className="text-xs text-slate-700">Stage I (14 HP / Hero)</div>
              </button>
              <button
                onClick={() => setDifficulty('expert')}
                className={`p-3 rounded border-2 text-center transition-all ${
                  difficulty === 'expert'
                    ? 'border-comic-black bg-comic-red text-white shadow-comic font-bold'
                    : 'border-slate-300 bg-white hover:border-comic-black'
                }`}
              >
                <div className="font-comic text-lg">EXPERT</div>
                <div className="text-xs text-slate-200">Stage II (15 HP / Hero)</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Hero Solo Configuration */}
        <div className="md:col-span-5 space-y-6 flex flex-col justify-between">
          <div className="comic-panel p-6 space-y-5">
            <div className="flex items-center gap-2 border-b-2 border-comic-black pb-3">
              <Users className="w-6 h-6 text-comic-blue" />
              <h2 className="font-comic text-2xl text-comic-black">3. Hero Seats (Solo Mode)</h2>
            </div>

            <p className="text-xs text-slate-600">
              Control 1 to 4 heroes simultaneously in Solo mode. Villain HP and scheme target threat
              scale automatically with hero count.
            </p>

            {/* Player Count Radio Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  onClick={() => setPlayerCount(count)}
                  className={`py-2 px-1 rounded border-2 text-center font-comic text-lg transition-all ${
                    playerCount === count
                      ? 'border-comic-black bg-comic-blue text-white shadow-comic'
                      : 'border-slate-300 bg-white hover:border-comic-black'
                  }`}
                >
                  {count} {count === 1 ? 'HERO' : 'HEROES'}
                </button>
              ))}
            </div>

            {/* Hero Seat Lists */}
            <div className="space-y-3 pt-2">
              {Array.from({ length: playerCount }).map((_, index) => (
                <div
                  key={index}
                  className="p-3 bg-amber-50/60 border border-comic-black rounded flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-comic-red text-white font-comic text-sm flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-comic-black">Spider-Man</div>
                      <div className="text-xs text-slate-500 font-medium">Justice Starter (40 Cards)</div>
                    </div>
                  </div>
                  <Shield className="w-5 h-5 text-comic-blue" />
                </div>
              ))}
            </div>

            {/* Summary Stat Box */}
            <div className="bg-slate-100 p-3 rounded border border-comic-black text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Villain HP:</span>
                <span className="font-bold text-comic-red">
                  {(difficulty === 'standard' ? 14 : 15) * playerCount} HP
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Scheme Target Limit:</span>
                <span className="font-bold text-comic-blue">{7 * playerCount} Threat</span>
              </div>
            </div>
          </div>

          {/* Big Start Action Button */}
          <button
            onClick={handleStart}
            className="w-full py-4 px-6 bg-comic-yellow border-comic border-comic-black font-comic text-2xl text-comic-red tracking-wider shadow-comic hover:bg-amber-300 active:translate-x-1 active:translate-y-1 transition-all flex items-center justify-center gap-3 group"
          >
            <Play className="w-7 h-7 text-comic-red fill-comic-red group-hover:scale-110 transition-transform" />
            <span>ASSEMBLE SCENARIO & DRAW HANDS!</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScenarioSelector;
