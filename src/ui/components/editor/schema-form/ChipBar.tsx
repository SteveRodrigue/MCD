import React from 'react';
import { Plus } from 'lucide-react';

export interface ChipBarItem {
  key: string;
  label: string;
  testId?: string;
  title?: string;
}

export interface ChipBarProps {
  items: readonly ChipBarItem[];
  onAdd: (key: string) => void;
  testId?: string;
}

/** A row of `+ Add ...` chips: the shared progressive-disclosure control of the schema-driven editor. */
export const ChipBar: React.FC<ChipBarProps> = ({ items, onAdd, testId }) => {
  if (items.length === 0) return null;
  return (
    <div data-testid={testId} className="flex flex-wrap items-center gap-1.5 col-span-full">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          data-testid={item.testId}
          title={item.title}
          onClick={() => onAdd(item.key)}
          className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold text-black bg-white border-2 border-black rounded-sm shadow-comic-xs cursor-pointer hover:bg-comic-yellow active:scale-95 transition-transform"
        >
          <Plus className="w-2.5 h-2.5" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};
