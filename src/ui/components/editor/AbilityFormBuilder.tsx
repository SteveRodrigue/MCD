import React from 'react';
import {
  TimingTypeSchema,
  TriggerTypeSchema,
  EffectTypeSchema,
  ConditionGateSchema,
  TargetSelectorSchema,
} from '../../../data/supplemental/schema';
import { Plus, Trash2, Shield, Zap, Sliders, ChevronDown, ChevronRight } from 'lucide-react';

interface AbilityFormBuilderProps {
  supplemental: any;
  onChange: (updatedSupplemental: any) => void;
}

export const AbilityFormBuilder: React.FC<AbilityFormBuilderProps> = ({
  supplemental,
  onChange,
}) => {
  const [expandedAbility, setExpandedAbility] = React.useState<number | null>(0);

  const abilities = Array.isArray(supplemental.abilities) ? supplemental.abilities : [];
  const audit = supplemental.audit || {};

  // Handlers for top-level fields
  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...supplemental,
      comment: e.target.value || undefined,
    });
  };

  const handleMaxPerPlayerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
    onChange({
      ...supplemental,
      maxPerPlayer: isNaN(val as number) ? undefined : val,
    });
  };

  const handleConfidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onChange({
      ...supplemental,
      audit: {
        ...audit,
        confidence: isNaN(val) ? 100 : val,
      },
    });
  };

  const handleReviewedByChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...supplemental,
      audit: {
        ...audit,
        reviewedBy: e.target.value || 'developer',
      },
    });
  };

  // Ability Management
  const handleAddAbility = () => {
    const newAbility = {
      id: `ability_${abilities.length + 1}`,
      timing: 'ACTION',
      steps: [
        {
          effect: 'DEAL_DAMAGE',
          params: { amount: 3 },
        },
      ],
    };
    const updated = [...abilities, newAbility];
    onChange({
      ...supplemental,
      abilities: updated,
    });
    setExpandedAbility(updated.length - 1);
  };

  const handleRemoveAbility = (index: number) => {
    const updated = abilities.filter((_: any, i: number) => i !== index);
    onChange({
      ...supplemental,
      abilities: updated,
    });
    if (expandedAbility === index) {
      setExpandedAbility(null);
    }
  };

  const handleUpdateAbility = (index: number, updatedFields: Record<string, any>) => {
    const updated = abilities.map((ab: any, i: number) => {
      if (i === index) {
        return { ...ab, ...updatedFields };
      }
      return ab;
    });
    onChange({
      ...supplemental,
      abilities: updated,
    });
  };

  // Step Management
  const handleAddStep = (abilityIndex: number) => {
    const ability = abilities[abilityIndex];
    const steps = Array.isArray(ability.steps) ? ability.steps : [];
    const newStep = {
      effect: 'DRAW_CARDS',
      params: { amount: 1 },
    };
    handleUpdateAbility(abilityIndex, {
      steps: [...steps, newStep],
    });
  };

  const handleRemoveStep = (abilityIndex: number, stepIndex: number) => {
    const ability = abilities[abilityIndex];
    const steps = Array.isArray(ability.steps) ? ability.steps : [];
    handleUpdateAbility(abilityIndex, {
      steps: steps.filter((_: any, sI: number) => sI !== stepIndex),
    });
  };

  const handleUpdateStep = (
    abilityIndex: number,
    stepIndex: number,
    updatedStepFields: Record<string, any>,
  ) => {
    const ability = abilities[abilityIndex];
    const steps = Array.isArray(ability.steps) ? ability.steps : [];
    const updatedSteps = steps.map((st: any, sI: number) => {
      if (sI === stepIndex) {
        return { ...st, ...updatedStepFields };
      }
      return st;
    });
    handleUpdateAbility(abilityIndex, {
      steps: updatedSteps,
    });
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* 1. CARD-LEVEL METADATA ACCORDION */}
      <div className="bg-white border-2 border-black p-3 rounded shadow-comic-xs">
        <div className="flex items-center gap-1.5 font-bangers text-sm border-b pb-1 mb-2 text-black">
          <Sliders className="w-4 h-4 text-comic-accent" />
          <span>CARD-LEVEL ATTRIBUTES & AUDIT</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Internal Developer Comment
            </label>
            <input
              type="text"
              value={supplemental.comment || ''}
              onChange={handleCommentChange}
              placeholder="e.g. Hero attack: deals 3 damage..."
              className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Max Per Player Board Limit
            </label>
            <input
              type="number"
              min="1"
              max="4"
              value={supplemental.maxPerPlayer || ''}
              onChange={handleMaxPerPlayerChange}
              placeholder="Leave empty if unrestricted"
              className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Confidence Level ({audit.confidence ?? 100}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={audit.confidence ?? 100}
              onChange={handleConfidenceChange}
              className="w-full cursor-pointer accent-comic-red"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Reviewed By Attribution
            </label>
            <input
              type="text"
              value={audit.reviewedBy || 'developer'}
              onChange={handleReviewedByChange}
              className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
            />
          </div>
        </div>
      </div>

      {/* 2. ABILITIES LIST */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bangers text-base tracking-wide text-black flex items-center gap-1.5">
            <Zap className="w-4 h-4 fill-comic-yellow text-black" />
            <span>DECLARATIVE ABILITIES ({abilities.length})</span>
          </span>

          <button
            type="button"
            onClick={handleAddAbility}
            className="flex items-center gap-1 bg-comic-accent hover:bg-blue-700 text-white font-bold px-2.5 py-1 border-2 border-black rounded shadow-comic-xs cursor-pointer active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Ability</span>
          </button>
        </div>

        {abilities.length === 0 && (
          <div className="p-4 bg-white border-2 border-dashed border-gray-300 rounded text-center text-gray-500 italic">
            No abilities defined. Click "Add Ability" to attach rules logic.
          </div>
        )}

        {abilities.map((ability: any, aIdx: number) => {
          const isExpanded = expandedAbility === aIdx;
          const steps = Array.isArray(ability.steps) ? ability.steps : [];
          const cost = ability.cost || {};

          return (
            <div
              key={aIdx}
              className="bg-white border-2 border-black rounded shadow-comic-xs overflow-hidden"
            >
              {/* Accordion Header */}
              <div
                onClick={() => setExpandedAbility(isExpanded ? null : aIdx)}
                className="bg-comic-paper px-3 py-2 border-b border-black flex items-center justify-between cursor-pointer hover:bg-yellow-50 select-none"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  )}
                  <span className="font-mono font-bold bg-black text-white px-1.5 py-0.2 rounded text-[11px]">
                    #{aIdx + 1}
                  </span>
                  <span className="font-bold text-xs">{ability.id || 'unnamed_ability'}</span>
                  <span className="bg-comic-yellow text-black px-1.5 py-0.2 border border-black rounded text-[10px] font-bold">
                    {ability.timing}
                  </span>
                  {ability.trigger && (
                    <span className="bg-gray-200 text-gray-700 px-1.5 py-0.2 rounded text-[10px] font-mono">
                      {ability.trigger}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleRemoveAbility(aIdx)}
                    className="p-1 text-gray-400 hover:text-comic-red cursor-pointer rounded hover:bg-red-50 transition-colors"
                    title="Remove ability"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Accordion Body */}
              {isExpanded && (
                <div className="p-3 space-y-3 bg-white">
                  {/* Ability ID & Description */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                        Ability Identifier
                      </label>
                      <input
                        type="text"
                        value={ability.id || ''}
                        onChange={(e) => handleUpdateAbility(aIdx, { id: e.target.value })}
                        className="w-full bg-white border border-black p-1 text-xs rounded font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                        Timing Window
                      </label>
                      <select
                        value={ability.timing || 'ACTION'}
                        onChange={(e) => handleUpdateAbility(aIdx, { timing: e.target.value })}
                        className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
                      >
                        {TimingTypeSchema.options.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Trigger Window (if not basic ACTION) */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                      Event Trigger (Optional for voluntary actions)
                    </label>
                    <select
                      value={ability.trigger || ''}
                      onChange={(e) =>
                        handleUpdateAbility(aIdx, { trigger: e.target.value || undefined })
                      }
                      className="w-full bg-white border border-black p-1 text-xs rounded font-mono"
                    >
                      <option value="">None (Voluntary Action / Constant)</option>
                      {TriggerTypeSchema.options.map((tr) => (
                        <option key={tr} value={tr}>
                          {tr}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Cost Specification */}
                  <div className="bg-gray-50 border border-gray-300 p-2.5 rounded space-y-2">
                    <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-comic-red" />
                      <span>Ability Costs</span>
                    </span>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(cost.exhaust)}
                          onChange={(e) =>
                            handleUpdateAbility(aIdx, {
                              cost: { ...cost, exhaust: e.target.checked || undefined },
                            })
                          }
                          className="accent-black"
                        />
                        <span className="font-bold">Exhaust Host Card</span>
                      </label>

                      <div className="flex items-center gap-1">
                        <span className="text-gray-600">Self DMG:</span>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={cost.damageSelf || ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                            handleUpdateAbility(aIdx, {
                              cost: { ...cost, damageSelf: isNaN(val as number) ? undefined : val },
                            });
                          }}
                          placeholder="0"
                          className="w-12 bg-white border border-black px-1 py-0.5 text-center text-xs rounded"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resolution Steps Sub-list */}
                  <div className="space-y-2 pt-1 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                        Resolution Steps ({steps.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddStep(aIdx)}
                        className="text-[11px] font-bold text-comic-accent hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Step</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {steps.map((step: any, sIdx: number) => {
                        const params = step.params || {};

                        return (
                          <div
                            key={sIdx}
                            className="bg-comic-paper border border-black p-2 rounded flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[10px] font-bold bg-gray-300 px-1 py-0.2 rounded">
                                Step #{sIdx + 1}
                              </span>

                              <button
                                type="button"
                                onClick={() => handleRemoveStep(aIdx, sIdx)}
                                className="text-gray-400 hover:text-comic-red cursor-pointer"
                                title="Remove step"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {/* Primitive Effect Selector */}
                              <div>
                                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">
                                  Effect Primitive
                                </label>
                                <select
                                  value={step.effect || 'DEAL_DAMAGE'}
                                  onChange={(e) =>
                                    handleUpdateStep(aIdx, sIdx, { effect: e.target.value })
                                  }
                                  className="w-full bg-white border border-black p-1 text-[11px] font-mono font-bold"
                                >
                                  {EffectTypeSchema.options.map((eff) => (
                                    <option key={eff} value={eff}>
                                      {eff}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Amount Param */}
                              <div>
                                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">
                                  Amount (e.g. dmg, threat, cards)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={params.amount !== undefined ? params.amount : ''}
                                  onChange={(e) => {
                                    const val = e.target.value
                                      ? parseInt(e.target.value, 10)
                                      : undefined;
                                    handleUpdateStep(aIdx, sIdx, {
                                      params: {
                                        ...params,
                                        amount: isNaN(val as number) ? undefined : val,
                                      },
                                    });
                                  }}
                                  placeholder="Amount"
                                  className="w-full bg-white border border-black p-1 text-xs rounded"
                                />
                              </div>

                              {/* Target Selector */}
                              <div>
                                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">
                                  Target
                                </label>
                                <select
                                  value={params.target || ''}
                                  onChange={(e) =>
                                    handleUpdateStep(aIdx, sIdx, {
                                      params: { ...params, target: e.target.value || undefined },
                                    })
                                  }
                                  className="w-full bg-white border border-black p-1 text-[11px] font-mono"
                                >
                                  <option value="">Default (Contextual)</option>
                                  {TargetSelectorSchema.options.map((tgt) => (
                                    <option key={tgt} value={tgt}>
                                      {tgt}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Conditional Gate */}
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-gray-600">Gate:</span>
                              <select
                                value={step.gate || ''}
                                onChange={(e) =>
                                  handleUpdateStep(aIdx, sIdx, {
                                    gate: e.target.value || undefined,
                                  })
                                }
                                className="bg-white border border-black px-1 py-0.5 text-[11px] rounded font-mono"
                              >
                                <option value="">None (ALWAYS)</option>
                                {ConditionGateSchema.options.map((g) => (
                                  <option key={g} value={g}>
                                    {g}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
