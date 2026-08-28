import React from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, HelpCircle, CheckCircle2 } from 'lucide-react';
import { PendingDecisionPrompt } from '../../../engine/models';

interface DecisionPromptModalProps {
  prompt?: PendingDecisionPrompt;
  onSelectOption: (optionId: string) => void;
}

export const DecisionPromptModal: React.FC<DecisionPromptModalProps> = ({
  prompt,
  onSelectOption,
}) => {
  if (!prompt) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-yellow-400 border-4 border-black rounded-2xl shadow-[8px_8px_0px_rgba(0,0,0,1)] p-6 overflow-hidden">
        {/* Comic background dots */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#000 2px, transparent 2px)',
            backgroundSize: '12px 12px',
          }}
        />

        {/* Source Card Badge */}
        <div className="relative flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 bg-black text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
            <span>{prompt.sourceCardName}</span>
          </div>
          <div className="bg-red-500 border-2 border-black text-white px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            DECISION REQUIRED
          </div>
        </div>

        {/* Title & Description */}
        <div className="relative mb-6">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-black" />
            {prompt.title}
          </h2>
          {prompt.description && (
            <p className="mt-1 text-sm font-bold text-slate-800 bg-yellow-300/80 border-2 border-black/30 p-2.5 rounded-lg">
              {prompt.description}
            </p>
          )}
        </div>

        {/* Option Selection List */}
        <div className="relative flex flex-col gap-3">
          {prompt.options.map((option, index) => (
            <button
              key={option.id}
              onClick={() => onSelectOption(option.id)}
              className="group relative flex flex-col items-start text-left p-4 bg-white hover:bg-slate-900 text-black hover:text-white border-3 border-black rounded-xl shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-black text-base uppercase tracking-wide flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-yellow-400 text-black border-2 border-black flex items-center justify-center text-xs font-black">
                    {index + 1}
                  </span>
                  {option.label}
                </span>
                <CheckCircle2 className="w-5 h-5 opacity-0 group-hover:opacity-100 text-yellow-400 transition-opacity" />
              </div>
              {option.description && (
                <p className="mt-1 text-xs font-medium text-slate-600 group-hover:text-slate-300 pl-8">
                  {option.description}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};
