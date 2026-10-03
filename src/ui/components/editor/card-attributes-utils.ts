export function getSectionVisibility(typeCode: string | undefined, showAll: boolean) {
  if (showAll || !typeCode) return { mechanics: true, combat: true, layout: true, playReqs: true };

  const combat = ['ally', 'minion', 'villain'].includes(typeCode);
  const layout = ['side_scheme', 'main_scheme', 'minion', 'villain'].includes(typeCode);
  const playReqs = [
    'ally',
    'upgrade',
    'support',
    'event',
    'resource',
    'hero',
    'alter_ego',
  ].includes(typeCode);
  const mechanics = !['treachery', 'obligation', 'environment'].includes(typeCode);

  return { mechanics, combat, layout, playReqs };
}

export function countAuditFields(audit: any, supplemental: any): number {
  if (!audit && !supplemental?.errata) return 0;
  let count = 0;
  if (audit?.comment) count++;
  if (audit?.confidence !== undefined) count++;
  if (audit?.reviewedBy) count++;
  if (audit?.ambiguityFile) count++;
  if (audit?.originalText) count++;
  if (supplemental?.errata) count++;
  return count;
}

export function countMechanicsFields(supplemental: any): number {
  let count = 0;
  if (supplemental?.keywords?.length) count++;
  if (supplemental?.traits?.length) count++;
  if (supplemental?.uses) count++;
  if (supplemental?.maxPerPlayer != null) count++;
  if (supplemental?.recipient) count++;
  if (supplemental?.restrictedSlots != null) count++;
  return count;
}

export function countCombatFields(supplemental: any): number {
  let count = 0;
  if (supplemental?.attackCost != null) count++;
  if (supplemental?.thwartCost != null) count++;
  if (supplemental?.additionalBoostCards != null) count++;
  return count;
}

export function countLayoutFields(supplemental: any): number {
  let count = 0;
  if (supplemental?.isLandscape) count++;
  if (supplemental?.victoryPoints != null) count++;
  return count;
}

export function countPlayReqFields(supplemental: any): number {
  let count = 0;
  const reqs = supplemental?.playRequirements;
  if (reqs?.identityForm) count++;
  if (reqs?.formTrait) count++;
  if (reqs?.identityTraits?.length) count++;
  if (reqs?.identityNames?.length) count++;
  if (reqs?.controlZones?.length) count++;
  if (reqs?.controlFilter) count++;
  if (supplemental?.playUnderAnyPlayerControl) count++;
  return count;
}
