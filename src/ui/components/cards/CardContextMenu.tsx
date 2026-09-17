import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NormalizedCard } from '../../../engine/models';
import { ExternalLink, Copy, Check, Info, X, Bug } from 'lucide-react';
import { ReportProblemModal } from '../board/ReportProblemModal';

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
  const menuHeight = 200;
  const adjustedX = Math.min(position.x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(position.y, window.innerHeight - menuHeight - 10);

  const handleOpenEditor = () => {
    window.open(`/editor?code=${card.code}`, '_blank');
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {!showReportModal && (
        <div
          ref={menuRef}
          style={{
            left: `${Math.max(10, adjustedX)}px`,
            top: `${Math.max(10, adjustedY)}px`,
          }}
          className="fixed z-[9999] w-60 bg-white border-3 border-black shadow-comic-lg rounded-md overflow-hidden font-sans select-none animate-in fade-in zoom-in-95 duration-100"
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

          {/* Menu Items */}
          <div className="p-1.5 space-y-1 text-xs">
            {/* 1. Open in Supplemental Editor */}
            <button
              type="button"
              onClick={handleOpenEditor}
              className="w-full flex items-center gap-2 px-2.5 py-2 font-comic font-bold text-black hover:bg-comic-yellow rounded text-left transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-comic-accent shrink-0" />
              <span>Open in Supplemental Editor</span>
            </button>

            {/* 2. Copy Card Code */}
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

            {/* 3. Inspect Raw Attributes Modal */}
            <button
              type="button"
              onClick={() => setShowRawModal(true)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-gray-800 hover:bg-gray-100 rounded text-left transition-colors cursor-pointer"
            >
              <Info className="w-4 h-4 text-gray-500 shrink-0" />
              <span>Inspect Attributes</span>
            </button>

            {/* 4. Create Issue for Card */}
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 font-comic text-gray-800 hover:bg-rose-50 rounded text-left transition-colors cursor-pointer"
            >
              <Bug className="w-4 h-4 text-comic-red shrink-0" />
              <span>Create issue for this card</span>
            </button>
          </div>
        </div>
      )}

      {/* Raw Attributes Quick Modal */}
      {showRawModal && (
        <div
          className="fixed inset-0 bg-comic-black/80 z-[10000] flex items-center justify-center p-4 backdrop-blur-xs font-comic"
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
    </>,
    document.body,
  );
};
