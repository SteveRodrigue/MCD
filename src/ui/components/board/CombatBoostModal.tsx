import React, { useEffect } from 'react';
import { Swords, Sparkles, ChevronRight } from 'lucide-react';
import { CombatResolutionSummary } from '../../../engine/models';
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
    <div
      data-testid="combat-boost-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-comic-black/80 backdrop-blur-xs font-comic"
    >
      <div className="relative w-full max-w-xl bg-comic-paper border-4 border-comic-black rounded-2xl shadow-comic-xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Comic Header Banner */}
        <div className="bg-comic-red text-white px-6 py-3 border-b-4 border-comic-black flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💥</span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-comic-yellow">
                COMBAT RESOLUTION
              </div>
              <h2 className="text-xl md:text-2xl font-black uppercase tracking-wide leading-none">
                Enemy Attack Math
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-comic-yellow text-comic-black rounded border-2 border-comic-black font-black text-xs uppercase shadow-comic-sm">
              {outcome.attackerName}
            </span>
            <span className="px-2 py-0.5 bg-white text-comic-black rounded border-2 border-comic-black font-black text-xs uppercase shadow-comic-sm">
              Target: {outcome.targetHeroName || 'Hero'}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* 1. Boost Cards Revealed Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-black uppercase text-slate-700">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-comic-red" />
                Revealed Boost Cards ({outcome.boostCards.length})
              </span>
              <span className="bg-comic-yellow px-2 py-0.5 rounded border border-comic-black text-comic-black font-black">
                Total Boost: +{outcome.totalBoostIcons} 💥
              </span>
            </div>

            {outcome.boostCards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {outcome.boostCards.map((boost, idx) => {
                  const icons = boost.card.boostIcons || 0;
                  const hasStar = Boolean(boost.card.boostStar);
                  const boostStarText = (boost.card as any).boostStarText || boost.card.text;

                  return (
                    <div
                      key={boost.instanceId || idx}
                      className="bg-white p-3 rounded-xl border-2 border-comic-black shadow-comic-sm flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="shrink-0 w-16">
                          <CardView
                            card={boost.card}
                            instance={boost}
                            size="sm"
                            showTokens={false}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-black text-xs text-comic-black truncate">
                            {boost.card.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="bg-comic-red text-white text-[11px] font-black px-1.5 py-0.5 rounded border border-comic-black shadow-comic-xs">
                              💥 x{icons}
                            </span>
                            {hasStar && (
                              <span className="bg-amber-400 text-comic-black text-[10px] font-black px-1.5 py-0.5 rounded border border-comic-black">
                                ★ STAR
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {hasStar && boostStarText && (
                        <p className="text-[10px] bg-amber-50 p-1.5 rounded border border-amber-300 text-amber-950 font-bold leading-tight">
                          ★ {boostStarText}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded-xl border-2 border-dashed border-amber-300 text-center text-xs text-slate-600 font-bold">
                No boost cards were drawn for this attack.
              </div>
            )}
          </div>

          {/* 2. Authoritative Combat Calculation Formula */}
          <div className="bg-amber-100/90 border-3 border-comic-black rounded-xl p-4 shadow-comic space-y-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-700">
              AUTHORITATIVE FORMULA (RR v1.8 p. 24)
            </div>

            <div className="flex items-center justify-around text-center flex-wrap gap-2">
              {/* Base Attack */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-slate-500">Base ATK</span>
                <span className="text-xl md:text-2xl font-black text-comic-black">
                  {outcome.baseAttack}
                </span>
                <span className="text-[9px] text-slate-600">{outcome.attackerName}</span>
              </div>

              <span className="text-xl font-black text-slate-600">+</span>

              {/* Boost Icons */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-slate-500">Boost Icons</span>
                <span className="text-xl md:text-2xl font-black text-comic-red">
                  +{outcome.totalBoostIcons}
                </span>
                <span className="text-[9px] text-slate-600">Revealed</span>
              </div>

              <span className="text-xl font-black text-slate-600">=</span>

              {/* Total Attack */}
              <div className="flex flex-col items-center bg-white px-2.5 py-1 rounded-lg border-2 border-comic-black shadow-comic-xs">
                <span className="text-[10px] uppercase font-black text-comic-red">Total ATK</span>
                <span className="text-xl md:text-2xl font-black text-comic-red">{totalAttack}</span>
              </div>

              <span className="text-xl font-black text-slate-600">vs</span>

              {/* Defense */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-slate-500">Defense</span>
                <span className="text-xl md:text-2xl font-black text-blue-700">
                  {outcome.defenseValue}
                </span>
                <span
                  className="text-[9px] text-slate-600 truncate max-w-[140px]"
                  title={
                    outcome.defenderType === 'ALLY' && outcome.targetHeroName
                      ? `${defenderLabel} protecting ${outcome.targetHeroName}`
                      : defenderLabel
                  }
                >
                  {outcome.defenderType === 'ALLY' && outcome.targetHeroName
                    ? `${defenderLabel} protecting ${outcome.targetHeroName}`
                    : defenderLabel}
                </span>
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
                  <span className="bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded border border-white">
                    OVERKILL
                  </span>
                )}
                {outcome.hasPiercing && (
                  <span className="bg-amber-400 text-comic-black text-[10px] font-black px-1.5 py-0.5 rounded border border-comic-black">
                    PIERCING
                  </span>
                )}
                <span className="text-2xl font-black text-comic-yellow">
                  {outcome.finalDamage} HP
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Continue Button */}
        <div className="p-4 bg-comic-paper border-t-4 border-comic-black flex items-center justify-between">
          <span className="text-xs text-slate-500 font-bold hidden sm:inline">
            Press{' '}
            <kbd className="px-1.5 py-0.5 bg-white border border-comic-black rounded shadow-comic-xs font-mono text-[10px]">
              Spacebar
            </kbd>{' '}
            or click Continue
          </span>
          <button
            onClick={onContinue}
            className="w-full sm:w-auto px-6 py-2.5 bg-comic-yellow hover:bg-yellow-400 active:scale-95 text-comic-black font-black uppercase text-sm rounded-xl border-3 border-comic-black shadow-comic flex items-center justify-center gap-2 transition-transform cursor-pointer"
          >
            <span>Continue</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CombatBoostModal;
