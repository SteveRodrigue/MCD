import React from 'react';
import { X, BookOpen } from 'lucide-react';
import { GameLogEntry } from '../../../engine/models';

interface CombatLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: GameLogEntry[];
}

export const CombatLogDrawer: React.FC<CombatLogDrawerProps> = ({
  isOpen,
  onClose,
  logs,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white border-l-4 border-comic-black shadow-comic-lg z-50 flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="bg-comic-yellow p-4 border-b-3 border-comic-black flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-comic-black" />
          <h2 className="font-comic text-xl text-comic-black">Combat Log & History</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded border-2 border-comic-black bg-white hover:bg-rose-50 text-comic-red shadow-comic-sm"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Log Entries Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-900 text-xs font-mono">
        {logs.map((entry, idx) => (
          <div
            key={entry.id || idx}
            className="p-2 rounded bg-slate-800 border border-slate-700 space-y-1"
          >
            <div className="flex items-center justify-between text-slate-400 text-[10px]">
              <span className="text-slate-500">#{idx + 1}</span>
              {entry.phase && <span className="uppercase text-sky-400 font-bold">{entry.phase}</span>}
            </div>

            {/* Onomatopoeia Banner */}
            {entry.onomatopoeia && (
              <div className="text-comic-yellow font-bold font-comic text-sm">
                💥 [{entry.onomatopoeia}]
              </div>
            )}

            {/* Event Key */}
            <div className="text-emerald-400 font-semibold">{entry.key}</div>

            {/* Params JSON */}
            {entry.params && (
              <pre className="text-slate-300 text-[11px] overflow-x-auto bg-slate-950/60 p-1.5 rounded">
                {JSON.stringify(entry.params, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 bg-amber-50 border-t-2 border-comic-black text-center text-xs font-bold text-slate-600">
        Total Events Logged: {logs.length}
      </div>
    </div>
  );
};

export default CombatLogDrawer;
