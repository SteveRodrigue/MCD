import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DualCardInspector } from '../../src/ui/components/editor/DualCardInspector';
import { cardCatalog } from '../../src/data/importer/card-loader';
import type { CardDetailsResponse } from '../../src/tools/editor/api-middleware';

const STAMP = '2026-01-02T03:04:05Z';

const detailsFor = (code: string, supplemental: any): CardDetailsResponse => ({
  code,
  packCode: 'core',
  packFile: 'core.json',
  upstream: cardCatalog.getCard(code)!.raw,
  supplemental,
  validation: { valid: true, errors: [] },
});

const rawJson = () => JSON.parse((screen.getByRole('textbox') as HTMLTextAreaElement).value);

describe('DualCardInspector tabs', () => {
  it('has exactly two tabs, Form Builder and Raw JSON (the Visual Review tab is gone)', () => {
    render(
      <DualCardInspector
        cardDetails={detailsFor('01018', { abilities: [] })}
        loading={false}
        onSaveSupplemental={vi.fn()}
      />,
    );

    expect(screen.getByText('Form Builder')).toBeDefined();
    expect(screen.getByText('Raw JSON')).toBeDefined();
    expect(screen.queryByText('Visual Review')).toBeNull();
    expect(screen.queryByTestId('summary-card-attributes')).toBeNull();
  });

  it('shows the upstream-derived badges of the loaded card in the form builder (Hulk THW is a dash)', () => {
    render(
      <DualCardInspector
        cardDetails={detailsFor('01050', { abilities: [] })}
        loading={false}
        onSaveSupplemental={vi.fn()}
      />,
    );
    expect(screen.getByTestId('upstream-badge-dash-thwart').textContent).toBe('THW –');
  });
});

describe('DualCardInspector Raw JSON formatting (moved from the Visual Review tab, Issue #79)', () => {
  it('renders the supplemental as 2-space indented JSON, never a single-line blob', async () => {
    const user = userEvent.setup();
    render(
      <DualCardInspector
        cardDetails={detailsFor('01018', {
          abilities: [
            {
              id: 'a',
              timing: 'ACTION',
              steps: [{ effect: 'DEAL_DAMAGE', effectParams: { amount: 2 } }],
            },
          ],
        })}
        loading={false}
        onSaveSupplemental={vi.fn()}
      />,
    );

    await user.click(screen.getByText('Raw JSON'));
    const text = (screen.getByRole('textbox') as HTMLTextAreaElement).value;
    expect(text).toBe(JSON.stringify(JSON.parse(text), null, 2));
    expect(text).toContain('\n          "effectParams": {\n');
    expect(text.split('\n').length).toBeGreaterThan(5);
  });
});

describe('DualCardInspector audit stamping', () => {
  const supplemental = () => ({ abilities: [], audit: { updatedAt: STAMP, comment: 'keep me' } });

  it('intermediate edits (form and raw) never change audit.updatedAt or audit.comment', async () => {
    const user = userEvent.setup();
    render(
      <DualCardInspector
        cardDetails={detailsFor('01018', supplemental())}
        loading={false}
        onSaveSupplemental={vi.fn()}
      />,
    );

    // Edit through the form builder
    await user.click(screen.getByTestId('card-chip-add-uses'));
    fireEvent.change(screen.getByTestId('uses-count'), { target: { value: '4' } });
    await user.click(screen.getByTestId('card-chip-add-errata'));
    fireEvent.change(screen.getByTestId('card-errata-input'), { target: { value: 'ruling' } });

    await user.click(screen.getByText('Raw JSON'));
    let edited = rawJson();
    expect(edited.uses.count).toBe(4);
    expect(edited.errata).toBe('ruling');
    expect(edited.audit.updatedAt).toBe(STAMP);
    expect(edited.audit.comment).toBe('keep me');

    // Edit through the raw JSON editor
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: JSON.stringify({ ...edited, errata: 'raw edit' }, null, 2) },
    });
    edited = rawJson();
    expect(edited.errata).toBe('raw edit');
    expect(edited.audit.updatedAt).toBe(STAMP);
  });

  it('save sends the edits unchanged (the save endpoint stamps audit.updatedAt) and keeps audit.comment', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(
      <DualCardInspector
        cardDetails={detailsFor('01018', supplemental())}
        loading={false}
        onSaveSupplemental={onSave}
      />,
    );

    await user.click(screen.getByTestId('card-chip-add-errata'));
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      await user.click(screen.getByText('SAVE CARD'));
    });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    const [code, payload] = onSave.mock.calls[0];
    expect(code).toBe('01018');
    expect(payload.packFile).toBe('core.json');
    expect(payload.supplemental.audit.updatedAt).toBe(STAMP);
    expect(payload.supplemental.errata).toBe('');
    expect(payload.supplemental.audit.comment).toBe('keep me');
  });
});
