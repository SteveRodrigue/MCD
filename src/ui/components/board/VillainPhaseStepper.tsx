import React from 'react';
import { FastForward, Play, Pause, ChevronRight, AlertTriangle } from 'lucide-react';
import { VillainPhaseStep } from '../../../engine/models';
import { peekDecisionPrompt } from '../../../engine/pipeline';
import { VillainPhasePacing } from '../../context/game-settings-context';
import { useGameSession } from '../../context/GameStateContext';
import { useModalStyle } from '../../theme/useModalStyle';
import { ToneButton } from '../../theme/kit/controls';

export interface VillainPhaseStepperProps {
  pacing: VillainPhasePacing;
  onNextStep: () => void;
  onToggleAutoPlay?: () => void;
  onSkip?: () => void;
  isAutoPlaying?: boolean;
}

export const VillainPhaseStepper: React.FC<VillainPhaseStepperProps> = ({
  pacing,
  onNextStep,
  onToggleAutoPlay,
  onSkip,
  isAutoPlaying = true,
}) => {
  const { style } = useModalStyle();
  const { state: gameState } = useGameSession();
  if (gameState.phase !== 'VILLAIN_PHASE') return null;

  const stepEvent = gameState.villainPhaseStepEvent;
  const currentStep =
    stepEvent?.step || gameState.villainPhaseStep || VillainPhaseStep.MAIN_SCHEME_THREAT;

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

  const isPromptOpen = Boolean(peekDecisionPrompt(gameState));

  return (
    <div
      data-testid="villain-phase-stepper"
      className="w-fit max-w-full mx-auto px-2 py-1 z-raised"
    >
      <div
        className={`p-2.5 sm:p-3 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${style.panel} ${style.text}`}
      >
        {/* Left: Step Category Badge & Narrative */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span
            className={`px-2.5 py-1 font-black text-xs uppercase shrink-0 ${style.buttonShape} ${categoryColor}`}
          >
            {categoryLabel}
          </span>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <span className="font-black text-xs sm:text-sm" title={description}>
                {description}
              </span>
              <span
                className={`bg-comic-yellow text-comic-black font-black text-micro px-1.5 py-0.2 -rotate-2 shrink-0 ${style.badge}`}
              >
                {onomatopoeia}
              </span>
            </div>
            {isPromptOpen && (
              <span className="text-micro text-comic-red font-black flex items-center gap-1 animate-pulse">
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
              className={`px-2.5 py-1.5 font-bold text-xs uppercase flex items-center gap-1.5 transition-all cursor-pointer ${style.buttonShape} ${
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
          <ToneButton
            tone="yellow"
            onClick={onNextStep}
            disabled={isPromptOpen}
            className="px-3 py-1.5 font-black text-xs uppercase gap-1.5 hover:scale-105"
          >
            <span>Next Step</span>
            <ChevronRight className="w-4 h-4" />
          </ToneButton>

          {/* Skip All Pacing Button */}
          {onSkip && (
            <button
              onClick={onSkip}
              disabled={isPromptOpen}
              className={`p-1.5 font-bold transition-all cursor-pointer hover:scale-105 ${style.btnMove}`}
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
