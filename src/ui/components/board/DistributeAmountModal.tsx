import React, { useState, useMemo } from 'react';
import { ShieldAlert, Zap, AlertTriangle, RotateCcw, ArrowRight } from 'lucide-react';
import { PendingDecisionPrompt, TargetAllocationItem } from '../../../engine/models';
import { AccentStripe } from '../../theme/AccentStripe';
import { CardRef } from '../../theme/CardRef';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { useModalStyle } from '../../theme/useModalStyle';

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
  const { style } = useModalStyle();
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

  return (
    <ModalScaffold
      title={prompt.title || 'Distribute Points'}
      kicker={isForced ? 'FORCED RESOLUTION' : 'DECISION POINT'}
      verb={isForced ? 'red' : 'yellow'}
      trigger={
        prompt.sourceCardName ? { name: prompt.sourceCardName, code: prompt.sourceCardCode } : null
      }
      icon={
        isForced ? <ShieldAlert className="w-5 h-5 animate-pulse" /> : <Zap className="w-5 h-5" />
      }
      headerRight={
        <span className={`text-[9px] font-black px-1.5 py-0.5 ${style.chip}`}>
          {config?.allocationDomain || 'DISTRIBUTE'}
        </span>
      }
      onClose={config?.canCancel && onCancel ? onCancel : undefined}
      maxWidthClass="max-w-2xl"
      testId="distribute-amount-modal"
      footer={
        <>
          <div>
            {config?.canCancel && onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className={`px-4 py-2 font-black text-xs uppercase cursor-pointer ${style.btnMove}`}
              >
                CANCEL
              </button>
            ) : (
              <div className={`text-xs font-bold ${style.muted}`}>
                {isComplete
                  ? 'All points assigned! Click confirm to proceed.'
                  : `Assign ${remainingBudget} more ${unit} to complete.`}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isComplete}
            className={`px-6 py-2.5 font-black text-sm uppercase flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed ${style.btnGo}`}
          >
            <span>CONFIRM ASSIGNMENT</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </>
      }
    >
      {/* Budget Tracker */}
      <div
        className={`-mx-5 sm:-mx-6 -mt-5 sm:-mt-6 px-5 py-3 flex items-center justify-between !rounded-none !border-x-0 ${style.inset}`}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-sm font-black uppercase tracking-wider">POINTS TO ASSIGN:</div>
          <div className={`text-2xl font-black tracking-widest ${style.emphasis}`}>
            {assignedTotal} / {effectiveBudget}
          </div>
          <div className={`text-xs font-bold uppercase ${style.muted}`}>
            ({remainingBudget} REMAINING)
          </div>
        </div>
        <button
          type="button"
          onClick={handleResetAll}
          disabled={assignedTotal === 0}
          className={`px-3 py-1.5 font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed ${style.btnMove}`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>RESET ALL</span>
        </button>
      </div>

      {/* Shortfall Alert Notice (if board capacity < nominal budget) */}
      {config?.shortfallNotice && (
        <div className="px-3 py-2 bg-amber-100 border-2 border-amber-300 rounded flex items-center gap-2 text-amber-900 text-xs font-bold">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{config.shortfallNotice}</span>
        </div>
      )}

      {/* Target Tiles grouped by Swimlanes */}
      <div className="space-y-4">
        {swimlanes.map((lane, laneIdx) => (
          <div key={laneIdx} className="space-y-2">
            <div
              className={`text-xs font-black uppercase tracking-wider pb-1 flex items-center gap-1.5 ${style.panelHead}`}
            >
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
                    data-card-anchor={target.cardCode ?? ''}
                    className={`relative p-3 pl-4 transition-all flex flex-col justify-between ${
                      isEligible
                        ? assigned > 0
                          ? style.slotFinal
                          : style.slot
                        : `${style.slot} opacity-60 border-dashed`
                    }`}
                  >
                    <AccentStripe code={target.cardCode ?? ''} />
                    {/* Target Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {!target.cardCode && (
                          <span className="text-xl shrink-0">{getTypeIcon(target.cardType)}</span>
                        )}
                        <div>
                          <div className="font-black text-sm leading-tight">
                            <CardRef code={target.cardCode} name={target.name} size="sm" />
                          </div>
                          <div
                            className={`flex items-center gap-2 text-[10px] font-bold uppercase ${style.muted}`}
                          >
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
                      <div className="flex items-center justify-between pt-2 mt-auto">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDecrement(target)}
                            disabled={!canDecrement}
                            aria-label="Decrease"
                            className={`w-8 h-8 font-black text-base flex items-center justify-center cursor-pointer disabled:cursor-not-allowed ${style.btnMove}`}
                          >
                            -
                          </button>
                          <span
                            className={`min-w-[70px] text-center font-black text-sm px-2 py-1 ${style.chip}`}
                          >
                            {assigned} {unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleIncrement(target)}
                            disabled={!canIncrement}
                            aria-label="Increase"
                            className={`w-8 h-8 font-black text-base flex items-center justify-center cursor-pointer disabled:cursor-not-allowed ${style.btnMove}`}
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleMax(target)}
                          disabled={!canIncrement}
                          aria-label="Max"
                          className={`px-2.5 py-1 text-xs font-black cursor-pointer disabled:cursor-not-allowed ${style.btnMove}`}
                        >
                          MAX
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`text-[11px] font-bold italic pt-1 text-center ${style.muted}`}
                      >
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
    </ModalScaffold>
  );
};
