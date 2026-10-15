// Local z inside an isolated fan (CSS isolation). Never compared with the global scale.
// Resting cards: count - index (always >= 1). Hovered card: count + 1 (above every sibling).
export function getFanZIndex(count: number, index: number, hovered = false): number {
  return hovered ? count + 1 : count - index;
}
