import React from 'react';
import { type DynamicValueSource, TargetSelectorSchema } from '../../../data/supplemental/schema';
import { UniversalCardFilterBuilder } from './UniversalCardFilterBuilder';
import { ChevronDown, ChevronRight, Calculator, Layers } from 'lucide-react';

export interface DynamicValueBuilderProps {
  label: string;
  value: number | 'ALL' | DynamicValueSource | undefined;
  onChange: (val: number | 'ALL' | DynamicValueSource | undefined) => void;
  allowAll?: boolean;
  description?: string;
}

const FROM_SOURCES = [
  'INTERCEPTED_VALUE',
  'PREVIOUS_RESULT',
  'DISCARDED_COUNT',
  'DISCARDED_RESOURCE_COUNT',
  'COUNTERS',
  'STAT_VALUE',
  'ENTITY_COUNT',
  'CARD_ATTRIBUTE',
] as const;

const STAT_OPTIONS = [
  'ATTACK',
  'THWART',
  'DEFENSE',
  'RECOVERY',
  'SUFFERED_DAMAGE',
  'HERO_ATK',
  'THREAT',
  'DAMAGE',
] as const;

const ATTRIBUTE_OPTIONS = ['PRINTED_RESOURCES', 'PRINTED_COST', 'BOOST_ICONS'] as const;

export const DynamicValueBuilder: React.FC<DynamicValueBuilderProps> = ({
  label,
  value,
  onChange,
  allowAll = false,
  description,
}) => {
  const [isFilterExpanded, setIsFilterExpanded] = React.useState(false);

  type ValueMode = 'number' | 'all' | 'formula';
  const currentMode: ValueMode =
    value === 'ALL' ? 'all' : typeof value === 'object' && value !== null ? 'formula' : 'number';

  const numValue = typeof value === 'number' ? value : 1;
  const sourceValue: DynamicValueSource =
    currentMode === 'formula' ? (value as DynamicValueSource) : { from: 'PREVIOUS_RESULT' };

  const handleSetMode = (mode: ValueMode) => {
    if (mode === 'all') {
      onChange('ALL');
    } else if (mode === 'formula') {
      onChange(typeof value === 'object' && value !== null ? value : { from: 'PREVIOUS_RESULT' });
    } else {
      onChange(typeof value === 'number' ? value : 1);
    }
  };

  const handleUpdateFormula = (updates: Partial<DynamicValueSource>) => {
    const next: DynamicValueSource = {
      ...sourceValue,
      ...updates,
    };
    // Prune undefined or default keys to satisfy DynamicValueSourceSchema.strict()
    const cleaned: Record<string, any> = { from: next.from };
    if (next.stat) cleaned.stat = next.stat;
    if (next.counterType) cleaned.counterType = next.counterType;
    if (next.attribute) cleaned.attribute = next.attribute;
    if (next.target) cleaned.target = next.target;
    if (next.filter) cleaned.filter = next.filter;
    if (next.multiplier !== undefined && next.multiplier !== 1)
      cleaned.multiplier = next.multiplier;
    if (next.offset !== undefined && next.offset !== 0) cleaned.offset = next.offset;
    if (next.clamp) {
      const c: Record<string, number> = {};
      if (typeof next.clamp.min === 'number' && !isNaN(next.clamp.min)) c.min = next.clamp.min;
      if (typeof next.clamp.max === 'number' && !isNaN(next.clamp.max)) c.max = next.clamp.max;
      if (Object.keys(c).length > 0) cleaned.clamp = c;
    }
    onChange(cleaned as DynamicValueSource);
  };

  // Filter criteria count for summary badge
  const filterCriteriaCount = sourceValue.filter
    ? [
        sourceValue.filter.codes?.length,
        sourceValue.filter.names?.length,
        sourceValue.filter.types?.length,
        sourceValue.filter.traits?.length,
        sourceValue.filter.aspects?.length,
        sourceValue.filter.sets?.length,
        sourceValue.filter.isUnique !== undefined ? 1 : undefined,
        sourceValue.filter.cost ? 1 : undefined,
        sourceValue.filter.resourceIcons?.length,
        sourceValue.filter.hasKeyword ? 1 : undefined,
        sourceValue.filter.hasStatus?.length,
      ].filter(Boolean).length
    : 0;

  return (
    <div className="space-y-2 rounded border-2 border-black bg-comic-paper p-2.5 text-black font-sans shadow-comic-xs">
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-black pb-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-1">
          <Calculator className="w-3.5 h-3.5 text-comic-accent" />
          <span>{label}</span>
        </label>

        {/* 3-Way Segmented Switcher */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="mode-fixed-number-btn"
            className={`px-2 py-0.5 rounded border border-black text-[10px] font-bold transition-transform active:scale-95 ${
              currentMode === 'number'
                ? 'bg-comic-accent text-white shadow-comic-xs'
                : 'bg-white text-gray-700 hover:bg-yellow-50'
            }`}
            onClick={() => handleSetMode('number')}
          >
            Fixed Number
          </button>

          {allowAll && (
            <button
              type="button"
              data-testid="mode-entire-pool-btn"
              className={`px-2 py-0.5 rounded border border-black text-[10px] font-bold transition-transform active:scale-95 ${
                currentMode === 'all'
                  ? 'bg-amber-400 text-black shadow-comic-xs'
                  : 'bg-white text-gray-700 hover:bg-yellow-50'
              }`}
              onClick={() => handleSetMode('all')}
            >
              Entire Pool (&quot;ALL&quot;)
            </button>
          )}

          <button
            type="button"
            data-testid="mode-dynamic-formula-btn"
            className={`px-2 py-0.5 rounded border border-black text-[10px] font-bold transition-transform active:scale-95 ${
              currentMode === 'formula'
                ? 'bg-comic-yellow text-black shadow-comic-xs'
                : 'bg-white text-gray-700 hover:bg-yellow-50'
            }`}
            onClick={() => handleSetMode('formula')}
          >
            Dynamic Formula
          </button>
        </div>
      </div>

      {description && <p className="text-[10px] text-gray-500 italic">{description}</p>}

      {currentMode === 'number' && (
        <div>
          <input
            type="number"
            data-testid="dynamic-value-number-input"
            value={numValue}
            onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
            className="w-full rounded border border-black bg-white px-2.5 py-1 text-xs text-black font-bold focus:ring-1 focus:ring-black"
          />
        </div>
      )}

      {currentMode === 'all' && (
        <div
          data-testid="dynamic-value-all-notice"
          className="rounded border border-amber-500 bg-amber-50 p-2 text-xs text-amber-900 font-comic"
        >
          <span className="font-bold">Entire Pool (&quot;ALL&quot;):</span> Resolves to all matching
          cards or counters without an explicit numeric bound (RR v1.8 p. 10).
        </div>
      )}

      {currentMode === 'formula' && (
        <div className="space-y-2.5 pt-2 border-t border-black">
          <div>
            <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
              Formula Source (from)
            </label>
            <select
              data-testid="dynamic-value-from-select"
              value={sourceValue.from}
              onChange={(e) =>
                handleUpdateFormula({
                  from: e.target.value as any,
                })
              }
              className="w-full rounded border border-black bg-white p-1 text-xs text-black font-bold focus:ring-1 focus:ring-black"
            >
              {FROM_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>

          {/* STAT_VALUE sub-fields */}
          {sourceValue.from === 'STAT_VALUE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
                  Character Stat
                </label>
                <select
                  data-testid="dynamic-value-stat-select"
                  value={sourceValue.stat || 'ATTACK'}
                  onChange={(e) =>
                    handleUpdateFormula({
                      stat: e.target.value as any,
                    })
                  }
                  className="w-full rounded border border-black bg-white p-1 text-xs text-black font-bold"
                >
                  {STAT_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
                  Stat Target
                </label>
                <select
                  data-testid="dynamic-value-target-select"
                  value={sourceValue.target || 'SELF_IDENTITY'}
                  onChange={(e) =>
                    handleUpdateFormula({
                      target: (e.target.value as any) || undefined,
                    })
                  }
                  className="w-full rounded border border-black bg-white p-1 text-xs text-black font-mono font-bold"
                >
                  <option value="">Default (Contextual Target)</option>
                  {TargetSelectorSchema.options.map((tgt) => (
                    <option key={tgt} value={tgt}>
                      {tgt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* COUNTERS sub-fields */}
          {sourceValue.from === 'COUNTERS' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
                  Counter Type
                </label>
                <input
                  type="text"
                  data-testid="dynamic-value-counter-type-input"
                  value={sourceValue.counterType || ''}
                  placeholder="e.g. all-purpose, charge, web"
                  onChange={(e) =>
                    handleUpdateFormula({
                      counterType: e.target.value.trim() || undefined,
                    })
                  }
                  className="w-full rounded border border-black bg-white px-2 py-1 text-xs text-black"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
                  Host Target
                </label>
                <select
                  data-testid="dynamic-value-target-select"
                  value={sourceValue.target || 'SELF'}
                  onChange={(e) =>
                    handleUpdateFormula({
                      target: (e.target.value as any) || undefined,
                    })
                  }
                  className="w-full rounded border border-black bg-white p-1 text-xs text-black font-mono font-bold"
                >
                  <option value="">Default (SELF)</option>
                  {TargetSelectorSchema.options.map((tgt) => (
                    <option key={tgt} value={tgt}>
                      {tgt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* CARD_ATTRIBUTE sub-fields */}
          {sourceValue.from === 'CARD_ATTRIBUTE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
                  Card Attribute
                </label>
                <select
                  data-testid="dynamic-value-attribute-select"
                  value={sourceValue.attribute || 'PRINTED_RESOURCES'}
                  onChange={(e) =>
                    handleUpdateFormula({
                      attribute: e.target.value as any,
                    })
                  }
                  className="w-full rounded border border-black bg-white p-1 text-xs text-black font-bold"
                >
                  {ATTRIBUTE_OPTIONS.map((att) => (
                    <option key={att} value={att}>
                      {att}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
                  Target Entity
                </label>
                <select
                  data-testid="dynamic-value-target-select"
                  value={sourceValue.target || 'TRIGGERING_CARD'}
                  onChange={(e) =>
                    handleUpdateFormula({
                      target: (e.target.value as any) || undefined,
                    })
                  }
                  className="w-full rounded border border-black bg-white p-1 text-xs text-black font-mono font-bold"
                >
                  <option value="">Default (TRIGGERING_CARD)</option>
                  {TargetSelectorSchema.options.map((tgt) => (
                    <option key={tgt} value={tgt}>
                      {tgt}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* ENTITY_COUNT sub-fields: Collapsible UniversalCardFilter Accordion */}
          {sourceValue.from === 'ENTITY_COUNT' && (
            <div
              data-testid="entity-count-filter-accordion"
              className="rounded border border-black bg-white/70 p-2 space-y-2"
            >
              <div
                onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                data-testid="toggle-entity-filter-btn"
                className="flex items-center justify-between cursor-pointer select-none hover:bg-yellow-50 p-1 rounded"
              >
                <div className="flex items-center gap-1.5">
                  {isFilterExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                  )}
                  <Layers className="w-3.5 h-3.5 text-comic-accent" />
                  <span className="text-[10px] font-bold uppercase text-black">
                    Entity Match Criteria Filter
                  </span>
                </div>
                <span className="bg-comic-yellow border border-black px-1.5 py-0.2 rounded text-[9px] font-bold text-black">
                  {filterCriteriaCount > 0
                    ? `${filterCriteriaCount} ${filterCriteriaCount === 1 ? 'criterion' : 'criteria'}`
                    : 'No criteria configured'}
                </span>
              </div>

              {isFilterExpanded && (
                <div className="pt-1 border-t border-gray-300">
                  <UniversalCardFilterBuilder
                    filter={sourceValue.filter}
                    onChange={(newFilter) => handleUpdateFormula({ filter: newFilter })}
                    isSubBranch={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* Scalers & Clamping (Multiplier, Offset, Clamp Min, Clamp Max) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-gray-300">
            <div>
              <label className="block text-[9px] font-bold uppercase text-gray-600 mb-0.5">
                Multiplier
              </label>
              <input
                type="number"
                step="any"
                data-testid="dynamic-value-multiplier-input"
                value={sourceValue.multiplier ?? 1}
                onChange={(e) =>
                  handleUpdateFormula({
                    multiplier: e.target.value === '' ? 1 : parseFloat(e.target.value) || 1,
                  })
                }
                className="w-full rounded border border-black bg-white px-1.5 py-0.5 text-xs text-black text-center"
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase text-gray-600 mb-0.5">
                Offset (+/-)
              </label>
              <input
                type="number"
                data-testid="dynamic-value-offset-input"
                value={sourceValue.offset ?? 0}
                onChange={(e) =>
                  handleUpdateFormula({
                    offset: e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0,
                  })
                }
                className="w-full rounded border border-black bg-white px-1.5 py-0.5 text-xs text-black text-center"
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase text-gray-600 mb-0.5">
                Clamp Min (≥)
              </label>
              <input
                type="number"
                data-testid="dynamic-value-clamp-min-input"
                value={sourceValue.clamp?.min ?? ''}
                placeholder="None"
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                  const existingClamp = sourceValue.clamp || {};
                  handleUpdateFormula({
                    clamp: { ...existingClamp, min: val },
                  });
                }}
                className="w-full rounded border border-black bg-white px-1.5 py-0.5 text-xs text-black text-center"
              />
            </div>

            <div>
              <label className="block text-[9px] font-bold uppercase text-gray-600 mb-0.5">
                Clamp Max (≤)
              </label>
              <input
                type="number"
                data-testid="dynamic-value-clamp-max-input"
                value={sourceValue.clamp?.max ?? ''}
                placeholder="None"
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                  const existingClamp = sourceValue.clamp || {};
                  handleUpdateFormula({
                    clamp: { ...existingClamp, max: val },
                  });
                }}
                className="w-full rounded border border-black bg-white px-1.5 py-0.5 text-xs text-black text-center"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
