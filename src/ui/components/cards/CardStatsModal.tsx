import React, { useState } from 'react';
import { BarChart3, Trash2, X } from 'lucide-react';
import { ModalLayer } from '../layout/ModalLayer';
import { NormalizedCard, GameState } from '../../../engine/models';
import { AllTimeStats, CardUsageStats } from '../../../engine/models/stats';
import { ResetCardStatsConfirmModal } from './ResetCardStatsConfirmModal';

interface CardStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: NormalizedCard;
  gameState?: GameState;
  allTimeStats?: AllTimeStats;
  devMode?: boolean;
  onStatsReset?: () => void | Promise<void>;
}

export const CardStatsModal: React.FC<CardStatsModalProps> = ({
  isOpen,
  onClose,
  card,
  gameState,
  allTimeStats,
  devMode = false,
  onStatsReset,
}) => {
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  if (!isOpen) return null;

  const gameCardStats: CardUsageStats | undefined = gameState?.stats?.cards?.[card.code];
  const allTimeCardStats: CardUsageStats | undefined = allTimeStats?.cards?.[card.code];

  const gamePlays = gameCardStats?.played || 0;
  const allTimePlays = allTimeCardStats?.played || 0;

  // Gather all unique ability IDs from card definition plus any recorded in stats
  const abilitiesConfig = card.enrichment?.abilities || [];
  const abilityIds = new Set<string>();
  for (const ab of abilitiesConfig) {
    if (ab.id) abilityIds.add(ab.id);
  }
  for (const id of Object.keys(gameCardStats?.abilitiesUsed || {})) {
    abilityIds.add(id);
  }
  for (const id of Object.keys(allTimeCardStats?.abilitiesUsed || {})) {
    abilityIds.add(id);
  }

  const sortedAbilityIds = Array.from(abilityIds);

  // Check if basic actions are relevant for this card
  const isCharacterOrEnemy =
    card.type === 'hero' ||
    card.type === 'alter_ego' ||
    card.type === 'ally' ||
    card.type === 'villain' ||
    card.type === 'minion';

  const basicActionsKeys = [
    { key: 'attack', label: 'Attack' },
    { key: 'thwart', label: 'Thwart' },
    { key: 'defense', label: 'Defense' },
    { key: 'recover', label: 'Recover' },
    { key: 'scheme', label: 'Scheme' },
    { key: 'changeForm', label: 'Change Form' },
  ] as const;

  const hasAnyBasicActions =
    isCharacterOrEnemy ||
    basicActionsKeys.some(
      ({ key }) =>
        (gameCardStats?.basicActions?.[key] || 0) > 0 ||
        (allTimeCardStats?.basicActions?.[key] || 0) > 0,
    );

  return (
    <>
      <ModalLayer className="fixed inset-0 bg-comic-black/80 z-modal flex items-center justify-center p-4 backdrop-blur-xs font-comic">
        <div
          className="bg-comic-paper border-4 border-comic-black max-w-xl w-full rounded-xl shadow-comic-xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-comic-darkBlue px-5 py-3 border-b-4 border-comic-black flex items-center justify-between text-white select-none">
            <div className="flex items-center gap-2 min-w-0">
              <BarChart3 className="w-5 h-5 text-comic-yellow shrink-0" />
              <div className="truncate">
                <span className="font-mono text-xs font-bold bg-comic-yellow text-comic-black px-1.5 py-0.5 rounded mr-2">
                  {card.code}
                </span>
                <span className="font-bangers text-xl tracking-wide uppercase text-white">
                  {card.name} — STATS
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-comic-yellow p-1 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 overflow-y-auto space-y-5 text-comic-black">
            {/* Plays Overview Panel */}
            <div className="bg-amber-50 p-4 rounded-xl border-2 border-comic-black shadow-comic-sm">
              <h4 className="font-bangers text-base uppercase tracking-wider text-comic-darkBlue mb-3">
                Card Plays & Reveals
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-lg border-2 border-comic-black text-center">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    This Game
                  </div>
                  <div className="font-bangers text-3xl text-comic-red mt-0.5">{gamePlays}</div>
                </div>
                <div className="bg-white p-3 rounded-lg border-2 border-comic-black text-center">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    All-Time
                  </div>
                  <div className="font-bangers text-3xl text-comic-darkBlue mt-0.5">
                    {allTimePlays}
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Actions Panel (if applicable) */}
            {hasAnyBasicActions && (
              <div className="bg-amber-50 p-4 rounded-xl border-2 border-comic-black shadow-comic-sm">
                <h4 className="font-bangers text-base uppercase tracking-wider text-comic-darkBlue mb-3">
                  Basic Actions
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {basicActionsKeys.map(({ key, label }) => {
                    const gCount = gameCardStats?.basicActions?.[key] || 0;
                    const atCount = allTimeCardStats?.basicActions?.[key] || 0;
                    return (
                      <div
                        key={key}
                        className="bg-white p-2.5 rounded-lg border-2 border-comic-black flex flex-col justify-between"
                      >
                        <span className="font-bold text-slate-700">{label}</span>
                        <div className="flex items-center justify-between mt-1 text-[11px]">
                          <span className="text-slate-500">
                            Game: <b className="text-comic-red">{gCount}</b>
                          </span>
                          <span className="text-slate-500">
                            All: <b className="text-comic-darkBlue">{atCount}</b>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ability Usage Panel */}
            <div className="bg-amber-50 p-4 rounded-xl border-2 border-comic-black shadow-comic-sm">
              <h4 className="font-bangers text-base uppercase tracking-wider text-comic-darkBlue mb-3">
                Ability Executions
              </h4>
              {sortedAbilityIds.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  No declarative abilities registered or used on this card.
                </p>
              ) : (
                <div className="space-y-2">
                  {sortedAbilityIds.map((abId) => {
                    const abConfig = abilitiesConfig.find((a) => a.id === abId);
                    const label = abConfig?.timing || abConfig?.trigger || 'Ability';
                    const gCount = gameCardStats?.abilitiesUsed?.[abId] || 0;
                    const atCount = allTimeCardStats?.abilitiesUsed?.[abId] || 0;
                    return (
                      <div
                        key={abId}
                        className="bg-white p-3 rounded-lg border-2 border-comic-black flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-3">
                          <div className="font-bold text-comic-darkBlue truncate font-mono">
                            {abId}
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                            {label}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 font-mono text-xs">
                          <span title="Uses in current game">
                            Game: <b className="text-comic-red">{gCount}</b>
                          </span>
                          <span title="Total all-time uses">
                            All: <b className="text-comic-darkBlue">{atCount}</b>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-comic-paper border-t-2 border-comic-black flex items-center justify-between select-none">
            <div>
              {devMode && (
                <button
                  type="button"
                  onClick={() => setShowConfirmReset(true)}
                  className="px-3 py-1.5 text-xs font-bold font-comic rounded-lg border-2 border-comic-black bg-rose-50 hover:bg-rose-100 text-comic-red shadow-comic-sm cursor-pointer transition-transform active:scale-95 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset Card Stats</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold font-comic uppercase rounded-lg border-2 border-comic-black bg-comic-yellow hover:bg-amber-300 text-comic-black shadow-comic-sm cursor-pointer transition-transform active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </ModalLayer>

      {showConfirmReset && (
        <ResetCardStatsConfirmModal
          isOpen={showConfirmReset}
          onClose={() => setShowConfirmReset(false)}
          card={card}
          onConfirm={() => onStatsReset?.()}
        />
      )}
    </>
  );
};
