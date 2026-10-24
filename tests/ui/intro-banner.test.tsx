import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScenarioSelector } from '../../src/ui/components/setup/ScenarioSelector';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import { ModalStyleProvider } from '../../src/ui/theme/ModalStyleContext';
import { GameThemeRoot } from '../../src/ui/theme/GameThemeRoot';
import { MODAL_STYLES } from '../../src/ui/theme/modal-styles';

/**
 * Only the intro banner keeps its look in every theme (fonts plan, N8): the yellow tab, the red title
 * and the blue subtitle, all in Bangers. The rest of the screen follows the theme.
 */
const BANNER = [
  /MISSION CONTROL/,
  /^MARVEL CHAMPIONS$/,
  /Solo & Multi-Hero Comic Tabletop Setup/,
] as const;

const bannerClasses = (styleId: string): string[] => {
  const style = MODAL_STYLES.find((s) => s.id === styleId)!;
  const { unmount } = render(
    <GameSettingsProvider>
      <ModalStyleProvider style={style}>
        <GameThemeRoot active>
          <ScenarioSelector onStartSetup={() => {}} />
        </GameThemeRoot>
      </ModalStyleProvider>
    </GameSettingsProvider>,
  );
  const classes = BANNER.map((pattern) => screen.getByText(pattern).className);
  unmount();
  return classes;
};

describe('the intro banner keeps its look in every theme', () => {
  it.each(MODAL_STYLES.map((s) => s.id))(
    'draws the tab, the title and the subtitle in Bangers under %s, never in a theme font',
    (id) => {
      for (const className of bannerClasses(id)) {
        expect(className).toContain('font-bangers');
        expect(className).not.toMatch(/font-(comic|body|mono|news-)/);
      }
    },
  );

  it('has the same classes in all 7 themes, colours included', () => {
    const [first, ...rest] = MODAL_STYLES.map((s) => bannerClasses(s.id).join('|'));
    for (const other of rest) expect(other).toBe(first);
    expect(first).toContain('text-comic-red');
    expect(first).toContain('text-comic-blue');
    expect(first).toContain('bg-comic-yellow');
  });
});
