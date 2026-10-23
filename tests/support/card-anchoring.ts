/**
 * Card Anchoring Rule check: every text node that names one of `cards` must sit inside a card
 * reference (thumbnail + name), a real card face, or a container that shows the card's thumbnail
 * (`data-card-anchor`). A dialog title may name its own trigger card because the header shows that
 * card's thumbnail.
 */
export interface NamedCard {
  code?: string;
  name: string;
}

export const cardNamesWithoutThumbnail = (cards: readonly NamedCard[]): string[] => {
  const offenders: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? '';
    const parent = node.parentElement;
    if (!parent) continue;
    for (const card of cards) {
      if (!text.includes(card.name)) continue;
      if (parent.closest('[data-card-ref],[data-card-view],[data-card-anchor]')) continue;
      const dialog = parent.closest('[role="dialog"]');
      const isTitle = parent.closest('h2') !== null;
      if (isTitle && card.code && dialog?.querySelector(`[data-card-ref="${card.code}"]`)) continue;
      offenders.push(`${card.name}: "${text.trim()}"`);
    }
  }
  return offenders;
};
