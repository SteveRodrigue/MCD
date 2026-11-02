/** Difficulty modes; kept in its own file so the Node-side tooling can import it without the engine graph. */
export const DIFFICULTY_MODES = ['SKIRMISH', 'STANDARD', 'EXPERT'] as const;
export type DifficultyMode = (typeof DIFFICULTY_MODES)[number];
