import React, { useState } from 'react';
import { ThemedButton } from '../../theme/kit/controls';
import { useModalStyle } from '../../theme/useModalStyle';
import { FailedPacksNotice } from './FailedPacksNotice';
import { FanProjectNotice } from './FanProjectNotice';

export const SYNC_COMMAND = 'npm run content:sync';
const DISABLED_REASON = 'Needs the desktop app or browser import, which are not built yet.';

interface WelcomeScreenProps {
  onOpenContent: () => void;
}

/** Shown instead of Mission Control when no scenario is loaded (zero packs enabled). */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onOpenContent }) => {
  const { style } = useModalStyle();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(SYNC_COMMAND);
    setCopied(true);
  };

  return (
    <div className="max-w-3xl w-full mx-auto my-6 p-4 space-y-5">
      <div className="text-center">
        <div className="inline-block bg-comic-yellow border-comic border-comic-black px-6 py-1.5 font-bangers text-xl md:text-2xl tracking-wider text-comic-red -rotate-1 mb-2">
          WELCOME TO MISSION CONTROL
        </div>
        <h1 className="font-bangers text-4xl md:text-5xl text-comic-red tracking-wide">
          NO CONTENT YET
        </h1>
      </div>

      <FanProjectNotice />
      <FailedPacksNotice />

      <div className={`p-5 space-y-4 ${style.panel} ${style.text}`}>
        <p className="font-comic text-lg">
          The game has no cards, heroes or scenarios loaded. Content comes in packs. Pick one way to
          get some:
        </p>

        <section className="space-y-1">
          <h2 className="font-comic text-xl">Sync official data</h2>
          <p className="text-sm">
            Run this in a terminal in the project folder, then add the pack ids you want to{' '}
            <code>enabledPacks</code> in <code>content/config.json</code> and reload.
          </p>
          <div className="flex items-center gap-2">
            <code className={`px-2 py-1 text-sm ${style.chip}`}>{SYNC_COMMAND}</code>
            <ThemedButton variant="secondary" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </ThemedButton>
          </div>
        </section>

        <section className="space-y-1">
          <h2 className="font-comic text-xl">Add a content folder</h2>
          <ThemedButton variant="secondary" disabled title={DISABLED_REASON}>
            Add content folder
          </ThemedButton>
          <p className={`text-xs ${style.muted}`}>{DISABLED_REASON}</p>
        </section>

        <section className="space-y-1">
          <h2 className="font-comic text-xl">Import a pack (zip)</h2>
          <ThemedButton variant="secondary" disabled title={DISABLED_REASON}>
            Import pack (zip)
          </ThemedButton>
          <p className={`text-xs ${style.muted}`}>{DISABLED_REASON}</p>
        </section>

        <p className={`text-sm ${style.muted}`}>
          To make your own pack, read <code>docs/creators/README.md</code>.
        </p>
      </div>

      <div className="text-center">
        <ThemedButton variant="primary" onClick={onOpenContent}>
          See the packs on disk
        </ThemedButton>
      </div>
    </div>
  );
};
