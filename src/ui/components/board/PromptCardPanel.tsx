import React from 'react';
import type { NormalizedCard } from '../../../engine/models';
import { CardView } from '../cards/CardView';
import { FormattedCardText } from '../cards/FormattedCardText';

interface PromptCardPanelProps {
  /** Badge text, e.g. "TRIGGERING ENCOUNTER CARD" or "ABILITY CARD". */
  label: string;
  card: NormalizedCard;
}

/** Card showcase used by the decision prompt: badge, type chip, icon, name, traits, full printed text. */
export const PromptCardPanel: React.FC<PromptCardPanelProps> = ({ label, card }) => (
  <div className="bg-amber-50/90 border-2 border-comic-black rounded-xl p-3 shadow-comic-sm space-y-2">
    <div className="flex items-center justify-between border-b border-comic-black/20 pb-1.5">
      <span className="text-[10px] font-comic font-black uppercase bg-comic-red text-white px-2 py-0.5 rounded border border-comic-black shadow-comic-xs">
        {label}
      </span>
      <span className="text-[10px] font-mono font-bold uppercase bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded border border-comic-black/40">
        {card.type}
      </span>
    </div>

    <div className="flex items-start gap-3 pt-0.5">
      <div className="shrink-0">
        <CardView card={card} size="sm" enableHoverZoom={true} />
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <h4 className="font-comic font-black text-sm uppercase text-comic-black truncate">
          {card.name}
        </h4>
        {card.traits && card.traits.length > 0 && (
          <p className="text-[10px] font-bold text-slate-600 italic">{card.traits.join('. ')}.</p>
        )}
        {card.text && (
          <div className="text-xs text-slate-800 bg-white/90 border border-comic-black/30 rounded-lg p-2">
            <FormattedCardText text={card.text} />
          </div>
        )}
      </div>
    </div>
  </div>
);

export default PromptCardPanel;
