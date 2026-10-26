import React from 'react';
import { X } from 'lucide-react';

export interface ChipSectionProps {
  title: string;
  testId: string;
  removeTestId: string;
  onRemove: () => void;
  children: React.ReactNode;
}

/** The frame of a field revealed by a `ChipBar` chip: a titled box with a remove control. */
export const ChipSection: React.FC<ChipSectionProps> = ({
  title,
  testId,
  removeTestId,
  onRemove,
  children,
}) => (
  <div
    data-testid={testId}
    className="bg-yellow-50/50 p-2 border-2 border-black rounded-sm shadow-comic-xs space-y-1.5"
  >
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-bold uppercase text-gray-700">{title}</span>
      <button
        type="button"
        data-testid={removeTestId}
        title={`Remove ${title}`}
        onClick={onRemove}
        className="p-0.5 text-gray-400 hover:text-comic-red cursor-pointer rounded-sm hover:bg-red-50 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
    {children}
  </div>
);
