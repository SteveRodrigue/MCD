import React from 'react';
import { getLoadedContent } from '../../../data/content/store';
import type { PackState } from '../../../data/content/types';
import { ThemedButton } from '../../theme/kit/controls';
import { useModalStyle } from '../../theme/useModalStyle';
import { FanProjectNotice } from './FanProjectNotice';

const STATE_LABEL: Record<PackState, string> = {
  playable: 'Playable',
  'data-only': 'Data only',
  'needs-pack': 'Needs pack',
  failed: 'Failed',
};

interface ContentScreenProps {
  onBack: () => void;
}

/** Every pack found on disk with its state and, when it did not load, the loader's reason. */
export const ContentScreen: React.FC<ContentScreenProps> = ({ onBack }) => {
  const { style } = useModalStyle();
  const { descriptions } = getLoadedContent();

  return (
    <div className="max-w-4xl w-full mx-auto my-6 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bangers text-3xl md:text-4xl text-comic-red tracking-wide">CONTENT</h1>
        <ThemedButton variant="secondary" onClick={onBack}>
          Back
        </ThemedButton>
      </div>
      <FanProjectNotice />
      <p className={`text-sm ${style.muted}`}>
        Enable a pack by adding its id to <code>enabledPacks</code> in{' '}
        <code>content/config.json</code> and reloading. Data only: cards but no supplemental data,
        or not enabled.
      </p>
      {descriptions.length === 0 ? (
        <p className={`p-4 ${style.panel} ${style.text}`}>
          No pack folders found in <code>content/packs/</code>. Run{' '}
          <code>npm run content:sync</code>.
        </p>
      ) : (
        <ul className={`divide-y divide-current/20 ${style.panel} ${style.text}`}>
          {descriptions.map((pack) => (
            <li key={pack.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-3">
              <span className="font-comic text-lg">{pack.name}</span>
              <span className={`text-xs ${style.muted}`}>{pack.id}</span>
              <span className={`px-2 py-0.5 text-xs font-bold uppercase ${style.chip}`}>
                {STATE_LABEL[pack.state]}
              </span>
              <span className={`text-xs ${style.muted}`}>
                {pack.enabled ? 'enabled' : 'not enabled'}
              </span>
              {pack.reason && <span className="w-full text-sm">{pack.reason}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
