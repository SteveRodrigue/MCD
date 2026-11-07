import React, { useMemo, useState } from 'react';
import { Images } from 'lucide-react';
import { artPackImageUrl } from '../../../data/content/card-art';
import type { ArtPackImage, ArtPackManifest } from '../../../data/packs/art-pack';
import { ModalScaffold } from '../../theme/ModalScaffold';
import { ThemedButton } from '../../theme/kit/controls';
import { useModalStyle } from '../../theme/useModalStyle';
import {
  describeArtPackCard,
  describeArtPackHeroes,
  type ArtPackCardDescription,
} from './art-pack-card-label';

interface BrowseItem {
  code: string;
  image: ArtPackImage;
  url: string;
  label: ArtPackCardDescription;
}

function browseItems(artPack: ArtPackManifest): BrowseItem[] {
  return Object.entries(artPack.cards)
    .flatMap(([code, images]) =>
      images.map((image) => ({
        code,
        image,
        url: artPackImageUrl(artPack, image),
        label: describeArtPackCard(code),
      })),
    )
    .sort((a, b) => a.code.localeCompare(b.code) || a.url.localeCompare(b.url));
}

function statsText(image: ArtPackImage): string {
  return image.attack === undefined ? '' : `ATK ${image.attack} / HP ${image.hitPoints}`;
}

/** The text a filter matches: code, name, kind and file name. */
function haystack(item: BrowseItem): string {
  return `${item.code} ${item.label.name} ${item.label.kind} ${item.image.file}`.toLowerCase();
}

const Tile: React.FC<{ item: BrowseItem; onSelect: (item: BrowseItem) => void }> = ({
  item,
  onSelect,
}) => {
  const { style } = useModalStyle();
  const [failed, setFailed] = useState(false);
  const stats = statsText(item.image);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(item)}
        data-testid="art-pack-tile"
        className={`w-full p-2 text-left cursor-pointer space-y-1 ${style.panel}`}
      >
        {failed ? (
          <div
            className={`flex aspect-[5/7] items-center justify-center p-2 text-center text-xs ${style.inset}`}
            data-testid="art-pack-tile-missing"
          >
            {item.image.file} cannot be shown
          </div>
        ) : (
          <img
            src={item.url}
            alt={`${item.label.name} (${item.code})`}
            loading="lazy"
            onError={() => setFailed(true)}
            className="w-full h-auto"
          />
        )}
        <div className="text-sm font-bold leading-tight">{item.label.name}</div>
        <div className={`text-xs ${style.muted}`}>
          {item.code}
          {item.label.kind && ` · ${item.label.kind}`}
          {stats && ` · ${stats}`}
          {item.label.packOff && ' · pack off'}
          {!item.label.known && ' · not in any installed pack'}
        </div>
      </button>
    </li>
  );
};

interface ArtPackBrowserProps {
  artPack: ArtPackManifest;
  onClose: () => void;
}

/** Every image of one art pack, whether or not the pack is switched on. Images are shown whole. */
export const ArtPackBrowser: React.FC<ArtPackBrowserProps> = ({ artPack, onClose }) => {
  const { style } = useModalStyle();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<BrowseItem | null>(null);
  const items = useMemo(() => browseItems(artPack), [artPack]);
  const needle = filter.trim().toLowerCase();
  const shown = needle ? items.filter((item) => haystack(item).includes(needle)) : items;

  return (
    <ModalScaffold
      title={artPack.name}
      kicker="ART PACK"
      verb="blue"
      trigger={null}
      icon={<Images className="w-5 h-5" />}
      onClose={onClose}
      closeOnBackdrop
      maxWidthClass="max-w-5xl"
      testId="art-pack-browser"
    >
      <p className="text-sm">{artPack.description}</p>
      {describeArtPackHeroes(artPack) && (
        <p className="text-sm font-bold" data-testid="art-pack-heroes">
          {describeArtPackHeroes(artPack)}
        </p>
      )}
      <p className={`text-xs ${style.muted}`}>
        Art by {artPack.credit.author}
        {artPack.credit.unofficial && ' (unofficial)'} ·{' '}
        <a href={artPack.credit.sourceUrl} target="_blank" rel="noreferrer" className="underline">
          source
        </a>{' '}
        · {items.length} {items.length === 1 ? 'image' : 'images'}
      </p>
      {selected && (
        <div className={`p-3 space-y-2 ${style.panel}`} data-testid="art-pack-enlarged">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-comic text-lg">
              {selected.label.name}{' '}
              <span className={`text-xs ${style.muted}`}>
                {selected.code}
                {statsText(selected.image) && ` · ${statsText(selected.image)}`}
              </span>
            </span>
            <ThemedButton variant="secondary" onClick={() => setSelected(null)}>
              Back to all
            </ThemedButton>
          </div>
          <img
            src={selected.url}
            alt={`${selected.label.name} (${selected.code}), enlarged`}
            className="mx-auto max-h-[70vh] w-auto"
          />
        </div>
      )}
      <label className="block text-sm">
        <span className="sr-only">Filter by card name or code</span>
        <input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by card name or code"
          className={`w-full px-3 py-2 ${style.inset}`}
        />
      </label>
      {shown.length === 0 ? (
        <p className={`text-sm ${style.muted}`} data-testid="art-pack-no-match">
          {items.length === 0 ? 'This pack lists no images.' : 'No image matches the filter.'}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {shown.map((item) => (
            <Tile key={item.url} item={item} onSelect={setSelected} />
          ))}
        </ul>
      )}
    </ModalScaffold>
  );
};
