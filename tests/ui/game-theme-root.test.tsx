import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GameThemeRoot } from '../../src/ui/theme/GameThemeRoot';
import { isGameStage } from '../../src/ui/theme/game-stage';
import { ModalStyleProvider } from '../../src/ui/theme/ModalStyleContext';
import { MODAL_STYLES, themeFontVars } from '../../src/ui/theme/modal-styles';
import { THEME_EXTRAS } from '../../src/ui/theme/theme-extras';

const renderRoot = (active: boolean, styleId: string) => {
  const style = MODAL_STYLES.find((s) => s.id === styleId)!;
  const { container } = render(
    <ModalStyleProvider style={style}>
      <GameThemeRoot active={active} className="outer">
        <span>text</span>
      </GameThemeRoot>
    </ModalStyleProvider>,
  );
  return container.firstElementChild as HTMLElement;
};

describe('game theme root: the screens that follow the theme', () => {
  it('is the setup, the mulligan and the game; never the card editor or the lab', () => {
    for (const stage of ['SETUP', 'MULLIGAN', 'IN_GAME']) expect(isGameStage(stage)).toBe(true);
    for (const stage of ['EDITOR', 'TEMPLATES', '']) expect(isGameStage(stage)).toBe(false);
  });

  it.each(MODAL_STYLES.map((s) => s.id))(
    'sets the font roles and size changes of %s, and makes Body the base text',
    (id) => {
      const style = MODAL_STYLES.find((s) => s.id === id)!;
      const root = renderRoot(true, id);
      expect(root.className).toContain('outer');
      expect(root.className).toContain('font-body');
      for (const [name, value] of Object.entries(themeFontVars(style))) {
        expect(root.style.getPropertyValue(name), `${id} ${name}`).toBe(String(value));
      }
      expect(root.style.getPropertyValue('--font-numbers')).toMatch(/Nunito/);
    },
  );

  it.each(MODAL_STYLES.map((s) => s.id))(
    'is the table of %s: its background, text and texture',
    (id) => {
      const table = THEME_EXTRAS[id].table;
      const root = renderRoot(true, id);
      for (const cls of `${table.bg} ${table.text}`.split(' '))
        expect(root.className).toContain(cls);
      const texture = root.querySelector('[data-testid="table-texture"]') as HTMLElement;
      expect(texture.className).toContain(table.textureClass);
      expect(texture.style.backgroundImage).toBe(table.texture.backgroundImage);
    },
  );

  it('keeps the comic paper and sets no Body base or variables when inactive (the card editor)', () => {
    const root = renderRoot(false, 'night');
    expect(root.className).toContain('outer');
    expect(root.className).toContain('bg-comic-paper');
    expect(root.className).not.toContain('font-body');
    expect(root.getAttribute('style')).toBeNull();
    const texture = root.querySelector('[data-testid="table-texture"]') as HTMLElement;
    expect(texture.className).toContain('bg-bendy-dots');
  });
});
