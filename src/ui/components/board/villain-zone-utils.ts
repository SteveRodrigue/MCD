import { NormalizedCard } from '../../../engine/models';

export function getEncounterSetName(card: NormalizedCard): string {
  if (card.type === 'obligation' || (card as any).type_code === 'obligation') {
    return 'Player Obligations';
  }
  const setCode = card.setCode || (card as any).set_code || (card as any).set || '';
  if (setCode === 'rhino') return 'Rhino';
  if (setCode === 'standard') return 'Standard';
  if (setCode === 'bomb_scare') return 'Bomb Scare';
  if (setCode === 'masters_of_evil') return 'Masters of Evil';
  if (setCode === 'under_attack') return 'Under Attack';
  if (setCode === 'legions_of_hydra') return 'Legions of Hydra';
  if (setCode === 'doomsday_chair') return 'The Doomsday Chair';
  if (setCode.includes('spider') || setCode.includes('obligation')) return 'Player Obligations';

  return (
    setCode
      .split('_')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || 'Encounter Set'
  );
}
