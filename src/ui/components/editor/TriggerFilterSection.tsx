import React from 'react';
import { Crosshair, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import { TriggerFilterSchema } from '../../../data/supplemental/schema';
import { ZodSchemaForm } from './schema-form/ZodSchemaForm';
import { kebabCase } from './schema-form/test-id';

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
        <div className="pt-2 border-t border-gray-300">
          <ZodSchemaForm
            schema={TriggerFilterSchema}
            value={filter}
            onChange={onChange}
            disclosure="all"
            emptyLabel="Any"
            testId={(path, extra) =>
              `trigger-${path.map(kebabCase).join('-')}${extra ? `-${extra}` : ''}-${abilityIndex}`
            }
          />
        </div>
      )}
    </div>
  );
};
