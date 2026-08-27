import React, { useState, useMemo } from 'react';
import { Users, Flame, Zap, Play, Info, Trash2 } from 'lucide-react';
import { listScenarios } from '../../../engine/scenarios';
import { listStarterDecks } from '../../../engine/decks';
import { CardCatalog } from '../../../data/importer/card-loader';
import corePack from '../../../../data/upstream/pack/core.json';
import coreEncounterPack from '../../../../data/upstream/pack/core_encounter.json';
import { CardView } from '../cards/CardView';

export interface SetupSelection {
  scenarioId: string;
  difficulty: 'standard' | 'expert';
  playerCount: number;
  deckIds: string[];
}

interface ScenarioSelectorProps {
  catalog?: CardCatalog;
  onStartSetup: (selection: SetupSelection) => void;
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  catalog: providedCatalog,
  onStartSetup,
}) => {
  const catalog = useMemo(
    () => providedCatalog || new CardCatalog([...corePack, ...coreEncounterPack]),
    [providedCatalog],
  );

  const scenarios = listScenarios();
  const starterDecks = listStarterDecks();

  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(scenarios[0]?.id || 'rhino');
  const [difficulty, setDifficulty] = useState<'standard' | 'expert'>('standard');

  // 4 discrete hero seat slots (null = empty seat)
  const [seats, setSeats] = useState<(string | null)[]>([
    starterDecks[0]?.id || 'spider_man_justice',
    null,
    null,
    null,
  ]);

  const activeDecks = seats.filter((deckId): deckId is string => Boolean(deckId));
  const playerCount = activeDecks.length;

  const handleAssignSeat = (seatIndex: number, deckId: string | null) => {
    setSeats((prev) => {
      const next = [...prev];
      next[seatIndex] = deckId;
      return next;
    });
  };

  const handleStart = () => {
    if (playerCount === 0) return;
    onStartSetup({
      scenarioId: selectedScenarioId,
      difficulty,
      playerCount,
      deckIds: activeDecks,
    });
  };

  return (
    <div className="relative max-w-5xl w-full mx-auto my-6 p-4 md:p-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scenario & Difficulty */}
        <div className="lg:col-span-6 space-y-6">
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
                <div className="text-center relative hover:z-50">
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
                <div className="text-center relative hover:z-50">
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
                className={`p-3 rounded border-2 text-center transition-all cursor-pointer ${
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
                className={`p-3 rounded border-2 text-center transition-all cursor-pointer ${
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

        {/* Right Column: 4 Hero Seats (Solo Mode) */}
        <div className="lg:col-span-6 space-y-6 flex flex-col justify-between">
          <div className="comic-panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-comic-black pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-comic-blue" />
                <h2 className="font-comic text-2xl text-comic-black">3. Hero Seats (1 to 4)</h2>
              </div>
              <span className="bg-comic-blue text-white font-comic text-xs px-2.5 py-1 rounded-full border border-comic-black font-bold">
                {playerCount} {playerCount === 1 ? 'HERO ASSIGNED' : 'HEROES ASSIGNED'}
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Assign heroes to any of the 4 seat slots below. The game scales automatically to the
              number of assigned heroes.
            </p>

            {/* The 4 Hero Seat Slots */}
            <div className="space-y-3 pt-1">
              {seats.map((deckId, index) => {
                const isAssigned = Boolean(deckId);
                const deckDef = isAssigned
                  ? starterDecks.find((d) => d.id === deckId) || starterDecks[0]
                  : null;
                const heroCard =
                  deckDef && catalog ? catalog.getCard(deckDef.rawDeck.hero_code) : undefined;

                // Find heroes taken in OTHER seats to enforce RR v1.8 unicity
                const takenInOtherSeats = seats
                  .map((otherDeckId, otherIdx) => {
                    if (otherIdx === index || !otherDeckId) return null;
                    const otherDeck = starterDecks.find((d) => d.id === otherDeckId);
                    return otherDeck
                      ? { heroId: otherDeck.heroId, heroName: otherDeck.heroName, seatNum: otherIdx + 1 }
                      : null;
                  })
                  .filter(Boolean) as { heroId: string; heroName: string; seatNum: number }[];

                return (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border-2 transition-all relative hover:z-40 ${
                      isAssigned
                        ? 'bg-amber-50/80 border-comic-black shadow-comic-sm'
                        : 'bg-slate-50 border-dashed border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {isAssigned && deckDef ? (
                      /* Occupied Seat Card Tile */
                      <div className="flex items-start gap-3">
                        {/* Hero Card Miniature Thumbnail (Hero Form) */}
                        <div className="shrink-0 relative z-10 hover:z-50">
                          {heroCard ? (
                            <CardView card={heroCard} size="sm" />
                          ) : (
                            <div className="w-28 h-40 bg-slate-200 border-2 border-comic-black rounded-xl flex items-center justify-center font-comic text-xs">
                              HERO CARD
                            </div>
                          )}
                        </div>

                        {/* Seat Info & Controls */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-comic-red text-white font-comic text-xs flex items-center justify-center font-bold border border-comic-black">
                                {index + 1}
                              </span>
                              <span className="font-comic text-base text-comic-black font-bold truncate">
                                {deckDef.heroName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="bg-comic-blue text-white font-comic text-[10px] px-2 py-0.5 rounded border border-comic-black font-bold uppercase">
                                {deckDef.aspect}
                              </span>
                              {/* Remove button (if more than 1 seat assigned) */}
                              {playerCount > 1 && (
                                <button
                                  onClick={() => handleAssignSeat(index, null)}
                                  className="text-slate-400 hover:text-comic-red p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Vacate this hero seat"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Deck Switcher Dropdown */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-0.5">
                              Change Deck:
                            </label>
                            <select
                              value={deckId || ''}
                              onChange={(e) => handleAssignSeat(index, e.target.value)}
                              className="w-full p-1.5 bg-white border border-comic-black rounded font-comic text-xs text-slate-900 shadow-comic-sm focus:outline-none cursor-pointer"
                            >
                              {starterDecks.map((deck) => {
                                const conflict = takenInOtherSeats.find(
                                  (t) => t.heroId === deck.heroId,
                                );
                                const isTaken = Boolean(conflict);

                                return (
                                  <option
                                    key={deck.id}
                                    value={deck.id}
                                    disabled={isTaken}
                                    className={isTaken ? 'text-slate-400 bg-slate-100' : ''}
                                  >
                                    {deck.heroName} ({deck.aspect} Starter • 40 Cards)
                                    {isTaken ? ` — (Taken in Seat ${conflict!.seatNum})` : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Empty Seat Tile */
                      <div className="py-2 px-1 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 font-comic text-xs flex items-center justify-center font-bold border border-slate-400">
                            {index + 1}
                          </span>
                          <span className="font-comic text-sm text-slate-600 font-bold">
                            Hero Seat {index + 1} (Empty)
                          </span>
                        </div>

                        {/* Quick Assign Dropdown */}
                        <div className="w-full sm:w-64">
                          <select
                            value=""
                            onChange={(e) => handleAssignSeat(index, e.target.value)}
                            className="w-full p-1.5 bg-white border-2 border-comic-black hover:bg-amber-50 rounded font-comic text-xs text-comic-blue font-bold shadow-comic-sm cursor-pointer"
                          >
                            <option value="" disabled>
                              + Assign Hero to Seat {index + 1}...
                            </option>
                            {starterDecks.map((deck) => {
                              const conflict = takenInOtherSeats.find(
                                (t) => t.heroId === deck.heroId,
                              );
                              const isTaken = Boolean(conflict);

                              return (
                                <option
                                  key={deck.id}
                                  value={deck.id}
                                  disabled={isTaken}
                                  className={isTaken ? 'text-slate-400 bg-slate-100' : ''}
                                >
                                  {deck.heroName} ({deck.aspect} Starter)
                                  {isTaken ? ` — (Taken in Seat ${conflict!.seatNum})` : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary Stat Box */}
            <div className="bg-slate-100 p-3 rounded border border-comic-black text-xs space-y-1 mt-4">
              <div className="flex justify-between">
                <span className="text-slate-600">Assigned Heroes:</span>
                <span className="font-bold text-slate-900">{playerCount} Player(s)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Villain HP:</span>
                <span className="font-bold text-comic-red">
                  {(difficulty === 'standard' ? 14 : 15) * Math.max(1, playerCount)} HP
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Scheme Target Limit:</span>
                <span className="font-bold text-comic-blue">
                  {7 * Math.max(1, playerCount)} Threat
                </span>
              </div>
            </div>
          </div>

          {/* Big Start Action Button */}
          <button
            disabled={playerCount === 0}
            onClick={handleStart}
            className={`w-full py-4 px-6 border-comic border-comic-black font-comic text-2xl tracking-wider shadow-comic transition-all flex items-center justify-center gap-3 group ${
              playerCount > 0
                ? 'bg-comic-yellow text-comic-red hover:bg-amber-300 active:translate-x-1 active:translate-y-1 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Play
              className={`w-7 h-7 ${
                playerCount > 0
                  ? 'text-comic-red fill-comic-red group-hover:scale-110'
                  : 'text-slate-400 fill-slate-400'
              } transition-transform`}
            />
            <span>
              {playerCount === 0
                ? 'ASSIGN AT LEAST 1 HERO TO PLAY!'
                : `ASSEMBLE ${playerCount} HERO${playerCount > 1 ? 'ES' : ''} & DRAW HANDS!`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScenarioSelector;
