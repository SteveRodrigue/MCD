import React, { useEffect } from 'react';
import { Swords, Sparkles, ChevronRight } from 'lucide-react';
import { CombatResolutionSummary } from '../../../engine/models';
import { AccentStripe } from '../../theme/AccentStripe';
import { CardRef } from '../../theme/CardRef';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';
import { BoostIconsPill } from '../cards/BoostIconsPill';
import { CardView } from '../cards/CardView';

export interface CombatBoostModalProps {
  isOpen: boolean;
  outcome?: CombatResolutionSummary;
  onContinue: () => void;
}

export const CombatBoostModal: React.FC<CombatBoostModalProps> = ({
  isOpen,
  outcome,
  onContinue,
}) => {
  const { style } = useModalStyle();

  // Listen for Spacebar or Enter to continue
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onContinue();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onContinue]);

  if (!isOpen || !outcome) return null;

  const totalAttack = outcome.baseAttack + outcome.totalBoostIcons;
  const defenderLabel =
    outcome.defenderName ||
    (outcome.defenderType === 'HERO'
      ? outcome.targetHeroName || 'Hero'
      : outcome.defenderType === 'ALLY'
        ? 'Ally Defender'
        : 'Undefended');

  return (
    <ModalScaffold
      title="Enemy Attack Math"
      kicker="COMBAT RESOLUTION"
      verb="red"
      trigger={{ name: outcome.attackerName, code: outcome.attackerCode }}
      icon={<span className="font-comic text-xl leading-none">💥</span>}
      headerRight={
        <span className={`px-2 py-0.5 font-black text-xs uppercase ${style.chip}`}>
          Target:{' '}
          {outcome.targetHeroCode ? (
            <CardRef code={outcome.targetHeroCode} name={outcome.targetHeroName || 'Hero'} />
          ) : (
            outcome.targetHeroName || 'Hero'
          )}
        </span>
      }
      maxWidthClass={outcome.boostCards.length > 2 ? 'max-w-3xl' : 'max-w-xl'}
      testId="combat-boost-modal"
      footer={
        <>
          <span className={`text-xs font-bold hidden sm:inline ${style.muted}`}>
            Press{' '}
            <kbd className="px-1.5 py-0.5 bg-white text-comic-black border border-comic-black rounded shadow-comic-xs font-mono text-micro">
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
      {/* 1. Boost Cards Revealed Section */}
      <div className="space-y-2">
        <div className="text-xs font-black uppercase">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-comic-red" />
            Revealed Boost Cards ({outcome.boostCards.length})
          </span>
        </div>

        {outcome.boostCards.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-3">
            {outcome.boostCards.map((boost, idx) => {
              const icons = boost.card.boostIcons || 0;
              const hasStar = Boolean(boost.card.boostStar);
              const boostStarText = (boost.card as any).boostStarText || boost.card.text;

              return (
                <div
                  key={boost.instanceId || idx}
                  data-card-anchor={boost.card.code}
                  className={`relative p-3 pl-4 flex flex-col justify-between gap-2 w-fit max-w-full ${style.panel}`}
                >
                  <AccentStripe code={boost.card.code} />
                  <div className="group/boost relative inline-block self-center">
                    <CardView
                      card={boost.card}
                      instance={boost}
                      size="md"
                      showTokens={false}
                      enableHoverZoom={false}
                      enableHoverLift={false}
                      enableContextMenu={false}
                    />
                    <BoostIconsPill icons={icons} star={hasStar} />
                  </div>

                  {hasStar && boostStarText && (
                    <p className={`text-micro p-1.5 font-bold leading-tight ${style.inset}`}>
                      ★ {boostStarText}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className={`p-3 border-dashed text-center text-xs font-bold ${style.inset} ${style.muted}`}
          >
            No boost cards were drawn for this attack.
          </div>
        )}
      </div>

      {/* 2. Authoritative Combat Calculation Formula */}
      <div className={`p-4 space-y-3 ${style.panel}`}>
        <div className={`text-micro font-black uppercase tracking-wider ${style.muted}`}>
          AUTHORITATIVE FORMULA (RR v1.8 p. 24)
        </div>

        <div className="flex items-center justify-around text-center flex-wrap gap-2">
          <div className="flex flex-col items-center">
            <span className={`text-micro uppercase font-bold ${style.muted}`}>Base ATK</span>
            <span className="font-comic text-xl md:text-2xl font-black">{outcome.baseAttack}</span>
          </div>

          <span className={`font-comic text-xl font-black ${style.muted}`}>+</span>

          <div className="flex flex-col items-center">
            <span className={`text-micro uppercase font-bold ${style.muted}`}>Boost Icons</span>
            <span className="font-comic text-xl md:text-2xl font-black text-comic-red">
              +{outcome.totalBoostIcons}
            </span>
          </div>

          <span className={`font-comic text-xl font-black ${style.muted}`}>=</span>

          <div className={`flex flex-col items-center px-2.5 py-1 ${style.inset}`}>
            <span className="text-micro uppercase font-black text-comic-red">Total ATK</span>
            <span className="font-comic text-xl md:text-2xl font-black text-comic-red">
              {totalAttack}
            </span>
          </div>

          <span className={`font-comic text-xl font-black ${style.muted}`}>vs</span>

          <div className="flex flex-col items-center">
            <span className={`text-micro uppercase font-bold ${style.muted}`}>Defense</span>
            <span className="font-comic text-xl md:text-2xl font-black text-blue-600">
              {outcome.defenseValue}
            </span>
            {outcome.defenderType === 'ALLY' && (
              <span className={`text-nano truncate max-w-[180px] ${style.muted}`}>
                {outcome.defenderCode ? (
                  <CardRef code={outcome.defenderCode} name={defenderLabel} />
                ) : (
                  defenderLabel
                )}
              </span>
            )}
          </div>
        </div>

        {/* Final Damage Result Banner */}
        <div className="bg-comic-black text-white p-3 rounded-lg border-2 border-comic-black flex items-center justify-between shadow-comic-sm">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-comic-yellow" />
            <span className="font-black text-sm uppercase">Damage Dealt:</span>
          </div>
          <div className="flex items-center gap-2">
            {outcome.hasOverkill && (
              <span className="bg-rose-600 text-white text-micro font-black px-1.5 py-0.5 rounded border border-white">
                OVERKILL
              </span>
            )}
            {outcome.hasPiercing && (
              <span className="bg-amber-400 text-comic-black text-micro font-black px-1.5 py-0.5 rounded border border-comic-black">
                PIERCING
              </span>
            )}
            <span className="font-comic text-2xl font-black text-comic-yellow">
              {outcome.finalDamage} HP
            </span>
          </div>
        </div>
      </div>
    </ModalScaffold>
  );
};

export default CombatBoostModal;
