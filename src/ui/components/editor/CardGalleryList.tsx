import React from 'react';
import { CardSummary } from '../../../tools/editor/api-middleware';
import {
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  FileQuestion,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface CardGalleryListProps {
  cards: CardSummary[];
  selectedCode: string | null;
  onSelectCard: (code: string) => void;
  loading: boolean;
  page?: number;
  pageSize?: number;
  totalCards?: number;
  onPageChange?: (newPage: number) => void;
}

export const CardGalleryList: React.FC<CardGalleryListProps> = ({
  cards,
  selectedCode,
  onSelectCard,
  loading,
  page = 1,
  pageSize = 50,
  totalCards = 0,
  onPageChange,
}) => {
  if (loading) {
    return (
      <div className="p-8 text-center text-comic-dark font-comic flex flex-col items-center justify-center gap-2">
        <div className="w-8 h-8 border-4 border-black border-t-comic-red rounded-full animate-spin" />
        <span className="font-bold text-sm">Loading card catalog...</span>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="p-8 text-center text-comic-dark font-comic flex flex-col items-center justify-center gap-2">
        <FileQuestion className="w-10 h-10 text-gray-400" />
        <span className="font-bold text-base">No cards match the active filters.</span>
        <span className="text-xs text-gray-600">
          Try clearing or widening your filter selections.
        </span>
      </div>
    );
  }

  const totalPages = pageSize && totalCards ? Math.max(1, Math.ceil(totalCards / pageSize)) : 1;
  const startIdx = totalCards > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIdx = totalCards > 0 ? Math.min(page * pageSize, totalCards) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-comic-paper">
      <div className="overflow-y-auto flex-1 divide-y-2 divide-black">
        {cards.map((card) => {
          const isSelected = card.code === selectedCode;

          // Determine status icon and color
          let statusBadge = (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-200 px-1.5 py-0.5 border border-gray-400 rounded"
              title="No supplemental entry defined"
            >
              <HelpCircle className="w-3 h-3 text-gray-400" />
              <span>None</span>
            </span>
          );

          if (card.hasSupplemental) {
            if (!card.isValid) {
              statusBadge = (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-comic-red px-1.5 py-0.5 border border-black rounded shadow-comic-xs"
                  title={`${card.errorCount || 1} schema error(s)`}
                >
                  <AlertTriangle className="w-3 h-3 text-white" />
                  <span>Error</span>
                </span>
              );
            } else if (card.noSupplementalNeeded) {
              statusBadge = (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-900 bg-blue-100 px-1.5 py-0.5 border border-black rounded shadow-comic-xs"
                  title="Vanilla Card: No supplemental rules needed"
                >
                  <ShieldCheck className="w-3 h-3 text-blue-700" />
                  <span>Vanilla</span>
                </span>
              );
            } else if ((card.confidence ?? 0) >= 95) {
              statusBadge = (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-green-700 px-1.5 py-0.5 border border-black rounded shadow-comic-xs"
                  title={`Verified (${card.confidence}%)`}
                >
                  <CheckCircle className="w-3 h-3 text-green-200" />
                  <span>{card.confidence}%</span>
                </span>
              );
            } else {
              statusBadge = (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-black bg-comic-yellow px-1.5 py-0.5 border border-black rounded shadow-comic-xs"
                  title={`Draft / Review (${card.confidence || 0}%)`}
                >
                  <CheckCircle className="w-3 h-3 text-black" />
                  <span>{card.confidence || 0}%</span>
                </span>
              );
            }
          }

          return (
            <button
              key={card.code}
              type="button"
              onClick={() => onSelectCard(card.code)}
              className={`w-full text-left p-2.5 transition-colors cursor-pointer flex items-center justify-between gap-2 text-xs font-sans ${
                isSelected
                  ? 'bg-comic-yellow font-bold border-l-6 border-l-black shadow-inner'
                  : 'hover:bg-white bg-transparent'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[11px] font-bold bg-black text-white px-1.5 py-0.2 rounded">
                    {card.code}
                  </span>
                  <span className="font-bangers tracking-wide text-sm truncate text-black">
                    {card.name}
                    {card.stage ? ` (${card.stage})` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-600 truncate">
                  <span className="capitalize font-medium">{card.typeCode}</span>
                  <span>•</span>
                  <span className="capitalize">{card.factionCode}</span>
                  {card.setCode && (
                    <>
                      <span>•</span>
                      <span className="text-gray-500 truncate">{card.setCode}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1">{statusBadge}</div>
            </button>
          );
        })}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && onPageChange && (
        <div
          data-testid="gallery-pagination"
          className="shrink-0 p-2 border-t-2 border-black bg-comic-panel flex items-center justify-between gap-1 shadow-comic-xs select-none"
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="pagination-first-btn"
              disabled={page <= 1}
              onClick={() => onPageChange(1)}
              className="p-1 font-bold border-2 border-black bg-white hover:bg-comic-yellow disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed shadow-comic-xs cursor-pointer active:scale-95 transition-transform"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-testid="pagination-prev-btn"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-2 py-1 text-xs font-bold border-2 border-black bg-white hover:bg-comic-yellow disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed shadow-comic-xs cursor-pointer active:scale-95 transition-transform flex items-center gap-0.5"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
          </div>

          <div className="text-center font-comic">
            <div className="text-[11px] font-bold text-black">
              Page {page} of {totalPages}
            </div>
            <div className="text-[9px] text-gray-600">
              {startIdx}–{endIdx} of {totalCards}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="pagination-next-btn"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-2 py-1 text-xs font-bold border-2 border-black bg-white hover:bg-comic-yellow disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed shadow-comic-xs cursor-pointer active:scale-95 transition-transform flex items-center gap-0.5"
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              data-testid="pagination-last-btn"
              disabled={page >= totalPages}
              onClick={() => onPageChange(totalPages)}
              className="p-1 font-bold border-2 border-black bg-white hover:bg-comic-yellow disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed shadow-comic-xs cursor-pointer active:scale-95 transition-transform"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
