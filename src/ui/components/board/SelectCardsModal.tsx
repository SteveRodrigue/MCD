import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Zap } from 'lucide-react';
import { PendingDecisionPrompt } from '../../../engine/models';
import { CardArtThumbnail } from '../cards/CardArtThumbnail';
import { FormattedCardText } from '../cards/FormattedCardText';

interface SelectCardsModalProps {
  prompt: PendingDecisionPrompt;
  onConfirm: (selectedOptionIds: string[]) => void;
}

interface CardOptionParams {
  cardName?: string;
  cardCode?: string;
}

/**
 * Multi-select card prompt (`prompt.selection`): the player picks between `min` and `max` cards,
 * never two cards with the same name when `distinctBy` is `NAME` (SEARCH `takeCount` /
 * `minimumTake` / `distinctBy`).
 */
export const SelectCardsModal: React.FC<SelectCardsModalProps> = ({ prompt, onConfirm }) => {
  const selection = prompt.selection!;
  const [chosen, setChosen] = useState<string[]>([]);

  const infoOf = (optionId: string): CardOptionParams =>
    (prompt.options.find((o) => o.id === optionId)?.params as CardOptionParams) ?? {};
  const chosenNames = new Set(chosen.map((id) => infoOf(id).cardName));

  const isDisabled = (optionId: string): boolean => {
    if (chosen.includes(optionId)) return false;
    if (chosen.length >= selection.max) return true;
    return selection.distinctBy === 'NAME' && chosenNames.has(infoOf(optionId).cardName);
  };

  const toggle = (optionId: string) => {
    setChosen((prev) =>
      prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
    );
  };

  const canConfirm = chosen.length >= selection.min && chosen.length <= selection.max;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-comic-black/80 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-200 font-comic">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-comic-paper border-4 border-comic-black rounded-xl shadow-comic-xl overflow-hidden flex flex-col">
        <div className="relative px-5 py-3.5 bg-comic-yellow border-b-4 border-comic-black flex items-center justify-between text-comic-black select-none">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-comic-black text-comic-yellow rounded-lg shadow-comic-sm">
              <Zap className="w-5 h-5 text-comic-yellow" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                {prompt.sourceCardName}
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight leading-none">
                {prompt.title}
              </h2>
            </div>
          </div>
          <span
            data-testid="select-cards-counter"
            className="text-sm font-black px-2.5 py-1 rounded border-2 border-comic-black bg-white shadow-comic-sm"
          >
            {chosen.length} / {selection.max}
          </span>
        </div>

        <div className="relative px-5 pt-3 text-sm font-bold text-comic-black">
          <FormattedCardText text={prompt.description} />
        </div>

        <div className="relative p-5 grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto">
          {prompt.options.map((option) => {
            const info = option.params as CardOptionParams | undefined;
            const isChosen = chosen.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                data-testid={`select-card-${option.id}`}
                disabled={isDisabled(option.id)}
                aria-pressed={isChosen}
                onClick={() => toggle(option.id)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-4 shadow-comic-sm transition-transform ${
                  isChosen
                    ? 'border-comic-red bg-comic-yellow scale-[1.03]'
                    : 'border-comic-black bg-white hover:bg-amber-50'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <CardArtThumbnail cardCode={info?.cardCode} cardName={info?.cardName} size="lg" />
                <span className="text-xs font-black uppercase leading-tight text-center text-comic-black">
                  {info?.cardName ?? option.label}
                </span>
                {option.description && (
                  <div className="text-[10px] text-slate-600 text-center line-clamp-3">
                    <FormattedCardText text={option.description} />
                  </div>
                )}
                {isChosen && <CheckCircle2 className="w-4 h-4 text-comic-red" />}
              </button>
            );
          })}
        </div>

        <div className="relative px-5 py-3 border-t-4 border-comic-black bg-white flex justify-end">
          <button
            type="button"
            data-testid="select-cards-confirm"
            disabled={!canConfirm}
            onClick={() => onConfirm(chosen)}
            className="px-5 py-2 bg-comic-yellow border-4 border-comic-black rounded-lg font-black uppercase shadow-comic-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
