// Global z-index scale (ADR-0082, Appendix C). Values are spaced ×10 so new
// layers can be inserted later. Never compare these with local fan values (fan-z.ts).
export const Z = {
  table: 0,
  content: 100,
  raised: 200,
  zoom: 400,
  sticky: 500,
  drawer: 600,
  modal: 700,
  banner: 800,
  menu: 900,
  critical: 1000,
} as const;

export type ZLayer = keyof typeof Z;

// Literal class names so Tailwind's content scanner generates them.
export const Z_CLASS: Record<ZLayer, string> = {
  table: 'z-table',
  content: 'z-content',
  raised: 'z-raised',
  zoom: 'z-zoom',
  sticky: 'z-sticky',
  drawer: 'z-drawer',
  modal: 'z-modal',
  banner: 'z-banner',
  menu: 'z-menu',
  critical: 'z-critical',
};
