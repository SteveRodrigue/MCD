import React from 'react';
import {
  TimingTypeSchema,
  TriggerTypeSchema,
  EffectTypeSchema,
  ConditionGateSchema,
  StepConditionSchema,
  KeywordSchema,
} from '../../../data/supplemental/schema';
import { UniversalCardFilterBuilder } from './UniversalCardFilterBuilder';
import { DynamicValueBuilder } from './DynamicValueBuilder';
import {
  Plus,
  Trash2,
  Shield,
  Zap,
  Sliders,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  Crosshair,
  Coins,
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
  const [expandedTriggerFilter, setExpandedTriggerFilter] = React.useState<number | null>(null);
  const [isControlFilterExpanded, setIsControlFilterExpanded] = React.useState(false);

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
      params: { count: 1 },
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

  const handleMoveStep = (abilityIndex: number, stepIndex: number, direction: 'up' | 'down') => {
    const ability = abilities[abilityIndex];
    const steps = Array.isArray(ability.steps) ? [...ability.steps] : [];
    const targetIndex = direction === 'up' ? stepIndex - 1 : stepIndex + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const temp = steps[stepIndex];
    steps[stepIndex] = steps[targetIndex];
    steps[targetIndex] = temp;

    handleUpdateAbility(abilityIndex, {
      steps,
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

          {/* Traits input */}
          <div className="sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Card Traits (comma-separated)
            </label>
            <input
              type="text"
              data-testid="card-traits-input"
              value={(supplemental.traits || []).join(', ')}
              placeholder="e.g. Avenger, Tech, Gamma"
              onChange={(e) => {
                const tr = e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean);
                onChange({
                  ...supplemental,
                  traits: tr.length > 0 ? tr : undefined,
                });
              }}
              className="w-full bg-white border border-black p-1.5 text-xs rounded"
            />
          </div>

          {/* Card Numeric Properties */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Restricted Slots (RR v1.8 p. 28)
            </label>
            <input
              type="number"
              min="1"
              data-testid="card-restricted-slots-input"
              value={supplemental.restrictedSlots || ''}
              placeholder="e.g. 1 or 2"
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onChange({
                  ...supplemental,
                  restrictedSlots: isNaN(val) ? undefined : val,
                });
              }}
              className="w-full bg-white border border-black p-1.5 text-xs rounded"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Additional Boost Cards
            </label>
            <input
              type="number"
              min="1"
              data-testid="card-additional-boost-cards-input"
              value={supplemental.additionalBoostCards || ''}
              placeholder="e.g. 1"
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onChange({
                  ...supplemental,
                  additionalBoostCards: isNaN(val) ? undefined : val,
                });
              }}
              className="w-full bg-white border border-black p-1.5 text-xs rounded"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Victory Points (RR v1.8 p. 30)
            </label>
            <input
              type="number"
              data-testid="card-victory-points-input"
              value={supplemental.victoryPoints || ''}
              placeholder="e.g. 1"
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onChange({
                  ...supplemental,
                  victoryPoints: isNaN(val) ? undefined : val,
                });
              }}
              className="w-full bg-white border border-black p-1.5 text-xs rounded"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
              Orientation
            </label>
            <label className="flex items-center gap-1.5 pt-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                data-testid="card-is-landscape-checkbox"
                checked={Boolean(supplemental.isLandscape)}
                onChange={(e) => {
                  onChange({
                    ...supplemental,
                    isLandscape: e.target.checked || undefined,
                  });
                }}
                className="accent-black"
              />
              <span>Landscape Orientation (e.g. Side Schemes)</span>
            </label>
          </div>

          {/* Uses Lifecycle (RR v1.8 p. 30, ADR-0057) */}
          <div className="sm:col-span-2 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-comic-accent" />
                <span>Uses Counters Lifecycle (RR v1.8 p. 30)</span>
              </span>
              <button
                type="button"
                data-testid="toggle-uses-btn"
                onClick={() => {
                  if (supplemental.uses) {
                    const { uses: _, ...rest } = supplemental;
                    onChange(rest);
                  } else {
                    onChange({
                      ...supplemental,
                      uses: { count: 3, type: 'charge', discardOnEmpty: true },
                    });
                  }
                }}
                className="text-[10px] font-bold text-comic-accent hover:underline cursor-pointer"
              >
                {supplemental.uses ? 'Remove Uses' : '+ Configure Uses'}
              </button>
            </div>

            {supplemental.uses && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-yellow-50/50 p-2.5 border border-black rounded shadow-comic-xs">
                <div>
                  <label className="block text-[9px] font-bold uppercase text-gray-600 mb-0.5">
                    Count
                  </label>
                  <input
                    type="number"
                    min="0"
                    data-testid="uses-count-input"
                    value={supplemental.uses.count ?? 0}
                    onChange={(e) => {
                      const count = parseInt(e.target.value, 10);
                      onChange({
                        ...supplemental,
                        uses: { ...supplemental.uses, count: isNaN(count) ? 0 : count },
                      });
                    }}
                    className="w-full bg-white border border-black p-1 text-xs rounded font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-gray-600 mb-0.5">
                    Counter Type
                  </label>
                  <input
                    type="text"
                    data-testid="uses-type-input"
                    value={supplemental.uses.type || supplemental.uses.counterType || ''}
                    placeholder="e.g. charge, all-purpose"
                    onChange={(e) => {
                      onChange({
                        ...supplemental,
                        uses: { ...supplemental.uses, type: e.target.value || undefined },
                      });
                    }}
                    className="w-full bg-white border border-black p-1 text-xs rounded"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold uppercase text-gray-600 mb-0.5">
                    Max Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    data-testid="uses-max-input"
                    value={supplemental.uses.max ?? ''}
                    placeholder="Optional"
                    onChange={(e) => {
                      const max = parseInt(e.target.value, 10);
                      onChange({
                        ...supplemental,
                        uses: { ...supplemental.uses, max: isNaN(max) ? undefined : max },
                      });
                    }}
                    className="w-full bg-white border border-black p-1 text-xs rounded text-center"
                  />
                </div>
                <div className="flex items-center pt-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-black">
                    <input
                      type="checkbox"
                      data-testid="uses-discard-on-empty-checkbox"
                      checked={Boolean(supplemental.uses.discardOnEmpty)}
                      onChange={(e) => {
                        onChange({
                          ...supplemental,
                          uses: {
                            ...supplemental.uses,
                            discardOnEmpty: e.target.checked || undefined,
                          },
                        });
                      }}
                      className="accent-black"
                    />
                    <span>Discard When Empty</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Structured Keywords Matrix (ADR-0054) */}
          <div className="sm:col-span-2 pt-2 border-t border-gray-200">
            <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-comic-yellow fill-comic-yellow" />
              <span>Structured Keywords Matrix (ADR-0054)</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {KeywordSchema.options.map((kw) => {
                const list = Array.isArray(supplemental.keywords) ? supplemental.keywords : [];
                const entry = list.find((k: any) =>
                  typeof k === 'string'
                    ? k.toLowerCase() === kw.toLowerCase()
                    : k.keyword?.toLowerCase() === kw.toLowerCase(),
                );
                const isActive = Boolean(entry);
                const retaliateAmount =
                  kw === 'Retaliate' && typeof entry === 'object' && entry !== null
                    ? entry.amount || 1
                    : 1;

                const toggleKeyword = () => {
                  const updated = [...list];
                  const idx = updated.findIndex((k: any) =>
                    typeof k === 'string'
                      ? k.toLowerCase() === kw.toLowerCase()
                      : k.keyword?.toLowerCase() === kw.toLowerCase(),
                  );
                  if (idx >= 0) {
                    updated.splice(idx, 1);
                  } else {
                    if (kw === 'Retaliate') {
                      updated.push({ keyword: 'Retaliate', amount: 1 });
                    } else {
                      updated.push(kw);
                    }
                  }
                  onChange({
                    ...supplemental,
                    keywords: updated.length > 0 ? updated : undefined,
                  });
                };

                return (
                  <div key={kw} className="flex items-center gap-1">
                    <button
                      type="button"
                      data-testid={`keyword-${kw.toLowerCase()}`}
                      onClick={toggleKeyword}
                      className={`rounded border border-black px-2 py-0.5 text-[11px] font-bold transition-transform active:scale-95 ${
                        isActive
                          ? 'bg-comic-accent text-white shadow-comic-xs'
                          : 'bg-white text-gray-700 hover:bg-yellow-50'
                      }`}
                    >
                      {kw}
                    </button>
                    {kw === 'Retaliate' && isActive && (
                      <input
                        type="number"
                        min="1"
                        max="10"
                        data-testid="keyword-retaliate-amount"
                        value={retaliateAmount}
                        onChange={(e) => {
                          const amt = parseInt(e.target.value, 10);
                          const updated = [...list];
                          const idx = updated.findIndex((k: any) =>
                            typeof k === 'string'
                              ? k.toLowerCase() === 'retaliate'
                              : k.keyword?.toLowerCase() === 'retaliate',
                          );
                          const val = isNaN(amt) ? 1 : Math.max(1, amt);
                          if (idx >= 0) {
                            updated[idx] = { keyword: 'Retaliate', amount: val };
                          } else {
                            updated.push({ keyword: 'Retaliate', amount: val });
                          }
                          onChange({
                            ...supplemental,
                            keywords: updated,
                          });
                        }}
                        className="w-10 bg-white border border-black px-1 py-0.5 text-xs text-center font-bold rounded"
                      />
                    )}
                  </div>
                );
              })}
            </div>
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

        {/* Play Requirements Section (RR v1.8 p. 16) */}
        <div className="mt-4 pt-3 border-t-2 border-dashed border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bangers tracking-wide text-gray-800 flex items-center gap-1.5">
              <span>PLAY REQUIREMENTS (RR v1.8 p. 16)</span>
            </span>
            <span className="text-[10px] text-gray-500">Form, Trait & Control gates</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-2.5 rounded border border-gray-300">
            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                Required Identity Form
              </label>
              <select
                data-testid="play-req-identity-form-select"
                value={supplemental.playRequirements?.identityForm || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const current = supplemental.playRequirements || {};
                  if (!val) {
                    const { identityForm: _, ...rest } = current;
                    onChange({
                      ...supplemental,
                      playRequirements: Object.keys(rest).length > 0 ? rest : undefined,
                    });
                  } else {
                    onChange({
                      ...supplemental,
                      playRequirements: {
                        ...current,
                        identityForm: val,
                      },
                    });
                  }
                }}
                className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
              >
                <option value="">Any / Unrestricted</option>
                <option value="HERO">Hero Form Only (e.g. Webbed Up)</option>
                <option value="ALTER_EGO">Alter-Ego Form Only</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                Form Trait Requirement
              </label>
              <input
                type="text"
                data-testid="play-req-form-trait-input"
                value={supplemental.playRequirements?.formTrait || ''}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  const current = supplemental.playRequirements || {};
                  if (!val) {
                    const { formTrait: _, ...rest } = current;
                    onChange({
                      ...supplemental,
                      playRequirements: Object.keys(rest).length > 0 ? rest : undefined,
                    });
                  } else {
                    onChange({
                      ...supplemental,
                      playRequirements: {
                        ...current,
                        formTrait: val,
                      },
                    });
                  }
                }}
                placeholder="e.g. Giant, Tiny"
                className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                Required Identity Traits (comma separated)
              </label>
              <input
                type="text"
                data-testid="play-req-identity-traits-input"
                value={(supplemental.playRequirements?.identityTraits || []).join(', ')}
                onChange={(e) => {
                  const traits = e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean);
                  const current = supplemental.playRequirements || {};
                  if (traits.length === 0) {
                    const { identityTraits: _, ...rest } = current;
                    onChange({
                      ...supplemental,
                      playRequirements: Object.keys(rest).length > 0 ? rest : undefined,
                    });
                  } else {
                    onChange({
                      ...supplemental,
                      playRequirements: {
                        ...current,
                        identityTraits: traits,
                      },
                    });
                  }
                }}
                placeholder="e.g. Avenger, Mystic, X-Men"
                className="w-full bg-white border border-black p-1.5 text-xs rounded focus:ring-1 focus:ring-black"
              />
            </div>

            {/* Controlled Card Requirement: UniversalCardFilterBuilder Integration */}
            <div className="sm:col-span-2">
              <div
                data-testid="play-req-control-filter-accordion"
                className="rounded border border-black bg-white p-2 space-y-2"
              >
                <div
                  onClick={() => setIsControlFilterExpanded(!isControlFilterExpanded)}
                  data-testid="toggle-play-req-control-filter-btn"
                  className="flex items-center justify-between cursor-pointer select-none hover:bg-yellow-50 p-1 rounded"
                >
                  <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center gap-1">
                    {isControlFilterExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                    )}
                    <span>Required Controlled Card Criteria (controlFilter)</span>
                  </span>
                  <span className="bg-comic-yellow border border-black px-1.5 py-0.2 rounded text-[9px] font-bold text-black">
                    {supplemental.playRequirements?.controlFilter
                      ? 'Configured'
                      : 'None configured'}
                  </span>
                </div>

                {isControlFilterExpanded && (
                  <div className="pt-2 border-t border-gray-200">
                    <UniversalCardFilterBuilder
                      filter={supplemental.playRequirements?.controlFilter}
                      onChange={(newFilter) => {
                        const current = supplemental.playRequirements || {};
                        if (!newFilter) {
                          const { controlFilter: _, ...rest } = current;
                          onChange({
                            ...supplemental,
                            playRequirements: Object.keys(rest).length > 0 ? rest : undefined,
                          });
                        } else {
                          onChange({
                            ...supplemental,
                            playRequirements: {
                              ...current,
                              controlFilter: newFilter,
                            },
                          });
                        }
                      }}
                      isSubBranch={true}
                    />
                  </div>
                )}
              </div>
            </div>
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

                  {/* Trigger Filter Sub-Form (rendered when an event trigger is chosen) */}
                  {ability.trigger && (
                    <div className="bg-yellow-50/60 border border-black rounded p-2.5 space-y-2">
                      <div
                        onClick={() =>
                          setExpandedTriggerFilter(expandedTriggerFilter === aIdx ? null : aIdx)
                        }
                        className="flex items-center justify-between cursor-pointer select-none"
                      >
                        <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center gap-1">
                          <Crosshair className="w-3.5 h-3.5 text-comic-red" />
                          <span>Trigger Filter & Event Scope</span>
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-600">
                          <span>{expandedTriggerFilter === aIdx ? 'Collapse' : 'Configure'}</span>
                          {expandedTriggerFilter === aIdx ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </div>

                      {expandedTriggerFilter === aIdx && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-gray-300">
                          {/* attackerKind */}
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-gray-600 mb-0.5">
                              Attacker Kind
                            </label>
                            <select
                              data-testid={`trigger-attacker-kind-${aIdx}`}
                              value={ability.triggerFilter?.attackerKind || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const current = ability.triggerFilter || {};
                                const updated = { ...current, attackerKind: val || undefined };
                                if (!val) delete updated.attackerKind;
                                handleUpdateAbility(aIdx, {
                                  triggerFilter:
                                    Object.keys(updated).length > 0 ? updated : undefined,
                                });
                              }}
                              className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
                            >
                              <option value="">Any</option>
                              <option value="VILLAIN">Villain</option>
                              <option value="MINION">Minion</option>
                              <option value="ANY_ENEMY">Any Enemy</option>
                            </select>
                          </div>

                          {/* targetPlayerScope */}
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-gray-600 mb-0.5">
                              Target Player Scope
                            </label>
                            <select
                              data-testid={`trigger-target-player-scope-${aIdx}`}
                              value={ability.triggerFilter?.targetPlayerScope || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const current = ability.triggerFilter || {};
                                const updated = { ...current, targetPlayerScope: val || undefined };
                                if (!val) delete updated.targetPlayerScope;
                                handleUpdateAbility(aIdx, {
                                  triggerFilter:
                                    Object.keys(updated).length > 0 ? updated : undefined,
                                });
                              }}
                              className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
                            >
                              <option value="">Any</option>
                              <option value="SELF">Self (You)</option>
                              <option value="OTHER">Other Player</option>
                              <option value="ANY">Any Player</option>
                            </select>
                          </div>

                          {/* targetForm */}
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-gray-600 mb-0.5">
                              Target Form
                            </label>
                            <select
                              data-testid={`trigger-target-form-${aIdx}`}
                              value={ability.triggerFilter?.targetForm || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const current = ability.triggerFilter || {};
                                const updated = { ...current, targetForm: val || undefined };
                                if (!val) delete updated.targetForm;
                                handleUpdateAbility(aIdx, {
                                  triggerFilter:
                                    Object.keys(updated).length > 0 ? updated : undefined,
                                });
                              }}
                              className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
                            >
                              <option value="">Any</option>
                              <option value="HERO">Hero Form</option>
                              <option value="ALTER_EGO">Alter-Ego Form</option>
                            </select>
                          </div>

                          {/* damageSourceType */}
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-gray-600 mb-0.5">
                              Damage Source
                            </label>
                            <select
                              data-testid={`trigger-damage-source-type-${aIdx}`}
                              value={ability.triggerFilter?.damageSourceType || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const current = ability.triggerFilter || {};
                                const updated = { ...current, damageSourceType: val || undefined };
                                if (!val) delete updated.damageSourceType;
                                handleUpdateAbility(aIdx, {
                                  triggerFilter:
                                    Object.keys(updated).length > 0 ? updated : undefined,
                                });
                              }}
                              className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
                            >
                              <option value="">Any</option>
                              <option value="ATTACK">Attack Damage</option>
                              <option value="SCHEME">Scheme</option>
                              <option value="EFFECT">Card Effect</option>
                            </select>
                          </div>

                          {/* defeatEntityType */}
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-gray-600 mb-0.5">
                              Defeat Entity
                            </label>
                            <select
                              data-testid={`trigger-defeat-entity-type-${aIdx}`}
                              value={ability.triggerFilter?.defeatEntityType || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const current = ability.triggerFilter || {};
                                const updated = { ...current, defeatEntityType: val || undefined };
                                if (!val) delete updated.defeatEntityType;
                                handleUpdateAbility(aIdx, {
                                  triggerFilter:
                                    Object.keys(updated).length > 0 ? updated : undefined,
                                });
                              }}
                              className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
                            >
                              <option value="">Any</option>
                              <option value="CHARACTER">Character (Hero/Ally/Enemy)</option>
                              <option value="SCHEME">Scheme</option>
                              <option value="ATTACHMENT">Attachment</option>
                            </select>
                          </div>

                          {/* formChangeDirection */}
                          <div>
                            <label className="block text-[9px] uppercase font-bold text-gray-600 mb-0.5">
                              Form Change Direction
                            </label>
                            <select
                              data-testid={`trigger-form-change-direction-${aIdx}`}
                              value={ability.triggerFilter?.formChangeDirection || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const current = ability.triggerFilter || {};
                                const updated = {
                                  ...current,
                                  formChangeDirection: val || undefined,
                                };
                                if (!val) delete updated.formChangeDirection;
                                handleUpdateAbility(aIdx, {
                                  triggerFilter:
                                    Object.keys(updated).length > 0 ? updated : undefined,
                                });
                              }}
                              className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
                            >
                              <option value="">Any</option>
                              <option value="ALTER_EGO_TO_HERO">Alter-Ego to Hero</option>
                              <option value="HERO_TO_ALTER_EGO">Hero to Alter-Ego</option>
                            </select>
                          </div>

                          {/* Checkboxes: isEngaged & defeatByAttack */}
                          <div className="flex items-center gap-4 col-span-1 sm:col-span-2 pt-2">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-800">
                              <input
                                type="checkbox"
                                data-testid={`trigger-is-engaged-${aIdx}`}
                                checked={Boolean(ability.triggerFilter?.isEngaged)}
                                onChange={(e) => {
                                  const current = ability.triggerFilter || {};
                                  const updated = {
                                    ...current,
                                    isEngaged: e.target.checked || undefined,
                                  };
                                  if (!e.target.checked) delete updated.isEngaged;
                                  handleUpdateAbility(aIdx, {
                                    triggerFilter:
                                      Object.keys(updated).length > 0 ? updated : undefined,
                                  });
                                }}
                                className="accent-black"
                              />
                              <span>Enemy Engaged With You</span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-800">
                              <input
                                type="checkbox"
                                data-testid={`trigger-defeat-by-attack-${aIdx}`}
                                checked={Boolean(ability.triggerFilter?.defeatByAttack)}
                                onChange={(e) => {
                                  const current = ability.triggerFilter || {};
                                  const updated = {
                                    ...current,
                                    defeatByAttack: e.target.checked || undefined,
                                  };
                                  if (!e.target.checked) delete updated.defeatByAttack;
                                  handleUpdateAbility(aIdx, {
                                    triggerFilter:
                                      Object.keys(updated).length > 0 ? updated : undefined,
                                  });
                                }}
                                className="accent-black"
                              />
                              <span>Defeated by Attack</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
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

                  {/* Cost Specification */}
                  <div className="bg-gray-50 border border-gray-300 p-2.5 rounded space-y-3">
                    <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-comic-red" />
                      <span>Ability Costs (RR v1.8 p. 11 &apos;Cost&apos;)</span>
                    </span>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          data-testid={`cost-exhaust-self-${aIdx}`}
                          checked={Boolean(cost.exhaustSelf || (cost as any).exhaust)}
                          onChange={(e) => {
                            const nextCost = {
                              ...cost,
                              exhaustSelf: e.target.checked || undefined,
                            };
                            delete (nextCost as any).exhaust;
                            if (!e.target.checked) delete nextCost.exhaustSelf;
                            handleUpdateAbility(aIdx, {
                              cost: Object.keys(nextCost).length > 0 ? nextCost : undefined,
                            });
                          }}
                          className="accent-black"
                        />
                        <span className="font-bold">Exhaust Host Card</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          data-testid={`cost-discard-self-${aIdx}`}
                          checked={Boolean(cost.discardSelf)}
                          onChange={(e) => {
                            const nextCost = {
                              ...cost,
                              discardSelf: e.target.checked || undefined,
                            };
                            if (!e.target.checked) delete nextCost.discardSelf;
                            handleUpdateAbility(aIdx, {
                              cost: Object.keys(nextCost).length > 0 ? nextCost : undefined,
                            });
                          }}
                          className="accent-black"
                        />
                        <span className="font-bold">Discard Host Card</span>
                      </label>

                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 font-bold">Self DMG:</span>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          data-testid={`cost-damage-self-${aIdx}`}
                          value={cost.damageSelf !== undefined ? cost.damageSelf : ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                            const nextCost = {
                              ...cost,
                              damageSelf: isNaN(val as number) ? undefined : val,
                            };
                            if (val === undefined || isNaN(val as number))
                              delete nextCost.damageSelf;
                            handleUpdateAbility(aIdx, {
                              cost: Object.keys(nextCost).length > 0 ? nextCost : undefined,
                            });
                          }}
                          placeholder="0"
                          className="w-12 bg-white border border-black px-1 py-0.5 text-center text-xs rounded font-bold"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-gray-600 font-bold">Hero DMG:</span>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          data-testid={`cost-damage-hero-${aIdx}`}
                          value={cost.damageHero !== undefined ? cost.damageHero : ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                            const nextCost = {
                              ...cost,
                              damageHero: isNaN(val as number) ? undefined : val,
                            };
                            if (val === undefined || isNaN(val as number))
                              delete nextCost.damageHero;
                            handleUpdateAbility(aIdx, {
                              cost: Object.keys(nextCost).length > 0 ? nextCost : undefined,
                            });
                          }}
                          placeholder="0"
                          className="w-12 bg-white border border-black px-1 py-0.5 text-center text-xs rounded font-bold"
                        />
                      </div>
                    </div>

                    {/* Resource Cost Matrix */}
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] uppercase font-bold text-gray-600 flex items-center gap-1">
                          <Coins className="w-3 h-3 text-amber-600" />
                          <span>Resource Costs ({cost.resources?.length || 0})</span>
                        </span>
                        {cost.resources && cost.resources.length > 0 && (
                          <button
                            type="button"
                            data-testid={`cost-clear-resources-${aIdx}`}
                            onClick={() => {
                              const nextCost = { ...cost };
                              delete nextCost.resources;
                              handleUpdateAbility(aIdx, {
                                cost: Object.keys(nextCost).length > 0 ? nextCost : undefined,
                              });
                            }}
                            className="text-[9px] text-comic-red font-bold hover:underline cursor-pointer"
                          >
                            Clear Resources
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {(['physical', 'energy', 'mental', 'wild'] as const).map((res) => {
                          const count = (cost.resources || []).filter(
                            (r: string) => r === res,
                          ).length;
                          return (
                            <div
                              key={res}
                              className="flex items-center gap-1 bg-white border border-black px-1.5 py-0.5 rounded text-xs shadow-comic-xs"
                            >
                              <span className="capitalize font-bold text-[11px]">{res}:</span>
                              <span
                                data-testid={`cost-res-count-${res}-${aIdx}`}
                                className="font-mono font-bold w-4 text-center"
                              >
                                {count}
                              </span>
                              <button
                                type="button"
                                data-testid={`cost-res-plus-${res}-${aIdx}`}
                                onClick={() => {
                                  const cur = cost.resources || [];
                                  handleUpdateAbility(aIdx, {
                                    cost: { ...cost, resources: [...cur, res] },
                                  });
                                }}
                                className="w-4 h-4 bg-gray-200 hover:bg-gray-300 font-bold flex items-center justify-center rounded text-xs border border-gray-400 cursor-pointer"
                                title={`Add ${res} resource`}
                              >
                                +
                              </button>
                              {count > 0 && (
                                <button
                                  type="button"
                                  data-testid={`cost-res-minus-${res}-${aIdx}`}
                                  onClick={() => {
                                    const cur = [...(cost.resources || [])];
                                    const idx = cur.lastIndexOf(res);
                                    if (idx >= 0) cur.splice(idx, 1);
                                    const nextCost = {
                                      ...cost,
                                      resources: cur.length > 0 ? cur : undefined,
                                    };
                                    if (cur.length === 0) delete nextCost.resources;
                                    handleUpdateAbility(aIdx, {
                                      cost: Object.keys(nextCost).length > 0 ? nextCost : undefined,
                                    });
                                  }}
                                  className="w-4 h-4 bg-gray-200 hover:bg-gray-300 font-bold flex items-center justify-center rounded text-xs border border-gray-400 cursor-pointer"
                                  title={`Remove ${res} resource`}
                                >
                                  -
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Spend Counters & Discard Card sub-costs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                      {/* Spend Counters Sub-form */}
                      <div className="bg-white p-2 border border-black rounded shadow-comic-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] uppercase font-bold text-gray-700">
                            Spend Counters Cost
                          </span>
                          <button
                            type="button"
                            data-testid={`cost-spend-counters-toggle-${aIdx}`}
                            onClick={() => {
                              if (cost.spendCounters) {
                                const nextCost = { ...cost };
                                delete nextCost.spendCounters;
                                handleUpdateAbility(aIdx, {
                                  cost: Object.keys(nextCost).length > 0 ? nextCost : undefined,
                                });
                              } else {
                                handleUpdateAbility(aIdx, {
                                  cost: {
                                    ...cost,
                                    spendCounters: {
                                      amount: 1,
                                      counterType: 'charge',
                                      target: 'SELF',
                                    },
                                  },
                                });
                              }
                            }}
                            className="text-[10px] font-bold text-comic-accent hover:underline cursor-pointer"
                          >
                            {cost.spendCounters ? 'Remove' : '+ Add'}
                          </button>
                        </div>
                        {cost.spendCounters && (
                          <div className="grid grid-cols-3 gap-1.5">
                            <div>
                              <label className="block text-[8px] uppercase font-bold text-gray-500">
                                Amount
                              </label>
                              <input
                                type="number"
                                min="1"
                                data-testid={`cost-spend-counters-amount-${aIdx}`}
                                value={cost.spendCounters.amount ?? 1}
                                onChange={(e) => {
                                  const amt = parseInt(e.target.value, 10);
                                  handleUpdateAbility(aIdx, {
                                    cost: {
                                      ...cost,
                                      spendCounters: {
                                        ...cost.spendCounters,
                                        amount: isNaN(amt) ? 1 : amt,
                                      },
                                    },
                                  });
                                }}
                                className="w-full bg-white border border-black p-1 text-xs rounded text-center font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] uppercase font-bold text-gray-500">
                                Type
                              </label>
                              <input
                                type="text"
                                data-testid={`cost-spend-counters-type-${aIdx}`}
                                value={cost.spendCounters.counterType || ''}
                                placeholder="e.g. charge"
                                onChange={(e) => {
                                  handleUpdateAbility(aIdx, {
                                    cost: {
                                      ...cost,
                                      spendCounters: {
                                        ...cost.spendCounters,
                                        counterType: e.target.value || undefined,
                                      },
                                    },
                                  });
                                }}
                                className="w-full bg-white border border-black p-1 text-xs rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] uppercase font-bold text-gray-500">
                                Target
                              </label>
                              <select
                                data-testid={`cost-spend-counters-target-${aIdx}`}
                                value={cost.spendCounters.target || 'SELF'}
                                onChange={(e) => {
                                  handleUpdateAbility(aIdx, {
                                    cost: {
                                      ...cost,
                                      spendCounters: {
                                        ...cost.spendCounters,
                                        target: e.target.value as 'SELF' | 'IDENTITY',
                                      },
                                    },
                                  });
                                }}
                                className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
                              >
                                <option value="SELF">SELF</option>
                                <option value="IDENTITY">IDENTITY</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Discard Card Sub-form */}
                      <div className="bg-white p-2 border border-black rounded shadow-comic-xs">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[9px] uppercase font-bold text-gray-700">
                            Discard Card Cost
                          </span>
                          <button
                            type="button"
                            data-testid={`cost-discard-card-toggle-${aIdx}`}
                            onClick={() => {
                              if (cost.discardCard) {
                                const nextCost = { ...cost };
                                delete nextCost.discardCard;
                                handleUpdateAbility(aIdx, {
                                  cost: Object.keys(nextCost).length > 0 ? nextCost : undefined,
                                });
                              } else {
                                handleUpdateAbility(aIdx, {
                                  cost: {
                                    ...cost,
                                    discardCard: { count: 1, from: 'HAND' },
                                  },
                                });
                              }
                            }}
                            className="text-[10px] font-bold text-comic-accent hover:underline cursor-pointer"
                          >
                            {cost.discardCard ? 'Remove' : '+ Add'}
                          </button>
                        </div>
                        {cost.discardCard && (
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <label className="block text-[8px] uppercase font-bold text-gray-500">
                                Count
                              </label>
                              <input
                                type="number"
                                min="1"
                                data-testid={`cost-discard-card-count-${aIdx}`}
                                value={cost.discardCard.count ?? 1}
                                onChange={(e) => {
                                  const c = parseInt(e.target.value, 10);
                                  handleUpdateAbility(aIdx, {
                                    cost: {
                                      ...cost,
                                      discardCard: {
                                        ...cost.discardCard,
                                        count: isNaN(c) ? 1 : c,
                                      },
                                    },
                                  });
                                }}
                                className="w-full bg-white border border-black p-1 text-xs rounded text-center font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[8px] uppercase font-bold text-gray-500">
                                From Zone
                              </label>
                              <select
                                data-testid={`cost-discard-card-from-${aIdx}`}
                                value={cost.discardCard.from || 'HAND'}
                                onChange={(e) => {
                                  handleUpdateAbility(aIdx, {
                                    cost: {
                                      ...cost,
                                      discardCard: {
                                        ...cost.discardCard,
                                        from: e.target.value as 'HAND' | 'DECK' | 'PLAY',
                                      },
                                    },
                                  });
                                }}
                                className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
                              >
                                <option value="HAND">HAND</option>
                                <option value="DECK">DECK</option>
                                <option value="PLAY">PLAY</option>
                              </select>
                            </div>
                          </div>
                        )}
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
                        data-testid={`add-step-btn-${aIdx}`}
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
                            data-testid={`step-item-${aIdx}-${sIdx}`}
                            className="bg-comic-paper border-2 border-black p-2.5 rounded shadow-comic-xs flex flex-col gap-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] font-bold bg-gray-300 px-1.5 py-0.5 rounded border border-gray-400">
                                  Step #{sIdx + 1}
                                </span>
                                {/* Reordering buttons */}
                                <button
                                  type="button"
                                  data-testid={`step-move-up-${aIdx}-${sIdx}`}
                                  disabled={sIdx === 0}
                                  onClick={() => handleMoveStep(aIdx, sIdx, 'up')}
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
                                  data-testid={`step-move-down-${aIdx}-${sIdx}`}
                                  disabled={sIdx === steps.length - 1}
                                  onClick={() => handleMoveStep(aIdx, sIdx, 'down')}
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
                                data-testid={`step-remove-${aIdx}-${sIdx}`}
                                onClick={() => handleRemoveStep(aIdx, sIdx)}
                                className="text-gray-400 hover:text-comic-red cursor-pointer p-0.5 rounded hover:bg-red-50 transition-colors"
                                title="Remove step"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Conditional Gate & Step Condition */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {/* Conditional Gate */}
                              <div>
                                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">
                                  Conditional Gate (Timing / Flow)
                                </label>
                                <select
                                  data-testid={`step-gate-${aIdx}-${sIdx}`}
                                  value={step.gate || ''}
                                  onChange={(e) =>
                                    handleUpdateStep(aIdx, sIdx, {
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
                                  data-testid={`step-condition-${aIdx}-${sIdx}`}
                                  value={step.condition || ''}
                                  onChange={(e) =>
                                    handleUpdateStep(aIdx, sIdx, {
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
                                data-testid={`step-effect-select-${aIdx}-${sIdx}`}
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
                                            handleUpdateStep(aIdx, sIdx, {
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
                                            handleUpdateStep(aIdx, sIdx, {
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
                                          data-testid={`step-param-${param.key}-${aIdx}-${sIdx}`}
                                          checked={Boolean(val)}
                                          onChange={(e) =>
                                            handleUpdateStep(aIdx, sIdx, {
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
                                          data-testid={`step-param-${param.key}-${aIdx}-${sIdx}`}
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
                                          data-testid={`step-param-${param.key}-${aIdx}-${sIdx}`}
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
                                        data-testid={`step-param-${param.key}-${aIdx}-${sIdx}`}
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
