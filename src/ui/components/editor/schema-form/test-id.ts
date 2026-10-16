/** `damageSelf` becomes `damage-self`; used to derive `data-testid`s from schema keys. */
export const kebabCase = (text: string): string =>
  text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
