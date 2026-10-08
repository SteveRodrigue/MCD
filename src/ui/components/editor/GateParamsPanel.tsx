import React from 'react';
import { GATE_REGISTRY, GateFieldMeta, StepGate } from '../../../data/supplemental/gate-params';

export interface GateParamsPanelProps {
  gate: StepGate;
  gateParams: Record<string, any>;
  onChange: (key: string, value: any) => void;
  availableStepIds?: string[];
  abilityIndex?: number;
  stepIndex?: number;
}

const GATE_TITLES: Partial<Record<StepGate, string>> = {
  THEN: 'THEN Parameters',
  IF_RESULT: 'IF_RESULT Parameters',
  IF_FORM: 'Form Gate Parameters',
  IF_PLAYER_HAS_TRAIT: 'Trait Gate Parameters',
  IF_ZONE_EMPTY: 'Zone Empty Parameters',
  IF_CARD_IN_PLAY: 'Card Gate Parameters',
  IF_RESOURCE_MATCH: 'Resource Match Gate Parameters',
  IF_UNDEFENDED_ATTACK: 'Undefended Attack Parameters',
  IF_ACTIVATION_DEALT_DAMAGE: 'Activation Dealt Damage Parameters',
};

export const GateParamsPanel: React.FC<GateParamsPanelProps> = ({
  gate,
  gateParams = {},
  onChange,
  availableStepIds = [],
  abilityIndex = 0,
  stepIndex = 0,
}) => {
  const definition = GATE_REGISTRY[gate];
  if (!definition || definition.fields.length === 0) {
    return null;
  }

  const title = GATE_TITLES[gate] || `${gate} Parameters`;
  const nonBooleanFields = definition.fields.filter((f) => f.type !== 'boolean');
  const booleanFields = definition.fields.filter((f) => f.type === 'boolean');

  const renderField = (field: GateFieldMeta) => {
    const value = gateParams[field.key];
    const testId = `gate-param-${field.key}-${abilityIndex}-${stepIndex}`;

    switch (field.type) {
      case 'enum':
        return (
          <div key={field.key}>
            <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">
              {field.label}
              {field.required ? (
                <span className="text-comic-red ml-0.5" title="Required">
                  *
                </span>
              ) : (
                <span className="text-gray-400 font-normal ml-0.5">(Optional)</span>
              )}
            </label>
            <select
              data-testid={testId}
              value={value !== undefined ? value : ''}
              onChange={(e) => onChange(field.key, e.target.value || undefined)}
              className="w-full bg-white border border-black p-1 text-[11px] font-mono font-bold rounded"
            >
              {field.required ? (
                <option value="" disabled={Boolean(value)}>
                  Select {field.label}...
                </option>
              ) : (
                <option value="">
                  {field.key === 'attackerKind'
                    ? 'Any attacker'
                    : field.key === 'form'
                      ? 'Any form'
                      : 'None'}
                </option>
              )}
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        );

      case 'string':
        return (
          <div key={field.key}>
            <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">
              {field.label}
              {field.required ? (
                <span className="text-comic-red ml-0.5" title="Required">
                  *
                </span>
              ) : (
                <span className="text-gray-400 font-normal ml-0.5">(Optional)</span>
              )}
            </label>
            <input
              type="text"
              data-testid={testId}
              value={value !== undefined ? value : ''}
              onChange={(e) => onChange(field.key, e.target.value || undefined)}
              placeholder={
                field.key === 'trait'
                  ? 'e.g. Aerial'
                  : field.key === 'cardCode'
                    ? 'e.g. 01109'
                    : `Enter ${field.label}...`
              }
              className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
            />
          </div>
        );

      case 'number':
        return (
          <div key={field.key}>
            <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">
              {field.label}
              {field.required ? (
                <span className="text-comic-red ml-0.5" title="Required">
                  *
                </span>
              ) : (
                <span className="text-gray-400 font-normal ml-0.5">(Optional)</span>
              )}
            </label>
            <input
              type="number"
              min={1}
              data-testid={testId}
              value={value !== undefined ? value : ''}
              onChange={(e) =>
                onChange(
                  field.key,
                  e.target.value !== '' ? parseInt(e.target.value, 10) : undefined,
                )
              }
              placeholder={
                field.defaultValue !== undefined ? String(field.defaultValue) : undefined
              }
              className="w-full bg-white border border-black p-1 text-xs rounded font-bold"
            />
          </div>
        );

      case 'step':
        return (
          <div key={field.key}>
            <label className="block text-[9px] uppercase font-bold text-gray-500 mb-0.5">
              {field.label}
              {field.required ? (
                <span className="text-comic-red ml-0.5" title="Required">
                  *
                </span>
              ) : (
                <span className="text-gray-400 font-normal ml-0.5">(Optional)</span>
              )}
            </label>
            <select
              data-testid={testId}
              value={value !== undefined ? value : ''}
              onChange={(e) => onChange(field.key, e.target.value || undefined)}
              className="w-full bg-white border border-black p-1 text-[11px] font-mono font-bold rounded"
            >
              <option value="">Previous step</option>
              {availableStepIds.map((sid) => (
                <option key={sid} value={sid}>
                  {sid}
                </option>
              ))}
              {value && !availableStepIds.includes(value) && (
                <option value={value}>{value} (invalid)</option>
              )}
            </select>
          </div>
        );

      case 'boolean':
        return (
          <label
            key={field.key}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-800 cursor-pointer select-none"
          >
            <input
              type="checkbox"
              data-testid={testId}
              checked={Boolean(value)}
              onChange={(e) => onChange(field.key, e.target.checked || undefined)}
              className="rounded border-black text-black accent-black focus:ring-0"
            />
            <span>{field.label}</span>
          </label>
        );

      default:
        return null;
    }
  };

  return (
    <div className="bg-yellow-50/70 border border-yellow-300 p-2 rounded shadow-comic-xs space-y-2">
      <span className="text-[9px] uppercase font-bold text-yellow-800 block">{title}</span>

      {nonBooleanFields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {nonBooleanFields.map(renderField)}
        </div>
      )}

      {booleanFields.length > 0 && (
        <div className="flex flex-wrap gap-4 pt-1 items-center">
          {booleanFields.map(renderField)}
        </div>
      )}
    </div>
  );
};
