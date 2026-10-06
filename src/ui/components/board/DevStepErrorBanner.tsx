import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { GameLogEntry } from '../../../engine/models';

interface DevStepErrorBannerProps {
  logs: GameLogEntry[];
  devMode: boolean;
}

/**
 * Dev Mode only: surfaces the latest `engine.stepError` log entry (#225) so testers cannot miss
 * an ability step that failed. Dismissing hides the entries seen so far; a newer one reappears.
 */
export const DevStepErrorBanner: React.FC<DevStepErrorBannerProps> = ({ logs, devMode }) => {
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  if (!devMode) return null;

  const latest = [...logs].reverse().find((entry) => entry.key === 'engine.stepError');
  if (!latest || latest.id === dismissedId) return null;

  return (
    <div
      role="alert"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] max-w-xl flex items-start gap-3 bg-yellow-300 border-4 border-comic-black shadow-comic-lg px-4 py-3 font-bold text-comic-black"
    >
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="text-sm">
        <div className="uppercase tracking-wide">Dev Mode: ability step failed</div>
        <div className="font-mono font-normal break-words">{latest.text}</div>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissedId(latest.id)}
        className="shrink-0 hover:bg-yellow-400 border-2 border-comic-black p-0.5"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default DevStepErrorBanner;
