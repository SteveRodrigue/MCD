import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert, Zap, AlertTriangle, RotateCcw, ArrowRight, X } from 'lucide-react';
import { PendingDecisionPrompt, TargetAllocationItem } from '../../../engine/models';

interface DistributeAmountModalProps {
  prompt: PendingDecisionPrompt;
  onConfirm: (assignments: Record<string, number>) => void;
  onCancel?: () => void;
}

export const DistributeAmountModal: React.FC<DistributeAmountModalProps> = ({
  prompt,
  onConfirm,
  onCancel,
}) => {
  const config = prompt.distributionConfig;
  const targets = useMemo(() => config?.targets || [], [config?.targets]);
  const totalBudget = config?.totalBudget ?? 0;
  const effectiveBudget = config?.effectiveBudget ?? totalBudget;
  const unit =
    config?.unitSingular ||
    (config?.allocationDomain === 'DAMAGE'
      ? 'DMG'
      : config?.allocationDomain === 'THREAT_REMOVAL'
        ? 'THW'
        : config?.allocationDomain === 'HEAL'
          ? 'HEAL'
          : 'PT');

  // Local state for assignments: { [instanceId: string]: number }
  const [assignments, setAssignments] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const t of targets) {
      initial[t.instanceId] = 0;
    }
    return initial;
  });

  const assignedTotal = useMemo(() => {
    return Object.values(assignments).reduce((sum, val) => sum + (val || 0), 0);
  }, [assignments]);

  const remainingBudget = Math.max(0, effectiveBudget - assignedTotal);
  const isComplete = assignedTotal === effectiveBudget;
  const isForced = !prompt.isVoluntary;

  const handleIncrement = (target: TargetAllocationItem) => {
    const current = assignments[target.instanceId] || 0;
    const cap = target.allocationCap ?? Infinity;
    if (remainingBudget <= 0 || current >= cap) return;

    setAssignments((prev) => ({
      ...prev,
      [target.instanceId]: current + 1,
    }));
  };

  const handleDecrement = (target: TargetAllocationItem) => {
    const current = assignments[target.instanceId] || 0;
    if (current <= 0) return;

    setAssignments((prev) => ({
      ...prev,
      [target.instanceId]: current - 1,
    }));
  };

  const handleMax = (target: TargetAllocationItem) => {
    const current = assignments[target.instanceId] || 0;
    const cap = target.allocationCap ?? Infinity;
    const availableForTarget = Math.max(0, cap - current);
    const amountToAdd = Math.min(remainingBudget, availableForTarget);
    if (amountToAdd <= 0) return;

    setAssignments((prev) => ({
      ...prev,
      [target.instanceId]: current + amountToAdd,
    }));
  };

  const handleResetAll = () => {
    const reset: Record<string, number> = {};
    for (const t of targets) {
      reset[t.instanceId] = 0;
    }
    setAssignments(reset);
  };

  const handleConfirm = () => {
    if (!isComplete) return;
    onConfirm(assignments);
  };

  // Group targets into swimlanes
  const swimlanes = useMemo(() => {
    const groups: { title: string; targets: TargetAllocationItem[] }[] = [];
    const playerMap = new Map<string, TargetAllocationItem[]>();
    const schemeTargets: TargetAllocationItem[] = [];
    const enemyTargets: TargetAllocationItem[] = [];
    const otherTargets: TargetAllocationItem[] = [];

    for (const t of targets) {
      if (t.cardType === 'main_scheme' || t.cardType === 'side_scheme') {
        schemeTargets.push(t);
      } else if (t.cardType === 'villain' || t.cardType === 'minion') {
        enemyTargets.push(t);
      } else if (t.controllerName || t.controllerPlayerId) {
        const key = t.controllerName || t.controllerPlayerId || 'Player';
        if (!playerMap.has(key)) {
          playerMap.set(key, []);
        }
        playerMap.get(key)!.push(t);
      } else {
        otherTargets.push(t);
      }
    }

    for (const [name, pTargets] of playerMap.entries()) {
      groups.push({ title: `${name}`, targets: pTargets });
    }
    if (schemeTargets.length > 0) {
      groups.push({ title: 'Schemes', targets: schemeTargets });
    }
    if (enemyTargets.length > 0) {
      groups.push({ title: 'Encounter / Enemies', targets: enemyTargets });
    }
    if (otherTargets.length > 0) {
      groups.push({ title: 'Other Targets', targets: otherTargets });
    }

    return groups.length > 0 ? groups : [{ title: 'Eligible Targets', targets }];
  }, [targets]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'hero':
        return '🦸';
      case 'alter_ego':
        return '👤';
      case 'ally':
        return '🤝';
      case 'villain':
        return '🦹';
      case 'minion':
        return '👾';
      case 'main_scheme':
        return '📜';
      case 'side_scheme':
        return '📑';
      default:
        return '🎯';
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-comic-black/80 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-200 font-comic">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-comic-paper border-4 border-comic-black rounded-xl shadow-comic-xl overflow-hidden flex flex-col">
        {/* Comic background dots */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#000 2px, transparent 2px)',
            backgroundSize: '12px 12px',
          }}
        />

        {/* 1. Header Banner */}
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
                <span className="bg-comic-black text-comic-yellow px-1.5 py-0.2 rounded text-[9px]">
                  {config?.allocationDomain || 'DISTRIBUTE'}
                </span>
              </div>
              <h2 className="text-xl font-black uppercase tracking-wide leading-tight">
                {prompt.title || 'Distribute Points'}
              </h2>
            </div>
          </div>
          {config?.canCancel && onCancel && (
            <button
              onClick={onCancel}
              className="p-1 hover:bg-comic-black hover:text-white rounded border border-comic-black transition-colors"
              aria-label="Cancel"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 2. Budget Tracker Banner */}
        <div className="relative px-5 py-3 bg-slate-900 text-white border-b-3 border-comic-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-sm font-black uppercase tracking-wider text-amber-300">
              POINTS TO ASSIGN:
            </div>
            <div className="text-2xl font-black tracking-widest text-comic-yellow">
              {assignedTotal} / {effectiveBudget}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase">
              ({remainingBudget} REMAINING)
            </div>
          </div>
          <button
            onClick={handleResetAll}
            disabled={assignedTotal === 0}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-amber-300 font-black text-xs uppercase rounded border-2 border-amber-400 shadow-comic-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET ALL</span>
          </button>
        </div>

        {/* Shortfall Alert Notice (if board capacity < nominal budget) */}
        {config?.shortfallNotice && (
          <div className="px-5 py-2 bg-amber-100 border-b-2 border-amber-300 flex items-center gap-2 text-amber-900 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{config.shortfallNotice}</span>
          </div>
        )}

        {/* 3. Target Tiles grouped by Swimlanes */}
        <div className="relative p-4 overflow-y-auto flex-1 space-y-4 max-h-[55vh]">
          {swimlanes.map((lane, laneIdx) => (
            <div key={laneIdx} className="space-y-2">
              <div className="text-xs font-black uppercase tracking-wider text-slate-700 border-b-2 border-comic-black pb-1 flex items-center gap-1.5">
                <span>⚡</span>
                <span>{lane.title}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lane.targets.map((target) => {
                  const assigned = assignments[target.instanceId] || 0;
                  const isEligible = target.isEligible !== false;
                  const cap = target.allocationCap ?? Infinity;
                  const canIncrement = isEligible && remainingBudget > 0 && assigned < cap;
                  const canDecrement = isEligible && assigned > 0;

                  return (
                    <div
                      key={target.instanceId}
                      className={`relative p-3 rounded-lg border-2 border-comic-black shadow-comic-sm transition-all flex flex-col justify-between ${
                        isEligible
                          ? assigned > 0
                            ? 'bg-amber-50 border-amber-500'
                            : 'bg-white'
                          : 'bg-slate-100 opacity-60 border-slate-400'
                      }`}
                    >
                      {/* Target Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl shrink-0">{getTypeIcon(target.cardType)}</span>
                          <div>
                            <div className="font-black text-sm text-comic-black leading-tight">
                              {target.name}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                              <span>{target.cardType.replace('_', ' ')}</span>
                              {target.currentValue !== undefined && (
                                <span>
                                  •{' '}
                                  {target.maxValue !== undefined
                                    ? `${target.currentValue}/${target.maxValue} HP`
                                    : `${target.currentValue} THW`}
                                </span>
                              )}
                              {target.hasTough && (
                                <span className="bg-amber-400 text-comic-black font-black px-1 rounded text-[9px]">
                                  TOUGH
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Ineligible Badge */}
                        {!isEligible && target.ineligibilityReason && (
                          <span className="bg-rose-100 text-rose-800 border border-rose-400 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider text-right">
                            {target.ineligibilityReason}
                          </span>
                        )}
                      </div>

                      {/* Stepper Controls (Only if eligible) */}
                      {isEligible ? (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 mt-auto">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleDecrement(target)}
                              disabled={!canDecrement}
                              aria-label="Decrease"
                              className="w-8 h-8 rounded bg-white hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-white text-comic-black font-black text-base border-2 border-comic-black shadow-comic-xs flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed"
                            >
                              -
                            </button>
                            <span className="min-w-[70px] text-center font-black text-sm bg-comic-black text-comic-yellow px-2 py-1 rounded shadow-comic-xs">
                              {assigned} {unit}
                            </span>
                            <button
                              onClick={() => handleIncrement(target)}
                              disabled={!canIncrement}
                              aria-label="Increase"
                              className="w-8 h-8 rounded bg-comic-yellow hover:bg-yellow-400 disabled:opacity-30 disabled:hover:bg-comic-yellow text-comic-black font-black text-base border-2 border-comic-black shadow-comic-xs flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>

                          <button
                            onClick={() => handleMax(target)}
                            disabled={!canIncrement}
                            aria-label="Max"
                            className="px-2.5 py-1 text-xs font-black bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-slate-100 text-comic-black rounded border-2 border-comic-black shadow-comic-xs transition-all cursor-pointer disabled:cursor-not-allowed"
                          >
                            MAX
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] font-bold text-slate-400 italic pt-1 text-center">
                          Ineligible for allocation
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 4. Action Bar (Footer) */}
        <div className="relative px-5 py-3.5 bg-comic-paper border-t-4 border-comic-black flex items-center justify-between">
          <div>
            {config?.canCancel && onCancel ? (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-comic-black font-black text-xs uppercase rounded-lg border-2 border-comic-black shadow-comic-sm transition-all cursor-pointer"
              >
                CANCEL
              </button>
            ) : (
              <div className="text-xs font-bold text-slate-600">
                {isComplete
                  ? 'All points assigned! Click confirm to proceed.'
                  : `Assign ${remainingBudget} more ${unit} to complete.`}
              </div>
            )}
          </div>

          <button
            onClick={handleConfirm}
            disabled={!isComplete}
            className="px-6 py-2.5 bg-comic-yellow hover:bg-yellow-400 disabled:opacity-40 disabled:hover:bg-comic-yellow active:translate-y-0.5 text-comic-black font-black text-sm uppercase rounded-lg border-3 border-comic-black shadow-comic-md disabled:shadow-none transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>CONFIRM ASSIGNMENT</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
