import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CycleOption {
  value: string;
  label: string;
}

export interface CycleGroup {
  /** Group heading in the list; omit for ungrouped options. */
  label?: string;
  options: readonly CycleOption[];
}

/** An optional size control shown at the right of the picker's label: smaller, the current change (click to clear), larger. */
export interface CycleSize {
  /** The current change, already formatted, e.g. "+2". */
  value: string;
  isChanged: boolean;
  atMin: boolean;
  atMax: boolean;
  onStep: (direction: 1 | -1) => void;
  onClear: () => void;
}

export interface CyclePickerProps {
  /** Accessible name of the list, e.g. "Headlines font". The buttons read "Previous headlines font". */
  name: string;
  /** Short visible label above the picker. */
  label: string;
  hint?: string;
  /** Key that cycles this picker, shown next to the label. */
  shortcut?: string;
  value: string;
  groups: readonly CycleGroup[];
  onChange: (value: string) => void;
  onStep: (direction: 1 | -1) => void;
  disabled?: boolean;
  size?: CycleSize;
}

const stepButton =
  'p-1.5 rounded-lg border-2 border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-not-allowed';

const sizeButton =
  'w-5 h-5 rounded-sm border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer text-xs font-black leading-none disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * The lab's cycling choice: previous, a list, next. Used for the fonts and for the style, kit and
 * modal, so every choice in the lab works the same way and has a key.
 */
export const CyclePicker: React.FC<CyclePickerProps> = ({
  name,
  label,
  hint,
  shortcut,
  value,
  groups,
  onChange,
  onStep,
  disabled = false,
  size,
}) => (
  <div role="group" aria-label={name} className="space-y-1">
    <div className="flex items-center justify-between gap-2">
      <span title={hint} className="text-[10px] font-black uppercase text-slate-300">
        {label}
      </span>
      <div className="flex items-center gap-1">
        {size && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label={`Smaller ${name.toLowerCase()}`}
              title="Smaller text, 1px at a time"
              disabled={size.atMin}
              onClick={() => size.onStep(-1)}
              className={sizeButton}
            >
              -
            </button>
            <button
              type="button"
              aria-label={`Clear the size of ${name.toLowerCase()}`}
              title="Size change in px. Click to clear."
              disabled={!size.isChanged}
              onClick={size.onClear}
              className="min-w-8 h-5 rounded-sm border border-slate-600 bg-slate-900 text-[10px] font-black text-comic-yellow cursor-pointer disabled:text-slate-400 disabled:cursor-default"
            >
              {size.value}px
            </button>
            <button
              type="button"
              aria-label={`Larger ${name.toLowerCase()}`}
              title="Larger text, 1px at a time"
              disabled={size.atMax}
              onClick={() => size.onStep(1)}
              className={sizeButton}
            >
              +
            </button>
          </div>
        )}
        {shortcut && (
          <kbd className="px-1 border border-slate-500 rounded-sm text-[10px] text-slate-400">
            {shortcut}
          </kbd>
        )}
      </div>
    </div>
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`Previous ${name.toLowerCase()}`}
        disabled={disabled}
        onClick={() => onStep(-1)}
        className={stepButton}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <select
        aria-label={name}
        title={hint}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-slate-800 text-slate-100 border-2 border-slate-600 rounded-lg px-2 py-1.5 text-xs font-bold"
      >
        {groups.map((group, i) =>
          group.label ? (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ) : (
            group.options.map((o) => (
              <option key={`${i}-${o.value}`} value={o.value}>
                {o.label}
              </option>
            ))
          ),
        )}
      </select>
      <button
        type="button"
        aria-label={`Next ${name.toLowerCase()}`}
        disabled={disabled}
        onClick={() => onStep(1)}
        className={stepButton}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);
