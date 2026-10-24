/** The screens that follow the theme: the setup, the mulligan and the game. The card editor and the lab do not. */
export const isGameStage = (stage: string): boolean =>
  stage === 'SETUP' || stage === 'MULLIGAN' || stage === 'IN_GAME';
