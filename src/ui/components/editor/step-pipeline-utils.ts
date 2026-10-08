export function formatGatePrefix(step: any): string | null {
  if (!step?.gate || step.gate === 'ALWAYS') {
    return null;
  }

  const gate = step.gate;
  const gateParams = step.gateParams || {};
  let base: string = gate;

  switch (gate) {
    case 'IF_RESULT':
      base = gateParams.result ? `IF_RESULT: ${gateParams.result}` : 'IF_RESULT';
      break;
    case 'IF_FORM':
      base = `IF_FORM: ${gateParams.form || 'HERO'}`;
      break;
    case 'IF_PLAYER_HAS_TRAIT':
      base = gateParams.trait ? `IF_PLAYER_HAS_TRAIT (${gateParams.trait})` : 'IF_PLAYER_HAS_TRAIT';
      break;
    case 'IF_ZONE_EMPTY':
      base = gateParams.zone ? `IF_ZONE_EMPTY (${gateParams.zone})` : 'IF_ZONE_EMPTY';
      break;
    case 'IF_CARD_IN_PLAY':
      base = gateParams.cardCode ? `IF_CARD_IN_PLAY (${gateParams.cardCode})` : 'IF_CARD_IN_PLAY';
      break;
    case 'IF_RESOURCE_MATCH':
      base = gateParams.resource
        ? `IF_RESOURCE_MATCH (${gateParams.resource})`
        : 'IF_RESOURCE_MATCH';
      break;
    case 'IF_UNDEFENDED_ATTACK':
      base = gateParams.attackerKind
        ? `IF_UNDEFENDED_ATTACK (${gateParams.attackerKind})`
        : 'IF_UNDEFENDED_ATTACK';
      break;
    case 'THEN':
      base = gateParams.step ? `THEN (${gateParams.step})` : 'THEN';
      break;
    default:
      base = gate;
      break;
  }

  if (gateParams.negate) {
    return `[IF NOT: ${base}]`;
  }
  return `[${base}]`;
}

export function generateStepSummary(step: any, index: number): string {
  const parts: string[] = [`#${index + 1}`];

  // Effect name
  parts.push(step?.effect || 'STEP');

  // Arrow + target (if set and not default)
  if (step?.target) {
    parts.push(`→ ${step.target}`);
  }

  // Key param extract from effectParams
  const params = step?.effectParams || {};
  if (params.stat) {
    const sign = typeof params.amount === 'number' && params.amount > 0 ? '+' : '';
    const amt = params.amount !== undefined ? `${sign}${params.amount}` : '';
    parts.push(`(${[params.stat, amt].filter(Boolean).join(' ')})`);
  } else if (typeof params.amount === 'number') {
    parts.push(`(${params.amount})`);
  } else if (typeof params.count === 'number') {
    parts.push(`(${params.count})`);
  } else if (params.status) {
    parts.push(`(${params.status})`);
  }

  // Gate prefix
  const gatePrefix = formatGatePrefix(step);
  if (gatePrefix) {
    parts.unshift(gatePrefix);
  }

  return parts.join(' ');
}
