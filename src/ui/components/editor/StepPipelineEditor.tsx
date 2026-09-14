import React from 'react';
import {
  ConditionGateSchema,
  StepConditionSchema,
  EffectTypeSchema,
} from '../../../data/supplemental/schema';
import { UniversalCardFilterBuilder } from './UniversalCardFilterBuilder';
import { DynamicValueBuilder } from './DynamicValueBuilder';
import { Plus, Trash2, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import { getEffectDescriptor } from './effect-parameter-registry';

export interface StepPipelineEditorProps {
  steps: any[];
  abilityIndex?: number;
  onChange: (updatedSteps: any[]) => void;
  hasErrors?: boolean;
  stepErrors?: Record<number, string[]>;
}

export const StepPipelineEditor: React.FC<StepPipelineEditorProps> = ({
  steps = [],
  abilityIndex = 0,
  onChange,
  hasErrors = false,
  stepErrors = {},
}) => {
  const handleAddStep = () => {
    const newStep = {
      effect: 'DRAW_CARDS',
      params: { count: 1 },
    };
    onChange([...steps, newStep]);
  };

  const handleRemoveStep = (stepIndex: number) => {
    onChange(steps.filter((_: any, sI: number) => sI !== stepIndex));
  };

  const handleMoveStep = (stepIndex: number, direction: 'up' | 'down') => {
    const updated = [...steps];
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;

    const temp = updated[stepIndex];
    updated[stepIndex] = updated[targetIndex];
    updated[targetIndex] = temp;
    onChange(updated);
  };

  const handleUpdateStep = (stepIndex: number, updatedStepFields: Record<string, any>) => {
    const updated = steps.map((st: any, sI: number) => {
      if (sI === stepIndex) {
        return { ...st, ...updatedStepFields };
      }
      return st;
    });
    onChange(updated);
  };

  return (
    <div
      data-testid={`step-pipeline-editor-${abilityIndex}`}
      className="space-y-2 pt-1 border-t border-gray-200"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
            Resolution Steps ({steps.length})
          </span>
          {hasErrors && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-comic-red bg-red-50 border border-comic-red px-1 rounded">
              <AlertCircle className="w-2.5 h-2.5" />
              <span>Step Errors</span>
            </span>
          )}
        </div>
        <button
          type="button"
          data-testid={`add-step-btn-${abilityIndex}`}
          onClick={handleAddStep}
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
          const errorsForStep = stepErrors[sIdx] || [];

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
            handleUpdateStep(sIdx, {
              effect: newEffect,
              params: Object.keys(newParams).length > 0 ? newParams : undefined,
            });
          };

          return (
            <div
              key={sIdx}
              data-testid={`step-item-${abilityIndex}-${sIdx}`}
              className={`bg-comic-paper border-2 ${
                errorsForStep.length > 0 ? 'border-comic-red ring-1 ring-red-300' : 'border-black'
              } p-2.5 rounded shadow-comic-xs flex flex-col gap-2.5 transition-colors`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold bg-gray-300 px-1.5 py-0.5 rounded border border-gray-400">
                    Step #{sIdx + 1}
                  </span>
                  {/* Reordering buttons */}
                  <button
                    type="button"
                    data-testid={`step-move-up-${abilityIndex}-${sIdx}`}
                    disabled={sIdx === 0}
                    onClick={() => handleMoveStep(sIdx, 'up')}
                    className={`p-0.5 border border-black rounded transition-transform ${
                      sIdx === 0
                        ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                        : 'bg-white hover:bg-gray-100 text-black cursor-pointer active:scale-95'
                    }`}
                    title="Move step up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    data-testid={`step-move-down-${abilityIndex}-${sIdx}`}
                    disabled={sIdx === steps.length - 1}
                    onClick={() => handleMoveStep(sIdx, 'down')}
                    className={`p-0.5 border border-black rounded transition-transform ${
                      sIdx === steps.length - 1
                        ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed'
                        : 'bg-white hover:bg-gray-100 text-black cursor-pointer active:scale-95'
                    }`}
                    title="Move step down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>

                <button
                  type="button"
                  data-testid={`step-remove-${abilityIndex}-${sIdx}`}
                  onClick={() => handleRemoveStep(sIdx)}
                  className="text-gray-400 hover:text-comic-red cursor-pointer p-0.5 rounded hover:bg-red-50 transition-colors"
                  title="Remove step"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {errorsForStep.length > 0 && (
                <div className="p-1.5 bg-red-50 border border-comic-red rounded text-[10px] text-red-800 space-y-0.5">
                  {errorsForStep.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}

              {/* Conditional Gate & Step Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Conditional Gate */}
                <div>
                  <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">
                    Conditional Gate (Timing / Flow)
                  </label>
                  <select
                    data-testid={`step-gate-${abilityIndex}-${sIdx}`}
                    value={step.gate || ''}
                    onChange={(e) =>
                      handleUpdateStep(sIdx, {
                        gate: e.target.value || undefined,
                      })
                    }
                    className="w-full bg-white border border-black p-1 text-[11px] font-mono font-bold"
                  >
                    <option value="">None (ALWAYS)</option>
                    {ConditionGateSchema.options.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step Condition */}
                <div>
                  <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">
                    Step Condition (Milestone / State)
                  </label>
                  <select
                    data-testid={`step-condition-${abilityIndex}-${sIdx}`}
                    value={step.condition || ''}
                    onChange={(e) =>
                      handleUpdateStep(sIdx, {
                        condition: e.target.value || undefined,
                      })
                    }
                    className="w-full bg-white border border-black p-1 text-[11px] font-mono font-bold"
                  >
                    <option value="">None (Unconditional)</option>
                    {StepConditionSchema.options.map((sc) => (
                      <option key={sc} value={sc}>
                        {sc}
                      </option>
                    ))}
                  </select>
                </div>
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
                  data-testid={`step-effect-select-${abilityIndex}-${sIdx}`}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white/80 p-2.5 border border-black rounded shadow-comic-xs">
                  {descriptor.parameters.map((param) => {
                    const val = params[param.key];

                    if (param.type === 'card-filter') {
                      return (
                        <div key={param.key} className="col-span-full">
                          <UniversalCardFilterBuilder
                            label={`${param.label} (Filter)`}
                            filter={val}
                            onChange={(newFilter) =>
                              handleUpdateStep(sIdx, {
                                params: {
                                  ...params,
                                  [param.key]: newFilter,
                                },
                              })
                            }
                            isSubBranch={true}
                          />
                        </div>
                      );
                    }

                    if (param.allowDynamic) {
                      return (
                        <div key={param.key} className="col-span-full">
                          <DynamicValueBuilder
                            label={param.label}
                            value={val}
                            allowAll={param.allowAll}
                            description={param.description}
                            onChange={(newVal) =>
                              handleUpdateStep(sIdx, {
                                params: {
                                  ...params,
                                  [param.key]: newVal,
                                },
                              })
                            }
                          />
                        </div>
                      );
                    }

                    if (param.type === 'boolean') {
                      return (
                        <label
                          key={param.key}
                          className="flex items-center gap-1.5 text-xs font-bold text-gray-800 cursor-pointer pt-3"
                          title={param.description}
                        >
                          <input
                            type="checkbox"
                            data-testid={`step-param-${param.key}-${abilityIndex}-${sIdx}`}
                            checked={Boolean(val)}
                            onChange={(e) =>
                              handleUpdateStep(sIdx, {
                                params: {
                                  ...params,
                                  [param.key]: e.target.checked,
                                },
                              })
                            }
                            className="accent-black"
                          />
                          <span>{param.label}</span>
                        </label>
                      );
                    }

                    if (param.type === 'multi-select') {
                      const selectedValues: string[] = Array.isArray(val)
                        ? val
                        : val
                          ? [val]
                          : param.defaultValue || [];
                      return (
                        <div key={param.key} className="col-span-full">
                          <label
                            className="block text-[9px] uppercase font-bold text-gray-500 mb-1"
                            title={param.description}
                          >
                            {param.label}
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {param.options?.map((opt) => {
                              const isActive = selectedValues.includes(opt);
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  data-testid={`step-param-${param.key}-${opt}-${abilityIndex}-${sIdx}`}
                                  onClick={() => {
                                    const next = isActive
                                      ? selectedValues.filter((v) => v !== opt)
                                      : [...selectedValues, opt];
                                    handleUpdateStep(sIdx, {
                                      params: {
                                        ...params,
                                        [param.key]: next.length > 0 ? next : undefined,
                                      },
                                    });
                                  }}
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded border border-black transition-all ${
                                    isActive
                                      ? 'bg-comic-accent text-white shadow-comic-xs'
                                      : 'bg-gray-100 text-black hover:bg-gray-200'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
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
                            data-testid={`step-param-${param.key}-${abilityIndex}-${sIdx}`}
                            value={val !== undefined ? val : ''}
                            onChange={(e) =>
                              handleUpdateStep(sIdx, {
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
                            min={0}
                            data-testid={`step-param-${param.key}-${abilityIndex}-${sIdx}`}
                            value={val !== undefined ? val : ''}
                            onChange={(e) => {
                              const num =
                                e.target.value !== ''
                                  ? Math.max(0, parseInt(e.target.value, 10) || 0)
                                  : undefined;
                              handleUpdateStep(sIdx, {
                                params: {
                                  ...params,
                                  [param.key]: num,
                                },
                              });
                            }}
                            placeholder={param.placeholder || '0'}
                            className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
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
                          data-testid={`step-param-${param.key}-${abilityIndex}-${sIdx}`}
                          value={val || ''}
                          onChange={(e) =>
                            handleUpdateStep(sIdx, {
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
            </div>
          );
        })}
      </div>
    </div>
  );
};
