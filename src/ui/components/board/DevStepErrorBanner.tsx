import React, { useState } from 'react';
import { ModalLayer } from '../layout/ModalLayer';
import { useModalStyle } from '../../theme/useModalStyle';
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
  const { style } = useModalStyle();

  const [dismissedId, setDismissedId] = useState<string | null>(null);
  if (!devMode) return null;

  const latest = [...logs].reverse().find((entry) => entry.key === 'engine.stepError');
  if (!latest || latest.id === dismissedId) return null;

  return (
    <ModalLayer
      layer="banner"
      role="alert"
      className={`top-4 left-1/2 -translate-x-1/2 max-w-xl flex items-start gap-3 px-4 py-3 font-bold ${style.frame} ${style.text}`}
    >
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="text-sm">
        <div className="uppercase tracking-wide">Dev Mode: ability step failed</div>
        <div className="font-mono font-normal wrap-break-word">{latest.text}</div>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissedId(latest.id)}
        className={`shrink-0 p-0.5 cursor-pointer ${style.btnMove}`}
      >
        <X className="w-4 h-4" />
      </button>
    </ModalLayer>
  );
};

export default DevStepErrorBanner;
