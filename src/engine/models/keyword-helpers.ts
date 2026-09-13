import { NormalizedCard } from './card';
import { CardInstance } from './state';
import { Keyword } from './enums';
import { parseKeywordItem } from './keyword';

/**
 * Checks whether a card or card instance possesses a given Keyword (ADR-0019, ADR-0054).
 * Evaluates the normalized card keywords array, supplemental enrichment keywords, and constant abilities.
 * Transparently supports structured { keyword, amount } and legacy string forms.
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
    if (!k) return false;
    const parsed = parseKeywordItem(k);
    if (parsed && parsed.name.toLowerCase() === kwStr) return true;

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

  // Check constant abilities with GRANT_KEYWORD
  const abilities = card.enrichment?.abilities || [];
  for (const ab of abilities) {
    if (ab.timing === 'CONSTANT') {
      for (const step of ab.steps || []) {
        if (step.effect === 'GRANT_KEYWORD' && step.params?.keyword) {
          const parsed = parseKeywordItem({
            keyword: step.params.keyword,
            amount: step.params.amount,
          });
          if (parsed && parsed.name.toLowerCase() === kwStr) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Resolves the aggregated numeric value of a parameterized keyword (e.g. 'Retaliate 1', 'Incite 2')
 * from card keywords, supplemental enrichment, and constant GRANT_KEYWORD abilities (ADR-0019, ADR-0054).
 * Returns undefined if the keyword is not present on the card.
 * If multiple instances exist, adds their values together per RR v1.8 p. 24.
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

  let total: number | undefined = undefined;

  const allKws: any[] = [
    ...(card.keywords || []),
    ...(((card.enrichment as any)?.keywords as any[]) || []),
  ];

  for (const k of allKws) {
    if (!k) continue;
    const parsed = parseKeywordItem(k);
    if (parsed && parsed.name.toLowerCase() === kwStr) {
      total = (total || 0) + parsed.amount;
      continue;
    }

    const s = String(k).toLowerCase().trim();
    if (s === kwStr || s.startsWith(kwStr + ' ')) {
      const match = s.match(/\d+/);
      const val = match ? parseInt(match[0], 10) : 1;
      total = (total || 0) + val;
    }
  }

  // Check constant abilities on card granting keyword to self
  const abilities = card.enrichment?.abilities || [];
  for (const ab of abilities) {
    if (ab.timing === 'CONSTANT') {
      for (const step of ab.steps || []) {
        if (step.effect === 'GRANT_KEYWORD' && step.params?.keyword) {
          const parsed = parseKeywordItem({
            keyword: step.params.keyword,
            amount: step.params.amount,
          });
          if (parsed && parsed.name.toLowerCase() === kwStr) {
            total = (total || 0) + parsed.amount;
          }
        }
      }
    }
  }

  return total;
}
