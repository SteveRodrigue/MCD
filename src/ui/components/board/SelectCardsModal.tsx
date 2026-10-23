import React, { useState } from 'react';
import { CheckCircle2, Layers } from 'lucide-react';
import { PendingDecisionPrompt } from '../../../engine/models';
import { AccentStripe } from '../../theme/AccentStripe';
import { CardRef } from '../../theme/CardRef';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';
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
  const { style } = useModalStyle();
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

  return (
    <ModalScaffold
      title={prompt.title}
      kicker="Card selection"
      verb="yellow"
      trigger={{ code: prompt.sourceCardCode, name: prompt.sourceCardName }}
      icon={<Layers className="w-5 h-5" />}
      maxWidthClass="max-w-2xl"
      headerRight={
        <span
          data-testid="select-cards-counter"
          className={`text-sm font-black px-2.5 py-1 ${style.chip}`}
        >
          {chosen.length} / {selection.max}
        </span>
      }
      footer={
        <button
          type="button"
          data-testid="select-cards-confirm"
          disabled={!canConfirm}
          onClick={() => onConfirm(chosen)}
          className={`ml-auto px-5 py-2 font-black uppercase cursor-pointer disabled:cursor-not-allowed ${style.btnGo}`}
        >
          Confirm
        </button>
      }
    >
      <div className="text-sm font-bold">
        <FormattedCardText text={prompt.description} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {prompt.options.map((option) => {
          const info = option.params as CardOptionParams | undefined;
          const isChosen = chosen.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              data-testid={`select-card-${option.id}`}
              data-card-anchor={info?.cardCode ?? ''}
              aria-label={info?.cardName ?? option.label}
              disabled={isDisabled(option.id)}
              aria-pressed={isChosen}
              onClick={() => toggle(option.id)}
              className={`relative flex flex-col items-center gap-1.5 p-2 pl-3 transition-transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isChosen ? style.tileSelected : style.tile
              }`}
            >
              <AccentStripe code={info?.cardCode ?? ''} />
              <CardRef
                code={info?.cardCode}
                name={info?.cardName ?? option.label}
                size="lg"
                stacked
                className="text-xs uppercase"
              />
              {option.description && (
                <div className={`text-[10px] text-center line-clamp-3 ${style.muted}`}>
                  <FormattedCardText text={option.description} />
                </div>
              )}
              {isChosen && <CheckCircle2 className={`w-4 h-4 ${style.emphasis}`} />}
            </button>
          );
        })}
      </div>
    </ModalScaffold>
  );
};
