import React, { useEffect } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { PendingDecisionPrompt } from '../../../engine/models';
import type { VillainPhasePacing } from '../../context/game-settings-context';
import { AccentStripe } from '../../theme/AccentStripe';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';
import { BoostIconsPill } from '../cards/BoostIconsPill';
import { CardView } from '../cards/CardView';

export interface BoostEffectModalProps {
  isOpen: boolean;
  prompt?: PendingDecisionPrompt;
  pacing?: VillainPhasePacing;
  isAutoPlaying?: boolean;
  onContinue: () => void;
}

export const BoostEffectModal: React.FC<BoostEffectModalProps> = ({
  isOpen,
  prompt,
  pacing = 'auto_normal',
  isAutoPlaying = true,
  onContinue,
}) => {
  const { style } = useModalStyle();

  // Listen for Spacebar or Enter to continue
  useEffect(() => {
    if (!isOpen || !prompt) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onContinue();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, prompt, onContinue]);

  // Auto-advance pacing timer during villain phase auto-play
  useEffect(() => {
    if (!isOpen || !prompt) return;
    if (!isAutoPlaying) return;
    if (pacing === 'manual') return;

    const delay = pacing === 'instant' ? 0 : pacing === 'auto_fast' ? 450 : 900;
    const timer = setTimeout(onContinue, delay);

    return () => clearTimeout(timer);
  }, [isOpen, prompt, pacing, isAutoPlaying, onContinue]);

  if (!isOpen || !prompt) return null;

  const cardInstance = prompt.sourceCardInstance;
  const boostIcons = cardInstance?.card?.boostIcons ?? 0;
  const hasStar = Boolean(cardInstance?.card?.boostStar);
  const cardCode = prompt.sourceCardCode || cardInstance?.card?.code || '';
  const cardName = prompt.sourceCardName || cardInstance?.card?.name || 'Boost Card';

  return (
    <ModalScaffold
      title={cardName}
      kicker="BOOST ABILITY REVEALED"
      verb="red"
      trigger={{ name: prompt.attackerName || 'Enemy' }}
      icon={<span className="font-comic text-xl leading-none">★</span>}
      maxWidthClass="max-w-xl"
      testId="boost-effect-modal"
      footer={
        <>
          <span className={`text-xs font-bold hidden sm:inline ${style.muted}`}>
            Press{' '}
            <kbd className="px-1.5 py-0.5 bg-white text-comic-black border border-comic-black rounded-sm shadow-comic-xs font-mono text-micro">
              Spacebar
            </kbd>{' '}
            or click Continue
          </span>
          <button
            type="button"
            onClick={onContinue}
            className={`w-full sm:w-auto px-6 py-2.5 font-black uppercase text-sm flex items-center justify-center gap-2 cursor-pointer ${style.btnGo}`}
          >
            <span>Continue</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Boost Card Presentation */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
          {cardInstance ? (
            <div
              data-card-anchor={cardCode}
              className={`relative p-3 pl-4 flex flex-col items-center justify-between gap-2 w-fit max-w-full ${style.panel}`}
            >
              <AccentStripe code={cardCode} />
              <div className="relative inline-block self-center">
                <CardView
                  card={cardInstance.card}
                  instance={cardInstance}
                  size="md"
                  showTokens={false}
                  enableHoverZoom={false}
                  enableHoverLift={false}
                  enableContextMenu={false}
                />
                <BoostIconsPill icons={boostIcons} star={hasStar} />
              </div>
            </div>
          ) : null}

          {/* Ability Text Box Callout */}
          <div className={`p-4 flex-1 space-y-2 rounded-lg border-2 ${style.inset}`}>
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-comic-red">
              <Sparkles className="w-4 h-4" />
              <span>Upcoming Boost Effect</span>
            </div>
            <p className="font-bold text-sm leading-relaxed text-comic-black">
              ★ {prompt.description}
            </p>
          </div>
        </div>
      </div>
    </ModalScaffold>
  );
};

export default BoostEffectModal;
