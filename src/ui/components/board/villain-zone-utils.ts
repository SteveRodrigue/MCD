import { NormalizedCard } from '../../../engine/models';
import { findEncounterSetName } from '../../../engine/scenarios/encounter-sets';

export function getEncounterSetName(card: NormalizedCard): string {
  const setCode = card.setCode || (card as any).set_code || (card as any).set || '';
  const listedName = findEncounterSetName(setCode);
  if (listedName) return listedName;
  if (card.type === 'obligation' || (card as any).type_code === 'obligation') {
    return 'Player Obligations';
  }

  return (
    setCode
      .split('_')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || 'Encounter Set'
  );
}
