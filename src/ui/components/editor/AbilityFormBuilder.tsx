import React from 'react';
import {
  TimingTypeSchema,
  TriggerTypeSchema,
  EffectTypeSchema,
  ConditionGateSchema,
} from '../../../data/supplemental/schema';
import {
  Plus,
  Trash2,
  Shield,
  Zap,
  Sliders,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { getEffectDescriptor } from './effect-parameter-registry';

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

  const handleNoSupplementalNeededChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    if (checked) {
      if (abilities.length > 0) {
        const confirmed = window.confirm(
          'Marking this card as vanilla (noSupplementalNeeded) will remove its existing declarative abilities. Proceed?',
        );
        if (!confirmed) return;
      }
      const updated = {
        ...supplemental,
        noSupplementalNeeded: true,
      };
      delete updated.abilities;
      onChange(updated);
      setExpandedAbility(null);
    } else {
      const updated = { ...supplemental };
      delete updated.noSupplementalNeeded;
      if (!updated.abilities) {
        updated.abilities = [];
      }
      onChange(updated);
    }
  };

  // Ability Management
  const handleAddAbility = () => {
    if (supplemental.noSupplementalNeeded) return;
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

          <div className="sm:col-span-2 pt-2 border-t border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                data-testid="no-supplemental-needed-checkbox"
                checked={Boolean(supplemental.noSupplementalNeeded)}
                onChange={handleNoSupplementalNeededChange}
                className="w-4 h-4 rounded border-black text-comic-accent focus:ring-black cursor-pointer"
              />
              <span className="font-bold text-xs text-black">
                🛡️ No Supplemental Rules Needed (Vanilla Card)
              </span>
            </label>
            <p className="text-[11px] text-gray-500 ml-6 mt-0.5 font-comic">
              Flag this card as having no printed abilities, actions, or triggers to declare (e.g.
              Rhino I, vanilla cards). Disables ability creation.
            </p>
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
            data-testid="add-ability-btn"
            onClick={handleAddAbility}
            disabled={Boolean(supplemental.noSupplementalNeeded)}
            className={`flex items-center gap-1 font-bold px-2.5 py-1 border-2 border-black rounded shadow-comic-xs transition-transform ${
              supplemental.noSupplementalNeeded
                ? 'bg-gray-200 text-gray-400 border-gray-400 cursor-not-allowed'
                : 'bg-comic-accent hover:bg-blue-700 text-white cursor-pointer active:scale-95'
            }`}
            title={
              supplemental.noSupplementalNeeded
                ? 'Cannot add abilities to a vanilla card (noSupplementalNeeded is checked)'
                : 'Add a new declarative ability'
            }
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Ability</span>
          </button>
        </div>

        {supplemental.noSupplementalNeeded && (
          <div
            data-testid="vanilla-card-notice"
            className="p-3 bg-blue-50 border-2 border-blue-600 rounded flex items-start gap-2 shadow-comic-xs"
          >
            <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-xs text-blue-900 block">
                Vanilla Card (No Supplemental Rules Needed)
              </span>
              <span className="text-[11px] text-blue-800 font-comic">
                This card has no printed abilities to evaluate. Ability creation is locked. If you
                need to define abilities, uncheck "No Supplemental Rules Needed" in the card
                attributes above.
              </span>
            </div>
          </div>
        )}

        {!supplemental.noSupplementalNeeded && abilities.length === 0 && (
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
                  {ability.limit && (
                    <span className="bg-amber-100 text-amber-900 border border-amber-400 px-1.5 py-0.2 rounded text-[10px] font-bold">
                      ⏳ {ability.limit}
                    </span>
                  )}
                  {ability.zone && (
                    <span className="bg-blue-100 text-blue-900 border border-blue-400 px-1.5 py-0.2 rounded text-[10px] font-mono">
                      📍 {ability.zone}
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

                  {/* Usage Limit & Activation Zone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                        Usage Limit (RR v1.8 p. 21)
                      </label>
                      <select
                        value={ability.limit || ''}
                        onChange={(e) =>
                          handleUpdateAbility(aIdx, {
                            limit: e.target.value
                              ? (e.target.value as 'ONCE_PER_ROUND' | 'ONCE_PER_PHASE')
                              : undefined,
                          })
                        }
                        className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
                      >
                        <option value="">None (Unlimited)</option>
                        <option value="ONCE_PER_ROUND">
                          Limit once per round (ONCE_PER_ROUND)
                        </option>
                        <option value="ONCE_PER_PHASE">
                          Limit once per phase (ONCE_PER_PHASE)
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                        Activation Zone
                      </label>
                      <select
                        value={ability.zone || ''}
                        onChange={(e) =>
                          handleUpdateAbility(aIdx, {
                            zone: e.target.value
                              ? (e.target.value as 'HAND' | 'PLAY' | 'DISCARD')
                              : undefined,
                          })
                        }
                        className="w-full bg-white border border-black p-1 text-xs rounded font-mono"
                      >
                        <option value="">Default (In Play)</option>
                        <option value="HAND">From Hand (HAND)</option>
                        <option value="PLAY">In Play (PLAY)</option>
                        <option value="DISCARD">From Discard (DISCARD)</option>
                      </select>
                    </div>
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

                        const descriptor = getEffectDescriptor(step.effect || 'DEAL_DAMAGE');

                        const handleEffectChange = (newEffect: string) => {
                          const newDesc = getEffectDescriptor(newEffect);
                          const newParams: Record<string, any> = {};
                          for (const p of newDesc.parameters) {
                            if (params[p.key] !== undefined) {
                              newParams[p.key] = params[p.key];
                            } else if (p.key === 'count' && params.amount !== undefined) {
                              newParams.count = params.amount;
                            } else if (p.key === 'amount' && params.count !== undefined) {
                              newParams.amount = params.count;
                            } else if (p.defaultValue !== undefined) {
                              newParams[p.key] = p.defaultValue;
                            }
                          }
                          handleUpdateStep(aIdx, sIdx, {
                            effect: newEffect,
                            params: Object.keys(newParams).length > 0 ? newParams : undefined,
                          });
                        };

                        return (
                          <div
                            key={sIdx}
                            className="bg-comic-paper border border-black p-2.5 rounded flex flex-col gap-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[10px] font-bold bg-gray-300 px-1 py-0.5 rounded border border-gray-400">
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

                            {/* Effect Primitive Selector & Description */}
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <label className="block text-[9px] uppercase font-bold text-gray-500">
                                  Effect Primitive
                                </label>
                                <span className="text-[10px] text-gray-500 italic truncate max-w-xs">
                                  {descriptor.description}
                                </span>
                              </div>
                              <select
                                value={step.effect || 'DEAL_DAMAGE'}
                                onChange={(e) => handleEffectChange(e.target.value)}
                                className="w-full bg-white border border-black p-1 text-[11px] font-mono font-bold"
                              >
                                {EffectTypeSchema.options.map((eff) => (
                                  <option key={eff} value={eff}>
                                    {eff}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Dynamic Parameter Fields */}
                            {descriptor.parameters.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 bg-white/70 p-2 border border-black rounded">
                                {descriptor.parameters.map((param) => {
                                  const val = params[param.key];

                                  if (param.type === 'boolean') {
                                    return (
                                      <label
                                        key={param.key}
                                        className="flex items-center gap-1.5 text-xs font-bold text-gray-800 cursor-pointer pt-3"
                                        title={param.description}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={Boolean(val)}
                                          onChange={(e) =>
                                            handleUpdateStep(aIdx, sIdx, {
                                              params: { ...params, [param.key]: e.target.checked },
                                            })
                                          }
                                          className="accent-black"
                                        />
                                        <span>{param.label}</span>
                                      </label>
                                    );
                                  }

                                  if (param.type === 'select') {
                                    return (
                                      <div key={param.key}>
                                        <label
                                          className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5"
                                          title={param.description}
                                        >
                                          {param.label}
                                        </label>
                                        <select
                                          value={val !== undefined ? val : ''}
                                          onChange={(e) =>
                                            handleUpdateStep(aIdx, sIdx, {
                                              params: {
                                                ...params,
                                                [param.key]: e.target.value || undefined,
                                              },
                                            })
                                          }
                                          className="w-full bg-white border border-black p-1 text-[11px] font-mono"
                                        >
                                          <option value="">Default (Contextual)</option>
                                          {param.options?.map((opt) => (
                                            <option key={opt} value={opt}>
                                              {opt}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    );
                                  }

                                  if (param.type === 'number') {
                                    return (
                                      <div key={param.key}>
                                        <label
                                          className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5"
                                          title={param.description}
                                        >
                                          {param.label}
                                        </label>
                                        <input
                                          type="number"
                                          value={val !== undefined ? val : ''}
                                          onChange={(e) => {
                                            const num = e.target.value
                                              ? parseInt(e.target.value, 10)
                                              : undefined;
                                            handleUpdateStep(aIdx, sIdx, {
                                              params: {
                                                ...params,
                                                [param.key]: isNaN(num as number) ? undefined : num,
                                              },
                                            });
                                          }}
                                          placeholder={param.placeholder || '0'}
                                          className="w-full bg-white border border-black p-1 text-xs rounded"
                                        />
                                      </div>
                                    );
                                  }

                                  // Text input
                                  return (
                                    <div key={param.key}>
                                      <label
                                        className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5"
                                        title={param.description}
                                      >
                                        {param.label}
                                      </label>
                                      <input
                                        type="text"
                                        value={val || ''}
                                        onChange={(e) =>
                                          handleUpdateStep(aIdx, sIdx, {
                                            params: {
                                              ...params,
                                              [param.key]: e.target.value || undefined,
                                            },
                                          })
                                        }
                                        placeholder={param.placeholder || ''}
                                        className="w-full bg-white border border-black p-1 text-xs rounded"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-[11px] italic text-gray-500 bg-gray-100 p-1.5 rounded border border-gray-300">
                                No additional parameters required for this operational primitive.
                              </div>
                            )}

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
