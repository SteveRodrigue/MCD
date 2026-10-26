import React, { useState } from 'react';
import { Zap, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import { PendingDecisionPrompt, NormalizedCard } from '../../../engine/models';
import { cardCatalog } from '../../../data/importer/card-loader';
import { CardArtThumbnail } from '../cards/CardArtThumbnail';
import { FormattedCardText } from '../cards/FormattedCardText';
import { PromptCardPanel } from './PromptCardPanel';
import { AccentStripe } from '../../theme/AccentStripe';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';

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
  const { style } = useModalStyle();
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
    <ModalScaffold
      title="Choose Resolution Order"
      kicker="Simultaneous Resolution"
      verb="yellow"
      trigger={null}
      icon={<Zap className="w-5 h-5" />}
      maxWidthClass="max-w-2xl"
      testId="simultaneous-abilities-modal"
      footer={
        <button
          type="button"
          data-testid="confirm-order-button"
          onClick={handleConfirm}
          className={`ml-auto px-6 py-2.5 font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer ${style.btnGo}`}
        >
          <span>Confirm Order</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      }
    >
      {/* Explanation note */}
      <div className={`text-xs sm:text-sm font-bold p-2.5 ${style.inset}`}>
        <FormattedCardText
          text={
            prompt.description ||
            'Multiple optional abilities triggered simultaneously. The first player determines the order in which they resolve.'
          }
        />
      </div>

      {/* Triggering event showcase */}
      {triggerCard && <PromptCardPanel label="TRIGGERING CARD" card={triggerCard} />}

      {/* Candidates list */}
      <div className="space-y-2.5">
        <div className="text-xs font-black uppercase tracking-wider">First ➔ Last</div>
        {orderedCandidates.map((candidate, index) => {
          const isFirst = index === 0;
          const isLast = index === orderedCandidates.length - 1;
          return (
            <div
              key={candidate.id}
              data-testid={`candidate-${candidate.id}`}
              data-card-anchor={candidate.cardCode ?? ''}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              className={`relative flex items-center gap-3 p-3 pl-4 transition-all select-none ${
                isFirst ? style.slotFinal : style.slot
              } ${draggedIndex === index ? 'opacity-40 scale-95' : ''}`}
            >
              <AccentStripe code={candidate.cardCode ?? ''} />
              {/* Step counter badge */}
              <div
                data-testid={`candidate-order-step-${index + 1}`}
                className={`flex flex-col items-center justify-center w-12 shrink-0 py-1 px-2 text-center ${style.chip}`}
              >
                <span className="font-comic text-base font-black leading-none">{index + 1}</span>
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
                  <span className="font-black text-sm uppercase truncate">{candidate.title}</span>
                  {candidate.ownerName && (
                    <span className={`text-micro font-bold px-1.5 py-0.5 ${style.inset}`}>
                      {candidate.ownerName}
                    </span>
                  )}
                  {candidate.triggerType && (
                    <span className="text-micro font-black uppercase px-1.5 py-0.5 rounded-sm bg-amber-300 text-comic-black border border-comic-black/40">
                      {candidate.triggerType}
                    </span>
                  )}
                </div>
                {candidate.description && (
                  <div className={`text-xs line-clamp-2 ${style.muted}`}>
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
                  className={`p-1 cursor-pointer disabled:cursor-not-allowed ${style.btnMove}`}
                  title="Move earlier"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  data-testid={`move-down-${candidate.id}`}
                  disabled={isLast}
                  onClick={() => moveCandidate(index, 1)}
                  className={`p-1 cursor-pointer disabled:cursor-not-allowed ${style.btnMove}`}
                  title="Move later"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ModalScaffold>
  );
};

export default SimultaneousAbilitiesModal;
