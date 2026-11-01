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
  Palette,
} from 'lucide-react';
import { ScenarioRegistry, listModularEncounterSets } from '../../../engine/scenarios';
import { listStarterDecks } from '../../../engine/decks';
import { cardCatalog as catalog } from '../../../data/importer/card-loader';
import { getLoadedContent } from '../../../data/content/store';
import { FailedPacksNotice } from './FailedPacksNotice';
import { DifficultyMode, CardType, MainSchemeCard } from '../../../engine/models';
import { useGameSettings } from '../../context/useGameSettings';
import { getModalStyle } from '../../theme/modal-styles';
import { ThemePicker } from '../../theme/ThemePicker';
import { ThemedButton, ToneButton } from '../../theme/kit/controls';
import { useModalStyle } from '../../theme/useModalStyle';
import { useThemeExtras } from '../../theme/useThemeExtras';
import { CardView } from '../cards/CardView';

export const RANDOM_MODULAR_SET_CODE = 'random';

export interface SetupSelection {
  scenarioId: string;
  difficulty: DifficultyMode;
  heroicLevel: number;
  playerCount: number;
  deckIds: string[];
  selectedModularSetCodes?: string[];
}

interface ScenarioSelectorProps {
  onStartSetup: (selection: SetupSelection) => void;
  onOpenContent: () => void;
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  onStartSetup,
  onOpenContent,
}) => {
  const { style } = useModalStyle();
  const { field } = useThemeExtras();
  const { settings, defaultDifficulty, defaultHeroicLevel } = useGameSettings();
  const scenarios = useMemo(() => ScenarioRegistry.getAll().map((p) => p.definition), []);
  const lockedScenarios = useMemo(
    () =>
      getLoadedContent().descriptions.flatMap((pack) =>
        pack.lockedScenarios.map((scenario) => ({ ...scenario, packName: pack.name })),
      ),
    [],
  );
  const starterDecks = useMemo(() => listStarterDecks(), []);
  const modularSets = useMemo(() => listModularEncounterSets(catalog), []);

  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(() => scenarios[0].id);
  const [difficulty, setDifficulty] = useState<DifficultyMode>(
    () => defaultDifficulty || 'STANDARD',
  );
  const [heroicLevel, setHeroicLevel] = useState<number>(() => defaultHeroicLevel || 0);

  const scenarioIndex = scenarios.findIndex((s) => s.id === selectedScenarioId);
  const currentScenarioIndex = scenarioIndex >= 0 ? scenarioIndex : 0;
  const selectedScenario = scenarios[currentScenarioIndex] || scenarios[0];

  const defaultModularForScenario = useMemo(() => {
    return selectedScenario.modularEncounterSets.recommendedModularSets?.[0] || 'bomb_scare';
  }, [selectedScenario]);

  const [selectedModularSetCode, setSelectedModularSetCode] = useState<string>(
    () => defaultModularForScenario,
  );
  const [excludeRecommendedFromRandom, setExcludeRecommendedFromRandom] = useState<boolean>(true);

  const handleSelectScenarioByIndex = (newIndex: number) => {
    const validIndex = (newIndex + scenarios.length) % scenarios.length;
    const scen = scenarios[validIndex];
    setSelectedScenarioId(scen.id);
    const recommended = scen.modularEncounterSets.recommendedModularSets?.[0];
    if (recommended) {
      setSelectedModularSetCode(recommended);
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

  const villainStages =
    selectedScenario.villainSetup.stages[difficulty] ||
    selectedScenario.villainSetup.stages.STANDARD;
  const villainPreviewCard = catalog.getCard(villainStages[0]);

  // Directly query Main Scheme Stage 1A from the catalog using type and stage metadata
  const mainSchemePreviewCard =
    catalog
      .getCardsBySet(selectedScenario.id)
      .find(
        (c): c is MainSchemeCard =>
          c.type === CardType.MAIN_SCHEME && (c as MainSchemeCard).stage?.toUpperCase() === '1A',
      ) || catalog.getCard(selectedScenario.mainSchemeSetup.stages[0]);
  const scenarioSubtitle = mainSchemePreviewCard?.name;

  const handleStart = () => {
    if (playerCount === 0) return;

    let resolvedModularCode = selectedModularSetCode;
    if (resolvedModularCode === RANDOM_MODULAR_SET_CODE) {
      const candidates = excludeRecommendedFromRandom
        ? modularSets.filter((m) => m.code !== defaultModularForScenario)
        : modularSets;
      const pool = candidates.length > 0 ? candidates : modularSets;
      const randomIndex = Math.floor(Math.random() * pool.length);
      resolvedModularCode = pool[randomIndex]?.code || defaultModularForScenario;
    }

    onStartSetup({
      scenarioId: selectedScenarioId,
      difficulty,
      heroicLevel,
      playerCount,
      deckIds: activeDecks,
      selectedModularSetCodes: [resolvedModularCode],
    });
  };

  return (
    <div className="relative max-w-6xl w-full mx-auto my-4 p-3 md:p-6 pb-28">
      {/* Top Banner */}
      <div className="text-center mb-6 relative">
        <div className="inline-block bg-comic-yellow border-comic border-comic-black px-6 py-1.5 font-bangers text-xl md:text-2xl tracking-wider text-comic-red shadow-comic transform -rotate-1 mb-2">
          MISSION CONTROL • SCENARIO SELECTION
        </div>
        <h1 className="font-bangers text-4xl md:text-6xl text-comic-red tracking-wide drop-shadow-md">
          MARVEL CHAMPIONS
        </h1>
        <p className="font-bangers text-lg md:text-xl text-comic-blue tracking-widest uppercase">
          Solo & Multi-Hero Comic Tabletop Setup
        </p>
        <div className="mt-2 flex flex-col items-center gap-2">
          <ThemedButton variant="secondary" onClick={onOpenContent}>
            Content
          </ThemedButton>
          <FailedPacksNotice />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📖 COMIC BOOK STYLE CAROUSEL SPREAD */}
      {/* ========================================================================= */}
      <div className="relative mb-8">
        {/* Comic Header Bar / Issue Badge */}
        <div
          className={`flex items-center justify-between px-4 py-2 rounded-b-none! rotate-0! ${style.chip}`}
        >
          <div className="flex items-center gap-3">
            {/* Vintage Price Box */}
            <div
              className={`bg-comic-yellow text-comic-black font-black text-xs px-2 py-0.5 -rotate-2 ${style.buttonShape}`}
            >
              12¢ • ISSUE #{currentScenarioIndex + 1}
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              <span className="font-comic text-lg md:text-xl tracking-wider uppercase">
                {selectedScenario.name}: {scenarioSubtitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Comics Code Authority Badge */}
            <div
              className={`hidden sm:inline-flex items-center gap-1 bg-slate-50 text-comic-black px-2 py-0.5 text-micro font-black uppercase ${style.badge}`}
            >
              <Sparkles className="w-3 h-3 text-comic-blue" />
              APPROVED BY COMICS CODE
            </div>
            <span className="bg-comic-red text-white text-xs font-bold px-2.5 py-0.5 rounded-full border border-white">
              {currentScenarioIndex + 1} OF {scenarios.length}
            </span>
          </div>
        </div>

        {/* The Open Comic Book Pages */}
        <div
          className={`relative p-4 md:p-6 overflow-hidden rounded-t-none! ${style.panel} ${style.text}`}
        >
          {/* Subtle Halftone & Paper Texture Background */}
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] bg-size-[16px_16px]" />

          {/* Left / Right Page-Flip Buttons */}
          {/* The wrapper centres the button, so the button's own press transform stays free. It sits at a
              fixed offset beside the cards: centred on the panel it moved with each scenario's text height (#390). */}
          {(['prev', 'next'] as const).map((direction) => {
            const Arrow = direction === 'prev' ? ChevronLeft : ChevronRight;
            return (
              <div
                key={direction}
                className={`absolute ${direction === 'prev' ? 'left-2' : 'right-2'} top-72 -translate-y-1/2 z-zoom pointer-events-none`}
              >
                <button
                  type="button"
                  onClick={direction === 'prev' ? handlePrevScenario : handleNextScenario}
                  className={`block p-2 md:p-3 pointer-events-auto transition-all cursor-pointer ${style.btnGo} rounded-full!`}
                  title={direction === 'prev' ? 'Previous Scenario' : 'Next Scenario'}
                >
                  <Arrow className="w-6 h-6 md:w-8 md:h-8 stroke-3" />
                </button>
              </div>
            );
          })}

          {/* Two-Page Spread Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-content px-4 md:px-8">
            {/* Center Spine Fold / Binding Crease */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-8 pointer-events-none z-raised">
              <div className="w-full h-full bg-linear-to-r from-transparent via-black/10 to-transparent" />
              {/* Metal Staples */}
              <div className="absolute top-12 left-1/2 -translate-x-1/2 w-1.5 h-6 bg-slate-400 rounded-xs border border-slate-600 shadow-xs" />
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-1.5 h-6 bg-slate-400 rounded-xs border border-slate-600 shadow-xs" />
            </div>

            {/* 🔴 LEFT PAGE: VILLAIN DOSSIER */}
            <div
              className={`flex flex-col items-center justify-between space-y-4 p-4 ${style.inset}`}
            >
              <div className="w-full flex items-center justify-between border-b-2 border-current/30 pb-2">
                <div
                  className={`flex items-center gap-1.5 font-comic text-base font-bold uppercase tracking-wide ${style.emphasis}`}
                >
                  <Flame className="w-5 h-5 text-comic-red" />
                  <span>LEFT PAGE • VILLAIN DOSSIER</span>
                </div>
                <span
                  className={`bg-comic-red text-white text-xs font-black px-2 py-0.5 uppercase ${style.badge}`}
                >
                  STAGE {difficulty === 'EXPERT' ? 'II' : 'I'}
                </span>
              </div>

              {/* Villain Card Display */}
              <div className="py-2 transform transition-transform hover:scale-105 duration-200">
                {villainPreviewCard ? (
                  <CardView card={villainPreviewCard} size="md" />
                ) : (
                  <div
                    className={`w-56 h-80 flex items-center justify-center text-sm ${style.inset}`}
                  >
                    VILLAIN CARD
                  </div>
                )}
              </div>

              {/* Villain Flavor Banner */}
              <div className={`w-full text-center p-2 ${style.panel}`}>
                <div className="font-comic text-lg font-bold">{selectedScenario.name}</div>
                <div className={`text-xs font-medium ${style.emphasis}`}>{scenarioSubtitle}</div>
              </div>
            </div>

            {/* 🔵 RIGHT PAGE: MAIN SCHEME BRIEFING */}
            <div
              className={`flex flex-col items-center justify-between space-y-4 p-4 ${style.inset}`}
            >
              <div className="w-full flex items-center justify-between border-b-2 border-current/30 pb-2">
                <div
                  className={`flex items-center gap-1.5 font-comic text-base font-bold uppercase tracking-wide ${style.emphasis}`}
                >
                  <Shield className="w-5 h-5 text-comic-blue" />
                  <span>RIGHT PAGE • MAIN SCHEME SETUP</span>
                </div>
                <span
                  className={`bg-comic-blue text-white text-xs font-black px-2 py-0.5 uppercase ${style.badge}`}
                >
                  STAGE 1A
                </span>
              </div>

              {/* Main Scheme Card Display */}
              <div className="py-2 transform transition-transform hover:scale-105 duration-200 max-w-full">
                {mainSchemePreviewCard ? (
                  <CardView card={mainSchemePreviewCard} size="md" />
                ) : (
                  <div
                    className={`w-80 h-56 flex items-center justify-center text-sm ${style.inset}`}
                  >
                    MAIN SCHEME CARD (1A)
                  </div>
                )}
              </div>

              {/* Scheme Summary / Briefing */}
              <div className={`w-full p-2.5 space-y-1 ${style.panel}`}>
                <div className={`text-mini font-bold uppercase tracking-wider ${style.muted}`}>
                  MISSION BRIEFING:
                </div>
                <p className="text-xs leading-snug">{selectedScenario.description}</p>
              </div>
            </div>
          </div>

          {/* Scenario Carousel Jump Bar (Thumbnails / Dots) */}
          <div className="flex items-center justify-center gap-2 md:gap-4 mt-6 pt-4 border-t-2 border-current/20">
            {scenarios.map((scen, idx) => (
              <button
                key={scen.id}
                type="button"
                onClick={() => handleSelectScenarioByIndex(idx)}
                className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-bold uppercase transition-all cursor-pointer ${
                  currentScenarioIndex === idx ? `${style.tileSelected} scale-105` : style.tile
                }`}
              >
                #{idx + 1} {scen.name}
              </button>
            ))}
            {lockedScenarios.map((scen) => (
              <button
                key={scen.id}
                type="button"
                disabled
                title={`Needs ${scen.packName}`}
                className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-bold uppercase opacity-50 cursor-not-allowed ${style.tile}`}
              >
                🔒 {scen.name} · Needs {scen.packName}
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
          <div className={`p-5 space-y-3.5 ${style.panel} ${style.text}`}>
            <div className="flex items-center justify-between border-b-2 border-current/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-comic-blue" />
                <h2 className="font-comic text-2xl">1. Encounter Sets & Modular</h2>
              </div>
              {selectedModularSetCode !== defaultModularForScenario && (
                <button
                  type="button"
                  onClick={() => setSelectedModularSetCode(defaultModularForScenario)}
                  className={`text-xs font-bold underline cursor-pointer ${style.emphasis}`}
                >
                  Reset to Default
                </button>
              )}
            </div>

            {/* Scenario-Mandatory Encounter Sets Badges */}
            <div className="space-y-1.5">
              <div className={`text-mini font-bold uppercase tracking-wider ${style.muted}`}>
                Scenario-Mandatory Sets:
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`bg-slate-200 text-slate-800 px-2 py-0.5 text-xs font-bold flex items-center gap-1 ${style.badge}`}
                >
                  <span>🔒 {selectedScenario.name} Set</span>
                  <span className="text-micro opacity-70 font-normal">(Mandatory)</span>
                </span>
                <span
                  className={`bg-slate-200 text-slate-800 px-2 py-0.5 text-xs font-bold flex items-center gap-1 ${style.badge}`}
                >
                  <span>🔒 Standard Set</span>
                  <span className="text-micro opacity-70 font-normal">(Mandatory)</span>
                </span>
                {difficulty === 'EXPERT' && (
                  <span
                    className={`bg-red-100 text-comic-red px-2 py-0.5 text-xs font-bold flex items-center gap-1 ${style.badge}`}
                  >
                    <span>🔒 Expert Set</span>
                    <span className="text-micro opacity-70 font-normal">(Mandatory)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Customizable Modular Slot (1 Slot) */}
            <div className="space-y-1.5 pt-2 border-t border-current/20">
              <div className="flex items-center justify-between">
                <div className={`text-mini font-bold uppercase tracking-wider ${style.muted}`}>
                  Modular Encounter Slot (1 Required):
                </div>
                <span
                  className={`text-micro bg-amber-100 text-slate-800 px-1.5 py-0.2 font-bold ${style.badge}`}
                >
                  {selectedModularSetCode === RANDOM_MODULAR_SET_CODE
                    ? 'Random Modular Set'
                    : selectedModularSetCode === defaultModularForScenario
                      ? 'Default Recommendation'
                      : 'Custom Modular Set'}
                </span>
              </div>

              <select
                value={selectedModularSetCode}
                onChange={(e) => setSelectedModularSetCode(e.target.value)}
                className={`w-full p-2 font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-comic-yellow cursor-pointer ${field}`}
              >
                <option value={RANDOM_MODULAR_SET_CODE}>🎲 Pick Randomly</option>
                {modularSets.map((mod) => (
                  <option key={mod.code} value={mod.code}>
                    {mod.name} ({mod.cardCount} cards){' '}
                    {mod.code === defaultModularForScenario ? '— [Recommended]' : ''}
                  </option>
                ))}
              </select>

              <p className={`text-mini italic ${style.muted}`}>
                {selectedModularSetCode === RANDOM_MODULAR_SET_CODE
                  ? 'A modular encounter set will be selected randomly when the mission begins.'
                  : modularSets.find((m) => m.code === selectedModularSetCode)?.description}
              </p>

              {selectedModularSetCode === RANDOM_MODULAR_SET_CODE && (
                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={excludeRecommendedFromRandom}
                    onChange={(e) => setExcludeRecommendedFromRandom(e.target.checked)}
                    className="w-4 h-4 text-comic-blue rounded-sm focus:ring-comic-yellow cursor-pointer"
                  />
                  <span className="text-xs font-bold">
                    Random pick exclude the recommended (house rule)
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Difficulty Mode & Heroic Variant Selection (NOW PROMINENT & HIGH-VISIBILITY) */}
          <div className={`p-5 space-y-4 ${style.panel} ${style.text}`}>
            <div className="flex items-center justify-between border-b-2 border-current/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-comic-yellow" />
                <h2 className="font-comic text-2xl">2. Select Difficulty & Modifiers</h2>
              </div>
              <span
                className={`bg-amber-100 text-slate-900 px-2.5 py-0.5 text-xs font-black uppercase ${style.badge}`}
              >
                MODE: {difficulty}
              </span>
            </div>

            {/* Base Difficulty Mode Buttons */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setDifficulty('SKIRMISH')}
                className={`p-3 text-center transition-all cursor-pointer ${
                  difficulty === 'SKIRMISH'
                    ? `${style.buttonShape} bg-sky-300 text-comic-black font-black scale-105`
                    : style.tile
                }`}
              >
                <div className="font-comic text-sm sm:text-base font-bold">SKIRMISH</div>
                <div className="text-micro font-medium leading-tight mt-0.5">Stage I Only</div>
              </button>

              <button
                type="button"
                onClick={() => setDifficulty('STANDARD')}
                className={`p-3 text-center transition-all cursor-pointer ${
                  difficulty === 'STANDARD'
                    ? `${style.buttonShape} bg-comic-yellow text-comic-black font-black scale-105`
                    : style.tile
                }`}
              >
                <div className="font-comic text-sm sm:text-base font-bold">STANDARD</div>
                <div className="text-micro font-medium leading-tight mt-0.5">Stage I ➔ II</div>
              </button>

              <button
                type="button"
                onClick={() => setDifficulty('EXPERT')}
                className={`p-3 text-center transition-all cursor-pointer ${
                  difficulty === 'EXPERT'
                    ? `${style.buttonShape} bg-comic-red text-white font-black scale-105`
                    : style.tile
                }`}
              >
                <div className="font-comic text-sm sm:text-base font-bold">EXPERT</div>
                <div className="text-micro opacity-80 font-medium leading-tight mt-0.5">
                  Stage II ➔ III
                </div>
              </button>
            </div>

            {/* Heroic Mode Variant (Optional Rule) */}
            <div className={`p-3.5 space-y-2 ${style.inset}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-comic-red" />
                  <span className="text-sm uppercase font-bold">Heroic Mode (Optional Rule)</span>
                </div>

                {heroicLevel > 0 && (
                  <span
                    className={`text-micro px-2 py-0.5 font-black uppercase ${style.badge} ${
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
              <div className={`grid grid-cols-4 gap-1.5 p-1 ${style.panel}`}>
                {[0, 1, 2, 3].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setHeroicLevel(lvl)}
                    className={`py-1 text-center text-xs uppercase transition-all cursor-pointer font-bold ${
                      heroicLevel === lvl
                        ? `${style.buttonShape} bg-comic-red text-white`
                        : `opacity-80 hover:opacity-100 ${style.muted}`
                    }`}
                  >
                    {lvl === 0 ? 'Off (0)' : `Heroic ${lvl} (+${lvl})`}
                  </button>
                ))}
              </div>

              <p className={`text-mini leading-relaxed ${style.muted}`}>
                {heroicLevel === 0
                  ? 'Standard encounter dealing: 1 encounter card dealt per player during Step 4.'
                  : `Heroic ${heroicLevel} active: Deals ${1 + heroicLevel} encounter cards (+${heroicLevel} extra) to each player during Step 4.`}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: 4 Hero Seats (Solo Mode) */}
        <div className="lg:col-span-6 space-y-6 flex flex-col justify-between">
          <div className={`p-5 space-y-4 ${style.panel} ${style.text}`}>
            <div className="flex items-center justify-between border-b-2 border-current/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-comic-blue" />
                <h2 className="font-comic text-2xl">3. Hero Seats (1 to 4)</h2>
              </div>
              <span
                className={`bg-comic-blue text-white text-xs px-2.5 py-1 font-bold ${style.badge}`}
              >
                {playerCount} {playerCount === 1 ? 'HERO ASSIGNED' : 'HEROES ASSIGNED'}
              </span>
            </div>
            {starterDecks.length === 0 && (
              <p className={`text-sm ${style.muted}`}>
                No heroes available: enable a hero pack on the Content screen.
              </p>
            )}

            <p className={`text-xs ${style.muted}`}>
              Assign heroes to the seat slots below.{' '}
              <span className={`font-bold ${style.text}`}>
                Hero Seat 1 is designated as the Starting Player
              </span>{' '}
              (holds the First Player Token in Round 1 per RR v1.8 Step 12).
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
                      ? {
                          heroId: otherDeck.heroId,
                          heroName: otherDeck.heroName,
                          seatNum: otherIdx + 1,
                        }
                      : null;
                  })
                  .filter(Boolean) as { heroId: string; heroName: string; seatNum: number }[];

                return (
                  <div
                    key={index}
                    className={`p-3 transition-all relative hover:z-zoom ${
                      isAssigned ? style.tileSelected : `${style.tile} border-dashed`
                    }`}
                  >
                    {isAssigned && deckDef ? (
                      /* Occupied Seat Card Tile */
                      <div className="flex items-start gap-3">
                        {/* Hero Card Miniature Thumbnail (Hero Form) */}
                        <div className="shrink-0 relative z-content hover:z-zoom">
                          {heroCard ? (
                            <CardView card={heroCard} size="sm" />
                          ) : (
                            <div
                              className={`w-28 h-40 flex items-center justify-center text-xs ${style.inset}`}
                            >
                              HERO CARD
                            </div>
                          )}
                        </div>

                        {/* Seat Info & Controls */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`w-5 h-5 bg-comic-red text-white text-xs flex items-center justify-center font-bold ${style.badge} rounded-full!`}
                              >
                                {index + 1}
                              </span>
                              <span className="font-comic text-base font-bold truncate">
                                {deckDef.heroName}
                              </span>
                              {index === 0 && (
                                <span
                                  className={`bg-comic-yellow text-comic-black text-micro px-2 py-0.5 font-bold uppercase flex items-center gap-1 ${style.badge}`}
                                >
                                  <Crown className="w-3 h-3 text-comic-red" />
                                  <span>STARTING PLAYER</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`bg-comic-blue text-white text-micro px-2 py-0.5 font-bold uppercase ${style.badge}`}
                              >
                                {deckDef.aspect}
                              </span>
                              {/* Remove button (if more than 1 seat assigned) */}
                              {playerCount > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleAssignSeat(index, null)}
                                  className="opacity-60 hover:opacity-100 hover:text-comic-red p-1 rounded-sm transition-colors cursor-pointer"
                                  title="Vacate this hero seat"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Deck Switcher Dropdown */}
                          <div>
                            <label
                              className={`text-micro font-bold uppercase block mb-0.5 ${style.muted}`}
                            >
                              Change Deck:
                            </label>
                            <select
                              value={deckId || ''}
                              onChange={(e) => handleAssignSeat(index, e.target.value)}
                              className={`w-full text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-comic-blue cursor-pointer ${field}`}
                            >
                              {starterDecks.map((d) => {
                                const isTakenElsewhere = takenInOtherSeats.some(
                                  (t) => t.heroId === d.heroId,
                                );
                                const takenBy = takenInOtherSeats.find(
                                  (t) => t.heroId === d.heroId,
                                );

                                return (
                                  <option key={d.id} value={d.id} disabled={isTakenElsewhere}>
                                    {d.heroName} ({d.aspect})
                                    {isTakenElsewhere
                                      ? ` — [🔒 Taken by Hero ${takenBy?.seatNum}]`
                                      : ''}
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
                          <span
                            className={`w-5 h-5 text-xs flex items-center justify-center font-bold ${style.chip} rounded-full!`}
                          >
                            {index + 1}
                          </span>
                          <span className={`text-sm ${style.muted}`}>
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
                            className={`text-xs font-bold px-2.5 py-1 cursor-pointer min-w-0 max-w-[55%] ${style.btnGo}`}
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
                                <option key={d.id} value={d.id} disabled={isTakenElsewhere}>
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

          {/* Theme: a chosen theme, or a random one for every game. Always open: the choice is made before the game starts. */}
          <section
            aria-labelledby="setup-theme-heading"
            className={`p-4 ${style.panel} ${style.text}`}
          >
            <h2
              id="setup-theme-heading"
              className="flex items-center gap-2 font-comic text-lg font-bold mb-3"
            >
              <Palette className="w-5 h-5 text-comic-red" />
              <span>
                Theme:{' '}
                {settings.themeMode === 'random'
                  ? 'Random each game'
                  : getModalStyle(settings.themeId)?.label}
              </span>
            </h2>
            <ThemePicker />
          </section>

          {/* Action Launch Bar */}
          <div
            className={`p-4 flex items-center justify-between gap-4 ${style.panel} ${style.text}`}
          >
            <div>
              <div className={`font-comic text-xl font-bold leading-tight ${style.emphasis}`}>
                READY FOR BATTLE?
              </div>
              <div className="text-xs font-semibold">
                {playerCount} {playerCount === 1 ? 'Hero' : 'Heroes'} • {difficulty} Mode •{' '}
                {selectedScenario.name}
              </div>
            </div>

            <ToneButton
              tone="red"
              onClick={handleStart}
              disabled={playerCount === 0}
              className="gap-2 px-6 py-3 font-comic text-xl font-black uppercase tracking-wider hover:scale-105 active:scale-95"
            >
              <Play className="w-6 h-6 fill-current" />
              <span>START MISSION</span>
            </ToneButton>
          </div>
        </div>
      </div>
    </div>
  );
};
