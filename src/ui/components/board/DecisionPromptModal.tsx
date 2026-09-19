import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Zap,
  ShieldAlert,
} from 'lucide-react';
import { PendingDecisionPrompt } from '../../../engine/models';
import { cardCatalog } from '../../../data/importer/card-loader';
import { CardView } from '../cards/CardView';
import { CardArtThumbnail } from '../cards/CardArtThumbnail';
import { FormattedCardText } from '../cards/FormattedCardText';
import { WakandaForeverModal } from './WakandaForeverModal';
import { DistributeAmountModal } from './DistributeAmountModal';

interface DecisionPromptModalProps {
  prompt?: PendingDecisionPrompt;
  onSelectOption: (optionId: string, payload?: any) => void;
}

export const DecisionPromptModal: React.FC<DecisionPromptModalProps> = ({
  prompt,
  onSelectOption,
}) => {
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  if (!prompt) return null;

  // Delegate Wakanda Forever sequence resolution to specialized modal (ADR-0038)
  if (prompt.sourceCardName === 'Wakanda Forever!' || prompt.title?.includes('Wakanda Forever')) {
    return (
      <WakandaForeverModal
        prompt={prompt}
        onExecuteSequence={(sequenceOrder) => {
          onSelectOption(sequenceOrder[0] || 'wf_execute', { sequenceOrder });
        }}
      />
    );
  }

  // Delegate interactive point distribution to specialized modal (ADR-0064)
  if (prompt.kind === 'DISTRIBUTE_POINTS' || prompt.distributionConfig) {
    return (
      <DistributeAmountModal
        prompt={prompt}
        onConfirm={(assignments) => onSelectOption('confirm_distribution', { assignments })}
        onCancel={prompt.distributionConfig?.canCancel ? () => onSelectOption('cancel') : undefined}
      />
    );
  }

  const isForced = !prompt.isVoluntary;
  const hasTriggerProvenance =
    Boolean(prompt.triggerSourceName) && prompt.triggerSourceName !== prompt.sourceCardName;

  const triggerCard =
    prompt.triggerSourceCard ||
    (prompt.triggerSourceCode ? cardCatalog.getCard(prompt.triggerSourceCode) : undefined) ||
    prompt.revealedCards?.[0]?.card;

  const showTriggerCardShowcase =
    Boolean(triggerCard) &&
    (triggerCard!.code !== prompt.sourceCardCode || Boolean(prompt.triggerSourceCode)) &&
    (!prompt.revealedCards ||
      prompt.revealedCards.length <= 1 ||
      Boolean(prompt.triggerSourceCard || prompt.triggerSourceCode));

  const isEncounterCard =
    triggerCard &&
    (triggerCard.type === 'treachery' ||
      triggerCard.type === 'minion' ||
      triggerCard.type === 'attachment' ||
      triggerCard.type === 'side_scheme' ||
      triggerCard.type === 'main_scheme' ||
      triggerCard.type === 'villain' ||
      triggerCard.type === 'environment' ||
      triggerCard.type === 'obligation');

  const headerBadgeLabel = isEncounterCard ? 'TRIGGERING ENCOUNTER CARD' : 'TRIGGERING CARD';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-comic-black/80 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-xl bg-comic-paper border-4 border-comic-black rounded-xl shadow-comic-xl overflow-hidden flex flex-col font-comic">
        {/* Comic background dots */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#000 2px, transparent 2px)',
            backgroundSize: '12px 12px',
          }}
        />

        {/* 1. Pop-Art Header */}
        <div className="relative px-5 py-3.5 bg-comic-yellow border-b-4 border-comic-black flex items-center justify-between text-comic-black select-none">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-comic-black text-comic-yellow rounded-lg shadow-comic-sm">
              {isForced ? (
                <ShieldAlert className="w-5 h-5 text-comic-red animate-pulse" />
              ) : (
                <Zap className="w-5 h-5 text-comic-yellow" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-800">
                <span>{isForced ? 'FORCED RESOLUTION' : 'DECISION POINT'}</span>
                {prompt.totalQueued && prompt.totalQueued > 1 && (
                  <span className="bg-comic-black text-comic-yellow px-1.5 py-0.2 rounded text-[9px]">
                    QUEUE: {prompt.queuePosition ?? 1} OF {prompt.totalQueued}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none text-comic-black drop-shadow-xs">
                {isForced ? 'FORCED RESPONSE / INTERRUPT' : 'CHOOSE AN ACTION'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs font-black uppercase px-2.5 py-1 rounded border-2 border-comic-black shadow-comic-sm ${
                isForced ? 'bg-comic-red text-white' : 'bg-comic-blue text-white'
              }`}
            >
              {isForced ? 'FORCED' : 'OPTIONAL'}
            </span>
          </div>
        </div>

        {/* 2. Provenance & Trigger Banner (Shows Trigger Source -> Ability Host) */}
        <div className="relative px-5 py-2.5 bg-amber-100 border-b-2 border-comic-black flex flex-wrap items-center justify-between gap-2 text-slate-900">
          <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
            {prompt.sourceCardCode && (
              <CardArtThumbnail
                cardCode={prompt.sourceCardCode}
                cardName={prompt.sourceCardName}
                size="sm"
              />
            )}

            {hasTriggerProvenance ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                {prompt.triggerSourceCode && (
                  <CardArtThumbnail
                    cardCode={prompt.triggerSourceCode}
                    cardName={prompt.triggerSourceName}
                    size="sm"
                  />
                )}
                <span className="text-[10px] font-black uppercase bg-slate-200 px-2 py-0.5 rounded border border-comic-black text-slate-700">
                  TRIGGER: {prompt.triggerSourceName}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-comic-black shrink-0" />
                <span className="text-[10px] font-black uppercase bg-comic-yellow px-2 py-0.5 rounded border border-comic-black text-comic-black">
                  ABILITY: {prompt.sourceCardName}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-comic-red" />
                <span className="text-xs font-black uppercase tracking-wide">
                  SOURCE: {prompt.sourceCardName}
                </span>
              </div>
            )}
          </div>

          {prompt.triggerType && (
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-comic-black text-comic-yellow rounded border border-comic-black uppercase">
              {prompt.triggerType}
            </span>
          )}
        </div>

        {/* 3. Modal Body */}
        <div className="relative p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Question Title & Description */}
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-black text-comic-black uppercase tracking-tight flex items-center gap-2 leading-snug">
              <HelpCircle className="w-5 h-5 text-comic-black shrink-0" />
              <span>{prompt.title}</span>
            </h3>
            {prompt.description && (
              <p className="text-xs sm:text-sm font-bold text-slate-800 bg-amber-50 border-2 border-comic-black/30 p-2.5 rounded-lg shadow-xs">
                {prompt.description}
              </p>
            )}
          </div>

          {/* Triggering Card Showcase */}
          {showTriggerCardShowcase && triggerCard && (
            <div className="bg-amber-50/90 border-2 border-comic-black rounded-xl p-3 shadow-comic-sm space-y-2">
              <div className="flex items-center justify-between border-b border-comic-black/20 pb-1.5">
                <span className="text-[10px] font-comic font-black uppercase bg-comic-red text-white px-2 py-0.5 rounded border border-comic-black shadow-comic-xs">
                  {headerBadgeLabel}
                </span>
                <span className="text-[10px] font-mono font-bold uppercase bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded border border-comic-black/40">
                  {triggerCard.type}
                </span>
              </div>

              <div className="flex items-start gap-3 pt-0.5">
                <div className="shrink-0">
                  <CardView card={triggerCard} size="sm" enableHoverZoom={true} />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <h4 className="font-comic font-black text-sm uppercase text-comic-black truncate">
                    {triggerCard.name}
                  </h4>
                  {triggerCard.traits && triggerCard.traits.length > 0 && (
                    <p className="text-[10px] font-bold text-slate-600 italic">
                      {triggerCard.traits.join('. ')}.
                    </p>
                  )}
                  {triggerCard.text && (
                    <div className="text-xs text-slate-800 bg-white/90 border border-comic-black/30 rounded-lg p-2 max-h-28 overflow-y-auto">
                      <FormattedCardText text={triggerCard.text} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Visual Scryed/Revealed Cards Gallery */}
          {prompt.revealedCards && prompt.revealedCards.length > 0 && (
            <div className="bg-amber-100/70 border-2 border-comic-black rounded-xl p-3 shadow-comic-sm overflow-visible">
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[11px] font-comic font-black uppercase text-slate-900 tracking-wider">
                  Revealed Cards ({prompt.revealedCards.length})
                </span>
                <span className="text-[10px] font-bold text-slate-700 italic">
                  (Click matching card or select option below)
                </span>
              </div>

              <div className="flex flex-wrap justify-center items-center gap-3 pt-1 overflow-visible">
                {prompt.revealedCards.map((rc) => {
                  const isHovered = hoveredCardId === rc.instanceId;
                  return (
                    <div
                      key={rc.instanceId}
                      onMouseEnter={() => setHoveredCardId(rc.instanceId)}
                      onMouseLeave={() => setHoveredCardId(null)}
                      onClick={() => {
                        if (rc.isSelectable && rc.selectableOptionId) {
                          onSelectOption(rc.selectableOptionId);
                        }
                      }}
                      style={{ zIndex: isHovered ? 60 : 10 }}
                      className={`flex flex-col items-center gap-1.5 transition-all relative ${
                        isHovered ? 'z-[60]' : 'z-10'
                      } ${
                        rc.isSelectable
                          ? 'cursor-pointer hover:scale-105 filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] ring-2 ring-emerald-500 rounded-xl p-0.5'
                          : 'filter grayscale brightness-90 contrast-95 ring-2 ring-slate-400/80 rounded-xl p-0.5 cursor-default'
                      }`}
                    >
                      <CardView
                        card={rc.card}
                        size="sm"
                        enableHoverZoom={true}
                        zoomOrigin="center"
                      />
                      <span
                        className={`font-comic text-[9px] px-2 py-0.5 rounded border border-comic-black font-black uppercase shadow-xs ${
                          rc.isSelectable
                            ? 'bg-emerald-400 text-slate-950 animate-pulse'
                            : 'bg-slate-300 text-slate-700'
                        }`}
                      >
                        {rc.isSelectable ? '✨ SELECTABLE TECH' : rc.dimmedReason || 'NON-MATCHING'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Option Selection List */}
          <div className="flex flex-col gap-2.5 pt-1">
            {prompt.options.map((option, index) => {
              const isDeclineOption =
                option.id.includes('none') || option.id.includes('decline') || option.id === 'pass';
              const isDisabled = Boolean(option.disabled);

              const optParams = option.params as Record<string, any> | undefined;
              const requiresPayment =
                !isDeclineOption &&
                Boolean(
                  (option as any).requiresPayment ||
                  optParams?.requiresPayment ||
                  (optParams?.resourceCost && optParams.resourceCost.amount > 0) ||
                  (optParams?.ability?.cost?.resourceCost !== undefined &&
                    optParams?.ability?.cost?.resourceCost !== 0),
                );

              const costAmount =
                optParams?.resourceCost?.amount ??
                (option as any).resourceCost?.amount ??
                (typeof optParams?.ability?.cost?.resourceCost === 'number'
                  ? optParams.ability.cost.resourceCost
                  : typeof optParams?.ability?.cost?.resourceCost === 'object' &&
                      optParams?.ability?.cost?.resourceCost !== null
                    ? Object.values(optParams.ability.cost.resourceCost)[0]
                    : 1);

              return (
                <button
                  key={option.id}
                  disabled={isDisabled}
                  onClick={() => {
                    if (!isDisabled) {
                      onSelectOption(option.id);
                    }
                  }}
                  className={`group relative flex flex-col items-start text-left p-3 sm:p-3.5 border-2 border-comic-black rounded-lg transition-all ${
                    isDisabled
                      ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-500 pointer-events-none ring-1 ring-slate-300'
                      : isDeclineOption
                        ? 'shadow-comic-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] cursor-pointer bg-slate-100 hover:bg-comic-red text-comic-black hover:text-white'
                        : 'shadow-comic-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] cursor-pointer bg-white hover:bg-comic-yellow text-comic-black'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-comic font-black text-sm sm:text-base uppercase tracking-wide flex items-center gap-2 flex-wrap">
                      <span
                        className={`w-6 h-6 rounded-full border-2 border-comic-black flex items-center justify-center text-xs font-black ${
                          isDisabled
                            ? 'bg-slate-300 text-slate-600'
                            : isDeclineOption
                              ? 'bg-rose-300 text-slate-950'
                              : 'bg-comic-yellow text-comic-black'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span>{option.label}</span>
                      {requiresPayment && costAmount !== undefined && costAmount > 0 && (
                        <span className="inline-flex items-center gap-1 font-comic text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-300 border border-comic-black text-slate-950 shadow-xs">
                          ⚡ COST: {costAmount} {costAmount === 1 ? 'RESOURCE' : 'RESOURCES'}
                        </span>
                      )}
                    </span>
                    {isDisabled ? (
                      <XCircle className="w-5 h-5 text-slate-400" />
                    ) : isDeclineOption ? (
                      <XCircle className="w-5 h-5 text-comic-red group-hover:text-white transition-colors" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 group-hover:text-comic-black transition-colors" />
                    )}
                  </div>
                  {option.disabledReason && (
                    <div className="mt-1 pl-8">
                      <span className="inline-flex items-center gap-1 font-comic text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-200 border border-comic-black text-amber-950">
                        ⚠️ {option.disabledReason}
                      </span>
                    </div>
                  )}
                  {option.description && (
                    <p className="mt-0.5 text-xs font-bold text-slate-600 group-hover:text-comic-black pl-8">
                      {option.description}
                    </p>
                  )}
                </button>
              );
            })}

            {prompt.isVoluntary &&
              !prompt.options.some((o) => o.id === 'pass' || o.id.includes('decline')) && (
                <button
                  onClick={() => onSelectOption('pass')}
                  className="group relative flex items-center justify-between p-3 border-2 border-comic-black rounded-lg bg-slate-200 hover:bg-comic-red text-slate-800 hover:text-white shadow-comic-sm hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer font-comic font-black text-sm uppercase tracking-wide"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full border-2 border-comic-black flex items-center justify-center text-xs font-black bg-slate-300 text-slate-900">
                      ✕
                    </span>
                    <span>Pass / Do Nothing</span>
                  </div>
                  <XCircle className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" />
                </button>
              )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DecisionPromptModal;
