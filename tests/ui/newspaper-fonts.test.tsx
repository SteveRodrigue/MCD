import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DailyBugleActionNewspaper } from '../../src/ui/components/board/DailyBugleActionNewspaper';
import { EndTurnConfirmationModal } from '../../src/ui/components/board/EndTurnConfirmationModal';
import type {
  LegalActionItem,
  LegalActionReport,
} from '../../src/engine/pipeline/legal-actions-generator';
import { ModalStyleProvider } from '../../src/ui/theme/ModalStyleContext';
import { MODAL_STYLES, newspaperFontVars } from '../../src/ui/theme/modal-styles';

vi.mock('../../src/ui/hooks/useCardArt', () => ({
  useCardArt: vi.fn().mockReturnValue({ artUrl: null, loading: false, error: null }),
}));

/**
 * N3 of the integration plan: the Daily Bugle surfaces read the Newspaper pair and the theme's
 * newspaper text sizes, so the paper follows each theme (Pop-Art keeps its serif broadsheet).
 */
const turnAction = {
  id: 'end-turn',
  label: 'End Turn',
  description: 'Pass the turn',
} as unknown as LegalActionItem;

const emptyReport = {
  playerId: 'p1',
  playerName: 'Peter',
  isPlayerTurn: true,
  activeActionCount: 0,
  identityActions: [],
  handCardActions: [],
  boardActions: [],
  callForActionItems: [],
  callForActionCount: 0,
  villainActionItems: [],
  villainActionCount: 0,
  turnAction,
  allActions: [],
} as LegalActionReport;

const inTheme = (styleId: string, ui: React.ReactElement) =>
  render(
    <ModalStyleProvider style={MODAL_STYLES.find((s) => s.id === styleId)!}>
      {ui}
    </ModalStyleProvider>,
  );

describe('Daily Bugle surfaces follow the theme newspaper', () => {
  it.each(MODAL_STYLES.map((s) => s.id))(
    'the action sheet carries the newspaper mark and the %s newspaper variables',
    (id) => {
      const style = MODAL_STYLES.find((s) => s.id === id)!;
      const { unmount } = inTheme(
        id,
        <DailyBugleActionNewspaper
          report={emptyReport}
          isOpen
          onClose={() => {}}
          onSelectAction={() => {}}
        />,
      );
      const sheet = screen.getByTestId('daily-bugle-container');
      expect(sheet.hasAttribute('data-newspaper')).toBe(true);
      for (const [name, value] of Object.entries(newspaperFontVars(style))) {
        expect(sheet.style.getPropertyValue(name), `${id} ${name}`).toBe(String(value));
      }
      expect(sheet.className).toContain('font-news-body');
      unmount();
    },
  );

  it('the end-turn flash carries the mark, the variables and the Newspaper roles', () => {
    inTheme(
      'splash',
      <EndTurnConfirmationModal
        isOpen
        playerName="Peter"
        turnAction={turnAction}
        onConfirmEndTurn={() => {}}
        onDismiss={() => {}}
      />,
    );
    const root = document.querySelector('[data-newspaper]') as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.style.getPropertyValue('--text-adjust')).toBe('4px');
    expect(root.className).toContain('font-news-body');
    expect(root.querySelector('h2')!.className).toContain('font-news-headline');
  });

  it('Splash gets +4 on newspaper body text, Dossier -1 on newspaper headlines, Pop-Art its serif pair', () => {
    const vars = (id: string) =>
      newspaperFontVars(MODAL_STYLES.find((s) => s.id === id)!) as Record<string, string>;
    expect(vars('splash')['--text-adjust']).toBe('4px');
    expect(vars('dossier')['--text-headline-adjust']).toBe('-1px');
    expect(vars('pop-art')['--font-news-body']).toMatch(/Georgia/);
  });
});
