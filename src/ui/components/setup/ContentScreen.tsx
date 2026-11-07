import React, { useState } from 'react';
import { applyContent } from '../../../data/content/apply';
import { FetchDriver } from '../../../data/content/drivers/fetch';
import { ART_PACK_FAILURE_PREFIX, loadContent } from '../../../data/content/loader';
import { getActiveDriver, getLoadedContent } from '../../../data/content/store';
import type {
  ContentDriver,
  ContentWriter,
  LoadedContent,
  PackState,
} from '../../../data/content/types';
import { ThemedButton, ThemedSwitch } from '../../theme/kit/controls';
import { useModalStyle } from '../../theme/useModalStyle';
import { ArtPackSettings } from './ArtPackSettings';
import { FanProjectNotice } from './FanProjectNotice';

const STATE_LABEL: Record<PackState, string> = {
  playable: 'Playable',
  incomplete: 'Incomplete',
  'no-supplemental': 'Error',
  'needs-pack': 'Needs pack',
  failed: 'Failed',
};

/** Tag colours by state, whatever the theme: green plays, yellow is partial, orange waits for a pack, red cannot play. */
const STATE_TONE: Record<PackState, string> = {
  playable: 'bg-emerald-600 text-white',
  incomplete: 'bg-comic-yellow text-comic-black',
  'no-supplemental': 'bg-comic-red text-white',
  'needs-pack': 'bg-orange-500 text-white',
  failed: 'bg-comic-red text-white',
};

export interface ContentScreenProps {
  onBack: () => void;
  driver?: ContentDriver & ContentWriter;
}

/** Every pack found on disk with its state and, when it did not load, the loader's reason. */
export const ContentScreen: React.FC<ContentScreenProps> = ({ onBack, driver }) => {
  const { style } = useModalStyle();
  const [content, setContent] = useState<LoadedContent>(() => getLoadedContent());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const activeDriver =
    driver ?? getActiveDriver() ?? (new FetchDriver('/__content') as ContentDriver & ContentWriter);

  const { descriptions, artPackWarnings, failures } = content;
  const artPackProblems = [
    ...failures.filter((failure) => failure.packId.startsWith(ART_PACK_FAILURE_PREFIX)),
    ...artPackWarnings,
  ];

  /** Loads the packs, saves them to config.json and applies them. `enabling` must load, or nothing changes. */
  const applyEnabledPacks = async (enabledPacks: string[], enabling?: string) => {
    if (isUpdating) return;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const nextContent = await loadContent(activeDriver, { packs: enabledPacks, artPacks: true });
      const failure = nextContent.failures.find((f) => f.packId === enabling);
      if (failure) {
        setErrorMessage(`Cannot enable "${enabling}": ${failure.reason}`);
        return;
      }
      await activeDriver.writeJson('config.json', {
        $schema: '../src/data/packs/content-config.schema.json',
        enabledPacks,
      });
      applyContent(nextContent);
      setContent(nextContent);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleTogglePack = async (packId: string, nextEnabledStatus: boolean) => {
    const currentEnabled = content.descriptions.filter((p) => p.enabled).map((p) => p.id);
    if (nextEnabledStatus) {
      await applyEnabledPacks(Array.from(new Set([...currentEnabled, packId])), packId);
      return;
    }
    const dependents = content.packs.filter(
      (p) => p.id !== packId && p.manifest.dependsOn.includes(packId),
    );
    if (dependents.length > 0) {
      const names = dependents.map((p) => p.manifest.name).join(', ');
      setErrorMessage(`Cannot disable "${packId}": ${names} depends on it.`);
      return;
    }
    await applyEnabledPacks(currentEnabled.filter((id) => id !== packId));
  };

  return (
    <div className="max-w-4xl w-full mx-auto my-6 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bangers text-3xl md:text-4xl text-comic-red tracking-wide">CONTENT</h1>
        <div className="flex items-center gap-2">
          <ThemedButton
            variant="secondary"
            onClick={() => void applyEnabledPacks(['core'])}
            disabled={isUpdating}
          >
            Reset to Default
          </ThemedButton>
          <ThemedButton variant="secondary" onClick={onBack}>
            Back
          </ThemedButton>
        </div>
      </div>
      <FanProjectNotice />
      {errorMessage && (
        <div
          className="p-3 bg-comic-red/20 border border-comic-red text-comic-red text-sm rounded font-bold"
          role="alert"
        >
          {errorMessage}
        </div>
      )}
      <p className={`text-sm ${style.muted}`}>
        Toggle packs on or off to enable them in your game. Playable: every card has supplemental
        data. Incomplete: only some do. Error: none does, so the pack cannot be switched on. Missing
        images never stop a pack: official packs download them as cards are shown.
      </p>
      {descriptions.length === 0 ? (
        <p className={`p-4 ${style.panel} ${style.text}`}>
          No pack folders found in <code>content/packs/</code>. Run{' '}
          <code>npm run content:sync</code>.
        </p>
      ) : (
        <ul className={`divide-y divide-current/20 ${style.panel} ${style.text}`}>
          {descriptions.map((pack) => {
            // A pack that is on can always be switched off; only these states may be switched on.
            const canToggle =
              pack.enabled || pack.state === 'playable' || pack.state === 'incomplete';
            return (
              <li
                key={pack.id}
                data-testid={`pack-row-${pack.id}`}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-comic text-lg">{pack.name}</span>
                  <span className={`text-xs ${style.muted}`}>{pack.id}</span>
                  <span
                    className={`px-2 py-0.5 text-xs font-bold uppercase ${style.badge} ${STATE_TONE[pack.state]}`}
                    data-state={pack.state}
                  >
                    {STATE_LABEL[pack.state]}
                  </span>
                  <span className={`text-xs ${style.muted}`}>
                    {pack.enabled ? 'enabled' : 'not enabled'}
                  </span>
                  {(pack.reason || pack.imageNote) && (
                    <span className="w-full text-sm">
                      {pack.reason && (
                        <span
                          className={pack.state === 'incomplete' ? style.muted : 'text-comic-red'}
                        >
                          {pack.reason}
                        </span>
                      )}
                      {pack.reason && pack.imageNote && ', '}
                      {pack.imageNote && <span className={style.muted}>{pack.imageNote}</span>}
                    </span>
                  )}
                </div>
                <div className="flex items-center">
                  <ThemedSwitch
                    checked={pack.enabled}
                    disabled={!canToggle || isUpdating}
                    onChange={(next) => void handleTogglePack(pack.id, next)}
                    label={`Enable ${pack.name}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <section data-testid="art-packs" className="space-y-2">
        <h2 className="font-bangers text-2xl text-comic-red tracking-wide">ART PACKS</h2>
        <ArtPackSettings />
        {artPackProblems.length > 0 && (
          <ul className={`divide-y divide-current/20 ${style.panel} ${style.text}`}>
            {artPackProblems.map((problem) => (
              <li key={`${problem.packId}:${problem.reason}`} className="p-3 text-sm" role="alert">
                <strong>{problem.packId.slice(ART_PACK_FAILURE_PREFIX.length)}:</strong>{' '}
                {problem.reason}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
