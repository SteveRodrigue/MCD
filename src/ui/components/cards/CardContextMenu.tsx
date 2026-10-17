import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NormalizedCard } from '../../../engine/models';
import { AllTimeStats } from '../../../engine/models/stats';
import { ExternalLink, Copy, Check, Info, X, Bug, BarChart2, Trash2 } from 'lucide-react';
import { ReportProblemModal } from '../board/ReportProblemModal';
import { CardStatsModal } from './CardStatsModal';
import { ResetCardStatsConfirmModal } from './ResetCardStatsConfirmModal';
import { useGameState } from '../../context/GameStateContext';
import { useGameSettings } from '../../context/useGameSettings';
import { getAllTimeStats, resetCardStats } from '../../services/stats-storage-service';

interface CardContextMenuProps {
  card: NormalizedCard;
  position: { x: number; y: number };
  onClose: () => void;
}

export const CardContextMenu: React.FC<CardContextMenuProps> = ({ card, position, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawModal, setShowRawModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);

  const gameState = useGameState();
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
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        (!modalRef.current || !modalRef.current.contains(e.target as Node))
      ) {
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
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 800);
  };

  const handleCopyJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(card, null, 2));
    setCopiedJson(true);
    setTimeout(() => {
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
            left: `${Math.max(10, adjustedX)}px`,
            top: `${Math.max(10, adjustedY)}px`,
          }}
          className="fixed z-menu w-64 bg-white border-3 border-black shadow-comic-lg rounded-md overflow-hidden font-sans select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Header Strip */}
          <div className="bg-comic-panel border-b-2 border-black px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono text-[10px] font-bold bg-black text-white px-1.5 py-0.2 rounded">
                {card.code}
              </span>
              <span className="font-bangers text-sm text-black truncate tracking-wide">
                {card.name}
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-black cursor-pointer p-0.5"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Stats Recap */}
          <div className="bg-amber-50/90 border-b-2 border-black px-3 py-1.5 text-[11px] font-comic space-y-0.5">
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-bold">Plays:</span>
              <span className="font-mono text-[10px]">
                Game: <b className="text-comic-red">{gamePlays}</b> | All:{' '}
                <b className="text-comic-darkBlue">{allTimePlays}</b>
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-bold">Abilities:</span>
              <span className="font-mono text-[10px]">
                Game: <b className="text-comic-red">{gameAbilities}</b> | All:{' '}
                <b className="text-comic-darkBlue">{allTimeAbilities}</b>
              </span>
            </div>
            {(gameBasicActions > 0 || allTimeBasicActions > 0) && (
              <div className="flex items-center justify-between text-slate-700">
                <span className="font-bold">Actions:</span>
                <span className="font-mono text-[10px]">
                  Game: <b className="text-comic-red">{gameBasicActions}</b> | All:{' '}
                  <b className="text-comic-darkBlue">{allTimeBasicActions}</b>
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
              className="w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-gray-800 hover:bg-comic-yellow/50 rounded text-left transition-colors cursor-pointer"
            >
              <BarChart2 className="w-4 h-4 text-comic-darkBlue shrink-0" />
              <span>View Detailed Stats</span>
            </button>

            {/* 2. Open in Supplemental Editor */}
            <button
              type="button"
              onClick={handleOpenEditor}
              className="w-full flex items-center gap-2 px-2.5 py-2 font-comic font-bold text-black hover:bg-comic-yellow rounded text-left transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-comic-accent shrink-0" />
              <span>Open in Supplemental Editor</span>
            </button>

            {/* 3. Open in MarvelCDB */}
            <button
              type="button"
              onClick={handleOpenMarvelCdb}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-gray-800 hover:bg-comic-yellow/50 rounded text-left transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-comic-darkBlue shrink-0" />
              <span>Open in MarvelCDB</span>
            </button>

            {/* 4. Copy Card Code */}
            <button
              type="button"
              onClick={handleCopyCode}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-gray-800 hover:bg-gray-100 rounded text-left transition-colors cursor-pointer"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-700 shrink-0" />
              ) : (
                <Copy className="w-4 h-4 text-gray-500 shrink-0" />
              )}
              <span>{copied ? 'Code Copied!' : 'Copy Card Code'}</span>
            </button>

            {/* 5. Inspect Raw Attributes Modal */}
            <button
              type="button"
              onClick={() => setShowRawModal(true)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-gray-800 hover:bg-gray-100 rounded text-left transition-colors cursor-pointer"
            >
              <Info className="w-4 h-4 text-gray-500 shrink-0" />
              <span>Inspect Attributes</span>
            </button>

            {/* 6. Create Issue for Card */}
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-gray-800 hover:bg-rose-50 rounded text-left transition-colors cursor-pointer"
            >
              <Bug className="w-4 h-4 text-comic-red shrink-0" />
              <span>Create issue for this card</span>
            </button>

            {/* 7. Reset Card Stats (Dev Mode Only) */}
            {devMode && (
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(true)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-comic-red hover:bg-rose-50 rounded text-left transition-colors cursor-pointer border-t border-gray-200 mt-1 pt-1.5"
              >
                <Trash2 className="w-4 h-4 text-comic-red shrink-0" />
                <span>Reset Card Stats</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Raw Attributes Quick Modal */}
      {showRawModal && (
        <div
          className="fixed inset-0 bg-comic-black/80 z-menu flex items-center justify-center p-4 backdrop-blur-xs font-comic"
          onClick={() => {
            setShowRawModal(false);
            onClose();
          }}
        >
          <div
            ref={modalRef}
            className="bg-comic-paper border-4 border-comic-black max-w-xl w-full rounded-xl shadow-comic-xl max-h-[85vh] flex flex-col overflow-hidden select-text"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 bg-comic-darkBlue text-white border-b-4 border-comic-black select-none">
              <span className="font-comic text-lg uppercase tracking-wide text-comic-yellow truncate mr-2 select-text">
                INSPECT CARD: {card.name} ({card.code})
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="flex items-center gap-1.5 text-xs font-comic font-black px-2.5 py-1 bg-comic-yellow text-comic-black hover:bg-amber-300 border-2 border-comic-black rounded-lg transition-all cursor-pointer shadow-comic-sm"
                  title="Copy full card JSON to clipboard"
                >
                  {copiedJson ? (
                    <Check className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-comic-black shrink-0" />
                  )}
                  <span>{copiedJson ? 'Copied JSON!' : 'Copy JSON'}</span>
                </button>
                <button
                  onClick={() => {
                    setShowRawModal(false);
                    onClose();
                  }}
                  className="text-white p-1 bg-comic-black hover:bg-slate-800 rounded-lg border border-white/20 cursor-pointer shadow-comic-sm"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-comic-paper">
              <pre className="w-full bg-slate-950 text-emerald-400 font-mono text-xs p-3.5 rounded-lg border-2 border-comic-black overflow-auto max-h-[60vh] select-text cursor-text shadow-comic-sm">
                {JSON.stringify(card, null, 2)}
              </pre>
            </div>
          </div>
        </div>
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
