import React from 'react';
import type { DynamicValueSource } from '../../../engine/models/abilities';

interface DynamicValueBuilderProps {
  label: string;
  value: number | DynamicValueSource | undefined;
  onChange: (val: number | DynamicValueSource | undefined) => void;
  description?: string;
}

const FROM_SOURCES = [
  'INTERCEPTED_VALUE',
  'PREVIOUS_RESULT',
  'DISCARDED_COUNT',
  'COUNTERS',
  'STAT_VALUE',
  'ENTITY_COUNT',
  'CARD_ATTRIBUTE',
] as const;

export const DynamicValueBuilder: React.FC<DynamicValueBuilderProps> = ({
  label,
  value,
  onChange,
  description,
}) => {
  const isDynamic = typeof value === 'object' && value !== null;
  const numValue = typeof value === 'number' ? value : 1;
  const sourceValue: DynamicValueSource = isDynamic
    ? (value as DynamicValueSource)
    : { from: 'PREVIOUS_RESULT' };

  const handleToggleMode = (dynamic: boolean) => {
    if (dynamic) {
      onChange({ from: 'PREVIOUS_RESULT' });
    } else {
      onChange(1);
    }
  };

  return (
    <div className="space-y-2 rounded border border-gray-700 bg-gray-800/50 p-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-200">{label}</label>
        <div className="flex items-center space-x-2 text-xs">
          <button
            type="button"
            className={`px-2 py-1 rounded transition-colors ${
              !isDynamic ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            onClick={() => handleToggleMode(false)}
          >
            Fixed Number
          </button>
          <button
            type="button"
            className={`px-2 py-1 rounded transition-colors ${
              isDynamic ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            onClick={() => handleToggleMode(true)}
          >
            Dynamic Formula
          </button>
        </div>
      </div>

      {description && <p className="text-xs text-gray-400">{description}</p>}

      {!isDynamic ? (
        <div>
          <input
            type="number"
            value={numValue}
            onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
            className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
          />
        </div>
      ) : (
        <div className="space-y-3 pt-2 border-t border-gray-700/60">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1">
              Formula Source (from)
            </label>
            <select
              value={sourceValue.from}
              onChange={(e) =>
                onChange({
                  ...sourceValue,
                  from: e.target.value as any,
                })
              }
              className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
            >
              {FROM_SOURCES.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>

          {sourceValue.from === 'STAT_VALUE' && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Character Stat</label>
              <select
                value={sourceValue.stat || 'ATTACK'}
                onChange={(e) =>
                  onChange({
                    ...sourceValue,
                    stat: e.target.value as any,
                  })
                }
                className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="ATTACK">ATTACK (Hero ATK)</option>
                <option value="THWART">THWART (Hero THW)</option>
                <option value="DEFENSE">DEFENSE (Hero DEF)</option>
                <option value="RECOVERY">RECOVERY (Hero REC)</option>
                <option value="SUFFERED_DAMAGE">SUFFERED_DAMAGE (Current Damage)</option>
              </select>
            </div>
          )}

          {sourceValue.from === 'COUNTERS' && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Counter Type</label>
              <input
                type="text"
                value={sourceValue.counterType || ''}
                placeholder="e.g. all_purpose, snoop, web"
                onChange={(e) =>
                  onChange({
                    ...sourceValue,
                    counterType: e.target.value || undefined,
                  })
                }
                className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          )}

          {sourceValue.from === 'CARD_ATTRIBUTE' && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Card Attribute</label>
              <select
                value={sourceValue.attribute || 'PRINTED_RESOURCES'}
                onChange={(e) =>
                  onChange({
                    ...sourceValue,
                    attribute: e.target.value as any,
                  })
                }
                className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="PRINTED_RESOURCES">PRINTED_RESOURCES</option>
                <option value="PRINTED_COST">PRINTED_COST</option>
                <option value="BOOST_ICONS">BOOST_ICONS</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Multiplier</label>
              <input
                type="number"
                value={sourceValue.multiplier ?? 1}
                onChange={(e) =>
                  onChange({
                    ...sourceValue,
                    multiplier: parseFloat(e.target.value) || 1,
                  })
                }
                className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Offset</label>
              <input
                type="number"
                value={sourceValue.offset ?? 0}
                onChange={(e) =>
                  onChange({
                    ...sourceValue,
                    offset: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
