import React from 'react';
import type { UniversalCardFilter } from '../../../data/supplemental/schema';

interface UniversalCardFilterBuilderProps {
  filter: UniversalCardFilter | undefined;
  onChange: (filter: UniversalCardFilter | undefined) => void;
}

const CARD_TYPES = [
  'hero',
  'alter_ego',
  'ally',
  'upgrade',
  'support',
  'event',
  'minion',
  'side_scheme',
  'treachery',
];

const ASPECT_OPTIONS = ['aggression', 'justice', 'leadership', 'protection', 'basic'];

export const UniversalCardFilterBuilder: React.FC<UniversalCardFilterBuilderProps> = ({
  filter,
  onChange,
}) => {
  const currentFilter = filter || {};

  const handleArrayToggle = (key: 'types' | 'traits' | 'aspects', val: any) => {
    const list = (currentFilter[key] as any[]) || [];
    const exists = list.includes(val);
    const updated = exists ? list.filter((item) => item !== val) : [...list, val];
    const newFilter = { ...currentFilter, [key]: updated.length > 0 ? updated : undefined };
    onChange(
      Object.keys(newFilter).some((k) => (newFilter as any)[k] !== undefined)
        ? newFilter
        : undefined,
    );
  };

  const handleTraitChange = (text: string) => {
    const traits = text
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const updated = {
      ...currentFilter,
      traits: traits.length > 0 ? traits : undefined,
    };
    const hasProps = Object.values(updated).some((v) => v !== undefined);
    onChange(hasProps ? updated : undefined);
  };

  const handleCodeChange = (text: string) => {
    const codes = text
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const updated = {
      ...currentFilter,
      codes: codes.length > 0 ? codes : undefined,
    };
    const hasProps = Object.values(updated).some((v) => v !== undefined);
    onChange(hasProps ? updated : undefined);
  };

  return (
    <div className="space-y-3 rounded border border-gray-700 bg-gray-900/60 p-3">
      <div className="flex items-center justify-between border-b border-gray-700 pb-2">
        <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
          Universal Card Filter
        </span>
        {filter && (
          <button
            type="button"
            className="text-xs text-red-400 hover:text-red-300"
            onClick={() => onChange(undefined)}
          >
            Clear Filter
          </button>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-300 mb-1">Target Card Codes</label>
        <input
          type="text"
          value={(currentFilter.codes || []).join(', ')}
          placeholder="e.g. 01002, cap_shield"
          onChange={(e) => handleCodeChange(e.target.value)}
          className="w-full rounded border border-gray-600 bg-gray-800 px-2.5 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-300 mb-1">Card Types</label>
        <div className="flex flex-wrap gap-1.5">
          {CARD_TYPES.map((type) => {
            const selected = (currentFilter.types || []).includes(type as any);
            return (
              <button
                key={type}
                type="button"
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  selected
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
                onClick={() => handleArrayToggle('types', type)}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-300 mb-1">Traits Match</label>
        <input
          type="text"
          value={(currentFilter.traits || []).join(', ')}
          placeholder="e.g. Tech, Avenger, Web-Shooter"
          onChange={(e) => handleTraitChange(e.target.value)}
          className="w-full rounded border border-gray-600 bg-gray-800 px-2.5 py-1 text-xs text-white focus:border-purple-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-300 mb-1">Aspects</label>
        <div className="flex flex-wrap gap-1.5">
          {ASPECT_OPTIONS.map((aspect) => {
            const selected = (currentFilter.aspects || []).includes(aspect as any);
            return (
              <button
                key={aspect}
                type="button"
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors capitalize ${
                  selected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
                onClick={() => handleArrayToggle('aspects', aspect)}
              >
                {aspect}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
