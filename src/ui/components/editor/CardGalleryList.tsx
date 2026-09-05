import React from 'react';
import { CardSummary } from '../../../tools/editor/api-middleware';
import { CheckCircle, AlertTriangle, HelpCircle, FileQuestion, ShieldCheck } from 'lucide-react';

interface CardGalleryListProps {
  cards: CardSummary[];
  selectedCode: string | null;
  onSelectCard: (code: string) => void;
  loading: boolean;
}

export const CardGalleryList: React.FC<CardGalleryListProps> = ({
  cards,
  selectedCode,
  onSelectCard,
  loading,
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

  return (
    <div className="overflow-y-auto h-full divide-y-2 divide-black bg-comic-paper">
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
  );
};
