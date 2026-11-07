import React, { useState } from 'react';
import { ART_PACK_FAILURE_PREFIX } from '../../../data/content/loader';
import { getLoadedContent } from '../../../data/content/store';
import type { ArtPackManifest } from '../../../data/packs/art-pack';
import { useGameSettings } from '../../context/useGameSettings';
import { ThemedButton, ThemedSwitch } from '../../theme/kit/controls';
import { useModalStyle } from '../../theme/useModalStyle';
import { ArtPackBrowser } from './ArtPackBrowser';
import { describeArtPackHeroes } from './art-pack-card-label';

function imageCount(artPack: ArtPackManifest): number {
  return Object.values(artPack.cards).reduce((total, images) => total + images.length, 0);
}

/**
 * The installed art packs: name, description, credit, an on/off switch and a Browse button. Shared by
 * the Options menu and the Content screen. A pack is on unless the player switched it off.
 */
export const ArtPackSettings: React.FC = () => {
  const { style } = useModalStyle();
  const { disabledArtPacks, setArtPackEnabled } = useGameSettings();
  const { artPacks, artPackWarnings } = getLoadedContent();
  const [browsing, setBrowsing] = useState<ArtPackManifest | null>(null);

  if (artPacks.length === 0) {
    return (
      <p className={`text-sm ${style.muted}`} data-testid="art-packs-empty">
        No art packs installed. Put one in <code>content/art-packs/</code>; see the art packs page
        of the Creator Guide.
      </p>
    );
  }

  return (
    <>
      <ul className={`divide-y divide-current/20 ${style.panel} ${style.text}`}>
        {artPacks.map((artPack) => {
          const on = !disabledArtPacks.includes(artPack.id);
          const problems = artPackWarnings.filter(
            (warning) => warning.packId === `${ART_PACK_FAILURE_PREFIX}${artPack.id}`,
          ).length;
          return (
            <li
              key={artPack.id}
              data-testid={`art-pack-row-${artPack.id}`}
              className="flex flex-wrap items-start gap-x-3 gap-y-2 p-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="font-comic text-lg">{artPack.name}</div>
                <p className="text-sm">{artPack.description}</p>
                {describeArtPackHeroes(artPack) && (
                  <p className="text-sm font-bold" data-testid={`art-pack-heroes-${artPack.id}`}>
                    {describeArtPackHeroes(artPack)}
                  </p>
                )}
                <p className={`text-xs ${style.muted}`}>
                  Art by {artPack.credit.author}
                  {artPack.credit.unofficial && ' (unofficial)'} · {imageCount(artPack)}{' '}
                  {imageCount(artPack) === 1 ? 'image' : 'images'}
                  {problems > 0 && ` · ${problems} ${problems === 1 ? 'problem' : 'problems'}`}
                </p>
              </div>
              <ThemedButton variant="secondary" onClick={() => setBrowsing(artPack)}>
                Browse
              </ThemedButton>
              <ThemedSwitch
                checked={on}
                onChange={(next) => setArtPackEnabled(artPack.id, next)}
                label={`Use ${artPack.name}`}
              />
            </li>
          );
        })}
      </ul>
      {browsing && <ArtPackBrowser artPack={browsing} onClose={() => setBrowsing(null)} />}
    </>
  );
};
