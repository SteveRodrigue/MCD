import React, { useState } from 'react';
import { BarChart3, Trash2 } from 'lucide-react';
import { NormalizedCard, GameState } from '../../../engine/models';
import { AllTimeStats, CardUsageStats } from '../../../engine/models/stats';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';
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

/** Counts are written as "this game / all-time"; the legend above them says so once. */
const Counts: React.FC<{ game: number; allTime: number; className?: string }> = ({
  game,
  allTime,
  className = '',
}) => (
  <span className={`font-black tabular-nums ${className}`}>
    <b className="text-comic-red">{game}</b> / <b>{allTime}</b>
  </span>
);

const Legend: React.FC = () => {
  const { style } = useModalStyle();
  return (
    <p className={`mb-2 text-micro font-bold uppercase tracking-wide ${style.muted}`}>
      <b className="text-comic-red">This game</b> / all-time
    </p>
  );
};

export const CardStatsModal: React.FC<CardStatsModalProps> = ({
  isOpen,
  onClose,
  card,
  gameState,
  allTimeStats,
  devMode = false,
  onStatsReset,
}) => {
  const { style } = useModalStyle();
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

  const heading = `font-bangers text-base uppercase tracking-wider mb-3 ${style.emphasis}`;

  return (
    <>
      <ModalScaffold
        title="Card stats"
        kicker="Usage"
        verb="blue"
        trigger={{ name: card.name, code: card.code }}
        icon={<BarChart3 className="w-5 h-5" />}
        onClose={onClose}
        maxWidthClass="max-w-xl"
        testId="card-stats-modal"
        footer={
          <>
            <div>
              {devMode && (
                <button
                  type="button"
                  onClick={() => setShowConfirmReset(true)}
                  className={`px-3 py-1.5 text-xs font-bold font-comic cursor-pointer flex items-center gap-1.5 ${style.btnMove}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Reset Card Stats</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`px-5 py-2 text-xs font-bold font-comic uppercase cursor-pointer ${style.btnGo}`}
            >
              Close
            </button>
          </>
        }
      >
        <div className="space-y-5">
          {/* Plays Overview Panel */}
          <div className={`p-4 ${style.panel}`}>
            <h4 className={heading}>Card Plays & Reveals</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-3 text-center ${style.inset}`}>
                <div className={`text-mini font-bold uppercase tracking-wide ${style.muted}`}>
                  This Game
                </div>
                <div className="font-bangers text-3xl text-comic-red mt-0.5">{gamePlays}</div>
              </div>
              <div className={`p-3 text-center ${style.inset}`}>
                <div className={`text-mini font-bold uppercase tracking-wide ${style.muted}`}>
                  All-Time
                </div>
                <div className="font-bangers text-3xl mt-0.5">{allTimePlays}</div>
              </div>
            </div>
          </div>

          {/* Basic Actions Panel (if applicable) */}
          {hasAnyBasicActions && (
            <div className={`p-4 ${style.panel}`}>
              <h4 className={heading}>Basic Actions</h4>
              <Legend />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {basicActionsKeys.map(({ key, label }) => {
                  const gCount = gameCardStats?.basicActions?.[key] || 0;
                  const atCount = allTimeCardStats?.basicActions?.[key] || 0;
                  return (
                    <div key={key} className={`p-2.5 flex flex-col justify-between ${style.inset}`}>
                      <span className="font-bold">{label}</span>
                      <Counts game={gCount} allTime={atCount} className="mt-1 text-mini" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ability Usage Panel */}
          <div className={`p-4 ${style.panel}`}>
            <h4 className={heading}>Ability Executions</h4>
            {sortedAbilityIds.length > 0 && <Legend />}
            {sortedAbilityIds.length === 0 ? (
              <p className={`text-xs italic ${style.muted}`}>
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
                      className={`p-3 flex items-center justify-between text-xs ${style.inset}`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="font-bold truncate font-mono">{abId}</div>
                        <div className={`text-micro uppercase tracking-wide ${style.muted}`}>
                          {label}
                        </div>
                      </div>
                      <Counts
                        game={gCount}
                        allTime={atCount}
                        className="shrink-0 font-mono text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ModalScaffold>

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
