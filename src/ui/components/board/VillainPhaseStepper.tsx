import React from 'react';
import { FastForward, Play, Pause, ChevronRight, AlertTriangle } from 'lucide-react';
import { GameState, VillainPhaseStep } from '../../../engine/models';
import { VillainPhasePacing } from '../../context/game-settings-context';

export interface VillainPhaseStepperProps {
  gameState: GameState;
  pacing: VillainPhasePacing;
  onNextStep: () => void;
  onToggleAutoPlay?: () => void;
  onSkip?: () => void;
  isAutoPlaying?: boolean;
}

export const VillainPhaseStepper: React.FC<VillainPhaseStepperProps> = ({
  gameState,
  pacing,
  onNextStep,
  onToggleAutoPlay,
  onSkip,
  isAutoPlaying = true,
}) => {
  if (gameState.phase !== 'VILLAIN_PHASE') return null;

  const currentStep = gameState.villainPhaseStep || VillainPhaseStep.MAIN_SCHEME_THREAT;
  const stepEvent = gameState.villainPhaseStepEvent;

  // Determine Category Badge
  let categoryLabel = 'THREAT';
  let categoryColor = 'bg-comic-yellow text-comic-black';

  switch (currentStep) {
    case VillainPhaseStep.MAIN_SCHEME_THREAT:
      categoryLabel = '1. THREAT';
      categoryColor = 'bg-amber-400 text-comic-black';
      break;
    case VillainPhaseStep.VILLAIN_ACTIVATIONS:
      if (stepEvent?.targetName) {
        if (stepEvent.type === 'VILLAIN_ATTACK') {
          categoryLabel = `2. VILLAIN ➔ ${stepEvent.targetName}`;
          categoryColor = 'bg-comic-red text-white';
        } else if (stepEvent.type === 'MINION_ATTACK') {
          categoryLabel = `2. MINION ➔ ${stepEvent.targetName}`;
          categoryColor = 'bg-rose-500 text-white';
        } else if (stepEvent.type === 'VILLAIN_SCHEME') {
          categoryLabel = `2. SCHEME ➔ ${stepEvent.targetName}`;
          categoryColor = 'bg-comic-red text-white';
        } else if (stepEvent.type === 'MINION_SCHEME') {
          categoryLabel = `2. SCHEME ➔ ${stepEvent.targetName}`;
          categoryColor = 'bg-rose-500 text-white';
        } else {
          categoryLabel = '2. ACTIVATION';
          categoryColor = 'bg-comic-red text-white';
        }
      } else {
        if (stepEvent?.type === 'MINION_ATTACK' || stepEvent?.type === 'MINION_SCHEME') {
          categoryLabel = '2. MINION';
          categoryColor = 'bg-rose-500 text-white';
        } else {
          categoryLabel = '2. VILLAIN';
          categoryColor = 'bg-comic-red text-white';
        }
      }
      break;
    case VillainPhaseStep.DEAL_ENCOUNTER_CARDS:
      categoryLabel = '3. DEAL CARDS';
      categoryColor = 'bg-sky-500 text-white';
      break;
    case VillainPhaseStep.REVEAL_ENCOUNTER_CARDS:
      categoryLabel = '4. REVEAL';
      categoryColor = 'bg-purple-600 text-white';
      break;
    case VillainPhaseStep.PASS_FIRST_PLAYER:
      categoryLabel = '5. FIRST PLAYER';
      categoryColor = 'bg-emerald-500 text-white';
      break;
  }

  const onomatopoeia = stepEvent?.onomatopoeia || 'VILLAIN PHASE!';
  const description =
    stepEvent?.description ||
    (currentStep === VillainPhaseStep.MAIN_SCHEME_THREAT
      ? 'Villain places threat on the main scheme.'
      : currentStep === VillainPhaseStep.VILLAIN_ACTIVATIONS
        ? 'Enemies activate in player turn order.'
        : currentStep === VillainPhaseStep.DEAL_ENCOUNTER_CARDS
          ? 'Encounter cards are dealt to players.'
          : currentStep === VillainPhaseStep.REVEAL_ENCOUNTER_CARDS
            ? 'Encounter cards are revealed and resolved.'
            : 'Pass first player token and round upkeep.');

  const isPromptOpen = Boolean(gameState.pendingDecisionPrompt);

  return (
    <div
      data-testid="villain-phase-stepper"
      className="w-full max-w-4xl mx-auto px-2 py-1 font-comic z-20"
    >
      <div className="bg-comic-paper border-3 border-comic-black rounded-xl shadow-comic p-2.5 sm:p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
        {/* Left: Step Category Badge & Narrative */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span
            className={`px-2.5 py-1 rounded-lg border-2 border-comic-black font-black text-xs uppercase shadow-comic-xs shrink-0 ${categoryColor}`}
          >
            {categoryLabel}
          </span>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-black text-xs sm:text-sm text-comic-black truncate">
                {description}
              </span>
              <span className="bg-comic-yellow text-comic-black font-black text-[10px] px-1.5 py-0.2 rounded border border-comic-black shadow-comic-xs -rotate-2 shrink-0">
                {onomatopoeia}
              </span>
            </div>
            {isPromptOpen && (
              <span className="text-[10px] text-comic-red font-black flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                Awaiting player decision prompt...
              </span>
            )}
          </div>
        </div>

        {/* Right: Interactive Stepping Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          {/* Auto-Play Toggle Button (If not in manual/instant) */}
          {pacing !== 'instant' && onToggleAutoPlay && (
            <button
              onClick={onToggleAutoPlay}
              className={`px-2.5 py-1.5 rounded-lg border-2 border-comic-black font-bold text-xs uppercase shadow-comic-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                isAutoPlaying
                  ? 'bg-amber-300 hover:bg-amber-400 text-comic-black'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
              }`}
              title={isAutoPlaying ? 'Pause Auto-Play' : 'Resume Auto-Play'}
            >
              {isAutoPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{isAutoPlaying ? 'Pause' : 'Auto'}</span>
            </button>
          )}

          {/* Next Step Button */}
          <button
            onClick={onNextStep}
            disabled={isPromptOpen}
            className={`px-3 py-1.5 rounded-lg border-2 border-comic-black font-black text-xs uppercase shadow-comic-sm flex items-center gap-1.5 transition-transform cursor-pointer active:scale-95 ${
              isPromptOpen
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                : 'bg-comic-yellow hover:bg-yellow-400 text-comic-black hover:scale-105'
            }`}
          >
            <span>Next Step</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Skip All Pacing Button */}
          {onSkip && (
            <button
              onClick={onSkip}
              disabled={isPromptOpen}
              className="p-1.5 rounded-lg border-2 border-comic-black bg-white hover:bg-slate-100 text-comic-black font-bold shadow-comic-xs transition-all cursor-pointer hover:scale-105"
              title="Skip remaining steps (Auto-Resolve Phase)"
            >
              <FastForward className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VillainPhaseStepper;
