import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardView } from '../../src/ui/components/cards/CardView';
import { cardZoomScale } from '../../src/ui/components/cards/card-zoom';
import { DecisionPromptModal } from '../../src/ui/components/board/DecisionPromptModal';
import * as settings from '../../src/ui/context/useGameSettings';
import type { CardInstance, PendingDecisionPrompt } from '../../src/engine/models';
import { GameSettingsProvider } from '../../src/ui/context/GameSettingsProvider';
import type { GameSettingsContextType } from '../../src/ui/context/game-settings-context';

const zoomLayer = () => document.body.querySelector<HTMLElement>('[data-card-zoom-layer]');
const PORTRAIT = '01112';
const LANDSCAPE = '01097b';

const hover = (container: HTMLElement) => {
  const el = container.querySelector('[data-card-view]')!;
  fireEvent.mouseEnter(el);
  return el;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Card hover zoom in the top right corner (#653)', () => {
  it.each(['sm', 'hand', 'md', 'lg', 'xl'] as const)(
    'S1: a hovered %s card shows its zoom pinned top right, outside the board, ignoring the pointer',
    (size) => {
      const card = cardCatalog.getCard(PORTRAIT)!;
      const { container } = render(
        <div style={{ overflow: 'hidden' }}>
          <CardView card={card} size={size} />
        </div>,
      );
      hover(container);

      const layer = zoomLayer()!;
      expect(layer).not.toBeNull();
      expect(container.contains(layer)).toBe(false);
      expect(layer.className).toContain('fixed');
      expect(layer.className).toContain('pointer-events-none');
      expect(layer.className).toContain('z-zoom');
      expect(layer.style.top).toBe('8px');
      expect(layer.style.right).toBe('8px');
      expect(layer.style.transformOrigin).toBe('top right');
      expect(layer.style.transform).toBe('scale(2.75)');
    },
  );

  it('S1: a scheme uses the same corner at the landscape size', () => {
    const { container } = render(<CardView card={cardCatalog.getCard(LANDSCAPE)!} size="md" />);
    hover(container);
    const layer = zoomLayer()!;
    expect(layer.style.right).toBe('8px');
    expect(layer.style.transform).toBe('scale(2.5)');
  });

  it('S2: leaving removes the zoom and moving to the next card swaps it', () => {
    const { container } = render(
      <>
        <CardView card={cardCatalog.getCard(PORTRAIT)!} size="hand" />
        <CardView card={cardCatalog.getCard('01005')!} size="hand" />
      </>,
    );
    const [first, second] = Array.from(container.querySelectorAll('[data-card-view]'));
    fireEvent.mouseEnter(first);
    expect(zoomLayer()!.dataset.cardZoomLayer).toBe(PORTRAIT);
    fireEvent.mouseLeave(first);
    fireEvent.mouseEnter(second);
    expect(document.body.querySelectorAll('[data-card-zoom-layer]')).toHaveLength(1);
    expect(zoomLayer()!.dataset.cardZoomLayer).toBe('01005');
    fireEvent.mouseLeave(second);
    expect(zoomLayer()).toBeNull();
  });

  it('S2: the hovered card has no hover scale, translate or rotate', () => {
    const { container } = render(
      <CardView card={cardCatalog.getCard(PORTRAIT)!} size="hand" isExhausted={true} />,
    );
    const el = hover(container);
    const classes = [el, ...Array.from(el.querySelectorAll('*'))]
      .map((node) => node.getAttribute('class') ?? '')
      .join(' ');
    expect(classes).not.toMatch(/hover:(-?scale|-?translate|-?rotate)/);
  });

  it('S2: an unplayable card stays gray and tagged on the table while its zoom shows full colour', () => {
    const { container } = render(
      <CardView card={cardCatalog.getCard(PORTRAIT)!} size="hand" isPlayable={false} />,
    );
    const el = hover(container);
    expect(el.querySelector('.grayscale')).not.toBeNull();
    expect(el.innerHTML).not.toContain('group-hover');
    expect(el.textContent).toContain('CANNOT PLAY');
    expect(zoomLayer()!.querySelector('.grayscale')).toBeNull();
    expect(zoomLayer()!.textContent).not.toContain('CANNOT PLAY');
  });

  it('S3 exhausted: the table card stays rotated and its zoom is upright', () => {
    const { container } = render(
      <CardView card={cardCatalog.getCard(PORTRAIT)!} size="sm" isExhausted={true} />,
    );
    const el = hover(container);
    expect(el.className).toContain('rotate-30');
    const copy = zoomLayer()!.querySelector('[data-card-view]')!;
    expect(copy.className).toContain('rotate-0');
    expect(copy.className).not.toContain('rotate-30');
    expect(zoomLayer()!.textContent).not.toContain('EXHAUSTED');
  });

  it('S3 small window: the zoom shrinks to fit at every Card Zooming level', () => {
    const card = { width: 123, height: 176 };
    for (const level of ['small', 'normal', 'larger'] as const) {
      const viewport = { width: 1024, height: 400 };
      const scale = cardZoomScale(false, level, card, viewport);
      expect(card.height * scale).toBeLessThanOrEqual(viewport.height - 16);
      expect(card.width * scale).toBeLessThanOrEqual(viewport.width - 16);
    }
    expect(
      cardZoomScale(true, 'normal', { width: 194, height: 141 }, { width: 300, height: 900 }),
    ).toBeLessThanOrEqual((300 - 16) / 194);
    // Room to spare: the setting decides, not the window
    expect(cardZoomScale(false, 'normal', card, { width: 1920, height: 1080 })).toBe(2.75);
  });

  it('S3 thumbnail: a prompt option thumbnail uses the same corner zoom', () => {
    const prompt: PendingDecisionPrompt = {
      promptId: 'p',
      playerId: 'p1',
      title: 'Choose',
      sourceCardName: 'Make the Call',
      description: 'Choose a card',
      options: [{ id: 'opt', label: 'Web-Shooter', effect: 'PASS', cardCode: '01005' }],
      isVoluntary: false,
    };
    render(<DecisionPromptModal prompt={prompt} onSelectOption={() => {}} />);
    fireEvent.mouseEnter(document.body.querySelector('[data-testid="option-card-thumbnail-opt"]')!);
    const layer = document.body.querySelector<HTMLElement>('[data-card-zoom-layer="01005"]')!;
    expect(layer.style.right).toBe('8px');
  });

  it('S3 context menu: right-clicking the card closes its zoom', () => {
    const { container } = render(
      <GameSettingsProvider>
        <CardView card={cardCatalog.getCard(PORTRAIT)!} size="sm" />
      </GameSettingsProvider>,
    );
    const el = hover(container);
    expect(zoomLayer()).not.toBeNull();
    fireEvent.contextMenu(el);
    expect(zoomLayer()).toBeNull();
  });

  it.each([
    ['small', 2.475],
    ['normal', 2.75],
    ['larger', 3.025],
  ] as const)('applies the %s Card Zooming setting', (level, scale) => {
    vi.spyOn(settings, 'useOptionalGameSettings').mockReturnValue({
      cardZoomLevel: level,
    } as unknown as GameSettingsContextType);
    const { container } = render(<CardView card={cardCatalog.getCard(PORTRAIT)!} size="sm" />);
    hover(container);
    expect(zoomLayer()!.style.transform).toBe(`scale(${scale})`);
  });

  it('shows no zoom when the card turns it off', () => {
    const { container } = render(
      <CardView card={cardCatalog.getCard(PORTRAIT)!} size="sm" enableHoverZoom={false} />,
    );
    hover(container);
    expect(zoomLayer()).toBeNull();
  });

  it('keeps dynamic traits and tokens on the zoom', () => {
    const card = cardCatalog.getCard(PORTRAIT)!;
    const instance = { instanceId: 'i', card, tokens: { damage: 3 } } as unknown as CardInstance;
    const { container } = render(
      <CardView card={card} instance={instance} dynamicTraits={['Aerial']} size="sm" />,
    );
    hover(container);
    const layer = zoomLayer()!;
    expect(layer.querySelector('[data-testid="dynamic-trait-badge-aerial"]')).not.toBeNull();
    expect(layer.textContent).toContain('💥 3');
  });
});
