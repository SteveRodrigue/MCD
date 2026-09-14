import React from 'react';
import {
  TimingTypeSchema,
  TriggerTypeSchema,
  CardEnrichmentSchema,
  CardAbilitySchema,
} from '../../../data/supplemental/schema';
import { CardAttributesSection } from './CardAttributesSection';
import { AbilityCostSection } from './AbilityCostSection';
import { TriggerFilterSection } from './TriggerFilterSection';
import { StepPipelineEditor } from './StepPipelineEditor';
import {
  Zap,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export interface AbilityFormBuilderProps {
  supplemental: any;
  onChange: (updatedSupplemental: any) => void;
}

export const AbilityFormBuilder: React.FC<AbilityFormBuilderProps> = ({
  supplemental,
  onChange,
}) => {
  const [expandedAbility, setExpandedAbility] = React.useState<number | null>(0);
  const [expandedTriggerFilter, setExpandedTriggerFilter] = React.useState<number | null>(null);
  const [showValidationIssues, setShowValidationIssues] = React.useState(false);

  const abilities = React.useMemo(() => {
    return Array.isArray(supplemental.abilities) ? supplemental.abilities : [];
  }, [supplemental.abilities]);

  // 1. Live Zod Schema Validation
  const cardValidation = React.useMemo(() => {
    return CardEnrichmentSchema.safeParse(supplemental);
  }, [supplemental]);

  // Extract top-level vs ability-specific validation errors
  const topLevelErrors = React.useMemo(() => {
    if (cardValidation.success) return [];
    return cardValidation.error.issues
      .filter((issue) => issue.path[0] !== 'abilities')
      .map((issue) => `${issue.path.join('.') || 'card'}: ${issue.message}`);
  }, [cardValidation]);

  const abilityErrors = React.useMemo(() => {
    const errorMap: Record<number, string[]> = {};
    abilities.forEach((ability: any, idx: number) => {
      const parsed = CardAbilitySchema.safeParse(ability);
      if (!parsed.success) {
        errorMap[idx] = parsed.error.issues.map(
          (issue) => `${issue.path.join('.') || 'ability'}: ${issue.message}`,
        );
      }
    });
    return errorMap;
  }, [abilities]);

  // Ability Management Handlers
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

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* Real-time Live Zod Validation Status Badge */}
      <div
        data-testid="live-validation-status"
        className={`p-2.5 rounded border-2 shadow-comic-xs flex flex-col gap-1 transition-colors ${
          cardValidation.success
            ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
            : 'bg-red-50 border-comic-red text-red-900'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {cardValidation.success ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-comic-red shrink-0" />
            )}
            <span className="font-bangers tracking-wide text-xs">
              {cardValidation.success
                ? 'REAL-TIME ZOD VALIDATION: SCHEMA COMPLIANT'
                : `REAL-TIME ZOD VALIDATION: ${cardValidation.error.issues.length} ISSUE${
                    cardValidation.error.issues.length > 1 ? 'S' : ''
                  } DETECTED`}
            </span>
          </div>

          {!cardValidation.success && (
            <button
              type="button"
              data-testid="toggle-validation-issues-btn"
              onClick={() => setShowValidationIssues(!showValidationIssues)}
              className="text-[10px] font-bold text-comic-red underline hover:text-red-700 cursor-pointer"
            >
              {showValidationIssues ? 'Hide Details' : 'Show Details'}
            </button>
          )}
        </div>

        {!cardValidation.success && showValidationIssues && (
          <ul
            data-testid="validation-issues-list"
            className="mt-1 pt-1.5 border-t border-red-200 text-[11px] font-mono space-y-0.5 list-disc list-inside"
          >
            {cardValidation.error.issues.map((issue, i) => (
              <li key={i}>
                <span className="font-bold">{issue.path.join('.') || 'card'}:</span>{' '}
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 1. Card-Level Attributes & Audit Section */}
      <CardAttributesSection
        supplemental={supplemental}
        onChange={onChange}
        onNoSupplementalNeededChange={handleNoSupplementalNeededChange}
        hasErrors={topLevelErrors.length > 0}
        errors={topLevelErrors}
      />

      {/* 2. Declarative Abilities List */}
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
                : 'bg-comic-accent hover:bg-sky-700 text-white font-bold cursor-pointer active:scale-95'
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
                need to define abilities, uncheck &quot;No Supplemental Rules Needed&quot; in the
                card attributes above.
              </span>
            </div>
          </div>
        )}

        {!supplemental.noSupplementalNeeded && abilities.length === 0 && (
          <div className="p-4 bg-white border-2 border-dashed border-gray-300 rounded text-center text-gray-500 italic">
            No abilities defined. Click &quot;Add Ability&quot; to attach rules logic.
          </div>
        )}

        {abilities.map((ability: any, aIdx: number) => {
          const isExpanded = expandedAbility === aIdx;
          const errors = abilityErrors[aIdx] || [];
          const isInvalid = errors.length > 0;

          return (
            <div
              key={aIdx}
              className={`bg-white border-2 ${
                isInvalid ? 'border-comic-red ring-2 ring-red-200' : 'border-black'
              } rounded shadow-comic-xs overflow-hidden transition-colors`}
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
                  {isInvalid && (
                    <span
                      data-testid={`ability-invalid-badge-${aIdx}`}
                      className="bg-comic-red text-white px-1.5 py-0.2 rounded text-[10px] font-bold"
                    >
                      ⚠️ INVALID
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
                  {isInvalid && (
                    <div
                      data-testid={`ability-errors-${aIdx}`}
                      className="p-2 bg-red-50 border border-comic-red rounded text-[11px] text-red-800 space-y-0.5"
                    >
                      <div className="font-bold">Ability Validation Issues:</div>
                      {errors.map((err, i) => (
                        <div key={i}>• {err}</div>
                      ))}
                    </div>
                  )}

                  {/* Ability ID & Timing Window */}
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
                      data-testid={`ability-trigger-select-${aIdx}`}
                      value={ability.trigger || ''}
                      onChange={(e) =>
                        handleUpdateAbility(aIdx, {
                          trigger: e.target.value || undefined,
                          triggerFilter: !e.target.value ? undefined : ability.triggerFilter,
                        })
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

                  {/* Trigger Filter Sub-Form */}
                  {ability.trigger && (
                    <TriggerFilterSection
                      filter={ability.triggerFilter}
                      abilityIndex={aIdx}
                      isExpanded={expandedTriggerFilter === aIdx}
                      onToggleExpand={() =>
                        setExpandedTriggerFilter(expandedTriggerFilter === aIdx ? null : aIdx)
                      }
                      onChange={(newFilter) =>
                        handleUpdateAbility(aIdx, { triggerFilter: newFilter })
                      }
                    />
                  )}

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

                  {/* Ability Cost Section */}
                  <AbilityCostSection
                    cost={ability.cost}
                    abilityIndex={aIdx}
                    onChange={(newCost) => handleUpdateAbility(aIdx, { cost: newCost })}
                  />

                  {/* Step Pipeline Editor */}
                  <StepPipelineEditor
                    steps={ability.steps || []}
                    abilityIndex={aIdx}
                    onChange={(newSteps) => handleUpdateAbility(aIdx, { steps: newSteps })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { CardAttributesSection, AbilityCostSection, TriggerFilterSection, StepPipelineEditor };
