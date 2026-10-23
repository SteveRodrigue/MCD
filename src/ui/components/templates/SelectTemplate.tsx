import React, { useState } from 'react';
import { Check, Layers } from 'lucide-react';
import { CardRef } from './CardRef';
import { AccentStripe } from './AccentStripe';
import { ModalScaffold } from './ModalScaffold';
import { SpeechBubble } from './ComicSpeech';
import { useActionBurst } from './useActionBurst';
import { useModalStyle } from './useModalStyle';
import type { VerbColor } from './modal-styles';
import { SEARCH_SOURCE, SELECT_POOL } from './template-data';

const MIN = 1;
const MAX = 2;

export interface SelectTemplateProps {
  verb?: VerbColor;
  onAction?: (message: string) => void;
}

/**
 * Archetype 3: Card multi-selection. Source card in the header, a grid of selectable card tiles,
 * a counter, and a confirm button that is only enabled for a valid count.
 */
export const SelectTemplate: React.FC<SelectTemplateProps> = ({ verb = 'yellow', onAction }) => {
  const { style } = useModalStyle();
  const { burst, fire } = useActionBurst();
  const [selectedIds, setSelectedIds] = useState<string[]>(['c2']);

  const toggle = (id: string) => {
    if (!selectedIds.includes(id) && selectedIds.length < MAX) fire();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length < MAX ? [...prev, id] : prev,
    );
  };

  const isValid = selectedIds.length >= MIN && selectedIds.length <= MAX;

  return (
    <ModalScaffold
      title="Search your deck for an ally or upgrade"
      kicker="Card selection"
      verb={verb}
      trigger={SEARCH_SOURCE}
      icon={<Layers className="w-5 h-5" />}
      maxWidthClass="max-w-3xl"
      headerRight={
        <span className={`text-sm font-black px-3 py-1 ${style.chip}`}>
          {selectedIds.length} / {MAX} SELECTED
        </span>
      }
      footer={
        <>
          <div className={`text-xs font-bold ${style.muted}`}>
            Select between {MIN} and {MAX} cards to add to your hand.
          </div>
          <button
            type="button"
            disabled={!isValid}
            onClick={() => {
              fire();
              onAction?.(
                `Confirmed: ${SELECT_POOL.filter((c) => selectedIds.includes(c.id))
                  .map((c) => c.name)
                  .join(', ')}`,
              );
            }}
            className={`px-6 py-2.5 font-black text-sm flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0 ${style.btnGo}`}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>CONFIRM SELECTION</span>
          </button>
        </>
      }
      burst={burst}
      testId="template-select"
    >
      <SpeechBubble speaker={SEARCH_SOURCE}>Who should I call in as backup?</SpeechBubble>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SELECT_POOL.map((card) => {
          const isSelected = selectedIds.includes(card.id);
          const isDisabled = !isSelected && selectedIds.length >= MAX;

          return (
            <button
              key={card.id}
              type="button"
              disabled={isDisabled}
              aria-pressed={isSelected}
              aria-label={card.name}
              onClick={() => toggle(card.id)}
              className={`relative flex flex-col items-center gap-2 p-3 pl-4 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isSelected ? style.tileSelected : style.tile
              }`}
            >
              <AccentStripe code={card.code} />
              <CardRef {...card} size="lg" stacked className="text-xs uppercase" />
            </button>
          );
        })}
      </div>
    </ModalScaffold>
  );
};
