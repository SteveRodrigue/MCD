import { CardInstance } from '../../../engine/models';

export interface StaircaseExpansion {
  extraBottomPx: number;
  extraLeftClass: string;
}

export function getStaircaseExpansion(
  attachments: CardInstance[] = [],
  cardsUnderneath: CardInstance[] = [],
): StaircaseExpansion {
  const attCount = attachments.length;
  const underCount = cardsUnderneath.length;
  const extraBottomPx = attCount * 70 + underCount * 12;
  const extraLeftClass = attCount > 0 ? 'ml-4 sm:ml-6' : '';
  return { extraBottomPx, extraLeftClass };
}
