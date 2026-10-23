import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { CardView } from '../cards/CardView';
import { FormattedCardText } from '../cards/FormattedCardText';
import { cardCatalog } from '../../../data/importer/card-loader';
import { CardRef, type CardReference } from '../../theme/CardRef';
import { AccentStripe } from '../../theme/AccentStripe';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { Narration } from '../../theme/ComicSpeech';
import { STAR_CLIP } from '../../theme/comic-shapes';
import { useActionBurst } from '../../theme/useActionBurst';
import { useModalStyle } from '../../theme/useModalStyle';
import type { VerbColor } from '../../theme/modal-styles';
import { WAKANDA_FOREVER, WAKANDA_UPGRADES, type UpgradeItem } from './template-data';

/** The real card face when the catalog knows the card, else its thumbnail. */
const CardShowcase: React.FC<{ card: CardReference; size: 'sm' | 'md' }> = ({ card, size }) => {
  const normalized = cardCatalog.getCard(card.code);
  return (
    <div data-card-view={card.code} className="flex justify-center">
      {normalized ? (
        <CardView card={normalized} size={size} />
      ) : (
        <CardRef {...card} size="lg" stacked />
      )}
    </div>
  );
};

export interface SequenceTemplateProps {
  verb?: VerbColor;
  onExecute?: (orderedIds: string[]) => void;
  onAction?: (message: string) => void;
}

/**
 * Archetype 2: Interactive sequence / pipeline (Wakanda Forever, Issue #358). Real card faces for
 * the trigger and every slot, Left/Right move buttons below each card (clear of hover-zoom),
 * drag-and-drop, step badges, finisher highlight and a text recap with thumbnails.
 */
export const SequenceTemplate: React.FC<SequenceTemplateProps> = ({
  verb = 'purple',
  onExecute,
  onAction,
}) => {
  const { style } = useModalStyle();
  const [upgrades, setUpgrades] = useState<UpgradeItem[]>([...WAKANDA_UPGRADES]);
  const { burst, fire } = useActionBurst();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= upgrades.length || from === to) return;
    const copy = [...upgrades];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    setUpgrades(copy);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (draggedIndex !== null) reorder(draggedIndex, targetIndex);
    setDraggedIndex(null);
  };

  const handleExecute = () => {
    const order = upgrades.map((u) => u.id);
    fire();
    onExecute?.(order);
    onAction?.(`Executed: ${upgrades.map((u) => u.name).join(' → ')}`);
  };

  const last = upgrades[upgrades.length - 1];

  return (
    <ModalScaffold
      title="Wakanda Forever! sequence resolution"
      kicker="Hero special pipeline"
      verb={verb}
      trigger={WAKANDA_FOREVER}
      maxWidthClass="max-w-6xl"
      headerRight={
        <span className={`text-xs font-black px-3 py-1 ${style.chip}`}>
          {upgrades.length} UPGRADES IN PLAY
        </span>
      }
      footer={
        <>
          <div className="text-xs font-bold">
            <span className={`font-black uppercase ${style.emphasis}`}>Tactical finisher:</span>{' '}
            <CardRef {...last} size="xs" /> triggers last with the{' '}
            <span className={`font-black ${style.emphasis}`}>💥 finisher bonus</span>.
          </div>
          <button
            type="button"
            onClick={handleExecute}
            className={`px-6 py-2.5 font-black text-sm cursor-pointer flex items-center gap-2 shrink-0 ${style.btnGo}`}
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>EXECUTE SEQUENCE!</span>
          </button>
        </>
      }
      burst={burst}
      testId="template-sequence"
    >
      <Narration>Wakanda stands as one... and the final strike lands hardest!</Narration>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div
          className={`relative lg:col-span-4 p-4 pl-5 flex flex-col items-center ${style.panel}`}
        >
          <AccentStripe code={WAKANDA_FOREVER.code} />
          <div className={`w-full flex items-center justify-between pb-2 mb-3 ${style.panelHead}`}>
            <span className="text-xs font-black uppercase tracking-wider">Triggering event</span>
            <span className={`text-[10px] font-black px-2 py-0.5 ${style.chip}`}>COST 1</span>
          </div>
          <div className="w-48">
            <CardShowcase card={WAKANDA_FOREVER} size="md" />
          </div>
          <div className={`mt-3 w-full p-2.5 text-xs ${style.inset}`}>
            <div className="font-black mb-1">💡 Finisher rule (RR v1.8 p. 28)</div>
            <p className={`text-[11px] leading-snug ${style.muted}`}>
              Trigger each Special ability in the order you choose. The final upgrade receives its
              enhanced values.
            </p>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-4">
          <div
            className={`flex items-center justify-between text-xs font-black uppercase pb-2 ${style.panelHead}`}
          >
            <span>Execution pipeline (step 1 ➔ step {upgrades.length})</span>
            <span className={style.emphasis}>Step {upgrades.length} = finisher boosted!</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {upgrades.map((item, index) => {
              const isFinal = index === upgrades.length - 1;
              const isFirst = index === 0;
              const isOver = dragOverIndex === index && draggedIndex !== index;

              return (
                <div
                  key={item.id}
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
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={() => setDraggedIndex(null)}
                  className={`relative flex flex-col p-2 cursor-grab active:cursor-grabbing transition-all select-none ${
                    isFinal ? style.slotFinal : style.slot
                  } ${draggedIndex === index ? 'opacity-40 scale-95 border-dashed' : ''} ${
                    isOver ? style.slotOver : ''
                  }`}
                >
                  <AccentStripe code={item.code} />
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
                      STEP {index + 1}
                    </span>
                    <span
                      className={`text-[10px] font-black uppercase ${isFinal ? style.emphasis : ''}`}
                    >
                      {isFinal ? item.finisherBadge : item.baseBadge}
                    </span>
                  </div>

                  <div className="pointer-events-none">
                    <div className="w-36 mx-auto">
                      <CardShowcase card={item} size="sm" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 mt-2">
                    <button
                      type="button"
                      disabled={isFirst}
                      aria-label={`Move ${item.name} earlier`}
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
                      aria-label={`Move ${item.name} later`}
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
                    <FormattedCardText text={item.effectText} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`p-3 ${style.panel}`}>
            <span
              className={`text-[10px] font-black uppercase tracking-wider block mb-1.5 ${style.muted}`}
            >
              Planned resolution sequence
            </span>
            <ol className="space-y-1.5 text-xs font-bold">
              {upgrades.map((u, i) => {
                const isLast = i === upgrades.length - 1;
                return (
                  <li key={u.id} className="flex items-center gap-2">
                    <span className="font-mono text-[11px] w-4">{i + 1}.</span>
                    <CardRef {...u} size="xs" />
                    <span className={style.muted}>➔</span>
                    <span className={isLast ? `font-black ${style.emphasis}` : style.muted}>
                      {isLast ? u.finisherBadge : u.baseBadge} ({u.effectText})
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
