import React from 'react';
import type { ZodObject } from 'zod';
import {
  StepGateSchema,
  EffectTypeSchema,
  type EffectType,
} from '../../../data/supplemental/schema';
import {
  EFFECT_DESCRIPTIONS,
  EFFECT_PARAM_SCHEMAS,
} from '../../../data/supplemental/effect-params';
import { introspectObjectSchema } from '../../../data/supplemental/schema-introspector';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { ZodSchemaForm } from './schema-form/ZodSchemaForm';
import { generateStepSummary } from './step-pipeline-utils';
import { GateParamsPanel } from './GateParamsPanel';

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
  const [expandedStep, setExpandedStep] = React.useState<number | null>(0);

  const handleAddStep = () => {
    const newStep = {
      effect: 'DRAW',
      effectParams: { count: 1 },
    };
    const updated = [...steps, newStep];
    onChange(updated);
    setExpandedStep(updated.length - 1);
  };

  const handleRemoveStep = (stepIndex: number) => {
    onChange(steps.filter((_: any, sI: number) => sI !== stepIndex));
    if (expandedStep === stepIndex) {
      setExpandedStep(null);
    } else if (expandedStep !== null && expandedStep > stepIndex) {
      setExpandedStep(expandedStep - 1);
    }
  };

  const handleMoveStep = (stepIndex: number, direction: 'up' | 'down') => {
    const updated = [...steps];
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;

    const temp = updated[stepIndex];
    updated[stepIndex] = updated[targetIndex];
    updated[targetIndex] = temp;
    if (expandedStep === stepIndex) {
      setExpandedStep(targetIndex);
    } else if (expandedStep === targetIndex) {
      setExpandedStep(stepIndex);
    }
    onChange(updated);
  };

  const handleUpdateStep = (stepIndex: number, updatedStepFields: Record<string, any>) => {
    const updated = steps.map((st: any, sI: number) => {
      if (sI === stepIndex) {
        const next = { ...st, ...updatedStepFields };
        for (const [key, val] of Object.entries(updatedStepFields)) {
          if (val === undefined) {
            delete next[key];
          }
        }
        return next;
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
          const effectParams = step.effectParams ?? {};
          const gateParams = step.gateParams ?? {};
          const effect: EffectType = step.effect || 'DEAL_DAMAGE';
          // An effect missing from the schema map (stale or invalid data) has no parameter form.
          const effectSchema: ZodObject | undefined = EFFECT_PARAM_SCHEMAS[effect];
          const effectFields = effectSchema ? introspectObjectSchema(effectSchema) : [];
          const errorsForStep = stepErrors[sIdx] || [];

          const handleEffectChange = (newEffect: string) => {
            const newFields = introspectObjectSchema(EFFECT_PARAM_SCHEMAS[newEffect as EffectType]);
            const newParams: Record<string, any> = {};
            for (const field of newFields) {
              if (effectParams[field.key] !== undefined) {
                newParams[field.key] = effectParams[field.key];
              } else if (field.key === 'count' && effectParams.amount !== undefined) {
                newParams.count = effectParams.amount;
              } else if (field.key === 'amount' && effectParams.count !== undefined) {
                newParams.amount = effectParams.count;
              } else if (field.defaultValue !== undefined) {
                newParams[field.key] = field.defaultValue;
              }
            }
            const cleanParams = Object.keys(newParams).length > 0 ? newParams : undefined;
            handleUpdateStep(sIdx, {
              effect: newEffect,
              effectParams: cleanParams,
            });
          };

          const updateGateParam = (key: string, val: any) => {
            const nextParams = { ...gateParams, [key]: val };
            if (val === undefined || val === '') {
              delete nextParams[key];
            }
            handleUpdateStep(sIdx, {
              gateParams: Object.keys(nextParams).length > 0 ? nextParams : undefined,
            });
          };

          const isExpanded = expandedStep === sIdx || errorsForStep.length > 0;
          const summary = generateStepSummary(step, sIdx);

          if (!isExpanded) {
            return (
              <div
                key={sIdx}
                data-testid={`step-item-${abilityIndex}-${sIdx}`}
                className={`bg-comic-paper border-2 ${
                  errorsForStep.length > 0 ? 'border-comic-red ring-1 ring-red-300' : 'border-black'
                } p-2 rounded shadow-comic-xs transition-colors hover:bg-yellow-50/40 cursor-pointer select-none`}
                onClick={() => setExpandedStep(sIdx)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] font-bold bg-gray-300 text-black px-1.5 py-0.5 rounded border border-gray-400 shrink-0">
                      Step #{sIdx + 1}
                    </span>
                    <span
                      data-testid={`step-summary-${abilityIndex}-${sIdx}`}
                      className="font-bangers tracking-wide text-xs text-black truncate"
                    >
                      {summary}
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                    <button
                      type="button"
                      data-testid={`step-remove-${abilityIndex}-${sIdx}`}
                      onClick={() => handleRemoveStep(sIdx)}
                      className="text-gray-400 hover:text-comic-red cursor-pointer p-0.5 rounded hover:bg-red-50 transition-colors"
                      title="Remove step"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="text-gray-600 pl-1">
                      <ChevronRight className="w-4 h-4 text-black" />
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={sIdx}
              data-testid={`step-item-${abilityIndex}-${sIdx}`}
              className={`bg-comic-paper border-2 ${
                errorsForStep.length > 0 ? 'border-comic-red ring-1 ring-red-300' : 'border-black'
              } p-2.5 rounded shadow-comic-xs flex flex-col gap-2.5 transition-colors`}
            >
              <div
                className="flex items-center justify-between gap-2 cursor-pointer select-none"
                onClick={() => setExpandedStep(expandedStep === sIdx ? null : sIdx)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[10px] font-bold bg-comic-yellow text-black px-1.5 py-0.5 rounded border border-black shrink-0">
                    Step #{sIdx + 1}
                  </span>
                  <span
                    data-testid={`step-summary-${abilityIndex}-${sIdx}`}
                    className="font-bangers tracking-wide text-xs text-black truncate"
                  >
                    {summary}
                  </span>
                </div>

                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
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
                  <button
                    type="button"
                    data-testid={`step-remove-${abilityIndex}-${sIdx}`}
                    onClick={() => handleRemoveStep(sIdx)}
                    className="text-gray-400 hover:text-comic-red cursor-pointer p-0.5 rounded hover:bg-red-50 transition-colors"
                    title="Remove step"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="text-gray-600 pl-1">
                    <ChevronDown className="w-4 h-4 text-black" />
                  </div>
                </div>
              </div>

              {errorsForStep.length > 0 && (
                <div className="p-1.5 bg-red-50 border border-comic-red rounded text-[10px] text-red-800 space-y-0.5">
                  {errorsForStep.map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}

              {/* Step Identification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">
                    Step ID (Optional)
                  </label>
                  <input
                    type="text"
                    data-testid={`step-id-${abilityIndex}-${sIdx}`}
                    value={step.id || ''}
                    onChange={(e) => handleUpdateStep(sIdx, { id: e.target.value || undefined })}
                    placeholder="e.g. photonic_blast_damage"
                    className="w-full bg-white border border-black p-1 text-xs rounded font-mono"
                  />
                </div>
              </div>

              {/* Conditional Gate */}
              <div>
                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">
                  Conditional Gate (Timing / Flow)
                </label>
                <select
                  data-testid={`step-gate-${abilityIndex}-${sIdx}`}
                  value={step.gate || ''}
                  onChange={(e) => {
                    const nextGate = e.target.value || undefined;
                    handleUpdateStep(sIdx, {
                      gate: nextGate,
                      gateParams: nextGate !== step.gate ? undefined : gateParams,
                    });
                  }}
                  className="w-full bg-white border border-black p-1 text-[11px] font-mono font-bold"
                >
                  <option value="">None (ALWAYS)</option>
                  {StepGateSchema.options.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* "This effect cannot be canceled" */}
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-700">
                <input
                  type="checkbox"
                  data-testid={`step-cannot-be-canceled-${abilityIndex}-${sIdx}`}
                  checked={step.cannotBeCanceled === true}
                  onChange={(e) =>
                    handleUpdateStep(sIdx, { cannotBeCanceled: e.target.checked || undefined })
                  }
                />
                This effect cannot be canceled (still resolves when the card&apos;s reveal is
                cancelled)
              </label>

              {/* Parameterized Gate Panel */}
              {step.gate && (
                <GateParamsPanel
                  gate={step.gate}
                  gateParams={gateParams}
                  onChange={updateGateParam}
                  availableStepIds={steps
                    .slice(0, sIdx)
                    .map((s: any) => s.id)
                    .filter(Boolean)}
                  abilityIndex={abilityIndex}
                  stepIndex={sIdx}
                />
              )}

              {/* Effect Primitive Selector & Description */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <label className="block text-[9px] uppercase font-bold text-gray-500">
                    Effect Primitive
                  </label>
                  <span className="text-[10px] text-gray-500 italic truncate max-w-xs">
                    {EFFECT_DESCRIPTIONS[effect]}
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

              {/* Effect parameters, rendered from EFFECT_PARAM_SCHEMAS[effect] */}
              {effectSchema && effectFields.length > 0 ? (
                <div className="space-y-2 bg-white/80 p-2.5 border border-black rounded shadow-comic-xs">
                  {effect === 'GENERATE_RESOURCE' && (
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">
                        Source Mode
                      </label>
                      <select
                        data-testid={`step-param-sourceMode-${abilityIndex}-${sIdx}`}
                        value={effectParams.fromCard ? 'FROM_CARD' : 'STATIC'}
                        onChange={(e) => {
                          const next = { ...effectParams };
                          if (e.target.value === 'FROM_CARD') {
                            delete next.resource;
                            delete next.amount;
                            next.fromCard = { zone: 'PLAYER_DISCARD', position: 'TOP' };
                          } else {
                            delete next.fromCard;
                            next.resource = 'wild';
                            next.amount = 1;
                          }
                          handleUpdateStep(sIdx, { effectParams: next });
                        }}
                        className="w-full bg-white border border-black p-1 text-[11px] font-mono font-bold"
                      >
                        <option value="STATIC">STATIC (Fixed Resource Amount)</option>
                        <option value="FROM_CARD">FROM_CARD (Dynamic Card Inspector)</option>
                      </select>
                    </div>
                  )}
                  <ZodSchemaForm
                    schema={effectSchema}
                    value={step.effectParams}
                    onChange={(next) => handleUpdateStep(sIdx, { effectParams: next })}
                    testId={(path, extra) =>
                      `step-param-${path.join('-')}${extra ? `-${extra}` : ''}-${abilityIndex}-${sIdx}`
                    }
                    hiddenKeys={
                      effect !== 'GENERATE_RESOURCE'
                        ? []
                        : effectParams.fromCard
                          ? ['resource', 'amount']
                          : ['fromCard']
                    }
                  />
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
