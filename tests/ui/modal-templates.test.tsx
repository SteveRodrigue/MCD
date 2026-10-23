import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ModalScaffold } from '../../src/ui/theme/ModalScaffold';
import { ModalStyleProvider } from '../../src/ui/theme/ModalStyleContext';
import { ModalTemplatesScreen } from '../../src/ui/components/templates/ModalTemplatesScreen';
import { DecisionTemplate } from '../../src/ui/components/templates/DecisionTemplate';
import { SequenceTemplate } from '../../src/ui/components/templates/SequenceTemplate';
import { SelectTemplate } from '../../src/ui/components/templates/SelectTemplate';
import { MODAL_STYLES, VERB_COLORS, type ModalStyle } from '../../src/ui/theme/modal-styles';
import { getCardAccent } from '../../src/ui/theme/card-accents';
import {
  buildTemplatesPath,
  parseTemplatesPath,
} from '../../src/ui/components/templates/template-routes';
import {
  ATTACKER,
  BLACK_WIDOW,
  HULK,
  SANDMAN,
  SELECT_POOL,
  SPIDER_MAN,
  WAKANDA_FOREVER,
  WAKANDA_UPGRADES,
} from '../../src/ui/components/templates/template-data';

const withStyle = (style: ModalStyle, ui: React.ReactElement, cardAccents = false) =>
  render(
    <ModalStyleProvider style={style} cardAccents={cardAccents}>
      {ui}
    </ModalStyleProvider>,
  );

const KNOWN_CARDS = [
  ATTACKER,
  SPIDER_MAN,
  BLACK_WIDOW,
  HULK,
  SANDMAN,
  WAKANDA_FOREVER,
  ...WAKANDA_UPGRADES,
  ...SELECT_POOL,
];

/**
 * Card Anchoring Rule: every text node that names a known card must sit inside a card reference
 * (thumbnail + name) or a real card face. A dialog title may name its own trigger card because the
 * header shows that card's thumbnail.
 */
const cardNamesWithoutThumbnail = (): string[] => {
  const offenders: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? '';
    const parent = node.parentElement;
    if (!parent) continue;
    for (const card of KNOWN_CARDS) {
      if (!text.includes(card.name)) continue;
      if (parent.closest('[data-card-ref],[data-card-view]')) continue;
      const dialog = parent.closest('[role="dialog"]');
      const isTitle = parent.closest('h2') !== null;
      if (isTitle && dialog?.querySelector(`[data-card-ref="${card.code}"]`)) continue;
      offenders.push(`${card.name}: "${text.trim()}"`);
    }
  }
  return offenders;
};

describe('Card Anchoring Rule checker', () => {
  it('flags a card name written as plain text', () => {
    render(<p>Declare Spider-Man as the defender</p>);
    expect(cardNamesWithoutThumbnail()).toHaveLength(1);
  });
});

describe('card accents', () => {
  it('uses the hero colours from the upstream pack for hero-set cards', () => {
    expect(getCardAccent('01001a')).toMatchObject({
      kind: 'hero',
      colors: ['#982828', '#2b3681', '#010101'],
    });
    expect(getCardAccent('01046')).toMatchObject({
      kind: 'hero',
      colors: ['#492b5f', '#492b5f', '#f1f017'],
    });
  });

  it('uses the villain accent for villains and nothing for unknown cards', () => {
    expect(getCardAccent('01094')?.kind).toBe('villain');
    expect(getCardAccent('does-not-exist')).toBeNull();
  });

  it('draws no accent when off', () => {
    withStyle(MODAL_STYLES[0], <SelectTemplate />, false);
    expect(document.querySelector('[data-accent]')).toBeNull();
  });

  it.each(MODAL_STYLES.map((s) => [s.label, s] as const))(
    'draws an accent on every card-bearing element in %s',
    (_label, style) => {
      const select = withStyle(style, <SelectTemplate />, true);
      expect(document.querySelectorAll('span[aria-hidden][data-accent]')).toHaveLength(
        SELECT_POOL.length,
      );
      select.unmount();

      const decision = withStyle(style, <DecisionTemplate />, true);
      // attacker panel + 4 options
      expect(document.querySelectorAll('span[aria-hidden][data-accent]')).toHaveLength(5);
      decision.unmount();

      withStyle(style, <SequenceTemplate />, true);
      // trigger panel + 4 slots
      expect(document.querySelectorAll('span[aria-hidden][data-accent]')).toHaveLength(5);
      expect(document.querySelector('[data-card-ref] [data-accent]')).toBeTruthy();
    },
  );
});

describe('template routes', () => {
  it('parses the gallery, style and archetype from the URL', () => {
    expect(parseTemplatesPath('/templates/')).toEqual({ style: null, archetype: 'sequence' });
    expect(parseTemplatesPath('/templates')).toEqual({ style: null, archetype: 'sequence' });
    expect(parseTemplatesPath('/templates/night/select')).toEqual({
      style: 'night',
      archetype: 'select',
    });
    expect(parseTemplatesPath('/templates/splash')).toEqual({
      style: 'splash',
      archetype: 'sequence',
    });
  });

  it('falls back to the gallery for an unknown style', () => {
    expect(parseTemplatesPath('/templates/template-wakanda-forever').style).toBeNull();
    expect(parseTemplatesPath('/templates/nope/decision').style).toBeNull();
  });

  it('builds paths that parse back to the same route', () => {
    for (const style of MODAL_STYLES) {
      for (const archetype of ['decision', 'sequence', 'select'] as const) {
        const route = { style: style.id, archetype };
        expect(parseTemplatesPath(buildTemplatesPath(route))).toEqual(route);
      }
    }
    expect(buildTemplatesPath({ style: null, archetype: 'select' })).toBe('/templates/');
  });
});

describe.each(MODAL_STYLES.map((s) => [s.label, s] as const))('style: %s', (_label, style) => {
  describe('ModalScaffold', () => {
    it.each(VERB_COLORS)('renders header, trigger thumbnail, body and footer for %s', (verb) => {
      withStyle(
        style,
        <ModalScaffold
          title="TEST TITLE"
          kicker="TEST KICKER"
          verb={verb}
          trigger={ATTACKER}
          icon={<span data-testid="icon">⚡</span>}
          footer={<div>TEST FOOTER</div>}
        >
          <div>TEST BODY</div>
        </ModalScaffold>,
      );

      const dialog = screen.getByRole('dialog', { name: 'TEST TITLE' });
      expect(within(dialog).getByText(/TEST KICKER/)).toBeTruthy();
      expect(within(dialog).getByTestId('icon')).toBeTruthy();
      expect(within(dialog).getByText('TEST BODY')).toBeTruthy();
      expect(within(dialog).getByText('TEST FOOTER')).toBeTruthy();
      expect(dialog.querySelector(`[data-card-ref="${ATTACKER.code}"]`)).toBeTruthy();
      expect(within(dialog).getByAltText(ATTACKER.name)).toBeTruthy();
    });

    it('omits the trigger only when explicitly null', () => {
      withStyle(
        style,
        <ModalScaffold title="NO CARD" trigger={null}>
          <div>x</div>
        </ModalScaffold>,
      );
      expect(document.querySelector('[data-card-ref]')).toBeNull();
    });
  });

  describe('Sequence (Wakanda Forever)', () => {
    it('reorders with the move buttons and executes the ordered ids', () => {
      const onExecute = vi.fn();
      withStyle(style, <SequenceTemplate onExecute={onExecute} />);

      fireEvent.click(screen.getByLabelText('Move Energy Daggers later'));
      fireEvent.click(screen.getByText('EXECUTE SEQUENCE!'));

      expect(onExecute).toHaveBeenCalledWith(['wf_claws', 'wf_daggers', 'wf_genius', 'wf_suit']);
    });

    it('disables the first earlier button and the last later button', () => {
      withStyle(style, <SequenceTemplate />);
      expect(
        (screen.getByLabelText('Move Energy Daggers earlier') as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(
        (screen.getByLabelText('Move Vibranium Suit later') as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it('marks the last step as the finisher', () => {
      withStyle(style, <SequenceTemplate />);
      expect(screen.getAllByText('💥 2 MOVE').length).toBeGreaterThan(0);
      expect(screen.getByText('STEP 4')).toBeTruthy();
    });

    it('pops a sound-effect burst on execute, with a finisher tag on the last slot', () => {
      withStyle(style, <SequenceTemplate />);
      expect(document.querySelector('.mcd-pop')).toBeNull();
      fireEvent.click(screen.getByText('EXECUTE SEQUENCE!'));
      expect(document.querySelector('.mcd-pop')?.textContent).toBeTruthy();
      expect(screen.getByText(style.finisher.label)).toBeTruthy();
    });

    it('names every card with its thumbnail', () => {
      withStyle(style, <SequenceTemplate />);
      expect(cardNamesWithoutThumbnail()).toEqual([]);
    });
  });

  describe('Decision', () => {
    it('switches title when forced', () => {
      const { rerender } = withStyle(style, <DecisionTemplate />);
      expect(screen.getByRole('dialog', { name: 'Choose defense action' })).toBeTruthy();

      rerender(
        <ModalStyleProvider style={style}>
          <DecisionTemplate forced />
        </ModalStyleProvider>,
      );
      expect(screen.getByRole('dialog', { name: 'Forced interrupt: enemy attack' })).toBeTruthy();
    });

    it('reports the chosen option', () => {
      const onAction = vi.fn();
      withStyle(style, <DecisionTemplate onAction={onAction} />);
      fireEvent.click(screen.getByRole('button', { name: /Exhaust to defend/i }));
      expect(onAction).toHaveBeenCalledWith('Chose: defend-spider-man');
    });

    it('names every card with its thumbnail', () => {
      withStyle(style, <DecisionTemplate />);
      expect(cardNamesWithoutThumbnail()).toEqual([]);
    });
  });

  describe('Select', () => {
    it('counts selections, caps at the maximum and gates confirm', () => {
      const onAction = vi.fn();
      withStyle(style, <SelectTemplate onAction={onAction} />);

      expect(screen.getByText('1 / 2 SELECTED')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Hawkeye' }));
      expect(screen.getByText('2 / 2 SELECTED')).toBeTruthy();
      expect((screen.getByRole('button', { name: 'Hulk' }) as HTMLButtonElement).disabled).toBe(
        true,
      );

      fireEvent.click(screen.getByText('CONFIRM SELECTION'));
      expect(onAction).toHaveBeenCalledWith('Confirmed: Jessica Jones, Hawkeye');

      fireEvent.click(screen.getByRole('button', { name: 'Hawkeye' }));
      fireEvent.click(screen.getByRole('button', { name: 'Jessica Jones' }));
      expect(screen.getByText('0 / 2 SELECTED')).toBeTruthy();
      expect(
        (screen.getByText('CONFIRM SELECTION').closest('button') as HTMLButtonElement).disabled,
      ).toBe(true);
    });

    it('pops a burst when a card is picked and shows the speech bubble', () => {
      withStyle(style, <SelectTemplate />);
      expect(screen.getByText('Who should I call in as backup?')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Hawkeye' }));
      expect(document.querySelector('.mcd-pop')).toBeTruthy();
    });

    it('names every card with its thumbnail', () => {
      withStyle(style, <SelectTemplate />);
      expect(cardNamesWithoutThumbnail()).toEqual([]);
    });
  });
});

describe('ModalTemplatesScreen navigation', () => {
  const openAt = (path: string, onExit?: () => void) => {
    window.history.replaceState({}, '', path);
    return render(<ModalTemplatesScreen onExit={onExit} />);
  };
  const styleBar = () => within(screen.getByRole('navigation', { name: 'Styles' }));
  const typeBar = () => within(screen.getByRole('navigation', { name: 'Modal types' }));

  beforeEach(() => {
    window.history.replaceState({}, '', '/templates/');
  });

  it('renders the lab bar on a portal above the modal layer so it stays clickable', () => {
    const { container } = openAt('/templates/night/sequence');
    const bar = screen.getByRole('banner');
    expect(container.contains(bar)).toBe(false);
    expect(bar.parentElement?.className).toContain('z-critical');
    expect(screen.getByRole('dialog').className).toContain('z-modal');
  });

  it('shows a gallery of every style at /templates/', () => {
    openAt('/templates/');
    for (const style of MODAL_STYLES) {
      expect(screen.getByTestId(`gallery-style-${style.id}`)).toBeTruthy();
    }
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a style and modal type from the gallery and updates the URL', () => {
    openAt('/templates/');
    const dossier = screen.getByTestId('gallery-style-dossier');
    fireEvent.click(within(dossier).getByRole('button', { name: 'Decision' }));

    expect(window.location.pathname).toBe('/templates/dossier/decision');
    expect(screen.getByRole('dialog', { name: 'Choose defense action' })).toBeTruthy();
  });

  it('reaches every style from the style bar and keeps the modal type', () => {
    openAt('/templates/pop-art/select');
    for (const style of MODAL_STYLES) {
      fireEvent.click(styleBar().getByRole('button', { name: style.label }));
      expect(window.location.pathname).toBe(`/templates/${style.id}/select`);
      expect(
        styleBar().getByRole('button', { name: style.label }).getAttribute('aria-current'),
      ).toBe('page');
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByText('1 / 2 SELECTED')).toBeTruthy();
    }
  });

  it('switches modal type and resets demo state', () => {
    openAt('/templates/night/decision');

    fireEvent.click(typeBar().getByRole('button', { name: 'Sequence' }));
    expect(window.location.pathname).toBe('/templates/night/sequence');
    expect(screen.getByText('EXECUTE SEQUENCE!')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Move Energy Daggers later'));
    expect(
      (screen.getByLabelText('Move Energy Daggers earlier') as HTMLButtonElement).disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }));
    expect(
      (screen.getByLabelText('Move Energy Daggers earlier') as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(typeBar().getByRole('button', { name: 'Select' }));
    expect(screen.getByText('1 / 2 SELECTED')).toBeTruthy();
  });

  it('toggles card accents from the lab bar', () => {
    openAt('/templates/pop-art/select');
    expect(document.querySelector('span[aria-hidden][data-accent]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Card accent: on/i }));
    expect(document.querySelector('span[aria-hidden][data-accent]')).toBeNull();
    expect(
      screen.getByRole('button', { name: /Card accent: off/i }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('shows the last action in the lab bar', () => {
    openAt('/templates/splash/decision');
    fireEvent.click(screen.getByRole('button', { name: /Take undefended damage/i }));
    expect(screen.getByRole('status').textContent).toBe('Chose: take-damage');
  });

  it('toggles forced mode on the decision modal', () => {
    openAt('/templates/pop-art/decision');
    fireEvent.click(screen.getByRole('button', { name: /Forced: off/i }));
    expect(screen.getByRole('dialog', { name: 'Forced interrupt: enemy attack' })).toBeTruthy();
  });

  it('overrides the header verb colour and goes back to default', () => {
    openAt('/templates/pop-art/decision');
    const group = within(screen.getByRole('group', { name: 'Header verb colour' }));
    fireEvent.click(group.getByRole('button', { name: /^blue/ }));
    expect(group.getByRole('button', { name: /^blue/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(group.getByRole('button', { name: 'Default' }));
    expect(group.getByRole('button', { name: 'Default' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('returns to the gallery with All styles', () => {
    openAt('/templates/dossier/sequence');
    fireEvent.click(screen.getByRole('button', { name: /All styles/i }));
    expect(window.location.pathname).toBe('/templates/');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('gallery-style-newsprint')).toBeTruthy();
  });

  it('follows the browser back button', async () => {
    openAt('/templates/');
    fireEvent.click(
      within(screen.getByTestId('gallery-style-night')).getByRole('button', { name: 'Select' }),
    );
    expect(screen.getByRole('dialog')).toBeTruthy();

    act(() => {
      window.history.back();
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByTestId('gallery-style-night')).toBeTruthy();
  });

  it('calls onExit from Back to game', () => {
    const onExit = vi.fn();
    openAt('/templates/', onExit);
    fireEvent.click(screen.getByRole('button', { name: /Back to game/i }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('opens an unknown style URL on the gallery', () => {
    openAt('/templates/template-wakanda-forever');
    expect(screen.getByTestId('gallery-style-pop-art')).toBeTruthy();
  });
});
