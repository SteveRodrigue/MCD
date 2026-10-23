import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import { DecisionPromptOption, PendingDecisionPrompt } from '../../../engine/models';
import { cardCatalog } from '../../../data/importer/card-loader';
import { AccentStripe } from '../../theme/AccentStripe';
import { STAR_CLIP } from '../../theme/comic-shapes';
import { CardRef, type CardRefProps } from '../../theme/CardRef';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';
import { CardView } from '../cards/CardView';
import { FormattedCardText } from '../cards/FormattedCardText';

interface WakandaForeverModalProps {
  prompt: PendingDecisionPrompt;
  onExecuteSequence: (sequenceOrder: string[]) => void;
}

interface EffectStyle {
  icon: string;
  unit: string;
}

interface UpgradeMeta {
  id: string;
  code?: string;
  name: string;
  text: string;
  icon: string;
  baseBadge: string;
  finisherBadge: string;
}

// Keyed by the Special's effect type (generic), never by card code: the card text and amounts
// come from the card data through the prompt option.
const EFFECT_STYLES: Record<string, EffectStyle> = {
  DEAL_DAMAGE: { icon: '🗡️', unit: 'DMG' },
  REMOVE_THREAT: { icon: '🧠', unit: 'THW' },
  TRANSFER_DAMAGE: { icon: '🛡️', unit: 'MOVE' },
};

const FALLBACK_STYLE: EffectStyle = { icon: '⚡', unit: '' };

function buildUpgrades(options: DecisionPromptOption[]): UpgradeMeta[] {
  return options.map((opt) => {
    const { specialEffect, amount, finisherAmount } = opt.params ?? {};
    const style =
      (typeof specialEffect === 'string' && EFFECT_STYLES[specialEffect]) || FALLBACK_STYLE;
    const hasAmounts = typeof amount === 'number' && typeof finisherAmount === 'number';
    return {
      id: opt.id,
      code: opt.cardCode,
      name: opt.label,
      text: opt.description || 'Special effect',
      icon: style.icon,
      baseBadge: hasAmounts ? `${amount} ${style.unit}`.trim() : 'BASE',
      finisherBadge: hasAmounts ? `💥 ${finisherAmount} ${style.unit}`.trim() : '💥 FINISHER',
    };
  });
}

/** The real card face when the catalog knows the card, else its thumbnail with the name. */
const CardFace: React.FC<{ card: CardRefProps; size: 'sm' | 'md' }> = ({ card, size }) => {
  const normalized = card.code ? cardCatalog.getCard(card.code) : undefined;
  return (
    <div data-card-view={card.code ?? ''} className="flex justify-center">
      {normalized ? (
        <CardView card={normalized} size={size} />
      ) : (
        <CardRef {...card} size="lg" stacked />
      )}
    </div>
  );
};

/**
 * Wakanda Forever! sequence resolution (ADR-0038, Issue #358): the player orders the Black Panther
 * upgrade Specials with real card faces; the last one resolves as the finisher.
 */
export const WakandaForeverModal: React.FC<WakandaForeverModalProps> = ({
  prompt,
  onExecuteSequence,
}) => {
  const { style } = useModalStyle();
  const [orderedUpgrades, setOrderedUpgrades] = useState<UpgradeMeta[]>(() =>
    buildUpgrades(prompt.options),
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const trigger = { code: prompt.sourceCardCode, name: prompt.sourceCardName };
  const triggerCard = trigger.code ? cardCatalog.getCard(trigger.code) : undefined;

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= orderedUpgrades.length || from === to) return;
    const updated = [...orderedUpgrades];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    setOrderedUpgrades(updated);
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex !== null) reorder(draggedIndex, targetIndex);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const last = orderedUpgrades[orderedUpgrades.length - 1];

  return (
    <ModalScaffold
      title="Wakanda Forever! sequence resolution"
      kicker="Hero special pipeline"
      verb="purple"
      trigger={trigger}
      maxWidthClass="max-w-6xl"
      headerRight={
        <span className={`text-xs font-black px-3 py-1 ${style.chip}`}>
          {orderedUpgrades.length} UPGRADES IN PLAY
        </span>
      }
      footer={
        <>
          {last ? (
            <div className="text-xs font-bold">
              <span className={`font-black uppercase ${style.emphasis}`}>Tactical finisher:</span>{' '}
              <CardRef code={last.code} name={last.name} size="xs" /> triggers last with the{' '}
              <span className={`font-black ${style.emphasis}`}>💥 finisher bonus</span>.
            </div>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setOrderedUpgrades(buildUpgrades(prompt.options))}
              className={`px-3 py-2 font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer ${style.btnMove}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Order</span>
            </button>
            <button
              type="button"
              onClick={() => onExecuteSequence(orderedUpgrades.map((u) => u.id))}
              className={`px-6 py-2.5 font-black text-sm cursor-pointer flex items-center gap-2 ${style.btnGo}`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>EXECUTE SEQUENCE!</span>
            </button>
          </div>
        </>
      }
      testId="wakanda-forever-modal"
    >
      <p className={`text-xs font-bold uppercase ${style.muted}`}>
        Drag & drop or use the arrows to set the execution order (left to right)
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div
          className={`relative lg:col-span-4 p-4 pl-5 flex flex-col items-center ${style.panel}`}
        >
          {trigger.code && <AccentStripe code={trigger.code} />}
          <div className={`w-full flex items-center justify-between pb-2 mb-3 ${style.panelHead}`}>
            <span className="text-xs font-black uppercase tracking-wider">Triggering event</span>
            {triggerCard?.cost !== undefined && (
              <span className={`text-[10px] font-black px-2 py-0.5 ${style.chip}`}>
                COST {triggerCard.cost}
              </span>
            )}
          </div>
          {triggerCard && (
            <div className="w-48">
              <CardFace card={trigger} size="md" />
            </div>
          )}
          <div className={`mt-3 w-full p-2.5 text-xs ${style.inset}`}>
            <div className="font-black mb-1">💡 Tactical finisher rule (RR v1.8 p. 28)</div>
            <p className={`text-[11px] leading-normal ${style.muted}`}>
              The <strong>final upgrade</strong> executed in your sequence receives its enhanced{' '}
              <strong className={style.emphasis}>Finisher Bonus</strong> (marked with 💥)!
            </p>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-4">
          <div
            className={`flex items-center justify-between text-xs font-black uppercase pb-2 ${style.panelHead}`}
          >
            <span>Execution pipeline (step 1 ➔ step {orderedUpgrades.length})</span>
            <span className={style.emphasis}>Final step = finisher boosted!</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {orderedUpgrades.map((card, index) => {
              const isFinal = index === orderedUpgrades.length - 1;
              const isOver = dragOverIndex === index && draggedIndex !== index;

              return (
                <div
                  key={card.id}
                  data-card-anchor={card.code ?? ''}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(index));
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedIndex(index);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverIndex(index);
                  }}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(index);
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`relative flex flex-col p-2 pl-3 cursor-grab active:cursor-grabbing transition-all select-none ${
                    isFinal ? style.slotFinal : style.slot
                  } ${draggedIndex === index ? 'opacity-40 scale-95' : ''} ${
                    isOver ? style.slotOver : ''
                  }`}
                >
                  {card.code && <AccentStripe code={card.code} />}
                  {isFinal && (
                    <span
                      aria-hidden="true"
                      className={`absolute -top-3 -right-3 z-10 flex items-center justify-center text-center font-black text-[10px] leading-none pointer-events-none ${
                        style.finisher.star ? 'w-16 h-16 rotate-12' : 'px-2 py-1 rotate-6'
                      } ${style.finisher.className}`}
                      style={style.finisher.star ? { clipPath: STAR_CLIP } : undefined}
                    >
                      {style.finisher.label}
                    </span>
                  )}

                  <div className="flex items-center justify-between mb-2 pointer-events-none">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 ${
                        isFinal ? style.stepFinal : style.step
                      }`}
                    >
                      {isFinal ? '💥 FINAL (FINISHER)' : `STEP ${index + 1}`}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-[10px] font-black uppercase ${
                        isFinal ? style.emphasis : ''
                      }`}
                    >
                      <span aria-hidden="true">{card.icon}</span>
                      <span>{isFinal ? card.finisherBadge : card.baseBadge}</span>
                    </span>
                  </div>

                  <div className="pointer-events-none">
                    <div className="w-36 mx-auto">
                      <CardFace card={{ code: card.code, name: card.name }} size="sm" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 mt-2">
                    <button
                      type="button"
                      disabled={index === 0}
                      aria-label={`Move ${card.name} earlier`}
                      title="Move earlier"
                      onClick={() => reorder(index, index - 1)}
                      className={`flex-1 py-1 px-2 flex items-center justify-center gap-1 font-black text-xs cursor-pointer active:scale-95 transition-all disabled:cursor-not-allowed ${style.btnMove}`}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Left</span>
                    </button>
                    <button
                      type="button"
                      disabled={isFinal}
                      aria-label={`Move ${card.name} later`}
                      title="Move later"
                      onClick={() => reorder(index, index + 1)}
                      className={`flex-1 py-1 px-2 flex items-center justify-center gap-1 font-black text-xs cursor-pointer active:scale-95 transition-all disabled:cursor-not-allowed ${style.btnMove}`}
                    >
                      <span>Right</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div
                    className={`mt-2 p-1.5 text-[10px] leading-tight ${style.inset} ${style.muted}`}
                  >
                    <FormattedCardText text={card.text} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`p-3 ${style.panel}`}>
            <h3 className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ${style.muted}`}>
              Planned resolution sequence
            </h3>
            <ol className="space-y-1.5 text-xs font-bold">
              {orderedUpgrades.map((u, i) => {
                const isLast = i === orderedUpgrades.length - 1;
                return (
                  <li key={u.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] w-4">{i + 1}.</span>
                      <CardRef code={u.code} name={u.name} size="xs" />
                    </span>
                    <span className={isLast ? `font-black ${style.emphasis}` : style.muted}>
                      ➔ {isLast ? u.finisherBadge : u.baseBadge}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </ModalScaffold>
  );
};
