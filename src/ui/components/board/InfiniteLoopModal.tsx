import React from 'react';
import { ArrowRight, Flame, Repeat } from 'lucide-react';
import { cardCatalog } from '../../../data/importer/card-loader';
import type { TriggerCallNode } from '../../../engine/errors/infinite-loop-error';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';
import { CardView } from '../cards/CardView';

interface InfiniteLoopModalProps {
  /** The engine's description of the halted loop; shown when no card of the cycle is known. */
  message: string;
  /** The trigger calls of the cycle, in order. */
  cycle: readonly TriggerCallNode[];
  onDismiss: () => void;
  onReset: () => void;
}

interface LoopCard {
  key: string;
  code?: string;
  name: string;
  /** Abilities of this card that fire in the cycle, e.g. "spider_sense (INTERRUPT)". */
  abilities: string[];
}

/** The cards of the cycle, each once, in the order they first fire. */
const loopCards = (cycle: readonly TriggerCallNode[]): LoopCard[] => {
  const cards = new Map<string, LoopCard>();
  for (const node of cycle) {
    const key = node.sourceInstanceId ?? node.cardCode ?? node.cardName ?? 'unknown';
    const entry = cards.get(key) ?? {
      key,
      code: node.cardCode,
      name: node.cardName ?? node.cardCode ?? 'Unknown card',
      abilities: [],
    };
    const ability = `${node.abilityId ?? 'ability'} (${node.trigger})`;
    if (!entry.abilities.includes(ability)) entry.abilities.push(ability);
    cards.set(key, entry);
  }
  return [...cards.values()];
};

/** Modal width by number of cards, so the cards fit side by side without a sideways scroll. */
const WIDTH_CLASS = ['max-w-xl', 'max-w-xl', 'max-w-4xl', 'max-w-5xl', 'max-w-7xl'] as const;

/** Shown when the engine halts an infinite trigger recursion between forced abilities (ADR-0053, Issue #48). */
export const InfiniteLoopModal: React.FC<InfiniteLoopModalProps> = ({
  message,
  cycle,
  onDismiss,
  onReset,
}) => {
  const { style } = useModalStyle();
  const cards = loopCards(cycle);
  const cardSize = cards.length > 2 ? 'md' : 'lg';

  return (
    <ModalScaffold
      layer="critical"
      title="Infinite Loop Detected!"
      kicker="Engine safeguard"
      verb="red"
      trigger={null}
      icon={<Flame className="w-5 h-5" />}
      maxWidthClass={WIDTH_CLASS[Math.min(cards.length, 4)]}
      testId="infinite-loop-modal"
      footer={
        <>
          <button
            type="button"
            onClick={onDismiss}
            className={`ml-auto px-4 py-2 font-black uppercase text-sm cursor-pointer ${style.btnMove}`}
          >
            Dismiss &amp; Continue
          </button>
          <button
            type="button"
            onClick={onReset}
            className={`px-4 py-2 font-black uppercase text-sm cursor-pointer ${style.btnGo}`}
          >
            Reset Game
          </button>
        </>
      }
    >
      <p className="font-bold text-sm">
        These forced abilities trigger each other without end, so the engine stopped them.
      </p>
      {cards.length > 0 ? (
        <>
          <ol
            aria-label="The loop"
            className={`flex flex-wrap items-start justify-center gap-3 p-4 ${style.inset}`}
          >
            {cards.map((card, index) => {
              const catalogCard = card.code ? cardCatalog.getCard(card.code) : undefined;
              return (
                <li key={card.key} className="flex items-center gap-3">
                  <figure className="flex flex-col items-center gap-2">
                    {catalogCard ? (
                      <CardView
                        card={catalogCard}
                        size={cardSize}
                        enableHoverZoom={false}
                        enableContextMenu={false}
                      />
                    ) : (
                      <span className={`px-3 py-6 text-sm font-black ${style.chip}`}>
                        {card.name}
                      </span>
                    )}
                    <figcaption className={`text-center text-micro font-mono ${style.muted}`}>
                      {card.abilities.join(', ')}
                    </figcaption>
                  </figure>
                  {index < cards.length - 1 && (
                    <ArrowRight
                      aria-hidden="true"
                      className={`w-6 h-6 shrink-0 ${style.emphasis}`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
          <p
            className={`flex items-center justify-center gap-1.5 text-mini font-black uppercase ${style.emphasis}`}
          >
            <Repeat aria-hidden="true" className="w-4 h-4" />
            Loops back to the first card
          </p>
        </>
      ) : (
        <div className={`p-3 font-mono text-xs overflow-x-auto whitespace-pre-wrap ${style.inset}`}>
          {message}
        </div>
      )}
    </ModalScaffold>
  );
};
