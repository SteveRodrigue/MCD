import React, { useState, useMemo } from 'react';
import { Users, Flame, Zap, Play, Info, Trash2, Crown, Award } from 'lucide-react';
import { listScenarios, getScenario } from '../../../engine/scenarios';
import { listStarterDecks } from '../../../engine/decks';
import { CardCatalog } from '../../../data/importer/card-loader';
import { DifficultyMode } from '../../../engine/models';
import { useGameSettings } from '../../context/GameSettingsContext';
import corePack from '../../../../data/upstream/pack/core.json';
import coreEncounterPack from '../../../../data/upstream/pack/core_encounter.json';
import { CardView } from '../cards/CardView';

export interface SetupSelection {
  scenarioId: string;
  difficulty: DifficultyMode;
  heroicLevel: number;
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
  const { defaultDifficulty, defaultHeroicLevel } = useGameSettings();
  const [catalog] = useState(() => providedCatalog || new CardCatalog([...corePack, ...coreEncounterPack]));
  const scenarios = useMemo(() => listScenarios(), []);
  const starterDecks = useMemo(() => listStarterDecks(), []);

  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('rhino');
  const [difficulty, setDifficulty] = useState<DifficultyMode>(() => defaultDifficulty || 'STANDARD');
  const [heroicLevel, setHeroicLevel] = useState<number>(() => defaultHeroicLevel || 0);

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

  const selectedScenario = getScenario(selectedScenarioId) || getScenario('rhino')!;
  const villainCode =
    difficulty === 'EXPERT' ? selectedScenario.stages.expert[0] : selectedScenario.stages.standard[0];
  const villainPreviewCard = catalog.getCard(villainCode);
  const mainSchemeCode = selectedScenario.mainSchemeCode;
  const mainSchemePreviewCard = catalog.getCard(mainSchemeCode);

  const handleStart = () => {
    if (playerCount === 0) return;
    onStartSetup({
      scenarioId: selectedScenarioId,
      difficulty,
      heroicLevel,
      playerCount,
      deckIds: activeDecks,
    });
  };

  return (
    <div className="relative max-w-5xl w-full mx-auto my-6 p-4 md:p-6 pb-24">
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
                      STAGE {difficulty === 'EXPERT' ? 'II' : 'I'}
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
                {/* Villain Stage I/II Card */}
                {villainPreviewCard && (
                  <div className="text-center relative hover:z-50">
                    <CardView card={villainPreviewCard} size="sm" />
                    <span className="font-comic text-xs text-comic-black block mt-1">
                      VILLAIN STAGE {difficulty === 'EXPERT' ? 'II' : 'I'}
                    </span>
                  </div>
                )}

                {/* Main Scheme 1B */}
                {mainSchemePreviewCard && (
                  <div className="text-center relative hover:z-50">
                    <CardView card={mainSchemePreviewCard} size="sm" />
                    <span className="font-comic text-xs text-comic-black block mt-1">
                      MAIN SCHEME {mainSchemePreviewCard.name}
                    </span>
                  </div>
                )}
            </div>
          </div>

          {/* Difficulty Mode & Optional Heroic Variant Selection */}
          <div className="comic-panel p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-comic-black pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-comic-yellow" />
                <h2 className="font-comic text-2xl text-comic-black">2. Select Difficulty</h2>
              </div>
              <span className="bg-amber-100 border border-comic-black px-2 py-0.5 text-xs font-bold uppercase rounded">
                {difficulty}
              </span>
            </div>

            {/* Base Difficulty Modes */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setDifficulty('SKIRMISH')}
                className={`p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  difficulty === 'SKIRMISH'
                    ? 'border-comic-black bg-sky-300 text-comic-black shadow-comic font-bold'
                    : 'border-slate-300 bg-white hover:border-comic-black'
                }`}
              >
                <div className="font-comic text-sm sm:text-base">SKIRMISH</div>
                <div className="text-[10px] text-slate-700 leading-tight mt-0.5">Stage I Only</div>
              </button>

              <button
                type="button"
                onClick={() => setDifficulty('STANDARD')}
                className={`p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  difficulty === 'STANDARD'
                    ? 'border-comic-black bg-comic-yellow text-comic-black shadow-comic font-bold'
                    : 'border-slate-300 bg-white hover:border-comic-black'
                }`}
              >
                <div className="font-comic text-sm sm:text-base">STANDARD</div>
                <div className="text-[10px] text-slate-700 leading-tight mt-0.5">Stage I ➔ II</div>
              </button>

              <button
                type="button"
                onClick={() => setDifficulty('EXPERT')}
                className={`p-2.5 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  difficulty === 'EXPERT'
                    ? 'border-comic-black bg-comic-red text-white shadow-comic font-bold'
                    : 'border-slate-300 bg-white hover:border-comic-black'
                }`}
              >
                <div className="font-comic text-sm sm:text-base">EXPERT</div>
                <div className="text-[10px] text-slate-200 leading-tight mt-0.5">Stage II ➔ III</div>
              </button>
            </div>

            {/* Heroic Mode Variant (Optional Rule) */}
            <div className="bg-amber-50/80 border-2 border-comic-black rounded-xl p-3.5 space-y-2 shadow-comic-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-comic-red" />
                  <span className="font-comic text-sm text-comic-black uppercase">
                    Heroic Mode (Optional Rule)
                  </span>
                </div>

                {heroicLevel > 0 && (
                  <span
                    className={`font-comic text-[10px] px-2 py-0.5 rounded border border-comic-black font-black uppercase ${
                      difficulty === 'EXPERT'
                        ? 'bg-emerald-400 text-slate-950'
                        : 'bg-amber-300 text-slate-900'
                    }`}
                  >
                    {difficulty === 'EXPERT' ? '⭐ OFFICIAL FFG MODE' : '⚡ CUSTOM VARIANT'}
                  </span>
                )}
              </div>

              {/* Segmented Heroic Selector */}
              <div className="grid grid-cols-4 gap-1.5 bg-white rounded-lg border-2 border-comic-black p-1 shadow-comic-sm">
                {[0, 1, 2, 3].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setHeroicLevel(lvl)}
                    className={`py-1 text-center font-comic text-xs uppercase rounded transition-all cursor-pointer font-bold ${
                      heroicLevel === lvl
                        ? 'bg-comic-red text-white border border-comic-black shadow-comic-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {lvl === 0 ? 'Off (0)' : `Heroic ${lvl} (+${lvl})`}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                {heroicLevel === 0
                  ? 'Standard encounter dealing: 1 encounter card dealt per player during Step 4.'
                  : `Heroic ${heroicLevel} active: Deals ${1 + heroicLevel} encounter cards (+${heroicLevel} extra) to each player during Step 4.`}
              </p>
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
              Assign heroes to the seat slots below. <span className="font-bold text-comic-black">Hero Seat 1 is designated as the Starting Player</span> (holds the First Player Token in Round 1 per RR v1.8 Step 12).
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="w-5 h-5 rounded-full bg-comic-red text-white font-comic text-xs flex items-center justify-center font-bold border border-comic-black">
                                {index + 1}
                              </span>
                              <span className="font-comic text-base text-comic-black font-bold truncate">
                                {deckDef.heroName}
                              </span>
                              {index === 0 && (
                                <span className="bg-comic-yellow text-comic-black font-comic text-[10px] px-2 py-0.5 rounded border border-comic-black font-bold uppercase flex items-center gap-1 shadow-comic-sm">
                                  <Crown className="w-3 h-3 text-comic-red" />
                                  <span>STARTING PLAYER (ROUND 1)</span>
                                </span>
                              )}
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 font-comic text-xs flex items-center justify-center font-bold border border-slate-400">
                            {index + 1}
                          </span>
                          <span className="font-comic text-sm text-slate-600 font-bold">
                            Hero Seat {index + 1} (Empty)
                          </span>
                          {index === 0 && (
                            <span className="bg-amber-100 text-amber-900 font-comic text-[10px] px-2 py-0.5 rounded border border-comic-black font-bold uppercase flex items-center gap-1">
                              <Crown className="w-3 h-3 text-amber-700" />
                              <span>STARTING PLAYER</span>
                            </span>
                          )}
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
                  {(difficulty === 'EXPERT' ? 15 : 14) * Math.max(1, playerCount)} HP
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
