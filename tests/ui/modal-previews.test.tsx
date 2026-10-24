import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ModalStyleProvider } from '../../src/ui/theme/ModalStyleContext';
import { MODAL_STYLES } from '../../src/ui/theme/modal-styles';
import { ModalPreview } from '../../src/ui/components/templates/ModalPreviews';
import { ModalTemplatesScreen } from '../../src/ui/components/templates/ModalTemplatesScreen';
import {
  ARCHETYPES,
  ARCHETYPE_GROUPS,
  type ArchetypeId,
} from '../../src/ui/components/templates/template-routes';

const PREVIEWED = ARCHETYPES.map((a) => a.id).filter(
  (id): id is ArchetypeId => !['decision', 'sequence', 'select'].includes(id),
);

afterEach(cleanup);

describe('modal previews', () => {
  it('covers every real modal the game opens, in three groups', () => {
    expect(PREVIEWED).toHaveLength(16);
    expect(ARCHETYPE_GROUPS).toHaveLength(3);
    for (const a of ARCHETYPES) expect(ARCHETYPE_GROUPS).toContain(a.group);
  });

  describe.each(MODAL_STYLES.map((s) => [s.label, s] as const))('under %s', (_label, style) => {
    it.each(PREVIEWED)('renders the %s modal', (item) => {
      render(
        <ModalStyleProvider style={style} cardAccents>
          <ModalPreview item={item} onAction={() => undefined} />
        </ModalStyleProvider>,
      );
      expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
    });
  });

  it('reports what the player chose to the lab', () => {
    const events: string[] = [];
    render(
      <ModalStyleProvider style={MODAL_STYLES[0]} cardAccents>
        <ModalPreview item="infinite-loop" onAction={(m) => events.push(m)} />
      </ModalStyleProvider>,
    );
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /reset/i }));
    expect(events).toEqual(['Reset game']);
  });
});

describe('lab navigation to the previews', () => {
  it('lists every modal under its group and opens one from the list', () => {
    window.history.pushState({}, '', '/templates/splash/decision');
    render(<ModalTemplatesScreen />);
    const list = screen.getByRole('combobox', { name: 'Prompt' }) as HTMLSelectElement;
    for (const a of ARCHETYPES) {
      const option = within(list).getByRole('option', { name: a.label }) as HTMLOptionElement;
      expect(option.parentElement?.getAttribute('label')).toBe(a.group);
    }
    const payment = within(list).getByRole('option', { name: 'Payment' }) as HTMLOptionElement;
    fireEvent.change(list, { target: { value: payment.value } });
    expect(window.location.pathname).toBe('/templates/splash/payment');
    expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
  });

  it('steps through every modal with the Next modal button and wraps', () => {
    window.history.pushState({}, '', '/templates/splash/decision');
    render(<ModalTemplatesScreen />);
    for (const a of ARCHETYPES.slice(1)) {
      fireEvent.click(screen.getByRole('button', { name: 'Next prompt' }));
      expect(window.location.pathname).toBe(`/templates/splash/${a.id}`);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Next prompt' }));
    expect(window.location.pathname).toBe(`/templates/splash/${ARCHETYPES[0].id}`);
  });
});
