import React, { useState, useMemo } from 'react';
import {
  Users,
  Flame,
  Zap,
  Play,
  Info,
  Trash2,
  Crown,
  Award,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Sparkles,
  Shield,
} from 'lucide-react';
import { listScenarios, listModularEncounterSets } from '../../../engine/scenarios';
import { listStarterDecks } from '../../../engine/decks';
import { CardCatalog } from '../../../data/importer/card-loader';
import { DifficultyMode, CardType, MainSchemeCard } from '../../../engine/models';
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
  selectedModularSetCodes?: string[];
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
  const modularSets = useMemo(() => listModularEncounterSets(), []);

  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('rhino');
  const [difficulty, setDifficulty] = useState<DifficultyMode>(() => defaultDifficulty || 'STANDARD');
  const [heroicLevel, setHeroicLevel] = useState<number>(() => defaultHeroicLevel || 0);

  const scenarioIndex = scenarios.findIndex((s) => s.id === selectedScenarioId);
  const currentScenarioIndex = scenarioIndex >= 0 ? scenarioIndex : 0;
  const selectedScenario = scenarios[currentScenarioIndex] || scenarios[0];

  const defaultModularForScenario = useMemo(() => {
    return selectedScenario.recommendedModularSets?.[0] || 'bomb_scare';
  }, [selectedScenario]);

  const [selectedModularSetCode, setSelectedModularSetCode] = useState<string>(() => defaultModularForScenario);

  const handleSelectScenarioByIndex = (newIndex: number) => {
    const validIndex = (newIndex + scenarios.length) % scenarios.length;
    const scen = scenarios[validIndex];
    setSelectedScenarioId(scen.id);
    if (scen.recommendedModularSets?.[0]) {
      setSelectedModularSetCode(scen.recommendedModularSets[0]);
    }
  };

  const handlePrevScenario = () => {
    handleSelectScenarioByIndex(currentScenarioIndex - 1);
  };

  const handleNextScenario = () => {
    handleSelectScenarioByIndex(currentScenarioIndex + 1);
  };

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

  const villainCode =
    difficulty === 'EXPERT' ? selectedScenario.stages.expert[0] : selectedScenario.stages.standard[0];
  const villainPreviewCard = catalog.getCard(villainCode);

  // Directly query Main Scheme Stage 1A from the catalog using type and stage metadata
  const mainSchemePreviewCard =
    (catalog
      .getCardsBySet(selectedScenario.id)
      .find(
        (c): c is MainSchemeCard =>
          c.type === CardType.MAIN_SCHEME && (c as MainSchemeCard).stage?.toUpperCase() === '1A'
      )) || catalog.getCard(selectedScenario.mainSchemeCode);

  const handleStart = () => {
    if (playerCount === 0) return;
    onStartSetup({
      scenarioId: selectedScenarioId,
      difficulty,
      heroicLevel,
      playerCount,
      deckIds: activeDecks,
      selectedModularSetCodes: [selectedModularSetCode],
    });
  };

  return (
    <div className="relative max-w-6xl w-full mx-auto my-4 p-3 md:p-6 pb-28">
      {/* Top Banner */}
      <div className="text-center mb-6 relative">
        <div className="inline-block bg-comic-yellow border-comic border-comic-black px-6 py-1.5 font-comic text-xl md:text-2xl tracking-wider text-comic-red shadow-comic transform -rotate-1 mb-2">
          MISSION CONTROL • SCENARIO SELECTION
        </div>
        <h1 className="font-comic text-4xl md:text-6xl text-comic-red tracking-wide drop-shadow-md">
          MARVEL CHAMPIONS
        </h1>
        <p className="font-comic text-lg md:text-xl text-comic-blue tracking-widest uppercase">
          Solo & Multi-Hero Comic Tabletop Setup
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 📖 COMIC BOOK STYLE CAROUSEL SPREAD */}
      {/* ========================================================================= */}
      <div className="relative mb-8">
        {/* Comic Header Bar / Issue Badge */}
        <div className="flex items-center justify-between bg-comic-black text-white px-4 py-2 rounded-t-2xl border-t-4 border-l-4 border-r-4 border-comic-black shadow-comic">
          <div className="flex items-center gap-3">
            {/* Vintage Price Box */}
            <div className="bg-comic-yellow text-comic-black font-black font-comic text-xs px-2 py-0.5 border-2 border-comic-black rounded rotate-[-2deg] shadow-comic-sm">
              12¢ • ISSUE #{currentScenarioIndex + 1}
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-comic-yellow" />
              <span className="font-comic text-lg md:text-xl text-comic-yellow tracking-wider uppercase">
                {selectedScenario.name}: {selectedScenario.subtitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Comics Code Authority Badge */}
            <div className="hidden sm:inline-flex items-center gap-1 bg-white text-comic-black border-2 border-comic-black px-2 py-0.5 rounded text-[10px] font-black uppercase font-comic">
              <Sparkles className="w-3 h-3 text-comic-blue" />
              APPROVED BY COMICS CODE
            </div>
            <span className="bg-comic-red text-white text-xs font-bold px-2.5 py-0.5 rounded-full border border-white font-comic">
              {currentScenarioIndex + 1} OF {scenarios.length}
            </span>
          </div>
        </div>

        {/* The Open Comic Book Pages */}
        <div className="relative bg-[#fffdfa] border-4 border-comic-black rounded-b-2xl shadow-comic p-4 md:p-6 overflow-hidden">
          {/* Subtle Halftone & Paper Texture Background */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Left / Right Page-Flip Buttons */}
          <button
            type="button"
            onClick={handlePrevScenario}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-30 bg-comic-yellow hover:bg-amber-300 text-comic-black border-2 border-comic-black p-2 md:p-3 rounded-full shadow-comic hover:scale-110 active:scale-95 transition-all cursor-pointer"
            title="Previous Scenario"
          >
            <ChevronLeft className="w-6 h-6 md:w-8 md:h-8 stroke-[3]" />
          </button>

          <button
            type="button"
            onClick={handleNextScenario}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-30 bg-comic-yellow hover:bg-amber-300 text-comic-black border-2 border-comic-black p-2 md:p-3 rounded-full shadow-comic hover:scale-110 active:scale-95 transition-all cursor-pointer"
            title="Next Scenario"
          >
            <ChevronRight className="w-6 h-6 md:w-8 md:h-8 stroke-[3]" />
          </button>

          {/* Two-Page Spread Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 px-4 md:px-8">
            {/* Center Spine Fold / Binding Crease */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-8 pointer-events-none z-20">
              <div className="w-full h-full bg-gradient-to-r from-transparent via-black/10 to-transparent" />
              {/* Metal Staples */}
              <div className="absolute top-12 left-1/2 -translate-x-1/2 w-1.5 h-6 bg-slate-400 rounded-sm border border-slate-600 shadow-sm" />
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-1.5 h-6 bg-slate-400 rounded-sm border border-slate-600 shadow-sm" />
            </div>

            {/* 🔴 LEFT PAGE: VILLAIN DOSSIER */}
            <div className="flex flex-col items-center justify-between space-y-4 bg-amber-50/60 p-4 rounded-xl border-2 border-comic-black/30 shadow-inner">
              <div className="w-full flex items-center justify-between border-b-2 border-comic-black pb-2">
                <div className="flex items-center gap-1.5 font-comic text-base text-comic-red font-bold uppercase tracking-wide">
                  <Flame className="w-5 h-5 text-comic-red" />
                  <span>LEFT PAGE • VILLAIN DOSSIER</span>
                </div>
                <span className="bg-comic-red text-white text-xs font-black px-2 py-0.5 rounded border border-comic-black font-comic uppercase">
                  STAGE {difficulty === 'EXPERT' ? 'II' : 'I'}
                </span>
              </div>

              {/* Villain Card Display */}
              <div className="py-2 transform transition-transform hover:scale-105 duration-200">
                {villainPreviewCard ? (
                  <CardView card={villainPreviewCard} size="md" />
                ) : (
                  <div className="w-56 h-80 bg-slate-200 border-2 border-comic-black rounded-xl flex items-center justify-center font-comic text-sm">
                    VILLAIN CARD
                  </div>
                )}
              </div>

              {/* Villain Flavor Banner */}
              <div className="w-full text-center bg-white/90 border border-comic-black rounded-lg p-2 shadow-sm">
                <div className="font-comic text-lg text-comic-black font-bold">
                  {selectedScenario.name}
                </div>
                <div className="text-xs text-comic-red font-medium">
                  {selectedScenario.subtitle}
                </div>
              </div>
            </div>

            {/* 🔵 RIGHT PAGE: MAIN SCHEME BRIEFING */}
            <div className="flex flex-col items-center justify-between space-y-4 bg-blue-50/60 p-4 rounded-xl border-2 border-comic-black/30 shadow-inner">
              <div className="w-full flex items-center justify-between border-b-2 border-comic-black pb-2">
                <div className="flex items-center gap-1.5 font-comic text-base text-comic-blue font-bold uppercase tracking-wide">
                  <Shield className="w-5 h-5 text-comic-blue" />
                  <span>RIGHT PAGE • MAIN SCHEME SETUP</span>
                </div>
                <span className="bg-comic-blue text-white text-xs font-black px-2 py-0.5 rounded border border-comic-black font-comic uppercase">
                  STAGE 1A
                </span>
              </div>

              {/* Main Scheme Card Display */}
              <div className="py-2 transform transition-transform hover:scale-105 duration-200 max-w-full">
                {mainSchemePreviewCard ? (
                  <CardView card={mainSchemePreviewCard} size="md" />
                ) : (
                  <div className="w-80 h-56 bg-slate-200 border-2 border-comic-black rounded-xl flex items-center justify-center font-comic text-sm">
                    MAIN SCHEME CARD (1A)
                  </div>
                )}
              </div>

              {/* Scheme Summary / Briefing */}
              <div className="w-full bg-white/90 border border-comic-black rounded-lg p-2.5 shadow-sm space-y-1">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  MISSION BRIEFING:
                </div>
                <p className="text-xs text-slate-700 leading-snug">
                  {selectedScenario.description}
                </p>
              </div>
            </div>
          </div>

          {/* Scenario Carousel Jump Bar (Thumbnails / Dots) */}
          <div className="flex items-center justify-center gap-2 md:gap-4 mt-6 pt-4 border-t-2 border-comic-black/20">
            {scenarios.map((scen, idx) => (
              <button
                key={scen.id}
                type="button"
                onClick={() => handleSelectScenarioByIndex(idx)}
                className={`px-3 md:px-4 py-1.5 rounded-lg border-2 font-comic text-xs md:text-sm font-bold uppercase transition-all cursor-pointer ${
                  currentScenarioIndex === idx
                    ? 'bg-comic-yellow text-comic-black border-comic-black shadow-comic-sm scale-105'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-comic-black hover:text-comic-black'
                }`}
              >
                #{idx + 1} {scen.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ⚙️ CONTROLS GRID: DIFFICULTY, ENCOUNTER CUSTOMIZATION & HERO SEATS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Difficulty & Encounter Sets */}
        <div className="lg:col-span-6 space-y-6">
          {/* Modular Encounter Set Customizer */}
          <div className="comic-panel p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b-2 border-comic-black pb-2.5">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-comic-blue" />
                <h2 className="font-comic text-2xl text-comic-black">1. Encounter Sets & Modular</h2>
              </div>
              {selectedModularSetCode !== defaultModularForScenario && (
                <button
                  type="button"
                  onClick={() => setSelectedModularSetCode(defaultModularForScenario)}
                  className="text-xs text-comic-red font-bold underline hover:text-red-700 cursor-pointer"
                >
                  Reset to Default
                </button>
              )}
            </div>

            {/* Scenario-Mandatory Encounter Sets Badges */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Scenario-Mandatory Sets:
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="bg-slate-200 border border-comic-black px-2 py-0.5 text-xs font-bold text-slate-800 rounded flex items-center gap-1">
                  <span>🔒 {selectedScenario.name} Set</span>
                  <span className="text-[10px] text-slate-500 font-normal">(Mandatory)</span>
                </span>
                <span className="bg-slate-200 border border-comic-black px-2 py-0.5 text-xs font-bold text-slate-800 rounded flex items-center gap-1">
                  <span>🔒 Standard Set</span>
                  <span className="text-[10px] text-slate-500 font-normal">(Mandatory)</span>
                </span>
                {difficulty === 'EXPERT' && (
                  <span className="bg-red-100 border border-comic-black px-2 py-0.5 text-xs font-bold text-comic-red rounded flex items-center gap-1">
                    <span>🔒 Expert Set</span>
                    <span className="text-[10px] text-slate-500 font-normal">(Mandatory)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Customizable Modular Slot (1 Slot) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Modular Encounter Slot (1 Required):
                </div>
                <span className="text-[10px] bg-amber-100 border border-comic-black px-1.5 py-0.2 rounded font-bold text-slate-800">
                  {selectedModularSetCode === defaultModularForScenario ? 'Default Recommendation' : 'Custom Modular Set'}
                </span>
              </div>

              <select
                value={selectedModularSetCode}
                onChange={(e) => setSelectedModularSetCode(e.target.value)}
                className="w-full p-2 bg-white border-2 border-comic-black rounded font-medium text-sm text-slate-800 shadow-comic-sm focus:outline-none focus:ring-2 focus:ring-comic-yellow cursor-pointer"
              >
                {modularSets.map((mod) => (
                  <option key={mod.code} value={mod.code}>
                    {mod.name} ({mod.cardCount} cards) {mod.code === defaultModularForScenario ? '— [Recommended]' : ''}
                  </option>
                ))}
              </select>

              <p className="text-[11px] text-slate-600 italic">
                {modularSets.find((m) => m.code === selectedModularSetCode)?.description}
              </p>
            </div>
          </div>

          {/* Difficulty Mode & Heroic Variant Selection (NOW PROMINENT & HIGH-VISIBILITY) */}
          <div className="comic-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-comic-black pb-2.5">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-comic-yellow" />
                <h2 className="font-comic text-2xl text-comic-black">2. Select Difficulty & Modifiers</h2>
              </div>
              <span className="bg-amber-100 border border-comic-black px-2.5 py-0.5 text-xs font-black uppercase rounded font-comic">
                MODE: {difficulty}
              </span>
            </div>

            {/* Base Difficulty Mode Buttons */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setDifficulty('SKIRMISH')}
                className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  difficulty === 'SKIRMISH'
                    ? 'border-comic-black bg-sky-300 text-comic-black shadow-comic font-black scale-105'
                    : 'border-slate-300 bg-white hover:border-comic-black hover:bg-slate-50'
                }`}
              >
                <div className="font-comic text-sm sm:text-base font-bold">SKIRMISH</div>
                <div className="text-[10px] text-slate-700 font-medium leading-tight mt-0.5">
                  Stage I Only
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDifficulty('STANDARD')}
                className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  difficulty === 'STANDARD'
                    ? 'border-comic-black bg-comic-yellow text-comic-black shadow-comic font-black scale-105'
                    : 'border-slate-300 bg-white hover:border-comic-black hover:bg-slate-50'
                }`}
              >
                <div className="font-comic text-sm sm:text-base font-bold">STANDARD</div>
                <div className="text-[10px] text-slate-700 font-medium leading-tight mt-0.5">
                  Stage I ➔ II
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDifficulty('EXPERT')}
                className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  difficulty === 'EXPERT'
                    ? 'border-comic-black bg-comic-red text-white shadow-comic font-black scale-105'
                    : 'border-slate-300 bg-white hover:border-comic-black hover:bg-slate-50'
                }`}
              >
                <div className="font-comic text-sm sm:text-base font-bold">EXPERT</div>
                <div className="text-[10px] text-slate-200 font-medium leading-tight mt-0.5">
                  Stage II ➔ III
                </div>
              </button>
            </div>

            {/* Heroic Mode Variant (Optional Rule) */}
            <div className="bg-amber-50/80 border-2 border-comic-black rounded-xl p-3.5 space-y-2 shadow-comic-sm">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-comic-red" />
                  <span className="font-comic text-sm text-comic-black uppercase font-bold">
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
          <div className="comic-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-comic-black pb-2.5">
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
                                  <span>STARTING PLAYER</span>
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
                                  type="button"
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
                              className="w-full text-xs font-medium border border-comic-black rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-comic-blue cursor-pointer"
                            >
                              {starterDecks.map((d) => {
                                const isTakenElsewhere = takenInOtherSeats.some(
                                  (t) => t.heroId === d.heroId,
                                );
                                const takenBy = takenInOtherSeats.find((t) => t.heroId === d.heroId);

                                return (
                                  <option
                                    key={d.id}
                                    value={d.id}
                                    disabled={isTakenElsewhere}
                                  >
                                    {d.heroName} ({d.aspect})
                                    {isTakenElsewhere ? ` — [🔒 Taken by Hero ${takenBy?.seatNum}]` : ''}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Empty Seat Placeholder */
                      <div className="flex items-center justify-between py-1 px-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 font-comic text-xs flex items-center justify-center font-bold border border-slate-400">
                            {index + 1}
                          </span>
                          <span className="font-comic text-sm text-slate-500">
                            Hero Seat {index + 1} (Empty)
                          </span>
                        </div>

                        {/* Add Hero Button */}
                        <div className="flex items-center gap-2">
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssignSeat(index, e.target.value);
                              }
                            }}
                            className="text-xs font-bold border-2 border-comic-black bg-comic-yellow text-comic-black rounded px-2.5 py-1 hover:bg-amber-300 cursor-pointer shadow-comic-sm"
                          >
                            <option value="" disabled>
                              + Assign Hero Deck...
                            </option>
                            {starterDecks.map((d) => {
                              const isTakenElsewhere = takenInOtherSeats.some(
                                (t) => t.heroId === d.heroId,
                              );
                              const takenBy = takenInOtherSeats.find((t) => t.heroId === d.heroId);

                              return (
                                <option
                                  key={d.id}
                                  value={d.id}
                                  disabled={isTakenElsewhere}
                                >
                                  {d.heroName} ({d.aspect})
                                  {isTakenElsewhere ? ` — [🔒 Hero ${takenBy?.seatNum}]` : ''}
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
          </div>

          {/* Action Launch Bar */}
          <div className="comic-panel p-4 bg-comic-yellow border-comic border-comic-black flex items-center justify-between gap-4 shadow-comic">
            <div>
              <div className="font-comic text-xl text-comic-red font-bold leading-tight">
                READY FOR BATTLE?
              </div>
              <div className="text-xs text-comic-black font-semibold">
                {playerCount} {playerCount === 1 ? 'Hero' : 'Heroes'} • {difficulty} Mode • {selectedScenario.name}
              </div>
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={playerCount === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl border-3 border-comic-black font-comic text-xl text-white font-black uppercase tracking-wider transition-all cursor-pointer shadow-comic hover:scale-105 active:scale-95 ${
                playerCount > 0 ? 'bg-comic-red hover:bg-red-600' : 'bg-slate-400 cursor-not-allowed'
              }`}
            >
              <Play className="w-6 h-6 fill-current" />
              <span>START MISSION</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
