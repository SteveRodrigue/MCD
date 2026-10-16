export function getSectionVisibility(typeCode: string | undefined, showAll: boolean) {
  if (showAll || !typeCode) return { mechanics: true, playReqs: true };

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

  return { mechanics, playReqs };
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
  if (supplemental?.uses) count++;
  if (supplemental?.recipient) count++;
  if (supplemental?.attachTo) count++;
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
