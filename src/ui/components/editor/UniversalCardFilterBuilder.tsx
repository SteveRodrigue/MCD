import React from 'react';
import {
  type UniversalCardFilter,
  type Keyword,
  CardTypeSchema,
  AspectSchema,
  ResourceTypeSchema,
  KeywordSchema,
  CharacterStatusSchema,
} from '../../../data/supplemental/schema';
import { Filter, Plus, Trash2 } from 'lucide-react';
import { sanitizeCardFilter } from './universal-card-filter-utils';

export interface UniversalCardFilterBuilderProps {
  label?: string;
  filter: UniversalCardFilter | undefined;
  onChange: (filter: UniversalCardFilter | undefined) => void;
  isSubBranch?: boolean;
}

const CARD_TYPES = CardTypeSchema.options;
const ASPECT_OPTIONS = AspectSchema.options;
const RESOURCE_OPTIONS = ResourceTypeSchema.options;
const KEYWORD_OPTIONS = KeywordSchema.options;
const STATUS_OPTIONS = CharacterStatusSchema.options;

export const UniversalCardFilterBuilder: React.FC<UniversalCardFilterBuilderProps> = ({
  label,
  filter,
  onChange,
  isSubBranch = false,
}) => {
  const currentFilter = filter || {};

  const emitChange = (updated: UniversalCardFilter) => {
    const cleaned = sanitizeCardFilter(updated);
    onChange(cleaned);
  };

  const handleArrayToggle = <T extends string>(
    key: 'types' | 'aspects' | 'resourceIcons' | 'hasStatus',
    val: T,
  ) => {
    const list = ((currentFilter[key] as any[]) || []) as T[];
    const exists = list.includes(val);
    const updated = exists ? list.filter((item) => item !== val) : [...list, val];
    emitChange({
      ...currentFilter,
      [key]: updated.length > 0 ? updated : undefined,
    });
  };

  const handleCsvChange = (key: 'codes' | 'names' | 'traits' | 'sets', text: string) => {
    const items = text
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    emitChange({
      ...currentFilter,
      [key]: items.length > 0 ? items : undefined,
    });
  };

  const handleCostChange = (bound: 'min' | 'max' | 'equals', rawVal: string) => {
    const num = rawVal === '' ? undefined : parseInt(rawVal, 10);
    const costObj = { ...(currentFilter.cost || {}) };
    if (num === undefined || isNaN(num)) {
      delete costObj[bound];
    } else {
      costObj[bound] = num;
    }
    emitChange({
      ...currentFilter,
      cost: Object.keys(costObj).length > 0 ? costObj : undefined,
    });
  };

  const handleBooleanToggle = (
    key: 'isUnique' | 'isIdentitySpecific' | 'isExhausted',
    nextVal: boolean | undefined,
  ) => {
    emitChange({
      ...currentFilter,
      [key]: nextVal,
    });
  };

  // Combinator handlers
  const handleAddCombinator = (comb: 'all' | 'any' | 'none') => {
    const existing = currentFilter[comb] || [];
    emitChange({
      ...currentFilter,
      [comb]: [...existing, {}],
    });
  };

  const handleRemoveCombinatorItem = (comb: 'all' | 'any' | 'none', index: number) => {
    const existing = currentFilter[comb] || [];
    const updated = existing.filter((_, idx) => idx !== index);
    emitChange({
      ...currentFilter,
      [comb]: updated.length > 0 ? updated : undefined,
    });
  };

  const handleUpdateCombinatorItem = (
    comb: 'all' | 'any' | 'none',
    index: number,
    itemFilter: UniversalCardFilter | undefined,
  ) => {
    const existing = [...(currentFilter[comb] || [])];
    if (!itemFilter) {
      handleRemoveCombinatorItem(comb, index);
    } else {
      existing[index] = itemFilter;
      emitChange({
        ...currentFilter,
        [comb]: existing,
      });
    }
  };

  // Count active criteria for visual badge
  const criteriaCount = [
    currentFilter.codes?.length,
    currentFilter.names?.length,
    currentFilter.types?.length,
    currentFilter.traits?.length,
    currentFilter.aspects?.length,
    currentFilter.sets?.length,
    currentFilter.isUnique !== undefined ? 1 : undefined,
    currentFilter.isIdentitySpecific !== undefined ? 1 : undefined,
    currentFilter.isExhausted !== undefined ? 1 : undefined,
    currentFilter.cost ? 1 : undefined,
    currentFilter.resourceIcons?.length,
    currentFilter.hasKeyword ? 1 : undefined,
    currentFilter.hasStatus?.length,
    currentFilter.all?.length,
    currentFilter.any?.length,
    currentFilter.none?.length,
  ].filter(Boolean).length;

  return (
    <div
      className={`space-y-3 rounded border-2 border-black p-3 text-black font-sans shadow-comic-xs ${
        isSubBranch ? 'bg-yellow-50/70 ml-2 mt-2' : 'bg-comic-paper'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-1.5">
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-comic-accent" />
          <span className="font-bangers tracking-wider text-xs uppercase text-black">
            {label || 'Universal Card Filter'}
          </span>
          {criteriaCount > 0 && (
            <span className="rounded bg-comic-yellow border border-black px-1.5 py-0.2 text-[10px] font-bold">
              {criteriaCount} {criteriaCount === 1 ? 'criterion' : 'criteria'}
            </span>
          )}
        </div>
        {filter && (
          <button
            type="button"
            className="text-[11px] font-bold text-comic-red hover:underline cursor-pointer"
            onClick={() => onChange(undefined)}
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* 1. Identification: Codes, Names, Sets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
            Card Codes
          </label>
          <input
            type="text"
            data-testid="filter-codes-input"
            value={(currentFilter.codes || []).join(', ')}
            placeholder="e.g. 01002, 01046"
            onChange={(e) => handleCsvChange('codes', e.target.value)}
            className="w-full rounded border border-black bg-white px-2 py-1 text-xs text-black focus:ring-1 focus:ring-black"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
            Card Names
          </label>
          <input
            type="text"
            data-testid="filter-names-input"
            value={(currentFilter.names || []).join(', ')}
            placeholder="e.g. Captain America, Hulk"
            onChange={(e) => handleCsvChange('names', e.target.value)}
            className="w-full rounded border border-black bg-white px-2 py-1 text-xs text-black focus:ring-1 focus:ring-black"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
            Sets / Packs
          </label>
          <input
            type="text"
            data-testid="filter-sets-input"
            value={(currentFilter.sets || []).join(', ')}
            placeholder="e.g. core, spider_man"
            onChange={(e) => handleCsvChange('sets', e.target.value)}
            className="w-full rounded border border-black bg-white px-2 py-1 text-xs text-black focus:ring-1 focus:ring-black"
          />
        </div>
      </div>

      {/* 2. Traits */}
      <div>
        <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
          Traits (comma-separated)
        </label>
        <input
          type="text"
          data-testid="filter-traits-input"
          value={(currentFilter.traits || []).join(', ')}
          placeholder="e.g. Avenger, Aerial, Tech"
          onChange={(e) => handleCsvChange('traits', e.target.value)}
          className="w-full rounded border border-black bg-white px-2 py-1 text-xs text-black focus:ring-1 focus:ring-black"
        />
      </div>

      {/* 3. Card Types */}
      <div>
        <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
          Card Types ({CARD_TYPES.length})
        </label>
        <div className="flex flex-wrap gap-1">
          {CARD_TYPES.map((type) => {
            const isSelected = (currentFilter.types || []).includes(type);
            return (
              <button
                key={type}
                type="button"
                data-testid={`filter-type-${type}`}
                onClick={() => handleArrayToggle('types', type)}
                className={`px-1.5 py-0.5 rounded border border-black text-[10px] font-bold transition-transform cursor-pointer ${
                  isSelected
                    ? 'bg-comic-accent text-white shadow-comic-xs scale-105'
                    : 'bg-white text-gray-800 hover:bg-gray-100'
                }`}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Aspects */}
      <div>
        <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">Aspects</label>
        <div className="flex flex-wrap gap-1">
          {ASPECT_OPTIONS.map((aspect) => {
            const isSelected = (currentFilter.aspects || []).includes(aspect);
            return (
              <button
                key={aspect}
                type="button"
                data-testid={`filter-aspect-${aspect}`}
                onClick={() => handleArrayToggle('aspects', aspect)}
                className={`px-1.5 py-0.5 rounded border border-black text-[10px] font-bold capitalize transition-transform cursor-pointer ${
                  isSelected
                    ? 'bg-comic-yellow text-black shadow-comic-xs scale-105'
                    : 'bg-white text-gray-800 hover:bg-gray-100'
                }`}
              >
                {aspect}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Resource Icons */}
      <div>
        <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
          Printed Resource Icons
        </label>
        <div className="flex flex-wrap gap-1">
          {RESOURCE_OPTIONS.map((res) => {
            const isSelected = (currentFilter.resourceIcons || []).includes(res);
            return (
              <button
                key={res}
                type="button"
                data-testid={`filter-resource-${res}`}
                onClick={() => handleArrayToggle('resourceIcons', res)}
                className={`px-1.5 py-0.5 rounded border border-black text-[10px] font-bold capitalize transition-transform cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 text-black shadow-comic-xs scale-105'
                    : 'bg-white text-gray-800 hover:bg-gray-100'
                }`}
              >
                {res}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Numeric Cost Comparison */}
      <div>
        <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
          Printed Cost Bounds (NumberComparison)
        </label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <span className="block text-[9px] uppercase text-gray-600 mb-0.5">Min Cost (≥)</span>
            <input
              type="number"
              min="0"
              max="20"
              data-testid="filter-cost-min"
              value={currentFilter.cost?.min ?? ''}
              placeholder="e.g. 1"
              onChange={(e) => handleCostChange('min', e.target.value)}
              className="w-full rounded border border-black bg-white px-2 py-0.5 text-xs text-center font-bold text-black"
            />
          </div>
          <div>
            <span className="block text-[9px] uppercase text-gray-600 mb-0.5">Max Cost (≤)</span>
            <input
              type="number"
              min="0"
              max="20"
              data-testid="filter-cost-max"
              value={currentFilter.cost?.max ?? ''}
              placeholder="e.g. 3"
              onChange={(e) => handleCostChange('max', e.target.value)}
              className="w-full rounded border border-black bg-white px-2 py-0.5 text-xs text-center font-bold text-black"
            />
          </div>
          <div>
            <span className="block text-[9px] uppercase text-gray-600 mb-0.5">Exact Cost (=)</span>
            <input
              type="number"
              min="0"
              max="20"
              data-testid="filter-cost-equals"
              value={currentFilter.cost?.equals ?? ''}
              placeholder="e.g. 2"
              onChange={(e) => handleCostChange('equals', e.target.value)}
              className="w-full rounded border border-black bg-white px-2 py-0.5 text-xs text-center font-bold text-black"
            />
          </div>
        </div>
      </div>

      {/* 7. Unicity & Identity Specific & Exhausted */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
            Unique Card (isUnique)
          </label>
          <select
            data-testid="filter-is-unique-select"
            value={
              currentFilter.isUnique === true
                ? 'true'
                : currentFilter.isUnique === false
                  ? 'false'
                  : ''
            }
            onChange={(e) => {
              const val = e.target.value;
              handleBooleanToggle('isUnique', val === '' ? undefined : val === 'true');
            }}
            className="w-full rounded border border-black bg-white p-1 text-xs font-bold text-black"
          >
            <option value="">Any (Unfiltered)</option>
            <option value="true">Must be Unique (True)</option>
            <option value="false">Must NOT be Unique (False)</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
            Identity Specific
          </label>
          <select
            data-testid="filter-is-identity-specific-select"
            value={
              currentFilter.isIdentitySpecific === true
                ? 'true'
                : currentFilter.isIdentitySpecific === false
                  ? 'false'
                  : ''
            }
            onChange={(e) => {
              const val = e.target.value;
              handleBooleanToggle('isIdentitySpecific', val === '' ? undefined : val === 'true');
            }}
            className="w-full rounded border border-black bg-white p-1 text-xs font-bold text-black"
          >
            <option value="">Any (Unfiltered)</option>
            <option value="true">Identity Specific Only</option>
            <option value="false">Universal Only</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
            Exhaustion State
          </label>
          <select
            data-testid="filter-is-exhausted-select"
            value={
              currentFilter.isExhausted === true
                ? 'true'
                : currentFilter.isExhausted === false
                  ? 'false'
                  : ''
            }
            onChange={(e) => {
              const val = e.target.value;
              handleBooleanToggle('isExhausted', val === '' ? undefined : val === 'true');
            }}
            className="w-full rounded border border-black bg-white p-1 text-xs font-bold text-black"
          >
            <option value="">Any (Unfiltered)</option>
            <option value="true">Must be Exhausted</option>
            <option value="false">Must be Ready</option>
          </select>
        </div>
      </div>

      {/* 8. Keywords & Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
            Has Keyword
          </label>
          <select
            data-testid="filter-keyword-select"
            value={currentFilter.hasKeyword || ''}
            onChange={(e) => {
              emitChange({
                ...currentFilter,
                hasKeyword: (e.target.value || undefined) as Keyword | undefined,
              });
            }}
            className="w-full rounded border border-black bg-white p-1 text-xs font-bold text-black"
          >
            <option value="">None (Any)</option>
            {KEYWORD_OPTIONS.map((kw) => (
              <option key={kw} value={kw}>
                {kw}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase text-gray-700 mb-1">
            Character Status
          </label>
          <div className="flex flex-wrap gap-1">
            {STATUS_OPTIONS.map((st) => {
              const isSelected = (currentFilter.hasStatus || []).includes(st);
              return (
                <button
                  key={st}
                  type="button"
                  data-testid={`filter-status-${st}`}
                  onClick={() => handleArrayToggle('hasStatus', st)}
                  className={`px-1.5 py-0.5 rounded border border-black text-[10px] font-bold transition-transform cursor-pointer ${
                    isSelected
                      ? 'bg-comic-red text-white shadow-comic-xs scale-105'
                      : 'bg-white text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  {st}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 9. Boolean Combinator Branches (Level 1 Composable Logic) */}
      {!isSubBranch && (
        <div className="border-t-2 border-dashed border-gray-300 pt-2 space-y-2">
          <span className="block text-[10px] font-bangers uppercase text-gray-800 tracking-wider">
            Composable Logic Branches (All, Any, None)
          </span>

          {(['all', 'any', 'none'] as const).map((comb) => {
            const branches = currentFilter[comb] || [];
            return (
              <div key={comb} className="rounded border border-black bg-white/70 p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-black">
                    Match {comb.toUpperCase()} of the following ({branches.length})
                  </span>
                  <button
                    type="button"
                    data-testid={`add-${comb}-subfilter`}
                    onClick={() => handleAddCombinator(comb)}
                    className="flex items-center gap-1 text-[10px] font-bold text-comic-accent hover:underline cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add {comb.toUpperCase()} Condition</span>
                  </button>
                </div>

                {branches.map((branchFilter, bIdx) => (
                  <div key={bIdx} className="relative">
                    <button
                      type="button"
                      data-testid={`remove-${comb}-subfilter-${bIdx}`}
                      onClick={() => handleRemoveCombinatorItem(comb, bIdx)}
                      className="absolute right-2 top-2 z-10 p-1 text-gray-400 hover:text-comic-red cursor-pointer"
                      title="Remove condition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <UniversalCardFilterBuilder
                      isSubBranch={true}
                      filter={branchFilter}
                      onChange={(updated) => handleUpdateCombinatorItem(comb, bIdx, updated)}
                    />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
