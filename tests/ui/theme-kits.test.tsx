import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CardSelectFrame } from '../../src/ui/theme/kit/cards';
import { ModalStyleProvider } from '../../src/ui/theme/ModalStyleContext';
import { MODAL_STYLES } from '../../src/ui/theme/modal-styles';
import { THEME_EXTRAS } from '../../src/ui/theme/theme-extras';
import { BoardKit } from '../../src/ui/components/templates/kits/BoardKit';
import { ElementsKit } from '../../src/ui/components/templates/kits/ElementsKit';
import { NewspaperKit } from '../../src/ui/components/templates/kits/NewspaperKit';
import { SetupKit } from '../../src/ui/components/templates/kits/SetupKit';
import { ModalTemplatesScreen } from '../../src/ui/components/templates/ModalTemplatesScreen';
import {
  DEFAULT_ITEM,
  KITS,
  buildTemplatesPath,
  kitOfItem,
  parseTemplatesPath,
} from '../../src/ui/components/templates/template-routes';

const KIT_PAGES = [
  ['elements', ElementsKit],
  ['board', BoardKit],
  ['newspaper', NewspaperKit],
  ['setup', SetupKit],
] as const;

afterEach(cleanup);

describe('theme extras', () => {
  it('has one entry per theme, with a newspaper era of its own', () => {
    expect(Object.keys(THEME_EXTRAS).sort()).toEqual(MODAL_STYLES.map((s) => s.id).sort());
    const eras = MODAL_STYLES.map((s) => THEME_EXTRAS[s.id].newspaper.era);
    expect(new Set(eras).size).toBe(eras.length);
  });

  it.each(MODAL_STYLES.map((s) => [s.label, s] as const))(
    '%s keeps the newspaper identity: a Bugle masthead, a flash word and a layout',
    (_label, style) => {
      const np = THEME_EXTRAS[style.id].newspaper;
      expect(np.title).toMatch(/BUGLE/);
      expect(np.flashWord.length).toBeGreaterThan(0);
    },
  );
});

describe.each(MODAL_STYLES.map((s) => [s.label, s] as const))('kits under %s', (_label, style) => {
  it.each(KIT_PAGES)('renders the %s kit', (_name, Kit) => {
    render(
      <ModalStyleProvider style={style} cardAccents>
        <Kit />
      </ModalStyleProvider>,
    );
    expect(document.body.textContent?.length).toBeGreaterThan(100);
  });

  it('draws the newspaper kit as a newspaper: masthead, edition line, stories, flash', () => {
    const np = THEME_EXTRAS[style.id].newspaper;
    render(
      <ModalStyleProvider style={style} cardAccents>
        <NewspaperKit />
      </ModalStyleProvider>,
    );
    expect(screen.getAllByRole('heading', { name: np.title }).length).toBeGreaterThanOrEqual(3);
    expect(document.querySelectorAll('[data-news-story]').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('note', { name: '' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('marquee').length).toBeGreaterThan(0);
  });
});

describe.each(MODAL_STYLES.map((s) => [s.label, s] as const))(
  'Daily Bugle action sheet under %s',
  (_label, style) => {
    it('keeps the game three-column page with the Call for Action! column', () => {
      render(
        <ModalStyleProvider style={style} cardAccents>
          <NewspaperKit />
        </ModalStyleProvider>,
      );
      const grid = screen.getByTestId('daily-bugle-grid');
      expect(grid.getAttribute('data-columns')).toBe('3');
      expect(grid.className).toContain('lg:grid-cols-3');
      expect(grid.className).toContain('grid-cols-1');
      expect(grid.children).toHaveLength(3);
      const callForAction = screen.getByTestId('daily-bugle-call-for-action-column');
      expect(grid.children[2].contains(callForAction)).toBe(true);
      expect(callForAction.textContent).toMatch(/call for action/i);
      expect(callForAction.textContent).toMatch(/2 ACTIONS/);
    });

    it('puts identity and hand in column 1, board and villain in column 2', () => {
      render(
        <ModalStyleProvider style={style} cardAccents>
          <NewspaperKit />
        </ModalStyleProvider>,
      );
      const [front, classifieds] = Array.from(screen.getByTestId('daily-bugle-grid').children);
      expect(front.textContent).toMatch(/identity directives/i);
      expect(front.textContent).toMatch(/playable hand cards/i);
      expect(classifieds.textContent).toMatch(/in-play assets/i);
      expect(classifieds.textContent).toMatch(/villain dispatches/i);
    });
  },
);

describe('newspaper kit behaviour', () => {
  const renderKit = () =>
    render(
      <ModalStyleProvider style={MODAL_STYLES[0]} cardAccents>
        <NewspaperKit />
      </ModalStyleProvider>,
    );

  it('filters the log wire by entry kind', () => {
    renderKit();
    expect(document.querySelectorAll('[data-log-kind]')).toHaveLength(4);
    const filter = screen.getByRole('group', { name: 'Log filter' });
    fireEvent.click(within(filter).getByRole('button', { name: 'villain' }));
    expect(document.querySelectorAll('[data-log-kind]')).toHaveLength(1);
    expect(document.querySelector('[data-log-kind="villain"]')).toBeTruthy();
  });

  it('anchors every story and log speaker to a card thumbnail', () => {
    renderKit();
    expect(
      document.querySelectorAll('[data-card-ref],[data-card-anchor]').length,
    ).toBeGreaterThanOrEqual(8);
  });
});

describe('board kit', () => {
  it('prints gauge numbers so colour is never the only cue', () => {
    render(
      <ModalStyleProvider style={MODAL_STYLES[0]} cardAccents>
        <BoardKit />
      </ModalStyleProvider>,
    );
    expect(screen.getByRole('meter', { name: 'Spider-Man' }).getAttribute('aria-valuenow')).toBe(
      '7',
    );
    expect(screen.getByText('9/15')).toBeTruthy();
  });
});

describe('kit routes', () => {
  it('opens each kit on its default item and round-trips through the URL', () => {
    for (const style of MODAL_STYLES) {
      for (const kit of KITS) {
        const route = { style: style.id, item: DEFAULT_ITEM[kit.id] };
        expect(parseTemplatesPath(buildTemplatesPath(route))).toEqual(route);
        expect(kitOfItem(route.item)).toBe(kit.id);
      }
    }
  });
});

describe('lab navigation between kits', () => {
  it('switches kit from the Kit list and keeps the theme', () => {
    window.history.pushState({}, '', '/templates/night/sequence');
    render(<ModalTemplatesScreen />);
    const list = screen.getByRole('combobox', { name: 'Kit' }) as HTMLSelectElement;
    for (const kit of KITS.filter((k) => k.id !== 'modals')) {
      fireEvent.change(list, { target: { value: kit.id } });
      expect(window.location.pathname).toBe(`/templates/night/${DEFAULT_ITEM[kit.id]}`);
      expect(list.value).toBe(kit.id);
    }
    fireEvent.change(list, { target: { value: 'modals' } });
    expect((screen.getByRole('combobox', { name: 'Prompt' }) as HTMLSelectElement).value).toBe(
      DEFAULT_ITEM.modals,
    );
  });

  it('cycles through every kit with the Next kit button and wraps', () => {
    window.history.pushState({}, '', '/templates/hud/decision');
    render(<ModalTemplatesScreen />);
    for (const kit of KITS.slice(1)) {
      fireEvent.click(screen.getByRole('button', { name: 'Next kit' }));
      expect(window.location.pathname).toBe(`/templates/hud/${DEFAULT_ITEM[kit.id]}`);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Next kit' }));
    expect(window.location.pathname).toBe(`/templates/hud/${DEFAULT_ITEM.modals}`);
  });

  it('hides the modal-only controls on a kit page', () => {
    window.history.pushState({}, '', '/templates/hud/board');
    render(<ModalTemplatesScreen />);
    const prompts = screen.getByRole('combobox', { name: 'Prompt' }) as HTMLSelectElement;
    expect(prompts.value).toBe('');
    expect(within(prompts).getByRole('option', { name: 'Choose a prompt…' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Header verb colour' })).toBeNull();
  });
});

describe('mulligan card selection', () => {
  const frames = (selection: 'keep' | 'discard') =>
    MODAL_STYLES.map((style) => {
      const { container, unmount } = render(
        <ModalStyleProvider style={style}>
          <CardSelectFrame code="01050" selection={selection}>
            <span>card</span>
          </CardSelectFrame>
        </ModalStyleProvider>,
      );
      const classes = container.querySelector('[data-selection]')!.className;
      unmount();
      return classes;
    });

  it.each(['keep', 'discard'] as const)('draws %s differently in every theme', (selection) => {
    expect(new Set(frames(selection)).size).toBe(MODAL_STYLES.length);
  });

  it('writes the meaning as a word, never colour alone', () => {
    const { rerender } = render(
      <ModalStyleProvider style={MODAL_STYLES[0]}>
        <CardSelectFrame code="01050" selection="keep">
          <span>card</span>
        </CardSelectFrame>
      </ModalStyleProvider>,
    );
    expect(screen.getByText('Keep')).toBeTruthy();
    rerender(
      <ModalStyleProvider style={MODAL_STYLES[0]}>
        <CardSelectFrame code="01050" selection="discard">
          <span>card</span>
        </CardSelectFrame>
      </ModalStyleProvider>,
    );
    expect(screen.getByText('Discard')).toBeTruthy();
  });
});
