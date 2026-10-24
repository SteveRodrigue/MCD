import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ModalTemplatesScreen } from '../../src/ui/components/templates/ModalTemplatesScreen';
import { FONT_CHOICES } from '../../src/ui/components/templates/lab-font-list';
import {
  DEFAULT_FONT_INDEX,
  DEFAULT_PAIR,
  SIZE_MAX,
  SIZE_MIN,
  applyShortcut,
  clampSize,
  cycleFontIndex,
  fontShortcut,
  fontStack,
  formatSize,
  stepSize,
  textRole,
} from '../../src/ui/components/templates/font-test';

const html = document.documentElement;

const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
  fontShortcut({
    key: k,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...extra,
  });

beforeEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.pushState({}, '', '/templates/pop-art/sequence');
});

describe('font choices', () => {
  it('offers 10 to 40 distinct fonts, each with a font-face in the lab stylesheet', () => {
    expect(FONT_CHOICES.length).toBeGreaterThanOrEqual(10);
    expect(FONT_CHOICES.length).toBeLessThanOrEqual(40);
    expect(new Set(FONT_CHOICES.map((f) => f.id)).size).toBe(FONT_CHOICES.length);
    const css = readFileSync('src/ui/components/templates/lab-fonts.css', 'utf8');
    for (const font of FONT_CHOICES) {
      expect(css).toContain(`font-family: '${font.family}'`);
    }
  });

  it('does not touch the themes: test fonts only ever use the Lab prefix', () => {
    expect(FONT_CHOICES.every((f) => f.family.startsWith('Lab '))).toBe(true);
  });

  it('includes Bangers, the original headline font, as the first choice', () => {
    expect(FONT_CHOICES[0].id).toBe('bangers');
    expect(fontStack(FONT_CHOICES[0])).toContain("'Body Digits'");
  });
});

describe('cycling and shortcuts', () => {
  it('goes through every font, then back to the theme font, in both directions', () => {
    let index = DEFAULT_FONT_INDEX;
    const seen: number[] = [];
    for (let i = 0; i <= FONT_CHOICES.length; i += 1) {
      index = cycleFontIndex(index, 1);
      seen.push(index);
    }
    expect(seen.slice(0, FONT_CHOICES.length)).toEqual(FONT_CHOICES.map((_, i) => i));
    expect(seen[FONT_CHOICES.length]).toBe(DEFAULT_FONT_INDEX);
    expect(cycleFontIndex(DEFAULT_FONT_INDEX, -1)).toBe(FONT_CHOICES.length - 1);
    expect(cycleFontIndex(0, -1)).toBe(DEFAULT_FONT_INDEX);
  });

  it('reads F as both, H as headlines, B as body, Shift as back, and ignores the rest', () => {
    expect(key('f')).toEqual({ target: 'both', direction: 1 });
    expect(key('F', { shiftKey: true })).toEqual({ target: 'both', direction: -1 });
    expect(key('h')).toEqual({ target: 'headline', direction: 1 });
    expect(key('B', { shiftKey: true })).toEqual({ target: 'body', direction: -1 });
    expect(key('f', { ctrlKey: true })).toBeNull();
    expect(key('f', { metaKey: true })).toBeNull();
    expect(key('g')).toBeNull();
  });

  it('moves headlines and body together on F, and each alone on H and B', () => {
    const both = applyShortcut(DEFAULT_PAIR, 'both', 1);
    expect(both).toEqual({ ...DEFAULT_PAIR, headline: 0, body: 0 });
    expect(applyShortcut(both, 'headline', 1)).toEqual({ ...both, headline: 1 });
    expect(applyShortcut(both, 'body', -1)).toEqual({ ...both, body: DEFAULT_FONT_INDEX });
  });
});

describe('font switcher in the lab', () => {
  it('has a separate list for headlines and for body, both starting on the theme font', () => {
    render(<ModalTemplatesScreen />);
    const headlines = screen.getByRole('combobox', { name: 'Headlines font' }) as HTMLSelectElement;
    const body = screen.getByRole('combobox', { name: 'Body font' }) as HTMLSelectElement;
    expect(headlines).not.toBe(body);
    expect(headlines.value).toBe(String(DEFAULT_FONT_INDEX));
    expect(body.value).toBe(String(DEFAULT_FONT_INDEX));
    expect(within(headlines).getAllByRole('option').length).toBe(FONT_CHOICES.length + 1);
    expect(html.dataset.labHeadline).toBeUndefined();
    expect(html.dataset.labBody).toBeUndefined();
  });

  it('changes headlines and body independently from their lists', () => {
    render(<ModalTemplatesScreen />);
    const lexend = FONT_CHOICES.findIndex((f) => f.id === 'lexend');
    const lilita = FONT_CHOICES.findIndex((f) => f.id === 'lilita-one');
    fireEvent.change(screen.getByRole('combobox', { name: 'Headlines font' }), {
      target: { value: String(lilita) },
    });
    expect(html.dataset.labHeadline).toBe('lilita-one');
    expect(html.dataset.labBody).toBeUndefined();
    fireEvent.change(screen.getByRole('combobox', { name: 'Body font' }), {
      target: { value: String(lexend) },
    });
    expect(html.dataset.labBody).toBe('lexend');
    expect(html.dataset.labHeadline).toBe('lilita-one');
    expect(html.style.getPropertyValue('--lab-body-font')).toBe("'Lab Lexend'");
  });

  it('F sets both, H the headlines only, B the body only', () => {
    render(<ModalTemplatesScreen />);
    fireEvent.keyDown(window, { key: 'f' });
    expect(html.dataset.labHeadline).toBe(FONT_CHOICES[0].id);
    expect(html.dataset.labBody).toBe(FONT_CHOICES[0].id);
    fireEvent.keyDown(window, { key: 'h' });
    expect(html.dataset.labHeadline).toBe(FONT_CHOICES[1].id);
    expect(html.dataset.labBody).toBe(FONT_CHOICES[0].id);
    fireEvent.keyDown(window, { key: 'B', shiftKey: true });
    expect(html.dataset.labBody).toBeUndefined();
    expect(html.dataset.labHeadline).toBe(FONT_CHOICES[1].id);
  });

  it('does not change the font while typing in a field', () => {
    render(<ModalTemplatesScreen />);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Body font' }), { key: 'f' });
    expect(html.dataset.labHeadline).toBeUndefined();
    expect(html.dataset.labBody).toBeUndefined();
  });

  it('goes back to the theme fonts with the reset button, and cleans up when the lab closes', () => {
    const { unmount } = render(<ModalTemplatesScreen />);
    fireEvent.keyDown(window, { key: 'f' });
    fireEvent.click(screen.getByRole('button', { name: 'Theme fonts' }));
    expect(html.dataset.labHeadline).toBeUndefined();
    expect(html.dataset.labBody).toBeUndefined();
    fireEvent.keyDown(window, { key: 'f' });
    unmount();
    expect(html.dataset.labHeadline).toBeUndefined();
    expect(html.dataset.labBody).toBeUndefined();
    expect(html.style.getPropertyValue('--lab-headline-font')).toBe('');
    expect(html.style.getPropertyValue('--lab-body-font')).toBe('');
  });

  it('remembers both fonts across a reload of the lab', () => {
    const first = render(<ModalTemplatesScreen />);
    fireEvent.keyDown(window, { key: 'f' });
    fireEvent.keyDown(window, { key: 'b' });
    first.unmount();
    render(<ModalTemplatesScreen />);
    expect(html.dataset.labHeadline).toBe(FONT_CHOICES[0].id);
    expect(html.dataset.labBody).toBe(FONT_CHOICES[1].id);
  });
});

describe('newspaper fonts: an exception that wins over the default pair', () => {
  it('has its own lists for newspaper headlines and body, starting on "Follow default"', () => {
    render(<ModalTemplatesScreen />);
    const headlines = screen.getByRole('combobox', {
      name: 'Newspaper headlines font',
    }) as HTMLSelectElement;
    const body = screen.getByRole('combobox', { name: 'Newspaper body font' }) as HTMLSelectElement;
    expect(headlines.value).toBe(String(DEFAULT_FONT_INDEX));
    expect(body.value).toBe(String(DEFAULT_FONT_INDEX));
    expect(within(headlines).getByRole('option', { name: 'Follow default' })).toBeTruthy();
    expect(html.dataset.labNewsHeadline).toBeUndefined();
    expect(html.dataset.labNewsBody).toBeUndefined();
  });

  it('sets the newspaper headline and body without touching the default pair', () => {
    render(<ModalTemplatesScreen />);
    const merriweather = FONT_CHOICES.findIndex((f) => f.id === 'merriweather');
    const lexend = FONT_CHOICES.findIndex((f) => f.id === 'lexend');
    fireEvent.change(screen.getByRole('combobox', { name: 'Newspaper headlines font' }), {
      target: { value: String(merriweather) },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Newspaper body font' }), {
      target: { value: String(lexend) },
    });
    expect(html.dataset.labNewsHeadline).toBe('merriweather');
    expect(html.dataset.labNewsBody).toBe('lexend');
    expect(html.style.getPropertyValue('--lab-news-headline-font')).toBe("'Lab Merriweather'");
    expect(html.dataset.labHeadline).toBeUndefined();
    expect(html.dataset.labBody).toBeUndefined();
  });

  it('N moves both newspaper fonts, F and H leave them alone', () => {
    expect(key('n')).toEqual({ target: 'newspaper', direction: 1 });
    const news = applyShortcut(DEFAULT_PAIR, 'newspaper', 1);
    expect(news).toEqual({ ...DEFAULT_PAIR, newsHeadline: 0, newsBody: 0 });
    expect(applyShortcut(news, 'both', 1)).toEqual({
      ...DEFAULT_PAIR,
      headline: 0,
      body: 0,
      newsHeadline: 0,
      newsBody: 0,
    });
    expect(applyShortcut(DEFAULT_PAIR, 'headline', 1).newsHeadline).toBe(DEFAULT_FONT_INDEX);
    render(<ModalTemplatesScreen />);
    fireEvent.keyDown(window, { key: 'n' });
    expect(html.dataset.labNewsHeadline).toBe(FONT_CHOICES[0].id);
    expect(html.dataset.labNewsBody).toBe(FONT_CHOICES[0].id);
    expect(html.dataset.labHeadline).toBeUndefined();
  });

  it('is cleared by the reset button and when the lab closes, and remembered across a reload', () => {
    const first = render(<ModalTemplatesScreen />);
    fireEvent.keyDown(window, { key: 'n' });
    first.unmount();
    expect(html.dataset.labNewsHeadline).toBeUndefined();
    const second = render(<ModalTemplatesScreen />);
    expect(html.dataset.labNewsHeadline).toBe(FONT_CHOICES[0].id);
    fireEvent.click(screen.getByRole('button', { name: 'Theme fonts' }));
    expect(html.dataset.labNewsHeadline).toBeUndefined();
    expect(html.dataset.labNewsBody).toBeUndefined();
    second.unmount();
  });

  it('only styles text inside a newspaper, and beats the default rules there', () => {
    const css = readFileSync('src/ui/components/templates/font-test.css', 'utf8');
    expect(css).toMatch(
      /html\[data-lab-news-headline\] \[data-newspaper\] \[data-font-role='headline'\]/,
    );
    expect(css).toMatch(/html\[data-lab-news-body\] \[data-newspaper\] \[data-font-role='body'\]/);
    expect(css).toContain('var(--lab-news-headline-font)');
    expect(css).toContain('var(--lab-news-body-font)');
  });
});

describe('numbers and codes font', () => {
  it('has its own list, starting on the theme font, and is changed by M', () => {
    expect(key('m')).toEqual({ target: 'numbers', direction: 1 });
    expect(applyShortcut(DEFAULT_PAIR, 'numbers', 1)).toEqual({ ...DEFAULT_PAIR, numbers: 0 });
    render(<ModalTemplatesScreen />);
    const list = screen.getByRole('combobox', {
      name: 'Numbers and codes font',
    }) as HTMLSelectElement;
    expect(list.value).toBe(String(DEFAULT_FONT_INDEX));
    fireEvent.keyDown(window, { key: 'm' });
    expect(html.dataset.labNumbers).toBe(FONT_CHOICES[0].id);
    expect(html.style.getPropertyValue('--lab-numbers-font')).toBe(fontStack(FONT_CHOICES[0]));
    expect(html.dataset.labHeadline).toBeUndefined();
    expect(html.dataset.labBody).toBeUndefined();
  });

  it('is picked from its list, reset by the button, and remembered', () => {
    const first = render(<ModalTemplatesScreen />);
    const mono = FONT_CHOICES.findIndex((f) => f.id === 'jetbrains-mono');
    fireEvent.change(screen.getByRole('combobox', { name: 'Numbers and codes font' }), {
      target: { value: String(mono) },
    });
    expect(html.dataset.labNumbers).toBe('jetbrains-mono');
    first.unmount();
    expect(html.dataset.labNumbers).toBeUndefined();
    render(<ModalTemplatesScreen />);
    expect(html.dataset.labNumbers).toBe('jetbrains-mono');
    fireEvent.click(screen.getByRole('button', { name: 'Theme fonts' }));
    expect(html.dataset.labNumbers).toBeUndefined();
  });

  it('only styles elements that name font-mono', () => {
    const css = readFileSync('src/ui/components/templates/font-test.css', 'utf8');
    expect(css).toMatch(/html\[data-lab-numbers\] \.font-mono/);
    expect(css).toContain('var(--lab-numbers-font)');
  });
});

describe('headline and body follow what the text is', () => {
  it('calls headings and text of 17px or more a headline, and smaller text body', () => {
    expect(textRole('H2', 12)).toBe('headline');
    expect(textRole('DIV', 12, 'heading')).toBe('headline');
    expect(textRole('SPAN', 17.6)).toBe('headline');
    expect(textRole('SPAN', 26)).toBe('headline');
    expect(textRole('SPAN', 15.4)).toBe('body');
    expect(textRole('P', 13.2)).toBe('body');
  });

  it('tags the page text by role while a font is on, and removes the tags when both are off', async () => {
    render(<ModalTemplatesScreen />);
    const big = document.createElement('div');
    big.textContent = 'Big title';
    big.style.fontSize = '28px';
    const small = document.createElement('p');
    small.textContent = 'Small caption';
    small.style.fontSize = '12px';
    document.body.append(big, small);

    fireEvent.keyDown(window, { key: 'f' });
    expect(big.getAttribute('data-font-role')).toBe('headline');
    expect(small.getAttribute('data-font-role')).toBe('body');

    const late = document.createElement('span');
    late.textContent = 'Added later';
    late.style.fontSize = '30px';
    document.body.append(late);
    await waitFor(() => expect(late.getAttribute('data-font-role')).toBe('headline'));

    fireEvent.keyDown(window, { key: 'F', shiftKey: true });
    expect(big.hasAttribute('data-font-role')).toBe(false);
    big.remove();
    small.remove();
    late.remove();
  });

  it('keeps the lab bar out of the font test', () => {
    render(<ModalTemplatesScreen />);
    fireEvent.keyDown(window, { key: 'f' });
    expect(document.querySelectorAll('[data-lab-chrome] [data-font-role]')).toHaveLength(0);
  });

  it('applies each role only to its own text', () => {
    const css = readFileSync('src/ui/components/templates/font-test.css', 'utf8');
    expect(css).toMatch(/html\[data-lab-headline\] \[data-font-role='headline'\]/);
    expect(css).toMatch(/html\[data-lab-body\] \[data-font-role='body'\]/);
    expect(css).toContain('var(--lab-headline-font)');
    expect(css).toContain('var(--lab-body-font)');
  });
});

describe('size change next to each font list', () => {
  const lists = [
    ['Headlines font', '--lab-headline-size'],
    ['Body font', '--lab-body-size'],
    ['Newspaper headlines font', '--lab-news-headline-size'],
    ['Newspaper body font', '--lab-news-body-size'],
    ['Numbers and codes font', '--lab-numbers-size'],
  ] as const;

  it('steps by 1px inside the lab range, and shows the change with its sign', () => {
    expect(stepSize(0, 1)).toBe(1);
    expect(stepSize(0, -1)).toBe(-1);
    expect(stepSize(SIZE_MAX, 1)).toBe(SIZE_MAX);
    expect(stepSize(SIZE_MIN, -1)).toBe(SIZE_MIN);
    expect(clampSize(99)).toBe(SIZE_MAX);
    expect(clampSize(-99)).toBe(SIZE_MIN);
    expect(formatSize(0)).toBe('0');
    expect(formatSize(2)).toBe('+2');
    expect(formatSize(-1)).toBe('-1');
  });

  it.each(lists)('%s has a smaller and a larger button that set its own size', (name, prop) => {
    render(<ModalTemplatesScreen />);
    expect(html.dataset.labSize).toBeUndefined();
    const lower = name.toLowerCase();
    fireEvent.click(screen.getByRole('button', { name: `Larger ${lower}` }));
    fireEvent.click(screen.getByRole('button', { name: `Larger ${lower}` }));
    expect(html.style.getPropertyValue(prop)).toBe('2px');
    expect(html.dataset.labSize).toBeDefined();
    for (const [, other] of lists.filter(([, p]) => p !== prop)) {
      expect(html.style.getPropertyValue(other)).toBe('');
    }
    fireEvent.click(screen.getByRole('button', { name: `Smaller ${lower}` }));
    expect(html.style.getPropertyValue(prop)).toBe('1px');
    fireEvent.click(screen.getByRole('button', { name: `Clear the size of ${lower}` }));
    expect(html.style.getPropertyValue(prop)).toBe('');
    expect(html.dataset.labSize).toBeUndefined();
  });

  it('stops at the end of the range', () => {
    render(<ModalTemplatesScreen />);
    const larger = screen.getByRole('button', { name: 'Larger body font' });
    for (let i = 0; i < SIZE_MAX + 2; i += 1) fireEvent.click(larger);
    expect(html.style.getPropertyValue('--lab-body-size')).toBe(`${SIZE_MAX}px`);
    expect((larger as HTMLButtonElement).disabled).toBe(true);
  });

  it('is cleared by the reset button, removed when the lab closes, and remembered across a reload', () => {
    const first = render(<ModalTemplatesScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Larger headlines font' }));
    first.unmount();
    expect(html.style.getPropertyValue('--lab-headline-size')).toBe('');
    expect(html.dataset.labSize).toBeUndefined();
    const second = render(<ModalTemplatesScreen />);
    expect(html.style.getPropertyValue('--lab-headline-size')).toBe('1px');
    fireEvent.click(screen.getByRole('button', { name: 'Theme fonts' }));
    expect(html.style.getPropertyValue('--lab-headline-size')).toBe('');
    expect(html.dataset.labSize).toBeUndefined();
    second.unmount();
  });

  it('keeps the size the game gave the text, so a bigger body never turns into a headline', () => {
    render(<ModalTemplatesScreen />);
    const text = document.createElement('p');
    text.textContent = 'Caption';
    text.style.fontSize = '15px';
    document.body.append(text);
    const larger = screen.getByRole('button', { name: 'Larger body font' });
    for (let i = 0; i < 5; i += 1) fireEvent.click(larger);
    expect(text.getAttribute('data-font-role')).toBe('body');
    expect(text.style.getPropertyValue('--lab-base')).toBe('15px');
    fireEvent.click(screen.getByRole('button', { name: 'Theme fonts' }));
    expect(text.hasAttribute('data-font-role')).toBe(false);
    expect(text.style.getPropertyValue('--lab-base')).toBe('');
    text.remove();
  });

  it('adds the change to the size, with numbers and codes first, then the newspaper, then the default pair', () => {
    const css = readFileSync('src/ui/components/templates/font-test.css', 'utf8');
    expect(css).toContain('font-size: calc(var(--lab-base) + var(--lab-offset, 0px))');
    expect(css).toMatch(/html\[data-lab-size\] \.font-mono/);
    expect(css).toContain('var(--lab-mono-size, var(--lab-headline-size, 0px))');
    expect(css).toContain(
      'var(--lab-mono-size, var(--lab-news-headline-size, var(--lab-headline-size, 0px)))',
    );
    expect(css).toContain(
      'var(--lab-mono-size, var(--lab-news-body-size, var(--lab-body-size, 0px)))',
    );
    expect(css).toMatch(/\[data-font-role\]:not\(\[data-lab-chrome\] \*\)/);
  });
});
