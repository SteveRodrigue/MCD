import React from 'react';
import { Crosshair, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

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

          {/* damageSourceType */}
          <div>
            <label className="block text-[9px] uppercase font-bold text-gray-600 mb-0.5">
              Damage Source
            </label>
            <select
              data-testid={`trigger-damage-source-type-${abilityIndex}`}
              value={currentFilter.damageSourceType || ''}
              onChange={(e) => handleFieldChange('damageSourceType', e.target.value || undefined)}
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
              data-testid={`trigger-defeat-entity-type-${abilityIndex}`}
              value={currentFilter.defeatEntityType || ''}
              onChange={(e) => handleFieldChange('defeatEntityType', e.target.value || undefined)}
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
              data-testid={`trigger-form-change-direction-${abilityIndex}`}
              value={currentFilter.formChangeDirection || ''}
              onChange={(e) =>
                handleFieldChange('formChangeDirection', e.target.value || undefined)
              }
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
                data-testid={`trigger-is-engaged-${abilityIndex}`}
                checked={Boolean(currentFilter.isEngaged)}
                onChange={(e) => handleFieldChange('isEngaged', e.target.checked || undefined)}
                className="accent-black"
              />
              <span>Enemy Engaged With You</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-gray-800">
              <input
                type="checkbox"
                data-testid={`trigger-defeat-by-attack-${abilityIndex}`}
                checked={Boolean(currentFilter.defeatByAttack)}
                onChange={(e) => handleFieldChange('defeatByAttack', e.target.checked || undefined)}
                className="accent-black"
              />
              <span>Defeated by Attack</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
