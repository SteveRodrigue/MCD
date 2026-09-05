import React from 'react';
import { AlignLeft, AlertCircle } from 'lucide-react';

interface RawJsonEditorProps {
  value: string;
  onChange: (val: string) => void;
  jsonSyntaxError: string | null;
  onFormat: () => void;
}

export const RawJsonEditor: React.FC<RawJsonEditorProps> = ({
  value,
  onChange,
  jsonSyntaxError,
  onFormat,
}) => {
  return (
    <div className="flex flex-col h-full space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-700 font-comic">
          Edit declarative supplemental JSON directly:
        </span>
        <button
          type="button"
          onClick={onFormat}
          className="flex items-center gap-1 text-[11px] font-bold bg-white hover:bg-gray-100 text-black px-2 py-0.5 border border-black rounded shadow-comic-xs cursor-pointer active:scale-95 transition-transform"
        >
          <AlignLeft className="w-3 h-3" />
          <span>Format JSON</span>
        </button>
      </div>

      {jsonSyntaxError && (
        <div className="bg-red-100 border border-comic-red p-2 rounded text-comic-red text-xs font-mono flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>JSON Syntax Error: {jsonSyntaxError}</span>
        </div>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        rows={20}
        className="w-full flex-1 bg-gray-950 text-green-400 font-mono text-xs p-3 border-2 border-black rounded shadow-inner focus:outline-none focus:ring-2 focus:ring-comic-red resize-y leading-relaxed"
      />
    </div>
  );
};
