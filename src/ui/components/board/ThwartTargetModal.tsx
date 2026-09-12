import React from 'react';
import { createPortal } from 'react-dom';
import { Target, ShieldAlert, Sparkles, X, AlertOctagon, Flame } from 'lucide-react';
import { SchemeTarget } from './thwart-target-utils';

interface ThwartTargetModalProps {
  isOpen: boolean;
  thwarterName: string;
  thwarterType: 'hero' | 'ally';
  thwartValue: number;
  consequentialDamage?: number;
  targets: SchemeTarget[];
  onSelectTarget: (target: SchemeTarget) => void;
  onClose: () => void;
}

export const ThwartTargetModal: React.FC<ThwartTargetModalProps> = ({
  isOpen,
  thwarterName,
  thwarterType,
  thwartValue,
  consequentialDamage,
  targets,
  onSelectTarget,
  onClose,
}) => {
  if (!isOpen || targets.length === 0) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-comic-black/80 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-lg bg-comic-paper border-4 border-comic-black rounded-xl shadow-comic-xl overflow-hidden flex flex-col font-comic">
        {/* Comic dots overlay */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#000 2px, transparent 2px)',
            backgroundSize: '12px 12px',
          }}
        />

        {/* 1. Pop-Art Header */}
        <div className="relative px-6 py-4 bg-comic-blue border-b-4 border-comic-black flex items-center justify-between text-white select-none">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-comic-black rounded-lg shadow-comic-sm">
              <Target className="w-6 h-6 text-comic-yellow animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-comic-yellow">
                <span>
                  {thwarterType === 'hero' ? 'Hero Thwart' : 'Ally Thwart'} • {thwartValue} THW
                </span>
                {consequentialDamage !== undefined && consequentialDamage > 0 && (
                  <span className="bg-comic-red text-white px-1.5 py-0.2 rounded text-[10px]">
                    Takes {consequentialDamage} DMG
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                THWART TARGET SELECTION
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-comic-black hover:bg-slate-800 text-white rounded-lg border-2 border-white/40 shadow-comic-sm transition-transform active:scale-95 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Thwarter Banner */}
        <div className="relative px-6 py-2.5 bg-sky-100 border-b-2 border-comic-black flex items-center justify-between text-slate-900">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-comic-blue" />
            <span className="text-xs sm:text-sm font-bold">
              <strong className="font-black uppercase">{thwarterName}</strong> is ready to remove
              threat!
            </span>
          </div>
          <span className="font-mono text-xs font-black px-2 py-0.5 bg-comic-black text-sky-300 rounded border border-comic-black">
            {thwartValue} THW
          </span>
        </div>

        {/* 3. Schemes List */}
        <div className="relative p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Choose a scheme to remove threat from:
          </p>

          <div className="grid grid-cols-1 gap-2.5">
            {targets.map((target) => {
              const isMain = target.type === 'main_scheme';
              const canThwart = target.allowed;

              return (
                <button
                  key={target.id}
                  disabled={!canThwart}
                  onClick={() => {
                    if (canThwart) {
                      onSelectTarget(target);
                      onClose();
                    }
                  }}
                  className={`w-full p-3 rounded-lg border-3 border-comic-black transition-all flex items-center justify-between gap-3 shadow-comic-sm text-left ${
                    canThwart
                      ? isMain
                        ? 'bg-sky-50 hover:bg-sky-100 ring-1 ring-sky-300 hover:shadow-comic hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer'
                        : 'bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300 hover:shadow-comic hover:-translate-y-0.5 active:translate-y-0.5 cursor-pointer'
                      : 'bg-slate-200/70 text-slate-500 cursor-not-allowed opacity-60 border-dashed'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg border-2 border-comic-black shrink-0 ${
                        canThwart
                          ? isMain
                            ? 'bg-comic-blue text-white'
                            : 'bg-amber-400 text-slate-950'
                          : 'bg-slate-300 text-slate-500'
                      }`}
                    >
                      {isMain ? (
                        <Target className="w-5 h-5" />
                      ) : (
                        <ShieldAlert className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm sm:text-base text-slate-950 truncate">
                          {target.name}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border border-comic-black ${
                            isMain ? 'bg-comic-blue text-white' : 'bg-comic-yellow text-slate-950'
                          }`}
                        >
                          {isMain ? 'MAIN SCHEME' : 'SIDE SCHEME'}
                        </span>
                        {target.hasCrisis && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-comic-red text-white border border-comic-black flex items-center gap-1">
                            <AlertOctagon className="w-3 h-3" /> CRISIS
                          </span>
                        )}
                        {target.hasHazard && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 border border-comic-black">
                            HAZARD
                          </span>
                        )}
                        {target.hasAcceleration && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500 text-white border border-comic-black flex items-center gap-1">
                            <Flame className="w-3 h-3" /> ACCEL
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600">
                        <span>
                          Threat:{' '}
                          <strong className="text-slate-900 font-black">{target.threat}</strong>
                          {target.targetThreat !== undefined && ` / ${target.targetThreat}`}
                        </span>
                        {!canThwart && target.disabledReason && (
                          <span className="text-comic-red font-bold">
                            ({target.disabledReason})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span
                      className={`font-comic text-xs font-black uppercase px-3 py-1.5 rounded-lg border-2 border-comic-black shadow-comic-xs ${
                        canThwart ? 'bg-comic-black text-sky-300' : 'bg-slate-300 text-slate-500'
                      }`}
                    >
                      {canThwart ? 'FOIL ➔' : 'BLOCKED'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Footer */}
        <div className="relative px-6 py-3 bg-slate-100 border-t-2 border-comic-black flex justify-end">
          <button
            onClick={onClose}
            className="font-comic text-xs font-black py-2 px-4 rounded-lg border-2 border-comic-black bg-slate-200 hover:bg-slate-300 text-slate-800 shadow-comic-sm active:translate-y-0.5 cursor-pointer uppercase"
          >
            Cancel Thwart
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ThwartTargetModal;
