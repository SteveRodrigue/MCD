import React from 'react';
import { Crosshair, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { UniversalCardFilterBuilder } from './UniversalCardFilterBuilder';

export interface TriggerFilterSectionProps {
  filter?: any;
  abilityIndex?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onChange: (updatedFilter: any | undefined) => void;
  hasErrors?: boolean;
  errors?: string[];
}

export const TriggerFilterSection: React.FC<TriggerFilterSectionProps> = ({
  filter,
  abilityIndex = 0,
  isExpanded,
  onToggleExpand,
  onChange,
  hasErrors = false,
  errors = [],
}) => {
  const [internalExpanded, setInternalExpanded] = React.useState(false);
  const [isAttackerFilterExpanded, setIsAttackerFilterExpanded] = React.useState(false);

  const expanded = isExpanded !== undefined ? isExpanded : internalExpanded;
  const toggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  const currentFilter = filter || {};

  const handleFieldChange = (field: string, value: any) => {
    const updated = { ...currentFilter, [field]: value };
    if (value === undefined || value === '' || value === false) {
      delete updated[field];
    }
    onChange(Object.keys(updated).length > 0 ? updated : undefined);
  };

  return (
    <div
      data-testid={`trigger-filter-section-${abilityIndex}`}
      className={`bg-yellow-50/60 border ${
        hasErrors ? 'border-comic-red ring-2 ring-red-200' : 'border-black'
      } rounded p-2.5 space-y-2 transition-colors`}
    >
      <div
        onClick={toggleExpand}
        className="flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5 text-comic-red" />
          <span className="text-[10px] font-bold uppercase text-gray-700">
            Trigger Filter & Event Scope
          </span>
          {hasErrors && (
            <span className="flex items-center gap-0.5 text-[9px] font-bold text-comic-red bg-red-50 border border-comic-red px-1 rounded">
              <AlertCircle className="w-2.5 h-2.5" />
              <span>Issue</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-600">
          <span>{expanded ? 'Collapse' : 'Configure'}</span>
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <div className="p-1.5 bg-red-50 border border-comic-red rounded text-[10px] text-red-800 space-y-0.5">
          {errors.map((err, i) => (
            <div key={i}>• {err}</div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-gray-300">
          {/* attackerKind */}
          <div>
            <label className="block text-[9px] uppercase font-bold text-gray-600 mb-0.5">
              Attacker Kind
            </label>
            <select
              data-testid={`trigger-attacker-kind-${abilityIndex}`}
              value={currentFilter.attackerKind || ''}
              onChange={(e) => handleFieldChange('attackerKind', e.target.value || undefined)}
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
              data-testid={`trigger-target-player-scope-${abilityIndex}`}
              value={currentFilter.targetPlayerScope || ''}
              onChange={(e) => handleFieldChange('targetPlayerScope', e.target.value || undefined)}
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
              data-testid={`trigger-target-form-${abilityIndex}`}
              value={currentFilter.targetForm || ''}
              onChange={(e) => handleFieldChange('targetForm', e.target.value || undefined)}
              className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
            >
              <option value="">Any</option>
              <option value="HERO">Hero Form</option>
              <option value="ALTER_EGO">Alter-Ego Form</option>
            </select>
          </div>

          {/* targetType */}
          <div>
            <label className="block text-[9px] uppercase font-bold text-gray-600 mb-0.5">
              Target Entity Type
            </label>
            <select
              data-testid={`trigger-target-type-${abilityIndex}`}
              value={currentFilter.targetType || ''}
              onChange={(e) => handleFieldChange('targetType', e.target.value || undefined)}
              className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
            >
              <option value="">Any</option>
              <option value="VILLAIN">Villain</option>
              <option value="MINION">Minion</option>
              <option value="SCHEME">Scheme</option>
              <option value="CHARACTER">Character</option>
            </select>
          </div>

          {/* sourceCardCode */}
          <div>
            <label className="block text-[9px] uppercase font-bold text-gray-600 mb-0.5">
              Source Card Code
            </label>
            <input
              type="text"
              data-testid={`trigger-source-card-code-${abilityIndex}`}
              value={currentFilter.sourceCardCode || ''}
              onChange={(e) =>
                handleFieldChange('sourceCardCode', e.target.value.trim() || undefined)
              }
              placeholder="e.g. 01050"
              className="w-full bg-white border border-black p-1 text-xs rounded font-mono"
            />
          </div>

          {/* sourceInstanceId */}
          <div>
            <label className="block text-[9px] uppercase font-bold text-gray-600 mb-0.5">
              Source Instance ID
            </label>
            <input
              type="text"
              data-testid={`trigger-source-instance-id-${abilityIndex}`}
              value={currentFilter.sourceInstanceId || ''}
              onChange={(e) =>
                handleFieldChange('sourceInstanceId', e.target.value.trim() || undefined)
              }
              placeholder="e.g. inst_123"
              className="w-full bg-white border border-black p-1 text-xs rounded font-mono"
            />
          </div>

          {/* Checkbox: isEngaged */}
          <div className="flex items-center gap-4 col-span-1 sm:col-span-2 pt-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-800">
              <input
                type="checkbox"
                data-testid={`trigger-is-engaged-${abilityIndex}`}
                checked={Boolean(currentFilter.isEngaged)}
                onChange={(e) => handleFieldChange('isEngaged', e.target.checked || undefined)}
                className="accent-black"
              />
              <span>Enemy Engaged With You</span>
            </label>
          </div>

          {/* attackerCardFilter Sub-form */}
          <div className="col-span-full pt-1">
            <div
              data-testid={`trigger-attacker-card-filter-accordion-${abilityIndex}`}
              className="rounded border border-black bg-white p-2 space-y-1.5"
            >
              <div
                onClick={() => setIsAttackerFilterExpanded(!isAttackerFilterExpanded)}
                data-testid={`toggle-trigger-attacker-card-filter-btn-${abilityIndex}`}
                className="flex items-center justify-between cursor-pointer select-none hover:bg-yellow-50 p-1 rounded"
              >
                <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center gap-1">
                  {isAttackerFilterExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                  )}
                  <span>Attacker Card Criteria (attackerCardFilter)</span>
                </span>
                <span className="bg-comic-yellow border border-black px-1.5 py-0.2 rounded text-[9px] font-bold text-black">
                  {currentFilter.attackerCardFilter ? 'Configured' : 'None'}
                </span>
              </div>
              {isAttackerFilterExpanded && (
                <div className="pt-2 border-t border-gray-200">
                  <UniversalCardFilterBuilder
                    label="Attacker Card Criteria"
                    filter={currentFilter.attackerCardFilter}
                    onChange={(newFilter) => handleFieldChange('attackerCardFilter', newFilter)}
                    isSubBranch={true}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
