import React from 'react';
import { Shield, Coins, AlertCircle } from 'lucide-react';
import { AbilityCostSchema } from '../../../data/supplemental/schema';
import { ZodSchemaForm } from './schema-form/ZodSchemaForm';
import { kebabCase } from './schema-form/test-id';

export interface AbilityCostSectionProps {
  cost?: any;
  abilityIndex?: number;
  isEvent?: boolean;
  onChange: (updatedCost: any | undefined) => void;
  hasErrors?: boolean;
  errors?: string[];
}

export const AbilityCostSection: React.FC<AbilityCostSectionProps> = ({
  cost = {},
  abilityIndex = 0,
  isEvent = false,
  onChange,
  hasErrors = false,
  errors = [],
}) => {
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

  const resourceMap: Record<string, number> =
    typeof currentCost.resourceCost === 'object' && currentCost.resourceCost !== null
      ? currentCost.resourceCost
      : {};

  const getResourceCount = (res: 'physical' | 'energy' | 'mental' | 'wild') =>
    resourceMap[res] || 0;

  const totalResourceCount = Object.values(resourceMap).reduce(
    (sum: number, c) => sum + (typeof c === 'number' ? c : 0),
    0,
  );

  const hasAnyResources = currentCost.resourceCost !== undefined;

  const handleAddResource = (res: 'physical' | 'energy' | 'mental' | 'wild') => {
    handleCostUpdate({ resourceCost: { ...resourceMap, [res]: (resourceMap[res] || 0) + 1 } });
  };

  const handleRemoveResource = (res: 'physical' | 'energy' | 'mental' | 'wild') => {
    if (!resourceMap[res]) return;
    const nextMap = { ...resourceMap };
    nextMap[res] -= 1;
    if (nextMap[res] <= 0) {
      delete nextMap[res];
    }
    handleCostUpdate({
      resourceCost: Object.keys(nextMap).length > 0 ? nextMap : undefined,
    });
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

      <ZodSchemaForm
        schema={AbilityCostSchema}
        value={cost || undefined}
        onChange={onChange}
        hiddenKeys={['resourceCost']}
        disabledKeys={isEvent ? ['discardSelf'] : []}
        emptyLabel="(None)"
        testId={(path, extra) =>
          `cost-${path.map(kebabCase).join('-')}${extra ? `-${extra}` : ''}-${abilityIndex}`
        }
      />
      {isEvent && (
        <p className="text-[10px] text-gray-500 italic">
          (Events discard intrinsically per RR v1.8)
        </p>
      )}

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
                handleCostUpdate({ resourceCost: undefined });
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
                  onClick={() => handleAddResource(res)}
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
        </div>
      </div>
    </div>
  );
};
