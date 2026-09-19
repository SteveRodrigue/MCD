import React from 'react';
import { Shield, Coins, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { TargetSelectorSchema } from '../../../data/supplemental/schema';
import { UniversalCardFilterBuilder } from './UniversalCardFilterBuilder';

export interface AbilityCostSectionProps {
  cost?: any;
  abilityIndex?: number;
  onChange: (updatedCost: any | undefined) => void;
  hasErrors?: boolean;
  errors?: string[];
}

export const AbilityCostSection: React.FC<AbilityCostSectionProps> = ({
  cost = {},
  abilityIndex = 0,
  onChange,
  hasErrors = false,
  errors = [],
}) => {
  const [isDiscardFilterExpanded, setIsDiscardFilterExpanded] = React.useState(false);
  const currentCost = cost || {};

  const handleCostUpdate = (nextCostFields: Record<string, any>) => {
    const updated = { ...currentCost, ...nextCostFields };
    // Clean undefined keys
    for (const key of Object.keys(updated)) {
      if (updated[key] === undefined) {
        delete updated[key];
      }
    }
    onChange(Object.keys(updated).length > 0 ? updated : undefined);
  };

  const getResourceCount = (res: 'physical' | 'energy' | 'mental' | 'wild') => {
    const arrayCount = (currentCost.resources || []).filter((r: string) => r === res).length;
    const mapCount =
      typeof currentCost.resourceCost === 'object' && currentCost.resourceCost !== null
        ? currentCost.resourceCost[res] || 0
        : 0;
    return arrayCount + mapCount;
  };

  const totalResourceCount =
    (currentCost.resources?.length || 0) +
    (typeof currentCost.resourceCost === 'object' && currentCost.resourceCost !== null
      ? Object.values(currentCost.resourceCost as Record<string, number>).reduce(
          (sum: number, c) => sum + (typeof c === 'number' ? c : 0),
          0,
        )
      : typeof currentCost.resourceCost === 'number'
        ? currentCost.resourceCost
        : 0);

  const hasAnyResources =
    (currentCost.resources && currentCost.resources.length > 0) ||
    currentCost.resourceCost !== undefined;

  const handleRemoveResource = (res: 'physical' | 'energy' | 'mental' | 'wild') => {
    const cur = [...(currentCost.resources || [])];
    const idx = cur.lastIndexOf(res);
    if (idx >= 0) {
      cur.splice(idx, 1);
      handleCostUpdate({
        resources: cur.length > 0 ? cur : undefined,
      });
    } else if (
      typeof currentCost.resourceCost === 'object' &&
      currentCost.resourceCost !== null &&
      currentCost.resourceCost[res]
    ) {
      const nextMap = { ...currentCost.resourceCost };
      nextMap[res] -= 1;
      if (nextMap[res] <= 0) {
        delete nextMap[res];
      }
      handleCostUpdate({
        resourceCost: Object.keys(nextMap).length > 0 ? nextMap : undefined,
      });
    }
  };

  return (
    <div
      data-testid={`ability-cost-section-${abilityIndex}`}
      className={`bg-gray-50 border ${
        hasErrors ? 'border-comic-red ring-2 ring-red-200' : 'border-gray-300'
      } p-2.5 rounded space-y-3 transition-colors`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-comic-red" />
          <span>Ability Costs (RR v1.8 p. 11 &apos;Cost&apos;)</span>
        </span>
        {hasErrors && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-comic-red">
            <AlertCircle className="w-3 h-3 text-comic-red" />
            <span>Cost Validation Error</span>
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div className="p-1.5 bg-red-50 border border-comic-red rounded text-[10px] text-red-800 space-y-0.5">
          {errors.map((err, i) => (
            <div key={i}>• {err}</div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            data-testid={`cost-exhaust-self-${abilityIndex}`}
            checked={Boolean(cost && cost.exhaustSelf)}
            onChange={(e) => {
              handleCostUpdate({
                exhaustSelf: e.target.checked || undefined,
              });
            }}
            className="accent-black"
          />
          <span className="font-bold">Exhaust Host Card</span>
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            data-testid={`cost-discard-self-${abilityIndex}`}
            checked={Boolean(currentCost.discardSelf)}
            onChange={(e) => {
              handleCostUpdate({
                discardSelf: e.target.checked || undefined,
              });
            }}
            className="accent-black"
          />
          <span className="font-bold">Discard Host Card</span>
        </label>

        <div className="flex items-center gap-1">
          <span className="text-gray-600 font-bold">Exhaust Card:</span>
          <select
            data-testid={`cost-exhaust-card-${abilityIndex}`}
            value={currentCost.exhaustCard || ''}
            onChange={(e) => {
              handleCostUpdate({
                exhaustCard: e.target.value || undefined,
              });
            }}
            className="bg-white border border-black px-1 py-0.5 text-xs rounded font-bold"
          >
            <option value="">(None)</option>
            {TargetSelectorSchema.options.map((tgt) => (
              <option key={tgt} value={tgt}>
                {tgt}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-gray-600 font-bold">Self DMG:</span>
          <input
            type="number"
            min="0"
            max="20"
            data-testid={`cost-damage-self-${abilityIndex}`}
            value={currentCost.damageSelf !== undefined ? currentCost.damageSelf : ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
              handleCostUpdate({
                damageSelf: isNaN(val as number) ? undefined : val,
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
            data-testid={`cost-damage-hero-${abilityIndex}`}
            value={currentCost.damageHero !== undefined ? currentCost.damageHero : ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
              handleCostUpdate({
                damageHero: isNaN(val as number) ? undefined : val,
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
            <span>Resource Costs ({totalResourceCount})</span>
          </span>
          {hasAnyResources && (
            <button
              type="button"
              data-testid={`cost-clear-resources-${abilityIndex}`}
              onClick={() => {
                handleCostUpdate({ resources: undefined, resourceCost: undefined });
              }}
              className="text-[9px] text-comic-red font-bold hover:underline cursor-pointer"
            >
              Clear Resources
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['physical', 'energy', 'mental', 'wild'] as const).map((res) => {
            const count = getResourceCount(res);
            return (
              <div
                key={res}
                className="flex items-center gap-1 bg-white border border-black px-1.5 py-0.5 rounded text-xs shadow-comic-xs"
              >
                <span className="capitalize font-bold text-[11px]">{res}:</span>
                <span
                  data-testid={`cost-res-count-${res}-${abilityIndex}`}
                  className="font-mono font-bold w-4 text-center"
                >
                  {count}
                </span>
                <button
                  type="button"
                  data-testid={`cost-res-plus-${res}-${abilityIndex}`}
                  onClick={() => {
                    const cur = currentCost.resources || [];
                    handleCostUpdate({ resources: [...cur, res] });
                  }}
                  className="w-4 h-4 bg-gray-200 hover:bg-gray-300 font-bold flex items-center justify-center rounded text-xs border border-gray-400 cursor-pointer"
                  title={`Add ${res} resource`}
                >
                  +
                </button>
                {count > 0 && (
                  <button
                    type="button"
                    data-testid={`cost-res-minus-${res}-${abilityIndex}`}
                    onClick={() => handleRemoveResource(res)}
                    className="w-4 h-4 bg-gray-200 hover:bg-gray-300 font-bold flex items-center justify-center rounded text-xs border border-gray-400 cursor-pointer"
                    title={`Remove ${res} resource`}
                  >
                    -
                  </button>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 bg-white border border-black px-2 py-0.5 rounded text-xs shadow-comic-xs">
            <span className="font-bold text-[11px] text-gray-700">Generic:</span>
            <input
              type="number"
              min="0"
              data-testid={`cost-resource-cost-generic-${abilityIndex}`}
              value={typeof currentCost.resourceCost === 'number' ? currentCost.resourceCost : ''}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                handleCostUpdate({
                  resourceCost: isNaN(val as number) || val === undefined ? undefined : val,
                });
              }}
              placeholder="0"
              className="w-12 bg-white border border-black px-1 py-0.5 text-center text-xs rounded font-bold"
            />
          </div>
        </div>
        <div className="mt-2 pt-1 border-t border-gray-100 flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
            <input
              type="checkbox"
              data-testid={`cost-require-printed-${abilityIndex}`}
              checked={Boolean(currentCost.requirePrinted)}
              onChange={(e) => {
                handleCostUpdate({
                  requirePrinted: e.target.checked || undefined,
                });
              }}
              className="accent-black"
            />
            <span className="font-bold text-gray-700">Require Printed Resources</span>
          </label>
        </div>
      </div>

      {/* Spend Counters, Discard Card & Heal sub-costs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-gray-200">
        {/* Spend Counters Sub-form */}
        <div className="bg-white p-2 border border-black rounded shadow-comic-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase font-bold text-gray-700">
              Spend Counters Cost
            </span>
            <button
              type="button"
              data-testid={`cost-spend-counters-toggle-${abilityIndex}`}
              onClick={() => {
                if (currentCost.spendCounters) {
                  handleCostUpdate({ spendCounters: undefined });
                } else {
                  handleCostUpdate({
                    spendCounters: {
                      amount: 1,
                      counterType: 'charge',
                      target: 'SELF',
                    },
                  });
                }
              }}
              className="text-[10px] font-bold text-comic-accent hover:underline cursor-pointer"
            >
              {currentCost.spendCounters ? 'Remove' : '+ Add'}
            </button>
          </div>
          {currentCost.spendCounters && (
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="block text-[8px] uppercase font-bold text-gray-500">Amount</label>
                <input
                  type="number"
                  min="1"
                  data-testid={`cost-spend-counters-amount-${abilityIndex}`}
                  value={currentCost.spendCounters.amount ?? 1}
                  onChange={(e) => {
                    const amt = parseInt(e.target.value, 10);
                    handleCostUpdate({
                      spendCounters: {
                        ...currentCost.spendCounters,
                        amount: isNaN(amt) ? 1 : amt,
                      },
                    });
                  }}
                  className="w-full bg-white border border-black p-1 text-xs rounded text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-[8px] uppercase font-bold text-gray-500">Type</label>
                <input
                  type="text"
                  data-testid={`cost-spend-counters-type-${abilityIndex}`}
                  value={currentCost.spendCounters.counterType || ''}
                  placeholder="e.g. charge"
                  onChange={(e) => {
                    handleCostUpdate({
                      spendCounters: {
                        ...currentCost.spendCounters,
                        counterType: e.target.value || undefined,
                      },
                    });
                  }}
                  className="w-full bg-white border border-black p-1 text-xs rounded"
                />
              </div>
              <div>
                <label className="block text-[8px] uppercase font-bold text-gray-500">Target</label>
                <select
                  data-testid={`cost-spend-counters-target-${abilityIndex}`}
                  value={currentCost.spendCounters.target || 'SELF'}
                  onChange={(e) => {
                    handleCostUpdate({
                      spendCounters: {
                        ...currentCost.spendCounters,
                        target: e.target.value as 'SELF' | 'IDENTITY',
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
            <span className="text-[9px] uppercase font-bold text-gray-700">Discard Card Cost</span>
            <button
              type="button"
              data-testid={`cost-discard-card-toggle-${abilityIndex}`}
              onClick={() => {
                if (currentCost.discardCard) {
                  handleCostUpdate({ discardCard: undefined });
                } else {
                  handleCostUpdate({
                    discardCard: { count: 1, from: 'HAND' },
                  });
                }
              }}
              className="text-[10px] font-bold text-comic-accent hover:underline cursor-pointer"
            >
              {currentCost.discardCard ? 'Remove' : '+ Add'}
            </button>
          </div>
          {currentCost.discardCard && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <div>
                  <label className="block text-[8px] uppercase font-bold text-gray-500">
                    Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    data-testid={`cost-discard-card-count-${abilityIndex}`}
                    value={currentCost.discardCard.count ?? 1}
                    onChange={(e) => {
                      const c = parseInt(e.target.value, 10);
                      handleCostUpdate({
                        discardCard: {
                          ...currentCost.discardCard,
                          count: isNaN(c) ? 1 : c,
                        },
                      });
                    }}
                    className="w-full bg-white border border-black p-1 text-xs rounded text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[8px] uppercase font-bold text-gray-500">
                    Max Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    data-testid={`cost-discard-card-max-count-${abilityIndex}`}
                    value={currentCost.discardCard.maxCount ?? ''}
                    onChange={(e) => {
                      const mc = e.target.value ? parseInt(e.target.value, 10) : undefined;
                      handleCostUpdate({
                        discardCard: {
                          ...currentCost.discardCard,
                          maxCount: isNaN(mc as number) ? undefined : mc,
                        },
                      });
                    }}
                    placeholder="Optional"
                    className="w-full bg-white border border-black p-1 text-xs rounded text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[8px] uppercase font-bold text-gray-500">
                    From Zone
                  </label>
                  <select
                    data-testid={`cost-discard-card-from-${abilityIndex}`}
                    value={currentCost.discardCard.from || 'HAND'}
                    onChange={(e) => {
                      handleCostUpdate({
                        discardCard: {
                          ...currentCost.discardCard,
                          from: e.target.value as 'HAND' | 'DECK' | 'PLAY',
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
                <div>
                  <label className="block text-[8px] uppercase font-bold text-gray-500">Mode</label>
                  <select
                    data-testid={`cost-discard-card-mode-${abilityIndex}`}
                    value={currentCost.discardCard.mode || 'CHOSEN'}
                    onChange={(e) => {
                      handleCostUpdate({
                        discardCard: {
                          ...currentCost.discardCard,
                          mode: e.target.value as 'CHOSEN' | 'RANDOM',
                        },
                      });
                    }}
                    className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
                  >
                    <option value="CHOSEN">CHOSEN</option>
                    <option value="RANDOM">RANDOM</option>
                  </select>
                </div>
              </div>

              {/* UniversalCardFilterBuilder Sub-form for discardCard.filter */}
              <div
                data-testid={`cost-discard-card-filter-accordion-${abilityIndex}`}
                className="rounded border border-gray-300 bg-gray-50 p-1.5 space-y-1"
              >
                <div
                  onClick={() => setIsDiscardFilterExpanded(!isDiscardFilterExpanded)}
                  data-testid={`cost-discard-card-filter-toggle-${abilityIndex}`}
                  className="flex items-center justify-between cursor-pointer select-none hover:bg-yellow-50 p-1 rounded"
                >
                  <span className="text-[9px] font-bold uppercase text-gray-700 flex items-center gap-1">
                    {isDiscardFilterExpanded ? (
                      <ChevronDown className="w-3 h-3 text-gray-600" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-gray-600" />
                    )}
                    <span>Discard Card Filter</span>
                  </span>
                  <span className="bg-comic-yellow border border-black px-1.5 py-0.2 rounded text-[8px] font-bold text-black">
                    {currentCost.discardCard.filter ? 'Configured' : 'None'}
                  </span>
                </div>
                {isDiscardFilterExpanded && (
                  <div className="pt-1 border-t border-gray-200">
                    <UniversalCardFilterBuilder
                      label="Discard Filter Criteria"
                      filter={currentCost.discardCard.filter}
                      onChange={(newFilter) => {
                        handleCostUpdate({
                          discardCard: {
                            ...currentCost.discardCard,
                            filter: newFilter || undefined,
                          },
                        });
                      }}
                      isSubBranch={true}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Heal Cost Sub-form */}
        <div className="bg-white p-2 border border-black rounded shadow-comic-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] uppercase font-bold text-gray-700">Heal Cost</span>
            <button
              type="button"
              data-testid={`cost-heal-toggle-${abilityIndex}`}
              onClick={() => {
                if (currentCost.heal) {
                  handleCostUpdate({ heal: undefined });
                } else {
                  handleCostUpdate({
                    heal: { amount: 1, target: 'SELF' },
                  });
                }
              }}
              className="text-[10px] font-bold text-comic-accent hover:underline cursor-pointer"
            >
              {currentCost.heal ? 'Remove' : '+ Add'}
            </button>
          </div>
          {currentCost.heal && (
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[8px] uppercase font-bold text-gray-500">Amount</label>
                <input
                  type="number"
                  min="1"
                  data-testid={`cost-heal-amount-${abilityIndex}`}
                  value={currentCost.heal.amount ?? 1}
                  onChange={(e) => {
                    const amt = parseInt(e.target.value, 10);
                    handleCostUpdate({
                      heal: {
                        ...currentCost.heal,
                        amount: isNaN(amt) ? 1 : amt,
                      },
                    });
                  }}
                  className="w-full bg-white border border-black p-1 text-xs rounded text-center font-bold"
                />
              </div>
              <div>
                <label className="block text-[8px] uppercase font-bold text-gray-500">Target</label>
                <select
                  data-testid={`cost-heal-target-${abilityIndex}`}
                  value={currentCost.heal.target || 'SELF'}
                  onChange={(e) => {
                    handleCostUpdate({
                      heal: {
                        ...currentCost.heal,
                        target: e.target.value as 'SELF' | 'TARGET',
                      },
                    });
                  }}
                  className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
                >
                  <option value="SELF">SELF</option>
                  <option value="TARGET">TARGET</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
