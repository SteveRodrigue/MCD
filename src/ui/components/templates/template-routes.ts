import { getModalStyle, type ModalStyleId } from '../../theme/modal-styles';

export type ArchetypeId = 'decision' | 'sequence' | 'select';

export interface ArchetypeMeta {
  id: ArchetypeId;
  label: string;
  description: string;
}

export const ARCHETYPES: readonly ArchetypeMeta[] = [
  {
    id: 'decision',
    label: 'Decision',
    description: 'Forced or optional prompt: trigger card, threat showcase, one row per choice.',
  },
  {
    id: 'sequence',
    label: 'Sequence',
    description: 'Wakanda Forever: reorder real cards, finisher highlight, execute.',
  },
  {
    id: 'select',
    label: 'Select',
    description: 'Pick N of M cards from a grid with a live counter and confirm.',
  },
];

export const DEFAULT_ARCHETYPE: ArchetypeId = 'sequence';

/** `style` is null on the gallery (`/templates/`). */
export interface TemplatesRoute {
  style: ModalStyleId | null;
  archetype: ArchetypeId;
}

const ROOT = '/templates';

/** `/templates/<style>/<archetype>`. An unknown style falls back to the gallery. */
export const parseTemplatesPath = (pathname: string): TemplatesRoute => {
  const rest = pathname.toLowerCase().replace(/^\/templates\/?/, '');
  const [styleSlug, archetypeSlug] = rest.split('/').filter(Boolean);
  const style = getModalStyle(styleSlug)?.id ?? null;
  const archetype = ARCHETYPES.find((a) => a.id === archetypeSlug)?.id ?? DEFAULT_ARCHETYPE;
  return { style, archetype };
};

export const buildTemplatesPath = ({ style, archetype }: TemplatesRoute): string =>
  style ? `${ROOT}/${style}/${archetype}` : `${ROOT}/`;
