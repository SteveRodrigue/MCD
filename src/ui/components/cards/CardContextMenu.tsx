import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NormalizedCard } from '../../../engine/models';
import { ExternalLink, Copy, Check, Info, X } from 'lucide-react';

interface CardContextMenuProps {
  card: NormalizedCard;
  position: { x: number; y: number };
  onClose: () => void;
}

export const CardContextMenu: React.FC<CardContextMenuProps> = ({ card, position, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [showRawModal, setShowRawModal] = useState(false);

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
  const menuHeight = 160;
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
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
        </div>
      </div>

      {/* Raw Attributes Quick Modal */}
      {showRawModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => {
            setShowRawModal(false);
            onClose();
          }}
        >
          <div
            ref={modalRef}
            className="bg-white border-4 border-black max-w-lg w-full p-4 rounded-lg shadow-comic-lg font-sans max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
              <span className="font-bangers text-lg tracking-wide text-black">
                RAW ATTRIBUTES: {card.name} ({card.code})
              </span>
              <button
                onClick={() => {
                  setShowRawModal(false);
                  onClose();
                }}
                className="text-black font-bold p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="flex-1 bg-gray-950 text-green-400 font-mono text-xs p-3 rounded overflow-auto border border-black max-h-96">
              {JSON.stringify(card, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
};
