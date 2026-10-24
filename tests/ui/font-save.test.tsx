import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ModalTemplatesScreen } from '../../src/ui/components/templates/ModalTemplatesScreen';
import { FONT_CHOICES } from '../../src/ui/components/templates/lab-font-list';
import {
  FONT_CHOICES_ENDPOINT,
  FONT_CHOICES_FILE,
  fontChoicesEntry,
  mergeFontChoices,
} from '../../src/ui/components/templates/font-save';
import { DEFAULT_PAIR, DEFAULT_SIZES } from '../../src/ui/components/templates/font-test';

const style = { id: 'storyboard', label: 'Storyboard Panels' };
const kalam = FONT_CHOICES.findIndex((f) => f.id === 'kalam');
const NOW = new Date('2026-10-24T10:00:00.000Z');

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.pushState({}, '', '/templates/storyboard/distribute');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('font choices entry', () => {
  it('names each slot font, with null where the theme keeps its own, and keeps the sizes', () => {
    const entry = fontChoicesEntry(
      style,
      { ...DEFAULT_PAIR, body: kalam },
      { ...DEFAULT_SIZES, body: 2 },
      NOW,
    );
    expect(entry.style).toBe('storyboard');
    expect(entry.label).toBe('Storyboard Panels');
    expect(entry.savedAt).toBe('2026-10-24T10:00:00.000Z');
    expect(entry.fonts.headline).toBeNull();
    expect(entry.fonts.body).toEqual({
      id: 'kalam',
      label: FONT_CHOICES[kalam].label,
      family: FONT_CHOICES[kalam].family,
    });
    expect(entry.sizes).toEqual({ ...DEFAULT_SIZES, body: 2 });
    expect(Object.keys(entry.fonts)).toEqual([
      'headline',
      'body',
      'newsHeadline',
      'newsBody',
      'numbers',
    ]);
  });
});

describe('merging into the saved file', () => {
  const a = fontChoicesEntry({ id: 'pop-art', label: 'Pop-Art' }, DEFAULT_PAIR, DEFAULT_SIZES, NOW);
  const b = fontChoicesEntry(style, DEFAULT_PAIR, DEFAULT_SIZES, NOW);

  it('starts the file from nothing, and keeps the other themes when one is saved again', () => {
    const first = mergeFontChoices(null, a);
    expect(Object.keys(first.themes)).toEqual(['pop-art']);
    expect(first.about).toContain('font test');
    const second = mergeFontChoices(first, b);
    expect(Object.keys(second.themes)).toEqual(['pop-art', 'storyboard']);
    const newer = { ...b, sizes: { ...b.sizes, body: 3 } };
    const third = mergeFontChoices(second, newer);
    expect(third.themes.storyboard.sizes.body).toBe(3);
    expect(third.themes['pop-art']).toEqual(a);
  });

  it('ignores a file that is not ours, and rejects an entry that is not one', () => {
    expect(Object.keys(mergeFontChoices('junk', a).themes)).toEqual(['pop-art']);
    expect(() =>
      mergeFontChoices(null, { style: '../x', label: 'x', fonts: {}, sizes: {} }),
    ).toThrow();
    expect(() => mergeFontChoices(null, null)).toThrow();
    expect(() => mergeFontChoices(null, { style: 'ok' })).toThrow();
  });
});

describe('save button in the lab', () => {
  it('posts the style, fonts and sizes of the open style, and says where they went', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ModalTemplatesScreen />);
    fireEvent.keyDown(window, { key: 'b' });
    fireEvent.click(screen.getByRole('button', { name: 'Larger body font' }));
    fireEvent.click(screen.getByRole('button', { name: /Save font choices/ }));

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(FONT_CHOICES_FILE),
    );
    expect(screen.getByRole('status').textContent).toContain('Storyboard Panels');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(FONT_CHOICES_ENDPOINT);
    expect(init.method).toBe('POST');
    const sent = JSON.parse(init.body);
    expect(sent.style).toBe('storyboard');
    expect(sent.fonts.body.id).toBe(FONT_CHOICES[0].id);
    expect(sent.fonts.headline).toBeNull();
    expect(sent.sizes.body).toBe(1);
  });

  it('says so when the server refuses, instead of claiming it saved', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'disk full' }) }),
    );
    render(<ModalTemplatesScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Save font choices/ }));
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Not saved: disk full'),
    );
  });

  it('is off on the gallery, where there is no style to save', () => {
    window.history.pushState({}, '', '/templates/');
    render(<ModalTemplatesScreen />);
    expect(
      (screen.getByRole('button', { name: /Save font choices/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
