import React from 'react';
import type { NormalizedCard } from '../../../engine/models';
import { CardView } from '../cards/CardView';
import { FormattedCardText } from '../cards/FormattedCardText';
import { AccentStripe } from '../../theme/AccentStripe';
import { useModalStyle } from '../../theme/useModalStyle';

interface PromptCardPanelProps {
  /** Badge text, e.g. "TRIGGERING ENCOUNTER CARD" or "ABILITY CARD". */
  label: string;
  card: NormalizedCard;
}

/** Card showcase used by the decision prompt: badge, type chip, icon, name, traits, full printed text. */
export const PromptCardPanel: React.FC<PromptCardPanelProps> = ({ label, card }) => {
  const { style } = useModalStyle();
  return (
    <div data-card-anchor={card.code} className={`relative p-3 pl-4 space-y-2 ${style.panel}`}>
      <AccentStripe code={card.code} />
      <div className={`flex items-center justify-between pb-1.5 ${style.panelHead}`}>
        <span className="text-micro font-black uppercase bg-comic-red text-white px-2 py-0.5 rounded-sm border border-comic-black shadow-comic-xs">
          {label}
        </span>
        <span className="text-micro font-mono font-bold uppercase bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-sm border border-comic-black/40">
          {card.type}
        </span>
      </div>

      <div className="flex items-start gap-3 pt-0.5">
        <div className="shrink-0">
          <CardView card={card} size="sm" enableHoverZoom={true} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <h4 className="font-black text-sm uppercase truncate">{card.name}</h4>
          {card.traits && card.traits.length > 0 && (
            <p className={`text-micro font-bold italic ${style.muted}`}>
              {card.traits.join('. ')}.
            </p>
          )}
          {card.text && (
            <div data-testid="prompt-card-text" className={`text-xs p-2 ${style.inset}`}>
              <FormattedCardText text={card.text} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptCardPanel;
