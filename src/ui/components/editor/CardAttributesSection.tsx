import React from 'react';
import { KeywordSchema } from '../../../data/supplemental/schema';
import { UniversalCardFilterBuilder } from './UniversalCardFilterBuilder';
import { Sliders, Layers, Sparkles, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

export interface CardAttributesSectionProps {
  supplemental: any;
  onChange: (updatedSupplemental: any) => void;
  onNoSupplementalNeededChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hasErrors?: boolean;
  errors?: string[];
}

export const CardAttributesSection: React.FC<CardAttributesSectionProps> = ({
  supplemental,
  onChange,
  onNoSupplementalNeededChange,
  hasErrors = false,
  errors = [],
}) => {
  const [isControlFilterExpanded, setIsControlFilterExpanded] = React.useState(false);

  const audit = supplemental.audit || {};

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...supplemental,
      audit: {
        ...supplemental.audit,
        comment: e.target.value || undefined,
      },
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

  const handleFallbackNoSupplementalNeededChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const abilities = Array.isArray(supplemental.abilities) ? supplemental.abilities : [];
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
    <div
      data-testid="card-attributes-section"
      className={`bg-white border-2 ${
        hasErrors ? 'border-comic-red ring-2 ring-red-200' : 'border-black'
      } p-3 rounded shadow-comic-xs transition-colors`}
    >
      <div className="flex items-center justify-between border-b pb-1 mb-2 text-black">
        <div className="flex items-center gap-1.5 font-bangers text-sm">
          <Sliders className="w-4 h-4 text-comic-accent" />
          <span>CARD-LEVEL ATTRIBUTES & AUDIT</span>
        </div>
        {hasErrors && (
          <div className="flex items-center gap-1 text-[11px] font-bold text-comic-red bg-red-50 border border-comic-red px-1.5 py-0.5 rounded">
            <AlertCircle className="w-3.5 h-3.5 text-comic-red" />
            <span>Attributes Issue</span>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div
          data-testid="card-attributes-errors"
          className="mb-2 p-2 bg-red-50 border border-comic-red rounded text-[11px] text-red-800 space-y-0.5"
        >
          {errors.map((err, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="font-bold">•</span>
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
            Internal Developer Comment
          </label>
          <input
            type="text"
            value={supplemental.audit?.comment || ''}
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
          <label className="text-[10px] font-bold uppercase text-gray-700 mb-1.5 flex items-center gap-1">
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
                        ? 'bg-comic-accent text-white shadow-comic-xs font-bold'
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
              onChange={onNoSupplementalNeededChange || handleFallbackNoSupplementalNeededChange}
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
                  {supplemental.playRequirements?.controlFilter ? 'Configured' : 'None configured'}
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
  );
};
