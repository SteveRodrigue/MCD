import { describe, it, expect } from 'vitest';
import { formatCardTextHtml } from '../../src/ui/components/cards/formatted-card-text-utils';

describe('FormattedCardText & MarvelCDB HTML/Token Formatter', () => {
  it('preserves HTML tags (<b>, <i>, <br>) and converts MarvelCDB tokens', () => {
    const rawText =
      '<b>Hero Action</b>: Spend 1 [physical] resource and discard Tenacity &rarr; ready your [hero].';
    const formatted = formatCardTextHtml(rawText);

    expect(formatted).toContain('<b>Hero Action</b>');
    expect(formatted).toContain('✊ Physical');
    expect(formatted).toContain('HERO');
  });

  it('converts resource tokens correctly', () => {
    const energyText = 'Spend 1 [energy] and 1 [mental] and 1 [wild]';
    const formatted = formatCardTextHtml(energyText);

    expect(formatted).toContain('⚡ Energy');
    expect(formatted).toContain('🧠 Mental');
    expect(formatted).toContain('⭐ Wild');
  });

  it('handles empty or undefined input gracefully', () => {
    expect(formatCardTextHtml('')).toBe('');
    expect(formatCardTextHtml(undefined)).toBe('');
  });
});
