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
  'data-only': 'Data only',
  'needs-pack': 'Needs pack',
  failed: 'Failed',
};

/** Tag colours by state, whatever the theme: green plays, yellow is data only, orange waits for a pack, red is broken. */
const STATE_TONE: Record<PackState, string> = {
  playable: 'bg-emerald-600 text-white',
  'data-only': 'bg-comic-yellow text-comic-black',
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

  const handleTogglePack = async (packId: string, nextEnabledStatus: boolean) => {
    if (isUpdating) return;
    setIsUpdating(true);
    setErrorMessage(null);

    const currentEnabled = content.descriptions.filter((p) => p.enabled).map((p) => p.id);
    let nextEnabled: string[];

    if (nextEnabledStatus) {
      nextEnabled = Array.from(new Set([...currentEnabled, packId]));
    } else {
      const dependents = content.packs.filter(
        (p) => p.id !== packId && p.manifest.dependsOn.includes(packId),
      );
      if (dependents.length > 0) {
        const names = dependents.map((p) => p.manifest.name).join(', ');
        setErrorMessage(`Cannot disable "${packId}": ${names} depends on it.`);
        setIsUpdating(false);
        return;
      }
      nextEnabled = currentEnabled.filter((id) => id !== packId);
    }

    try {
      const nextContent = await loadContent(activeDriver, {
        packs: nextEnabled,
        artPacks: true,
      });

      if (nextEnabledStatus) {
        const failure = nextContent.failures.find((f) => f.packId === packId);
        if (failure) {
          setErrorMessage(`Cannot enable "${packId}": ${failure.reason}`);
          setIsUpdating(false);
          return;
        }
      }

      await activeDriver.writeJson('config.json', {
        $schema: '../src/data/packs/content-config.schema.json',
        enabledPacks: nextEnabled,
      });

      applyContent(nextContent);
      setContent(nextContent);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetDefault = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      const nextContent = await loadContent(activeDriver, {
        packs: ['core'],
        artPacks: true,
      });
      await activeDriver.writeJson('config.json', {
        $schema: '../src/data/packs/content-config.schema.json',
        enabledPacks: ['core'],
      });
      applyContent(nextContent);
      setContent(nextContent);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto my-6 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-bangers text-3xl md:text-4xl text-comic-red tracking-wide">CONTENT</h1>
        <div className="flex items-center gap-2">
          <ThemedButton
            variant="secondary"
            onClick={() => void handleResetDefault()}
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
        Toggle packs on or off to enable them in your game. Data only: cards but no supplemental
        data, or not enabled.
      </p>
      {descriptions.length === 0 ? (
        <p className={`p-4 ${style.panel} ${style.text}`}>
          No pack folders found in <code>content/packs/</code>. Run{' '}
          <code>npm run content:sync</code>.
        </p>
      ) : (
        <ul className={`divide-y divide-current/20 ${style.panel} ${style.text}`}>
          {descriptions.map((pack) => {
            const isFailed = pack.state === 'failed';
            const isNeedsPack = pack.state === 'needs-pack';
            const canToggle = !isFailed && !isNeedsPack;
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
                  {pack.reason && (
                    <span className="w-full text-sm text-comic-red">{pack.reason}</span>
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
