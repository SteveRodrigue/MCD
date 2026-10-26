import React from 'react';
import type { ZodType } from 'zod';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import {
  defOf,
  getShape,
  introspectObjectSchema,
  type FieldDescriptor,
} from '../../../../data/supplemental/schema-introspector';
import { UniversalCardFilterBuilder } from '../UniversalCardFilterBuilder';
import { DynamicValueBuilder } from '../DynamicValueBuilder';
import { CardLocationSelectorForm } from '../CardLocationSelectorForm';
import { ChipBar } from './ChipBar';
import { kebabCase } from './test-id';

type FormValue = Record<string, any>;

export interface ZodSchemaFormProps {
  /** A Zod object schema; each key becomes one field (see `introspectObjectSchema`). */
  schema: ZodType;
  value: FormValue | undefined;
  /** Receives the next value, or `undefined` when nothing is set (unset fields are never emitted). */
  onChange: (next: FormValue | undefined) => void;
  /** Builds the `data-testid` of a field (`extra` names a sub-control: `add`, `remove`, an option). */
  testId?: (path: string[], extra?: string) => string;
  /**
   * `progressive` shows primary, required and populated fields and offers the rest as `+ Add`
   * chips. `all` shows every field.
   */
  disclosure?: 'progressive' | 'all';
  /** Keys that a parent component renders itself. */
  hiddenKeys?: readonly string[];
  /** Keys shown disabled (for example `discardSelf` on an event). */
  disabledKeys?: readonly string[];
  /** Label of the blank option of select fields. */
  emptyLabel?: string;
  /** Path of this form inside a parent form (nested objects only). */
  pathPrefix?: string[];
}

const defaultTestId = (path: string[], extra?: string) =>
  ['field', ...path.map(kebabCase), ...(extra ? [extra] : [])].join('-');

const isPopulated = (value: unknown): boolean =>
  value !== undefined &&
  value !== null &&
  value !== '' &&
  !(Array.isArray(value) && value.length === 0);

const WRAPPER_TYPES = new Set(['optional', 'nullable', 'default', 'readonly', 'catch', 'prefault']);

/** The schema under optional/nullable/default/lazy wrappers. */
function peel(schema: ZodType): ZodType {
  let current = schema;
  for (let depth = 0; depth < 20; depth++) {
    const def = defOf(current);
    if (!def) return current;
    if (WRAPPER_TYPES.has(def.type) && def.innerType) current = def.innerType;
    else if (def.type === 'lazy' && def.getter) current = def.getter();
    else return current;
  }
  return current;
}

const LABEL_CLASS = 'block text-[9px] uppercase font-bold text-gray-500 mb-0.5';
const SELECT_CLASS = 'w-full bg-white border border-black p-1 text-[11px] font-mono';
const INPUT_CLASS = 'w-full bg-white border border-black p-1 text-xs rounded-sm';

interface FieldContext {
  field: FieldDescriptor;
  childSchema: ZodType;
  value: any;
  set: (value: any) => void;
  path: string[];
  testId: (path: string[], extra?: string) => string;
  emptyLabel: string;
  disabled: boolean;
}

const FieldLabel: React.FC<{ field: FieldDescriptor }> = ({ field }) => (
  <label className={LABEL_CLASS} title={field.description}>
    {field.label}
  </label>
);

const JsonField: React.FC<FieldContext> = ({ field, value, set, path, testId }) => {
  const external = value === undefined ? '' : JSON.stringify(value, null, 2);
  const [text, setText] = React.useState(external);
  const [invalid, setInvalid] = React.useState(false);
  const lastEmitted = React.useRef(external);

  React.useEffect(() => {
    if (external !== lastEmitted.current) {
      lastEmitted.current = external;
      setText(external);
      setInvalid(false);
    }
  }, [external]);

  return (
    <div className="col-span-full">
      <FieldLabel field={field} />
      <textarea
        data-testid={testId(path)}
        value={text}
        rows={4}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (next.trim() === '') {
            setInvalid(false);
            lastEmitted.current = '';
            set(undefined);
            return;
          }
          try {
            const parsed = JSON.parse(next);
            setInvalid(false);
            lastEmitted.current = JSON.stringify(parsed, null, 2);
            set(parsed);
          } catch {
            setInvalid(true);
          }
        }}
        className={`w-full bg-white border p-1 text-[11px] font-mono rounded ${
          invalid ? 'border-comic-red ring-1 ring-red-300' : 'border-black'
        }`}
      />
      {invalid && <span className="text-[10px] font-bold text-comic-red">Invalid JSON</span>}
    </div>
  );
};

const StringListField: React.FC<FieldContext> = ({ field, value, set, path, testId }) => (
  <div className="col-span-full">
    <FieldLabel field={field} />
    <input
      type="text"
      data-testid={testId(path)}
      value={Array.isArray(value) ? value.join(', ') : ''}
      onChange={(e) => {
        const items = e.target.value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        set(items.length > 0 ? items : undefined);
      }}
      placeholder={field.placeholder}
      className={INPUT_CLASS}
    />
  </div>
);

const CardFilterField: React.FC<FieldContext> = ({ field, value, set, path, testId }) => {
  const [open, setOpen] = React.useState(isPopulated(value));
  return (
    <div className="col-span-full rounded-sm border border-black bg-white p-2 space-y-1.5">
      <div
        onClick={() => setOpen(!open)}
        data-testid={testId(path, 'toggle')}
        className="flex items-center justify-between cursor-pointer select-none hover:bg-yellow-50 p-1 rounded-sm"
      >
        <span className="text-[10px] font-bold uppercase text-gray-700 flex items-center gap-1">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-gray-600" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
          )}
          <span title={field.description}>{field.label}</span>
        </span>
        <span className="bg-comic-yellow border border-black px-1.5 py-0.5 rounded-sm text-[9px] font-bold text-black">
          {isPopulated(value) ? 'Configured' : 'None'}
        </span>
      </div>
      {open && (
        <div className="pt-2 border-t border-gray-200">
          <UniversalCardFilterBuilder
            label={field.label}
            filter={value}
            onChange={(next) => set(next)}
            isSubBranch={true}
          />
        </div>
      )}
    </div>
  );
};

const NumberField: React.FC<FieldContext> = ({ field, childSchema, value, set, path, testId }) => {
  const core = peel(childSchema) as ZodType & { minValue?: number | null };
  const min =
    typeof core.minValue === 'number' && Number.isFinite(core.minValue) ? core.minValue : undefined;
  return (
    <div>
      <FieldLabel field={field} />
      <input
        type="number"
        min={min}
        data-testid={testId(path)}
        value={typeof value === 'number' ? value : ''}
        onChange={(e) => {
          const parsed = parseInt(e.target.value, 10);
          if (Number.isNaN(parsed)) set(undefined);
          else set(min !== undefined ? Math.max(min, parsed) : parsed);
        }}
        placeholder={
          field.placeholder ?? (field.defaultValue !== undefined ? String(field.defaultValue) : '')
        }
        className={`${INPUT_CLASS} font-bold`}
      />
    </div>
  );
};

const MultiEnumField: React.FC<FieldContext> = ({ field, value, set, path, testId }) => {
  const selected: string[] = Array.isArray(value)
    ? value
    : value
      ? [value]
      : Array.isArray(field.defaultValue)
        ? field.defaultValue
        : [];
  return (
    <div className="col-span-full">
      <label className={`${LABEL_CLASS} mb-1`} title={field.description}>
        {field.label}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {field.options?.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              data-testid={testId(path, option)}
              onClick={() => {
                const next = active ? selected.filter((v) => v !== option) : [...selected, option];
                set(next.length > 0 ? next : undefined);
              }}
              className={`px-2 py-0.5 text-[10px] font-bold rounded border border-black transition-all cursor-pointer ${
                active
                  ? 'bg-comic-accent text-white shadow-comic-xs'
                  : 'bg-gray-100 text-black hover:bg-gray-200'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const FieldRenderer: React.FC<FieldContext & { renderNested: () => React.ReactNode }> = (props) => {
  const { field, value, set, path, testId, emptyLabel, disabled, renderNested } = props;

  if (field.widget === 'card-filter') return <CardFilterField {...props} />;

  if (field.widget === 'card-location') {
    return (
      <div className="col-span-full">
        <CardLocationSelectorForm
          value={value}
          onChange={(next) => set(next)}
          label={field.label}
          testIdPrefix={testId(path)}
        />
      </div>
    );
  }

  if (field.allowDynamic) {
    return (
      <div className="col-span-full">
        <DynamicValueBuilder
          label={field.label}
          value={value}
          allowAll={field.allowAll}
          description={field.description}
          onChange={(next) => set(next)}
        />
      </div>
    );
  }

  if (field.widget === 'string-list') return <StringListField {...props} />;
  if (field.widget === 'multi-enum') return <MultiEnumField {...props} />;

  switch (field.kind) {
    case 'boolean':
      return (
        <label
          className="flex items-center gap-1.5 text-xs font-bold text-gray-800 cursor-pointer pt-3"
          title={field.description}
        >
          <input
            type="checkbox"
            data-testid={testId(path)}
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => {
              const checked = e.target.checked;
              set(checked || field.defaultValue === true ? checked : undefined);
            }}
            className="accent-black"
          />
          <span>{field.label}</span>
        </label>
      );
    case 'multi-enum':
      return <MultiEnumField {...props} />;
    case 'enum':
    case 'literal':
      return (
        <div>
          <FieldLabel field={field} />
          <select
            data-testid={testId(path)}
            value={value !== undefined && value !== null ? String(value) : ''}
            disabled={disabled}
            onChange={(e) => set(e.target.value || undefined)}
            className={`${SELECT_CLASS} font-bold`}
          >
            {(!field.required || !isPopulated(value)) && <option value="">{emptyLabel}</option>}
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );
    case 'number':
      return <NumberField {...props} />;
    case 'string':
      return (
        <div>
          <FieldLabel field={field} />
          <input
            type="text"
            data-testid={testId(path)}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => set(e.target.value || undefined)}
            placeholder={field.placeholder ?? ''}
            className={INPUT_CLASS}
          />
        </div>
      );
    case 'object':
      return <>{renderNested()}</>;
    default:
      return <JsonField {...props} />;
  }
};

/**
 * Renders any Zod object schema as a form (Card Editor re-architecture, Phase 3). Field widgets come
 * from the introspector's `FieldDescriptor`s; the specialized editors (`DynamicValueBuilder`,
 * `UniversalCardFilterBuilder`, `CardLocationSelectorForm`) are used where a descriptor points at
 * their schemas. Unset optional fields are removed from the emitted object.
 */
export const ZodSchemaForm: React.FC<ZodSchemaFormProps> = ({
  schema,
  value,
  onChange,
  testId = defaultTestId,
  disclosure = 'progressive',
  hiddenKeys = [],
  disabledKeys = [],
  emptyLabel = 'Default (Contextual)',
  pathPrefix = [],
}) => {
  const fields = React.useMemo(() => introspectObjectSchema(schema), [schema]);
  const shape = React.useMemo(() => getShape(schema), [schema]);
  const [revealed, setRevealed] = React.useState<ReadonlySet<string>>(new Set());
  const current: FormValue = value ?? {};

  const setField = (key: string, next: unknown) => {
    const updated: FormValue = { ...current };
    if (next === undefined || next === '') delete updated[key];
    else updated[key] = next;
    onChange(Object.keys(updated).length > 0 ? updated : undefined);
  };

  const addField = (key: string) => {
    const field = fields.find((f) => f.key === key);
    setRevealed(new Set([...revealed, key]));
    if (field && field.defaultValue !== undefined && field.defaultValue !== false) {
      setField(key, field.defaultValue);
    }
  };

  const removeField = (key: string) => {
    setRevealed(new Set([...revealed].filter((k) => k !== key)));
    setField(key, undefined);
  };

  const candidates = fields.filter((f) => !hiddenKeys.includes(f.key));
  const isShown = (f: FieldDescriptor) =>
    disclosure === 'all' ||
    f.primary === true ||
    f.required ||
    isPopulated(current[f.key]) ||
    current[f.key] === false ||
    revealed.has(f.key);
  const shown = candidates.filter(isShown);
  const chips = candidates.filter((f) => !isShown(f));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {shown.map((field) => {
        const path = [...pathPrefix, field.key];
        const removable = disclosure === 'progressive' && !field.primary && !field.required;
        const childSchema = shape[field.key];
        const nestedCore = peel(childSchema);
        const isNestedObject = field.kind === 'object' && defOf(nestedCore)?.type === 'object';
        const set = (next: unknown) => setField(field.key, next);
        return (
          <div
            key={field.key}
            className={`relative ${
              field.kind === 'object' || field.widget === 'card-filter' ? 'col-span-full' : ''
            } ${removable && field.kind !== 'boolean' ? 'pr-5' : ''}`}
          >
            <FieldRenderer
              field={field}
              childSchema={childSchema}
              value={current[field.key]}
              set={set}
              path={path}
              testId={testId}
              emptyLabel={emptyLabel}
              disabled={disabledKeys.includes(field.key)}
              renderNested={() =>
                isNestedObject ? (
                  <div className="rounded-sm border border-black bg-white/80 p-2 space-y-1.5 shadow-comic-xs">
                    <span
                      className="text-[9px] uppercase font-bold text-gray-700"
                      title={field.description}
                    >
                      {field.label}
                    </span>
                    <ZodSchemaForm
                      schema={nestedCore}
                      value={current[field.key]}
                      onChange={set}
                      testId={testId}
                      disclosure="all"
                      emptyLabel={emptyLabel}
                      pathPrefix={path}
                    />
                  </div>
                ) : (
                  <JsonField
                    field={field}
                    childSchema={childSchema}
                    value={current[field.key]}
                    set={set}
                    path={path}
                    testId={testId}
                    emptyLabel={emptyLabel}
                    disabled={false}
                  />
                )
              }
            />
            {removable && (
              <button
                type="button"
                data-testid={testId(path, 'remove')}
                title={`Remove ${field.label}`}
                onClick={() => removeField(field.key)}
                className="absolute top-0 right-0 p-0.5 text-gray-400 hover:text-comic-red cursor-pointer rounded-sm hover:bg-red-50 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
      <ChipBar
        items={chips.map((field) => ({
          key: field.key,
          label: field.label,
          title: field.description,
          testId: testId([...pathPrefix, field.key], 'add'),
        }))}
        onAdd={addField}
      />
    </div>
  );
};
