import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PendingDecisionPrompt } from '../../../engine/models';

interface WakandaForeverModalProps {
  prompt: PendingDecisionPrompt;
  onExecuteSequence: (sequenceOrder: string[]) => void;
}

interface UpgradeMeta {
  id: string;
  name: string;
  code: string;
  icon: string;
  baseEffect: string;
  finisherEffect: string;
  baseBadge: string;
  finisherBadge: string;
  colorClass: string;
}

const UPGRADE_CONFIGS: Record<string, Omit<UpgradeMeta, 'id'>> = {
  '01046': {
    name: 'Energy Daggers',
    code: '01046',
    icon: '🗡️',
    baseEffect: '1 dmg to villain & engaged minions',
    finisherEffect: '2 DMG TO ALL ENEMIES (FINISHER)',
    baseBadge: '1 DMG AOE',
    finisherBadge: '💥 2 DMG AOE',
    colorClass: 'border-emerald-500 bg-emerald-950/80 text-emerald-100',
  },
  '01047': {
    name: 'Panther Claws',
    code: '01047',
    icon: '🐾',
    baseEffect: 'Deal 2 damage to an enemy',
    finisherEffect: 'DEAL 4 DAMAGE TO ENEMY (FINISHER)',
    baseBadge: '2 DMG',
    finisherBadge: '💥 4 DMG',
    colorClass: 'border-rose-500 bg-rose-950/80 text-rose-100',
  },
  '01048': {
    name: 'Tactical Genius',
    code: '01048',
    icon: '🧠',
    baseEffect: 'Remove 1 threat from a scheme',
    finisherEffect: 'REMOVE 2 THREAT FROM SCHEME (FINISHER)',
    baseBadge: '1 THW',
    finisherBadge: '💥 2 THW',
    colorClass: 'border-sky-500 bg-sky-950/80 text-sky-100',
  },
  '01049': {
    name: 'Panther Suit',
    code: '01049',
    icon: '🛡️',
    baseEffect: 'Move 1 damage from BP to enemy',
    finisherEffect: 'MOVE 2 DAMAGE TO ENEMY (FINISHER)',
    baseBadge: '1 MOVE',
    finisherBadge: '💥 2 MOVE',
    colorClass: 'border-purple-500 bg-purple-950/80 text-purple-100',
  },
};

export const WakandaForeverModal: React.FC<WakandaForeverModalProps> = ({
  prompt,
  onExecuteSequence,
}) => {
  // Initialize upgrades from prompt options
  const initialUpgrades: UpgradeMeta[] = prompt.options.map((opt) => {
    const matchedConfig = Object.values(UPGRADE_CONFIGS).find(
      (c) => opt.label.includes(c.name) || (opt.description && opt.description.includes(c.name)),
    );
    if (matchedConfig) {
      return { id: opt.id, ...matchedConfig };
    }
    return {
      id: opt.id,
      name: opt.label,
      code: 'unknown',
      icon: '⚡',
      baseEffect: opt.description || 'Special effect',
      finisherEffect: `${opt.description || 'Special effect'} (BOOSTED)`,
      baseBadge: 'BASE',
      finisherBadge: '💥 FINISHER',
      colorClass: 'border-amber-500 bg-slate-900 text-amber-100',
    };
  });

  const [orderedUpgrades, setOrderedUpgrades] = useState<UpgradeMeta[]>(initialUpgrades);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const moveCard = (index: number, direction: number) => {
    const targetIndex = index + direction;
    if (targetIndex >= 0 && targetIndex < orderedUpgrades.length) {
      const updated = [...orderedUpgrades];
      const [item] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, item);
      setOrderedUpgrades(updated);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      const updated = [...orderedUpgrades];
      const [item] = updated.splice(draggedIndex, 1);
      updated.splice(targetIndex, 0, item);
      setOrderedUpgrades(updated);
    }
    setDraggedIndex(null);
  };

  const resetDefaultOrder = () => {
    setOrderedUpgrades(initialUpgrades);
  };

  const handleExecute = () => {
    const sequenceOrder = orderedUpgrades.map((u) => u.id);
    onExecuteSequence(sequenceOrder);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-slate-900 border-4 border-slate-950 rounded-2xl shadow-[8px_8px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col">
        {/* Comic Header Banner */}
        <div className="bg-amber-400 text-slate-950 p-4 border-b-4 border-slate-950 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🐾</span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider leading-none">
                WAKANDA FOREVER! — SEQUENCE RESOLUTION
              </h1>
              <p className="text-[11px] font-bold text-slate-900 uppercase tracking-wide mt-0.5">
                Drag & drop or use arrows to set the execution order (Left to Right)
              </p>
            </div>
          </div>
          <div className="bg-purple-900 text-amber-300 text-xs font-black px-3 py-1 rounded-full border-2 border-slate-950 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
            {orderedUpgrades.length} UPGRADES IN PLAY
          </div>
        </div>

        {/* Modal Grid Body */}
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Reference Card */}
          <div className="lg:col-span-4 flex flex-col items-center bg-slate-800/90 p-4 rounded-xl border-3 border-slate-950 shadow-[4px_4px_0px_rgba(0,0,0,1)]">
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-xs font-black text-purple-400 uppercase tracking-wider">Triggering Event</span>
              <span className="bg-purple-950 text-purple-200 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-400/40">
                COST: 1
              </span>
            </div>

            {/* Wakanda Forever Card Preview */}
            <div className="w-48 bg-purple-950 rounded-xl p-3 flex flex-col items-center text-center relative border-2 border-slate-950 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
              <div className="bg-purple-800 text-amber-300 text-sm font-black px-2 py-0.5 rounded w-full border border-slate-950 mb-2">
                Wakanda Forever!
              </div>
              <div className="w-full h-24 bg-slate-900 rounded border border-slate-950 flex items-center justify-center text-3xl mb-2">
                ⚡🐾⚡
              </div>
              <div className="text-[10px] font-bold text-purple-200 leading-tight bg-purple-900/60 p-2 rounded border border-purple-400/30 text-left">
                <span className="font-black text-amber-300 uppercase">Hero Action:</span> Trigger the "Special" ability of each <span className="text-amber-300 font-bold">Black Panther</span> upgrade you control, one at a time, in the order of your choice.
              </div>
            </div>

            {/* Finisher Rule Tooltip */}
            <div className="mt-4 bg-amber-500/10 border-2 border-amber-400/60 rounded-lg p-3 text-left">
              <div className="flex items-center gap-1.5 text-amber-300 text-xs font-black mb-1">
                <span>💡</span>
                <span>TACTICAL FINISHER RULE (RR v1.8 p. 28)</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-normal">
                The <strong className="text-amber-300 font-bold">final upgrade</strong> executed in your sequence receives its enhanced <strong className="text-amber-300">Finisher Bonus</strong> (marked with 💥)!
              </p>
            </div>
          </div>

          {/* Right Drag & Drop Sequence */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 border-b border-slate-700 pb-2">
              <span className="uppercase tracking-wider">Execution Pipeline (Step 1 ➔ Step {orderedUpgrades.length})</span>
              <span className="text-amber-400 font-black">FINAL STEP = FINISHER BOOSTED!</span>
            </div>

            {/* Slots Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {orderedUpgrades.map((card, index) => {
                const isFinal = index === orderedUpgrades.length - 1;
                const stepNum = index + 1;

                return (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(index)}
                    className={`relative flex flex-col justify-between p-3 rounded-xl border-3 border-slate-950 shadow-[4px_4px_0px_rgba(0,0,0,1)] cursor-grab select-none transition-all ${card.colorClass} ${
                      isFinal ? 'ring-4 ring-amber-400 shadow-amber-500/30' : ''
                    } ${draggedIndex === index ? 'opacity-40 scale-95' : ''}`}
                  >
                    {/* Step Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded border border-slate-950 ${
                          isFinal
                            ? 'bg-amber-400 text-slate-950 animate-pulse'
                            : 'bg-slate-800 text-slate-200'
                        }`}
                      >
                        {isFinal ? '💥 FINAL (FINISHER)' : `STEP ${stepNum}`}
                      </span>
                      <div className="flex items-center gap-1">
                        {index > 0 && (
                          <button
                            onClick={() => moveCard(index, -1)}
                            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-1 py-0.5 rounded border border-slate-950"
                            title="Move earlier"
                          >
                            ◀
                          </button>
                        )}
                        {index < orderedUpgrades.length - 1 && (
                          <button
                            onClick={() => moveCard(index, 1)}
                            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-1 py-0.5 rounded border border-slate-950"
                            title="Move later"
                          >
                            ▶
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Card Title & Icon */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-2xl">{card.icon}</span>
                      <div className="truncate">
                        <h4 className="font-black text-xs text-slate-100 truncate">{card.name}</h4>
                        <span className="text-[9px] text-slate-400 font-mono uppercase">Upgrade Special</span>
                      </div>
                    </div>

                    {/* Effect Text */}
                    <div
                      className={`mt-2 p-2 rounded border border-slate-950 text-[10px] leading-tight ${
                        isFinal
                          ? 'bg-amber-950/80 text-amber-200 font-bold border-amber-400/50'
                          : 'bg-slate-900/80 text-slate-300 font-mono'
                      }`}
                    >
                      {isFinal ? card.finisherEffect : card.baseEffect}
                    </div>

                    {/* Stat Badge */}
                    <div className="mt-3 flex justify-end">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded border border-slate-950 ${
                          isFinal ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {isFinal ? card.finisherBadge : card.baseBadge}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Checklist */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border-2 border-slate-950 shadow-[3px_3px_0px_rgba(0,0,0,1)]">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider mb-2">Planned Resolution Sequence:</h3>
              <div className="text-xs space-y-1 text-slate-400 font-mono">
                {orderedUpgrades.map((u, i) => {
                  const isFinal = i === orderedUpgrades.length - 1;
                  return (
                    <div key={u.id} className="flex items-center justify-between">
                      <span>{i + 1}. {u.name}</span>
                      <span className={isFinal ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                        ➔ {isFinal ? u.finisherEffect : u.baseEffect}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-700">
              <button
                onClick={resetDefaultOrder}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase rounded border-2 border-slate-950 shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all"
              >
                Reset Order ↺
              </button>
              <button
                onClick={handleExecute}
                className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 active:translate-y-0.5 text-slate-950 font-black text-sm uppercase rounded-xl border-3 border-slate-950 shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2"
              >
                <span>EXECUTE SEQUENCE!</span>
                <span>➔</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
