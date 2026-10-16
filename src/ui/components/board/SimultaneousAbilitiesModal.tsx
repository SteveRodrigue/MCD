import React, { useState } from 'react';
import { ModalLayer } from '../layout/ModalLayer';
import { Zap, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import { PendingDecisionPrompt, NormalizedCard } from '../../../engine/models';
import { cardCatalog } from '../../../data/importer/card-loader';
import { CardArtThumbnail } from '../cards/CardArtThumbnail';
import { FormattedCardText } from '../cards/FormattedCardText';
import { PromptCardPanel } from './PromptCardPanel';

export interface SimultaneousAbilitiesModalProps {
  prompt: PendingDecisionPrompt;
  onConfirmOrder: (sequenceOrder: string[]) => void;
}

interface CandidateItem {
  id: string;
  promptId: string;
  title: string;
  cardCode?: string;
  ownerName?: string;
  triggerType?: string;
  description?: string;
}

export const SimultaneousAbilitiesModal: React.FC<SimultaneousAbilitiesModalProps> = ({
  prompt,
  onConfirmOrder,
}) => {
  const initialCandidates: CandidateItem[] =
    prompt.options && prompt.options.length > 0
      ? prompt.options.map((opt) => {
          const matchingPrompt = prompt.simultaneousPrompts?.find(
            (p) => p.promptId === opt.id || p.options.some((o) => o.id === opt.id),
          );
          const params = opt.params as
            | {
                promptId?: string;
                playerName?: string;
                triggerType?: string;
              }
            | undefined;
          return {
            id: opt.id,
            promptId: params?.promptId || matchingPrompt?.promptId || opt.id,
            title: opt.cardName || opt.label || matchingPrompt?.sourceCardName || 'Ability',
            cardCode: opt.cardCode || matchingPrompt?.sourceCardCode,
            ownerName: params?.playerName || matchingPrompt?.playerId,
            triggerType: params?.triggerType || matchingPrompt?.triggerType || 'INTERRUPT',
            description: opt.description || matchingPrompt?.description,
          };
        })
      : (prompt.simultaneousPrompts || []).map((p) => ({
          id: p.promptId,
          promptId: p.promptId,
          title: p.sourceCardName,
          cardCode: p.sourceCardCode,
          ownerName: p.playerId,
          triggerType: p.triggerType || 'INTERRUPT',
          description: p.description,
        }));

  const [orderedCandidates, setOrderedCandidates] = useState<CandidateItem[]>(initialCandidates);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const moveCandidate = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex >= 0 && targetIndex < orderedCandidates.length) {
      const updated = [...orderedCandidates];
      const [item] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, item);
      setOrderedCandidates(updated);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const updated = [...orderedCandidates];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);
    setOrderedCandidates(updated);
    setDraggedIndex(null);
  };

  const triggerCard: NormalizedCard | undefined =
    prompt.triggerSourceCard ||
    (prompt.triggerSourceCode ? cardCatalog.getCard(prompt.triggerSourceCode) : undefined);

  const handleConfirm = () => {
    const sequenceOrder = orderedCandidates.map((c) => c.promptId || c.id);
    onConfirmOrder(sequenceOrder);
  };

  return (
    <ModalLayer className="inset-0 flex items-center justify-center p-4 bg-comic-black/80 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-200 font-comic">
      <div
        data-testid="simultaneous-abilities-modal"
        className="relative w-full max-w-2xl max-h-[90vh] bg-comic-paper border-4 border-comic-black rounded-xl shadow-comic-xl overflow-hidden flex flex-col font-comic"
      >
        {/* Comic background dots */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#000 2px, transparent 2px)',
            backgroundSize: '12px 12px',
          }}
        />

        {/* 1. Header */}
        <div className="relative px-5 py-3.5 bg-comic-yellow border-b-4 border-comic-black flex items-center justify-between text-comic-black select-none">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-comic-black text-comic-yellow rounded-lg shadow-comic-sm">
              <Zap className="w-5 h-5 text-comic-yellow" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                Simultaneous Resolution
              </div>
              <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight leading-none">
                Choose Resolution Order
              </h2>
            </div>
          </div>
          <span className="text-xs font-black px-2.5 py-1 rounded border-2 border-comic-black bg-comic-red text-white shadow-comic-sm">
            FIRST PLAYER CHOICE
          </span>
        </div>

        {/* 2. Body */}
        <div className="relative p-5 space-y-4 overflow-y-auto">
          {/* Explanation note */}
          <div className="text-xs sm:text-sm font-bold text-slate-800 bg-amber-50 border-2 border-comic-black/30 p-2.5 rounded-lg shadow-xs">
            <FormattedCardText
              text={
                prompt.description ||
                'Multiple optional abilities triggered simultaneously. The first player determines the order in which they resolve.'
              }
            />
          </div>

          {/* Triggering event showcase */}
          {triggerCard && (
            <div className="mb-2">
              <PromptCardPanel label="TRIGGERING CARD" card={triggerCard} />
            </div>
          )}

          {/* Candidates list */}
          <div className="space-y-2.5">
            <div className="text-xs font-black text-comic-black uppercase tracking-wider">
              Resolution Pipeline (First ➔ Last):
            </div>
            {orderedCandidates.map((candidate, index) => {
              const isFirst = index === 0;
              const isLast = index === orderedCandidates.length - 1;
              return (
                <div
                  key={candidate.id}
                  data-testid={`candidate-${candidate.id}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border-3 border-comic-black bg-white shadow-comic-sm transition-all select-none ${
                    isFirst ? 'ring-2 ring-amber-400 bg-amber-50/50' : ''
                  } ${draggedIndex === index ? 'opacity-40 scale-95' : ''}`}
                >
                  {/* Step counter badge */}
                  <div
                    data-testid={`candidate-order-step-${index + 1}`}
                    className="flex flex-col items-center justify-center w-12 shrink-0 py-1 px-2 rounded-lg bg-comic-black text-comic-yellow border-2 border-comic-black shadow-comic-xs text-center"
                  >
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-300">
                      STEP
                    </span>
                    <span className="text-base font-black leading-none">{index + 1}</span>
                  </div>

                  {/* Thumbnail */}
                  <div className="shrink-0">
                    <CardArtThumbnail
                      cardCode={candidate.cardCode}
                      cardName={candidate.title}
                      size="md"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-comic font-black text-sm uppercase text-comic-black truncate">
                        {candidate.title}
                      </span>
                      {candidate.ownerName && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-800 border border-comic-black/30">
                          {candidate.ownerName}
                        </span>
                      )}
                      {candidate.triggerType && (
                        <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-300 text-comic-black border border-comic-black/40">
                          {candidate.triggerType}
                        </span>
                      )}
                    </div>
                    {candidate.description && (
                      <div className="text-xs text-slate-700 line-clamp-2">
                        <FormattedCardText text={candidate.description} />
                      </div>
                    )}
                  </div>

                  {/* Up / Down Controls */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      data-testid={`move-up-${candidate.id}`}
                      disabled={isFirst}
                      onClick={() => moveCandidate(index, -1)}
                      className="p-1 rounded bg-comic-paper hover:bg-amber-100 disabled:opacity-30 disabled:cursor-not-allowed border-2 border-comic-black shadow-comic-xs transition-colors"
                      title="Move earlier"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-comic-black" />
                    </button>
                    <button
                      type="button"
                      data-testid={`move-down-${candidate.id}`}
                      disabled={isLast}
                      onClick={() => moveCandidate(index, 1)}
                      className="p-1 rounded bg-comic-paper hover:bg-amber-100 disabled:opacity-30 disabled:cursor-not-allowed border-2 border-comic-black shadow-comic-xs transition-colors"
                      title="Move later"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-comic-black" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Footer */}
        <div className="relative px-5 py-3.5 bg-slate-100 border-t-4 border-comic-black flex items-center justify-end">
          <button
            type="button"
            data-testid="confirm-order-button"
            onClick={handleConfirm}
            className="px-6 py-2.5 bg-comic-yellow hover:bg-amber-400 text-comic-black font-black uppercase tracking-wider rounded-lg border-2 border-comic-black shadow-comic active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span>Confirm Order</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </ModalLayer>
  );
};

export default SimultaneousAbilitiesModal;
