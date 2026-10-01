import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import {
  CardLocationSelector,
  CardLocationZone,
  CardLocationPosition,
  CardLocationTarget,
  CardLocationZoneSchema,
  CardLocationPositionSchema,
  CardLocationTargetSchema,
  UniversalCardFilter,
} from '../../../data/supplemental/schema';
import { UniversalCardFilterBuilder } from './UniversalCardFilterBuilder';

import { sanitizeCardLocation } from './card-location-selector-utils';

export interface CardLocationSelectorFormProps {
  value: CardLocationSelector | undefined;
  onChange: (value: CardLocationSelector | undefined) => void;
  label?: string;
  testIdPrefix: string;
}

function countFilterCriteria(filter?: UniversalCardFilter): number {
  if (!filter) return 0;
  let count = 0;
  if (filter.codes?.length) count++;
  if (filter.names?.length) count++;
  if (filter.types?.length) count++;
  if (filter.traits?.length) count++;
  if (filter.aspects?.length) count++;
  if (filter.sets?.length) count++;
  if (filter.isUnique !== undefined) count++;
  if (filter.cost !== undefined) count++;
  if (filter.resourceIcons?.length) count++;
  if (filter.hasKeyword) count++;
  if (filter.hasStatus?.length) count++;
  if (filter.all?.length) count++;
  if (filter.any?.length) count++;
  if (filter.none?.length) count++;
  return count;
}

export const CardLocationSelectorForm: React.FC<CardLocationSelectorFormProps> = ({
  value,
  onChange,
  label,
  testIdPrefix,
}) => {
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(
    Boolean(value?.filter && Object.keys(value.filter).length > 0),
  );

  const isZoneSet = Boolean(value?.zone);

  const updateField = (updates: Partial<CardLocationSelector>) => {
    const current = value || {};
    const next: Partial<CardLocationSelector> = { ...current, ...updates };

    for (const key of Object.keys(updates) as (keyof CardLocationSelector)[]) {
      if (updates[key] === undefined || updates[key] === '') {
        delete next[key];
      }
    }

    onChange(sanitizeCardLocation(next));
  };

  const filterCriteriaCount = countFilterCriteria(value?.filter);

  return (
    <div
      data-testid={`${testIdPrefix}-form`}
      className="space-y-2 rounded border border-black bg-yellow-50/50 p-2 text-xs shadow-comic-xs"
    >
      {label && (
        <div className="text-[10px] font-bold uppercase tracking-wider text-black">{label}</div>
      )}

      {/* Grid: Zone and Position */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="block text-[9px] font-bold uppercase text-gray-700 mb-0.5">Zone</label>
          <select
            data-testid={`${testIdPrefix}-zone-select`}
            value={value?.zone || ''}
            onChange={(e) => {
              const zoneVal = e.target.value as CardLocationZone | '';
              updateField({ zone: zoneVal || undefined });
            }}
            className="w-full rounded border border-black bg-white p-1 text-xs font-mono font-bold text-black"
          >
            <option value="">Select Zone...</option>
            {CardLocationZoneSchema.options.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>

        {isZoneSet && (
          <div>
            <label className="block text-[9px] font-bold uppercase text-gray-700 mb-0.5">
              Position
            </label>
            <select
              data-testid={`${testIdPrefix}-position-select`}
              value={value?.position || ''}
              onChange={(e) => {
                const posVal = e.target.value as CardLocationPosition | '';
                updateField({ position: posVal || undefined });
              }}
              className="w-full rounded border border-black bg-white p-1 text-xs font-bold text-black"
            >
              <option value="">Default (TOP)</option>
              {CardLocationPositionSchema.options.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Progressive Disclosure: Target & Card Code (only when Zone is set) */}
      {isZoneSet && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="block text-[9px] font-bold uppercase text-gray-700 mb-0.5">
                Target Entity
              </label>
              <select
                data-testid={`${testIdPrefix}-target-select`}
                value={value?.target || ''}
                onChange={(e) => {
                  const targetVal = e.target.value as CardLocationTarget | '';
                  updateField({ target: targetVal || undefined });
                }}
                className="w-full rounded border border-black bg-white p-1 text-xs font-bold text-black"
              >
                <option value="">None / Contextual</option>
                {CardLocationTargetSchema.options.map((tgt) => (
                  <option key={tgt} value={tgt}>
                    {tgt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase text-gray-700 mb-0.5">
                Card Code
              </label>
              <input
                type="text"
                data-testid={`${testIdPrefix}-card-code-input`}
                value={value?.cardCode || ''}
                placeholder="e.g. 01109"
                onChange={(e) => {
                  const val = e.target.value;
                  updateField({ cardCode: val.trim() ? val : undefined });
                }}
                className="w-full rounded border border-black bg-white px-2 py-1 text-xs font-mono text-black"
              />
            </div>
          </div>

          {/* Filter Accordion */}
          <div
            data-testid={`${testIdPrefix}-filter-accordion`}
            className="rounded border border-black bg-white/80 p-2 space-y-2"
          >
            <div
              data-testid={`${testIdPrefix}-filter-accordion-toggle`}
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              className="flex items-center justify-between cursor-pointer select-none hover:bg-yellow-100/70 p-1 rounded"
            >
              <div className="flex items-center gap-1.5">
                {isFilterExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                )}
                <Layers className="w-3.5 h-3.5 text-comic-accent" />
                <span className="text-[10px] font-bold uppercase text-black">
                  Card Filter Criteria
                </span>
              </div>
              <span
                data-testid={`${testIdPrefix}-filter-badge`}
                className="bg-comic-yellow border border-black px-1.5 py-0.5 rounded text-[9px] font-bold text-black"
              >
                {filterCriteriaCount > 0
                  ? `${filterCriteriaCount} criteri${filterCriteriaCount > 1 ? 'a' : 'on'}`
                  : 'No Filter'}
              </span>
            </div>

            {isFilterExpanded && (
              <div
                data-testid={`${testIdPrefix}-filter-content`}
                className="pt-2 border-t border-gray-300"
              >
                <UniversalCardFilterBuilder
                  label="Location Card Filter"
                  filter={value?.filter}
                  onChange={(newFilter) => updateField({ filter: newFilter })}
                  isSubBranch={true}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
