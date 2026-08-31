import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, HelpCircle, CheckCircle2, XCircle } from 'lucide-react';
import { PendingDecisionPrompt } from '../../../engine/models';
import { CardView } from '../cards/CardView';

interface DecisionPromptModalProps {
  prompt?: PendingDecisionPrompt;
  onSelectOption: (optionId: string) => void;
}

export const DecisionPromptModal: React.FC<DecisionPromptModalProps> = ({
  prompt,
  onSelectOption,
}) => {
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  if (!prompt) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-yellow-400 border-4 border-black rounded-2xl shadow-[8px_8px_0px_rgba(0,0,0,1)] p-5 sm:p-6 overflow-visible">
        {/* Comic background dots */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none rounded-2xl overflow-hidden"
          style={{
            backgroundImage: 'radial-gradient(#000 2px, transparent 2px)',
            backgroundSize: '12px 12px',
          }}
        />

        {/* Source Card Badge & Queue Depth Badge */}
        <div className="relative flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 bg-black text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span>{prompt.sourceCardName}</span>
          </div>
          <div className="flex items-center gap-2">
            {prompt.totalQueued && prompt.totalQueued > 1 && (
              <div className="bg-amber-500 border-2 border-black text-slate-950 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                QUEUE: {prompt.queuePosition ?? 1} OF {prompt.totalQueued}
              </div>
            )}
            <div className="bg-red-500 border-2 border-black text-white px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_rgba(0,0,0,1)]">
              {prompt.isVoluntary ? 'OPTIONAL REACTION' : 'DECISION REQUIRED'}
            </div>
          </div>
        </div>

        {/* Title & Description */}
        <div className="relative mb-4">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-black" />
            {prompt.title}
          </h2>
          {prompt.description && (
            <p className="mt-1 text-xs sm:text-sm font-bold text-slate-800 bg-yellow-300/80 border-2 border-black/30 p-2.5 rounded-lg">
              {prompt.description}
            </p>
          )}
        </div>

        {/* Visual Scryed/Revealed Cards Gallery (with Non-Tech Cards Grayed Out) */}
        {prompt.revealedCards && prompt.revealedCards.length > 0 && (
          <div className="relative mb-4 bg-yellow-300/90 border-2 border-black rounded-xl p-3 shadow-inner overflow-visible">
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
                    <CardView card={rc.card} size="sm" enableHoverZoom={true} zoomOrigin="center" />
                    <span
                      className={`font-comic text-[9px] px-2 py-0.5 rounded border border-black font-black uppercase shadow-xs ${
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
        <div className="relative flex flex-col gap-2.5">
          {prompt.options.map((option, index) => {
            const isDeclineOption = option.id.includes('none') || option.id.includes('decline');

            return (
              <button
                key={option.id}
                onClick={() => onSelectOption(option.id)}
                className={`group relative flex flex-col items-start text-left p-3 sm:p-3.5 border-3 border-black rounded-xl shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer ${
                  isDeclineOption
                    ? 'bg-slate-100 hover:bg-rose-950 text-black hover:text-white'
                    : 'bg-white hover:bg-slate-900 text-black hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-black text-sm sm:text-base uppercase tracking-wide flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full border-2 border-black flex items-center justify-center text-xs font-black ${
                        isDeclineOption ? 'bg-rose-400 text-slate-950' : 'bg-yellow-400 text-black'
                      }`}
                    >
                      {index + 1}
                    </span>
                    {option.label}
                  </span>
                  {isDeclineOption ? (
                    <XCircle className="w-5 h-5 opacity-0 group-hover:opacity-100 text-rose-400 transition-opacity" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 opacity-0 group-hover:opacity-100 text-yellow-400 transition-opacity" />
                  )}
                </div>
                {option.description && (
                  <p className="mt-0.5 text-xs font-medium text-slate-600 group-hover:text-slate-300 pl-8">
                    {option.description}
                  </p>
                )}
              </button>
            );
          })}
          {prompt.isVoluntary && !prompt.options.some((o) => o.id === 'pass' || o.id.includes('decline')) && (
            <button
              onClick={() => onSelectOption('pass')}
              className="group relative flex items-center justify-between p-3 border-3 border-black rounded-xl bg-slate-200 hover:bg-rose-900 text-slate-800 hover:text-white shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer mt-1 font-black text-sm uppercase tracking-wide"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full border-2 border-black flex items-center justify-center text-xs font-black bg-slate-300 text-slate-900">
                  ✕
                </span>
                <span>Pass / Do Nothing</span>
              </div>
              <XCircle className="w-5 h-5 opacity-0 group-hover:opacity-100 text-rose-400 transition-opacity" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DecisionPromptModal;
