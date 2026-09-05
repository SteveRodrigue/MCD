import { NormalizedCard } from './card';
import { CardInstance } from './state';
import { Keyword } from './enums';

/**
 * Checks whether a card or card instance possesses a given Keyword (ADR-0019).
 * Evaluates both the normalized card keywords array and supplemental enrichment keywords.
 * Never reads or regex-matches raw card.text.
 */
export function hasKeyword(
  cardOrInstance: NormalizedCard | CardInstance | undefined,
  keyword: Keyword | string,
): boolean {
  if (!cardOrInstance) return false;
  const card =
    'card' in cardOrInstance && 'instanceId' in cardOrInstance
      ? cardOrInstance.card
      : (cardOrInstance as NormalizedCard);

  if (!card) return false;

  const kwStr = String(keyword).toLowerCase().trim();

  const matches = (k: any) => {
    const s = String(k).toLowerCase().trim();
    if (s === kwStr) return true;
    if (s.startsWith(kwStr + ' ')) return true;
    if (kwStr === 'tough' && s === 'toughness') return true;
    if (kwStr === 'toughness' && s === 'tough') return true;
    return false;
  };

  if (card.keywords && card.keywords.some(matches)) {
    return true;
  }

  const enrichmentKeywords = (card.enrichment as any)?.keywords;
  if (Array.isArray(enrichmentKeywords) && enrichmentKeywords.some(matches)) {
    return true;
  }

  return false;
}

/**
 * Resolves the numeric value of a parameterized keyword (e.g. 'Retaliate 1', 'Incite 2')
 * from card keywords or supplemental enrichment (ADR-0019).
 * Returns undefined if the keyword is not present on the card.
 * Never reads or regex-matches raw card.text.
 */
export function getKeywordValue(
  cardOrInstance: NormalizedCard | CardInstance | undefined,
  keyword: Keyword | string,
): number | undefined {
  if (!cardOrInstance) return undefined;
  const card =
    'card' in cardOrInstance && 'instanceId' in cardOrInstance
      ? cardOrInstance.card
      : (cardOrInstance as NormalizedCard);

  if (!card) return undefined;
  const kwStr = String(keyword).toLowerCase().trim();

  const allKws: any[] = [
    ...(card.keywords || []),
    ...(((card.enrichment as any)?.keywords as any[]) || []),
  ];

  for (const k of allKws) {
    const s = String(k).toLowerCase().trim();
    if (s === kwStr || s.startsWith(kwStr + ' ')) {
      const match = s.match(/\d+/);
      if (match) {
        return parseInt(match[0], 10);
      }
      return 1;
    }
  }

  return undefined;
}
