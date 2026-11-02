import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { cardCatalog } from '../../src/data/importer/card-loader';
import { CardView } from '../../src/ui/components/cards/CardView';
import { DecisionPromptModal } from '../../src/ui/components/board/DecisionPromptModal';
import { CardZoomLayerContext } from '../../src/ui/context/card-zoom-layer';
import type { PendingDecisionPrompt } from '../../src/engine/models';

const zoomLayer = () => document.body.querySelector('[data-card-zoom-layer]');

describe('Card hover zoom floats above clipping panels (ADR-0012)', () => {
  it('zooms inline outside a clipping surface', () => {
    const card = cardCatalog.getCard('01112')!;
    const { container } = render(<CardView card={card} size="sm" />);
    fireEvent.mouseEnter(container.querySelector('[data-card-view]')!);
    expect(zoomLayer()).toBeNull();
  });

  it('draws the zoomed card in a body-level portal inside a clipping surface', () => {
    const card = cardCatalog.getCard('01112')!;
    const { container } = render(
      <CardZoomLayerContext.Provider value={true}>
        <div style={{ overflow: 'auto' }}>
          <CardView card={card} size="sm" />
        </div>
      </CardZoomLayerContext.Provider>,
    );
    const el = container.querySelector('[data-card-view]')!;
    fireEvent.mouseEnter(el);
    const layer = zoomLayer();
    expect(layer).not.toBeNull();
    expect(container.contains(layer)).toBe(false);
    fireEvent.mouseLeave(el);
    expect(zoomLayer()).toBeNull();
  });

  it('floats cards shown in the decision modal body', () => {
    const prompt: PendingDecisionPrompt = {
      promptId: 'p',
      playerId: 'p1',
      title: 'Use ability?',
      description: 'Use the ability?',
      sourceCardName: 'Enhanced Spider-Sense',
      sourceCardCode: '01004',
      options: [{ id: 'pass', label: 'No', effect: 'PASS' }],
      isVoluntary: true,
    };
    render(<DecisionPromptModal prompt={prompt} onSelectOption={() => {}} />);
    const el = document.body.querySelector('[data-card-view="01004"]')!;
    fireEvent.mouseEnter(el);
    expect(zoomLayer()).not.toBeNull();
  });
});
