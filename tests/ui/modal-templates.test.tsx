import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { cardNamesWithoutThumbnail as anchoringOffenders } from '../support/card-anchoring';
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

const cardNamesWithoutThumbnail = () => anchoringOffenders(KNOWN_CARDS);

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
      const stripesOf = () => document.querySelectorAll('span[aria-hidden][data-accent]');
      const anchored = () =>
        [...document.querySelectorAll('[data-card-anchor]')].filter((el) =>
          el.getAttribute('data-card-anchor'),
        );

      const select = withStyle(style, <SelectTemplate />, true);
      expect(stripesOf().length).toBeGreaterThanOrEqual(SELECT_POOL.length);
      select.unmount();

      for (const ui of [<DecisionTemplate key="d" />, <SequenceTemplate key="s" />]) {
        const rendered = withStyle(style, ui, true);
        expect(anchored().length).toBeGreaterThan(0);
        for (const el of anchored()) {
          expect(el.querySelector(':scope > span[aria-hidden][data-accent]')).toBeTruthy();
        }
        expect(document.querySelector('[data-card-ref] [data-accent]')).toBeTruthy();
        rendered.unmount();
      }
    },
  );
});

describe('template routes', () => {
  it('parses the gallery, style and archetype from the URL', () => {
    expect(parseTemplatesPath('/templates/')).toEqual({ style: null, item: 'sequence' });
    expect(parseTemplatesPath('/templates')).toEqual({ style: null, item: 'sequence' });
    expect(parseTemplatesPath('/templates/night/select')).toEqual({
      style: 'night',
      item: 'select',
    });
    expect(parseTemplatesPath('/templates/splash')).toEqual({
      style: 'splash',
      item: 'sequence',
    });
  });

  it('falls back to the gallery for an unknown style', () => {
    expect(parseTemplatesPath('/templates/template-wakanda-forever').style).toBeNull();
    expect(parseTemplatesPath('/templates/nope/decision').style).toBeNull();
  });

  it('builds paths that parse back to the same route', () => {
    for (const style of MODAL_STYLES) {
      for (const archetype of ['decision', 'sequence', 'select'] as const) {
        const route = { style: style.id, item: archetype };
        expect(parseTemplatesPath(buildTemplatesPath(route))).toEqual(route);
      }
    }
    expect(buildTemplatesPath({ style: null, item: 'select' })).toBe('/templates/');
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
      expect(screen.getByText('💥 STEP 4')).toBeTruthy();
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
      expect(screen.getByRole('dialog', { name: 'Choose your defense' })).toBeTruthy();

      rerender(
        <ModalStyleProvider style={style}>
          <DecisionTemplate forced />
        </ModalStyleProvider>,
      );
      expect(screen.getByRole('dialog', { name: 'Choose your defense' })).toBeTruthy();
    });

    it('reports the chosen option', () => {
      const onAction = vi.fn();
      withStyle(style, <DecisionTemplate onAction={onAction} />);
      fireEvent.click(screen.getByRole('button', { name: /Defend with Spider-Man/i }));
      expect(onAction).toHaveBeenCalledWith('Chose: defend');
    });

    it('names every card with its thumbnail', () => {
      withStyle(style, <DecisionTemplate />);
      expect(cardNamesWithoutThumbnail()).toEqual([]);
    });
  });

  describe('Select', () => {
    const counter = () => screen.getByTestId('select-cards-counter').textContent;

    it('counts selections, caps at the maximum and gates confirm', () => {
      const onAction = vi.fn();
      withStyle(style, <SelectTemplate onAction={onAction} />);
      const confirm = () => screen.getByTestId('select-cards-confirm') as HTMLButtonElement;

      expect(counter()).toBe('0 / 2');
      expect(confirm().disabled).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Jessica Jones' }));
      fireEvent.click(screen.getByRole('button', { name: 'Hawkeye' }));
      expect(counter()).toBe('2 / 2');
      expect((screen.getByRole('button', { name: 'Hulk' }) as HTMLButtonElement).disabled).toBe(
        true,
      );

      fireEvent.click(confirm());
      expect(onAction).toHaveBeenCalledWith('Confirmed: Jessica Jones, Hawkeye');

      fireEvent.click(screen.getByRole('button', { name: 'Hawkeye' }));
      fireEvent.click(screen.getByRole('button', { name: 'Jessica Jones' }));
      expect(counter()).toBe('0 / 2');
      expect(confirm().disabled).toBe(true);
    });

    it('shows the speech bubble and pops a burst on confirm', () => {
      withStyle(style, <SelectTemplate />);
      expect(screen.getByText('Who should I call in as backup?')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Hawkeye' }));
      expect(document.querySelector('.mcd-pop')).toBeNull();
      fireEvent.click(screen.getByTestId('select-cards-confirm'));
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
  const choose = (name: string, label: string) => {
    const list = screen.getByRole('combobox', { name }) as HTMLSelectElement;
    const option = within(list).getByRole('option', { name: label }) as HTMLOptionElement;
    fireEvent.change(list, { target: { value: option.value } });
  };

  beforeEach(() => {
    window.history.replaceState({}, '', '/templates/');
  });

  it('renders the lab controls on a portal above the modal layer so they stay clickable', () => {
    const { container } = openAt('/templates/night/sequence');
    const bar = screen.getByRole('complementary', { name: 'Lab controls' });
    expect(container.contains(bar)).toBe(false);
    expect(bar.parentElement?.className).toContain('z-critical');
    expect(screen.getByRole('dialog').className).toContain('z-modal');
  });

  it('starts the modals to the right of the controls, so the controls are never covered', () => {
    openAt('/templates/night/sequence');
    const overlay = screen.getByRole('dialog');
    expect(overlay.style.left).not.toBe('');
    expect(overlay.style.top).toBe('');
  });

  it('shows a gallery of every style at /templates/', () => {
    openAt('/templates/');
    for (const style of MODAL_STYLES) {
      expect(screen.getByTestId(`gallery-style-${style.id}`)).toBeTruthy();
    }
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is an overview only: no buttons in any style card, readable text under the previews', () => {
    openAt('/templates/');
    for (const style of MODAL_STYLES) {
      const card = screen.getByTestId(`gallery-style-${style.id}`);
      expect(within(card).queryAllByRole('button')).toHaveLength(0);
      expect(within(card).getByRole('heading', { name: style.label })).toBeTruthy();
      expect(within(card).getByText(style.tagline)).toBeTruthy();
    }
    const gallery = screen.getByTestId('gallery-style-pop-art').parentElement!.parentElement!;
    expect(gallery.className).toContain('font-body');
    expect(gallery.className).not.toContain('font-comic');
  });

  it('opens a style from the Style list while on the gallery, and updates the URL', () => {
    openAt('/templates/');
    choose('Style', 'S.H.I.E.L.D. Dossier');
    expect(window.location.pathname).toMatch(/^\/templates\/dossier\//);
    expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
  });

  it('reaches every style from the style list and keeps the modal', () => {
    openAt('/templates/pop-art/select');
    for (const style of MODAL_STYLES) {
      choose('Style', style.label);
      expect(window.location.pathname).toBe(`/templates/${style.id}/select`);
      expect((screen.getByRole('combobox', { name: 'Style' }) as HTMLSelectElement).value).toBe(
        style.id,
      );
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByTestId('select-cards-counter').textContent).toBe('0 / 2');
    }
  });

  it('cycles the style with the buttons and with T, wrapping through the gallery', () => {
    openAt('/templates/pop-art/select');
    fireEvent.click(screen.getByRole('button', { name: 'Next style' }));
    expect(window.location.pathname).toBe('/templates/storyboard/select');
    fireEvent.keyDown(window, { key: 't' });
    expect(window.location.pathname).toBe('/templates/newsprint/select');
    fireEvent.keyDown(window, { key: 'T', shiftKey: true });
    fireEvent.keyDown(window, { key: 'T', shiftKey: true });
    fireEvent.keyDown(window, { key: 'T', shiftKey: true });
    expect(window.location.pathname).toBe('/templates/');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Previous style' }));
    expect(window.location.pathname).toBe('/templates/hud/select');
  });

  it('cycles the kit with K and the modal with P, and ignores keys typed in a field', () => {
    openAt('/templates/night/decision');
    fireEvent.keyDown(window, { key: 'p' });
    expect(window.location.pathname).toBe('/templates/night/sequence');
    fireEvent.keyDown(window, { key: 'P', shiftKey: true });
    expect(window.location.pathname).toBe('/templates/night/decision');
    fireEvent.keyDown(window, { key: 'k' });
    expect(window.location.pathname).toBe('/templates/night/elements');
    expect((screen.getByRole('combobox', { name: 'Prompt' }) as HTMLSelectElement).value).toBe('');
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Kit' }), { key: 'k' });
    expect(window.location.pathname).toBe('/templates/night/elements');
  });

  it('switches modal type and resets demo state', () => {
    openAt('/templates/night/decision');

    choose('Prompt', 'Sequence');
    expect(window.location.pathname).toBe('/templates/night/sequence');
    expect(screen.getByText('EXECUTE SEQUENCE!')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Move Energy Daggers later'));
    expect(
      (screen.getByLabelText('Move Energy Daggers earlier') as HTMLButtonElement).disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(
      (screen.getByLabelText('Move Energy Daggers earlier') as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Next prompt' }));
    expect(window.location.pathname).toBe('/templates/night/select');
    expect(screen.getByTestId('select-cards-counter').textContent).toBe('0 / 2');
  });

  it('toggles card accents from the lab controls', () => {
    openAt('/templates/pop-art/select');
    expect(document.querySelector('span[aria-hidden][data-accent]')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Card accent: on/i }));
    expect(document.querySelector('span[aria-hidden][data-accent]')).toBeNull();
    expect(
      screen.getByRole('button', { name: /Card accent: off/i }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('shows the last action in the lab controls', () => {
    openAt('/templates/splash/decision');
    fireEvent.click(screen.getByRole('button', { name: /Take undefended damage/i }));
    expect(screen.getByRole('status').textContent).toBe('Chose: undefended');
  });

  it('toggles forced mode on the decision modal', () => {
    openAt('/templates/pop-art/decision');
    fireEvent.click(screen.getByRole('button', { name: /Forced: off/i }));
    expect(screen.getByRole('dialog', { name: 'Choose your defense' })).toBeTruthy();
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

  it('returns to the gallery from the first stop of the style list', () => {
    openAt('/templates/dossier/sequence');
    choose('Style', 'All styles (gallery)');
    expect(window.location.pathname).toBe('/templates/');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('gallery-style-newsprint')).toBeTruthy();
  });

  it('follows the browser back button', async () => {
    openAt('/templates/');
    choose('Style', 'Night Edition');
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
