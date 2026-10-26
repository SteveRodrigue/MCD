import React, { useEffect, useRef, useState } from 'react';
import { useTimeout } from '../../hooks/useTimeout';
import { createPortal } from 'react-dom';
import { NormalizedCard } from '../../../engine/models';
import { AllTimeStats } from '../../../engine/models/stats';
import { ExternalLink, Copy, Check, Info, X, Bug, BarChart2, Trash2 } from 'lucide-react';
import { ReportProblemModal } from '../board/ReportProblemModal';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { themeFontVars } from '../../theme/modal-styles';
import { useModalStyle } from '../../theme/useModalStyle';
import { CardStatsModal } from './CardStatsModal';
import { ResetCardStatsConfirmModal } from './ResetCardStatsConfirmModal';
import { useOptionalGameSession } from '../../context/GameStateContext';
import { useGameSettings } from '../../context/useGameSettings';
import { getAllTimeStats, resetCardStats } from '../../services/stats-storage-service';

interface CardContextMenuProps {
  card: NormalizedCard;
  position: { x: number; y: number };
  onClose: () => void;
}

export const CardContextMenu: React.FC<CardContextMenuProps> = ({ card, position, onClose }) => {
  const later = useTimeout();
  const { style } = useModalStyle();
  const menuRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawModal, setShowRawModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  const gameState = useOptionalGameSession()?.state;
  const { devMode } = useGameSettings();
  const [allTimeStats, setAllTimeStats] = useState<AllTimeStats | undefined>(undefined);

  useEffect(() => {
    getAllTimeStats()
      .then(setAllTimeStats)
      .catch(() => {});
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to stay on screen
  const menuWidth = 240;
  const menuHeight = 280;
  const adjustedX = Math.min(position.x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(position.y, window.innerHeight - menuHeight - 10);

  const handleOpenEditor = () => {
    window.open(`/editor?code=${card.code}`, '_blank');
    onClose();
  };

  const handleOpenMarvelCdb = () => {
    window.open(
      `https://marvelcdb.com/card/${encodeURIComponent(card.code)}`,
      '_blank',
      'noopener,noreferrer',
    );
    onClose();
  };

  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(card.code);
    setCopied(true);
    later(() => {
      setCopied(false);
      onClose();
    }, 800);
  };

  const handleCopyJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(card, null, 2));
    setCopiedJson(true);
    later(() => {
      setCopiedJson(false);
    }, 1500);
  };

  const handleStatsReset = async () => {
    const updated = await resetCardStats(card.code);
    setAllTimeStats(updated);
  };

  const gameCardStats = gameState?.stats?.cards?.[card.code];
  const allTimeCardStats = allTimeStats?.cards?.[card.code];

  const gamePlays = gameCardStats?.played || 0;
  const allTimePlays = allTimeCardStats?.played || 0;

  const gameAbilities = Object.values(gameCardStats?.abilitiesUsed || {}).reduce(
    (a, b) => a + b,
    0,
  );
  const allTimeAbilities = Object.values(allTimeCardStats?.abilitiesUsed || {}).reduce(
    (a, b) => a + b,
    0,
  );

  const gameBasicActions = Object.values(gameCardStats?.basicActions || {}).reduce(
    (a, b) => a + (b || 0),
    0,
  );
  const allTimeBasicActions = Object.values(allTimeCardStats?.basicActions || {}).reduce(
    (a, b) => a + (b || 0),
    0,
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {!showReportModal && !showStatsModal && !showResetConfirmModal && (
        <div
          ref={menuRef}
          style={{
            ...themeFontVars(style),
            left: `${Math.max(10, adjustedX)}px`,
            top: `${Math.max(10, adjustedY)}px`,
          }}
          className={`fixed z-menu w-64 overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100 font-body ${style.panel} ${style.text}`}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Header Strip */}
          <div className={`px-3 py-2 flex items-center justify-between ${style.panelHead}`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`font-mono text-micro font-bold px-1.5 py-0.2 ${style.chip}`}>
                {card.code}
              </span>
              <span className="font-bold text-sm truncate tracking-wide">{card.name}</span>
            </div>
            <button
              onClick={onClose}
              className={`cursor-pointer p-0.5 opacity-70 hover:opacity-100 ${style.muted}`}
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Stats Recap */}
          <div
            className={`px-3 py-1.5 text-mini space-y-0.5 rounded-none! border-x-0! border-t-0! ${style.inset}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold">Plays:</span>
              <span className="font-mono text-micro">
                Game: <b className="text-comic-red">{gamePlays}</b> | All:{' '}
                <b className={style.emphasis}>{allTimePlays}</b>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold">Abilities:</span>
              <span className="font-mono text-micro">
                Game: <b className="text-comic-red">{gameAbilities}</b> | All:{' '}
                <b className={style.emphasis}>{allTimeAbilities}</b>
              </span>
            </div>
            {(gameBasicActions > 0 || allTimeBasicActions > 0) && (
              <div className="flex items-center justify-between">
                <span className="font-bold">Actions:</span>
                <span className="font-mono text-micro">
                  Game: <b className="text-comic-red">{gameBasicActions}</b> | All:{' '}
                  <b className={style.emphasis}>{allTimeBasicActions}</b>
                </span>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="p-1.5 space-y-1 text-xs">
            {/* 1. View Detailed Stats */}
            <button
              type="button"
              onClick={() => setShowStatsModal(true)}
              className={`group w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-left cursor-pointer ${style.option}`}
            >
              <BarChart2 className="w-4 h-4 text-comic-blue shrink-0" />
              <span>View Detailed Stats</span>
            </button>

            {/* 2. Open in Supplemental Editor */}
            <button
              type="button"
              onClick={handleOpenEditor}
              className={`group w-full flex items-center gap-2 px-2.5 py-2 font-comic font-bold text-left cursor-pointer ${style.option}`}
            >
              <ExternalLink className="w-4 h-4 text-comic-accent shrink-0" />
              <span>Open in Supplemental Editor</span>
            </button>

            {/* 3. Open in MarvelCDB */}
            <button
              type="button"
              onClick={handleOpenMarvelCdb}
              className={`group w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-left cursor-pointer ${style.option}`}
            >
              <ExternalLink className="w-4 h-4 text-comic-blue shrink-0" />
              <span>Open in MarvelCDB</span>
            </button>

            {/* 4. Copy Card Code */}
            <button
              type="button"
              onClick={handleCopyCode}
              className={`group w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-left cursor-pointer ${style.option}`}
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-700 shrink-0" />
              ) : (
                <Copy className="w-4 h-4 opacity-60 shrink-0" />
              )}
              <span>{copied ? 'Code Copied!' : 'Copy Card Code'}</span>
            </button>

            {/* 5. Inspect Raw Attributes Modal */}
            <button
              type="button"
              onClick={() => setShowRawModal(true)}
              className={`group w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-left cursor-pointer ${style.option}`}
            >
              <Info className="w-4 h-4 opacity-60 shrink-0" />
              <span>Inspect Attributes</span>
            </button>

            {/* 6. Create Issue for Card */}
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className={`group w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-left cursor-pointer ${style.option}`}
            >
              <Bug className="w-4 h-4 text-comic-red shrink-0" />
              <span>Create issue for this card</span>
            </button>

            {/* 7. Reset Card Stats (Dev Mode Only) */}
            {devMode && (
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(true)}
                className={`group w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-comic-red text-left cursor-pointer border-t border-current/20 mt-1 pt-1.5 ${style.option}`}
              >
                <Trash2 className="w-4 h-4 text-comic-red shrink-0" />
                <span>Reset Card Stats</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Raw Attributes Quick Modal (Dev) */}
      {showRawModal && (
        <ModalScaffold
          title="Inspect card"
          kicker="Raw attributes"
          verb="blue"
          trigger={{ name: card.name, code: card.code }}
          icon={<Info className="w-5 h-5" />}
          onClose={() => {
            setShowRawModal(false);
            onClose();
          }}
          closeOnBackdrop
          maxWidthClass="max-w-xl"
          testId="card-raw-modal"
          footer={
            <>
              <span />
              <button
                type="button"
                onClick={handleCopyJson}
                className={`flex items-center gap-1.5 text-xs font-black px-2.5 py-1 cursor-pointer ${style.btnGo}`}
                title="Copy full card JSON to clipboard"
              >
                {copiedJson ? (
                  <Check className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{copiedJson ? 'Copied JSON!' : 'Copy JSON'}</span>
              </button>
            </>
          }
        >
          <pre
            className={`w-full font-mono text-xs p-3.5 overflow-auto max-h-[60vh] select-text cursor-text ${style.inset}`}
          >
            {JSON.stringify(card, null, 2)}
          </pre>
        </ModalScaffold>
      )}

      {showReportModal && (
        <ReportProblemModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            onClose();
          }}
          initialDescription={`Card: ${card.name} (${(card as any).id || card.code})\n\n`}
        />
      )}

      {showStatsModal && (
        <CardStatsModal
          isOpen={showStatsModal}
          onClose={() => {
            setShowStatsModal(false);
            onClose();
          }}
          card={card}
          gameState={gameState}
          allTimeStats={allTimeStats}
          devMode={devMode}
          onStatsReset={handleStatsReset}
        />
      )}

      {showResetConfirmModal && (
        <ResetCardStatsConfirmModal
          isOpen={showResetConfirmModal}
          onClose={() => setShowResetConfirmModal(false)}
          card={card}
          onConfirm={handleStatsReset}
        />
      )}
    </>,
    document.body,
  );
};
