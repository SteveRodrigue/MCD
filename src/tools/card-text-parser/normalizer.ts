/**
 * Normalizes raw upstream card text by stripping HTML tags,
 * converting HTML entities, standardizing dashes and arrows,
 * and normalizing whitespace while preserving logical layout.
 */
export function normalizeCardText(rawText: string): string {
  if (!rawText) return '';

  return rawText
    // Convert line break tags to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove cosmetic HTML tags
    .replace(/<\/?(b|i|em|strong|span|p)[^>]*>/gi, '')
    // Standardize HTML entities
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#8594;|&rarr;/gi, '→')
    .replace(/&nbsp;/gi, ' ')
    // Normalize dashes surrounded by spaces or between words
    .replace(/\s*--\s*/g, ' — ')
    // Standardize cost arrow ascii variants
    .replace(/\s*->\s*/g, ' → ')
    // Standardize quotes
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // Trim each line
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}
