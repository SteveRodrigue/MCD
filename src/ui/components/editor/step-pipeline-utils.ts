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
  if (step?.gate && step.gate !== 'ALWAYS') {
    parts.unshift(`[${step.gate}]`);
  }

  return parts.join(' ');
}
