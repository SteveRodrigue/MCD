import { Keyword } from './enums';

/**
 * Structured parameterized keyword representation (ADR-0054).
 * Allows explicit declarative modeling of parameterized keywords like Retaliate, Incite, or Hinder.
 */
export interface ParameterizedKeyword {
  keyword: Keyword | string;
  amount?: number;
}

export type CardKeyword = Keyword | string | ParameterizedKeyword;

export interface ParsedKeyword {
  name: string;
  amount: number;
}

/**
 * Normalizes any keyword input (structured object, enum, bare string, or legacy string token like 'Retaliate 1')
 * into a canonical keyword name and numeric magnitude (ADR-0054).
 * Defaults magnitude to 1 when omitted.
 */
export function parseKeywordItem(item: CardKeyword | any): ParsedKeyword | null {
  if (!item) return null;

  if (typeof item === 'object' && item !== null && 'keyword' in item) {
    const rawName = String(item.keyword).trim();
    // In case the object's keyword field itself has a number like { keyword: 'Retaliate 1' }
    const match = rawName.match(/^([a-zA-Z\s_-]+?)(?:\s+(\d+))?$/);
    const name = match ? match[1].trim() : rawName;
    let amount =
      typeof item.amount === 'number' && !isNaN(item.amount)
        ? item.amount
        : match && match[2]
          ? parseInt(match[2], 10)
          : 1;
    return { name, amount };
  }

  const str = String(item).trim();
  if (!str) return null;

  const match = str.match(/^([a-zA-Z\s_-]+?)(?:\s+(\d+))?$/);
  if (match) {
    const name = match[1].trim();
    const amount = match[2] ? parseInt(match[2], 10) : 1;
    return { name, amount };
  }

  return { name: str, amount: 1 };
}
