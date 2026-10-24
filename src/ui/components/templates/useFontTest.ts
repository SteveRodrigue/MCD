import { useCallback, useEffect, useState } from 'react';
import { FONT_CHOICES } from './lab-font-list';
import {
  DEFAULT_FONT_INDEX,
  DEFAULT_PAIR,
  DEFAULT_SIZES,
  applyShortcut,
  clampSize,
  fontAt,
  fontShortcut,
  fontStack,
  isTypingTarget,
  stepSize,
  textRole,
  type FontPair,
  type FontSizes,
  type FontSlot,
  type ShortcutTarget,
} from './font-test';

const STORAGE_KEY = 'mcd.lab.fontTest.v3';
const ROLE_ATTR = 'data-font-role';
/** The size the game gives a piece of text, kept on the element so the size change can be added to it. */
const BASE_PROP = '--lab-base';

const indexOfId = (id: unknown): number => {
  const index = FONT_CHOICES.findIndex((f) => f.id === id);
  return index >= 0 ? index : DEFAULT_FONT_INDEX;
};

const SLOTS: readonly FontSlot[] = ['headline', 'body', 'newsHeadline', 'newsBody', 'numbers'];

const savedSize = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) ? clampSize(value) : 0;

const readSaved = (): { pair: FontPair; sizes: FontSizes } => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Record<FontSlot, string | null>> & {
        sizes?: Partial<Record<FontSlot, number>>;
      };
      return {
        pair: {
          headline: indexOfId(saved.headline),
          body: indexOfId(saved.body),
          newsHeadline: indexOfId(saved.newsHeadline),
          newsBody: indexOfId(saved.newsBody),
          numbers: indexOfId(saved.numbers),
        },
        sizes: {
          headline: savedSize(saved.sizes?.headline),
          body: savedSize(saved.sizes?.body),
          newsHeadline: savedSize(saved.sizes?.newsHeadline),
          newsBody: savedSize(saved.sizes?.newsBody),
          numbers: savedSize(saved.sizes?.numbers),
        },
      };
    }
  } catch {
    // Storage can be blocked; the test then starts on the theme fonts.
  }
  return { pair: DEFAULT_PAIR, sizes: DEFAULT_SIZES };
};

/**
 * Tags every element that holds its own text with its role (headline or body), outside the lab bar,
 * and records the size the game gave it. An element already tagged is only measured again when its
 * class changed (`dirty`), because the size change overrides its size.
 */
const tagTextRoles = (root: ParentNode, dirty: ReadonlySet<Element>) => {
  const elements =
    root instanceof Element
      ? [root, ...root.querySelectorAll('*')]
      : [...root.querySelectorAll('*')];
  for (const el of elements) {
    if (el.closest('[data-lab-chrome]')) continue;
    const ownsText = [...el.childNodes].some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
    );
    if (!ownsText) continue;
    const styled = el as HTMLElement;
    if (el.hasAttribute(ROLE_ATTR) && styled.style.getPropertyValue(BASE_PROP) && !dirty.has(el)) {
      continue;
    }
    el.removeAttribute(ROLE_ATTR);
    const size = parseFloat(getComputedStyle(el).fontSize) || 0;
    styled.style.setProperty(BASE_PROP, `${size}px`);
    el.setAttribute(ROLE_ATTR, textRole(el.tagName, size, el.getAttribute('role')));
  }
};

const clearTextRoles = () => {
  for (const el of document.querySelectorAll(`[${ROLE_ATTR}]`)) {
    el.removeAttribute(ROLE_ATTR);
    (el as HTMLElement).style.removeProperty(BASE_PROP);
  }
};

const ROOT: Record<FontSlot, { attr: string; fontProp: string; sizeProp: string }> = {
  headline: {
    attr: 'labHeadline',
    fontProp: '--lab-headline-font',
    sizeProp: '--lab-headline-size',
  },
  body: { attr: 'labBody', fontProp: '--lab-body-font', sizeProp: '--lab-body-size' },
  newsHeadline: {
    attr: 'labNewsHeadline',
    fontProp: '--lab-news-headline-font',
    sizeProp: '--lab-news-headline-size',
  },
  newsBody: {
    attr: 'labNewsBody',
    fontProp: '--lab-news-body-font',
    sizeProp: '--lab-news-body-size',
  },
  numbers: {
    attr: 'labNumbers',
    fontProp: '--lab-numbers-font',
    sizeProp: '--lab-numbers-size',
  },
};

const clearRoot = () => {
  const root = document.documentElement;
  delete root.dataset.labSize;
  for (const { attr, fontProp, sizeProp } of Object.values(ROOT)) {
    delete root.dataset[attr];
    root.style.removeProperty(fontProp);
    root.style.removeProperty(sizeProp);
  }
};

/**
 * Lab-only font test with a font for headlines and one for body text, plus an optional pair for
 * newspaper surfaces that wins over the first inside a newspaper. Pick them in the lists, or press
 * F (both), H (headlines), B (body) or N (newspaper pair); Shift goes back. Each list has a size
 * change in px (smaller, larger) that is added to the size the game gives the text. The choice is
 * written on the html element, so portalled modals follow, and removed when the lab closes. The theme
 * fonts and sizes are never changed.
 */
export const useFontTest = () => {
  const [saved] = useState(readSaved);
  const [pair, setPair] = useState(saved.pair);
  const [sizes, setSizes] = useState(saved.sizes);

  const shortcut = useCallback(
    (target: ShortcutTarget, direction: 1 | -1) =>
      setPair((p) => applyShortcut(p, target, direction)),
    [],
  );
  const setFont = useCallback(
    (slot: FontSlot, index: number) => setPair((p) => ({ ...p, [slot]: index })),
    [],
  );
  const stepFontSize = useCallback(
    (slot: FontSlot, direction: 1 | -1) =>
      setSizes((s) => ({ ...s, [slot]: stepSize(s[slot], direction) })),
    [],
  );
  const clearFontSize = useCallback((slot: FontSlot) => setSizes((s) => ({ ...s, [slot]: 0 })), []);
  const reset = useCallback(() => {
    setPair(DEFAULT_PAIR);
    setSizes(DEFAULT_SIZES);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    for (const slot of SLOTS) {
      const font = fontAt(pair[slot]);
      const { attr, fontProp, sizeProp } = ROOT[slot];
      if (font) {
        root.dataset[attr] = font.id;
        root.style.setProperty(fontProp, fontStack(font));
      } else {
        delete root.dataset[attr];
        root.style.removeProperty(fontProp);
      }
      if (sizes[slot] !== 0) root.style.setProperty(sizeProp, `${sizes[slot]}px`);
      else root.style.removeProperty(sizeProp);
    }
    if (SLOTS.some((slot) => sizes[slot] !== 0)) root.dataset.labSize = '';
    else delete root.dataset.labSize;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...Object.fromEntries(SLOTS.map((slot) => [slot, fontAt(pair[slot])?.id ?? null])),
          sizes,
        }),
      );
    } catch {
      // Nothing to do: the choice just does not survive a reload.
    }
  }, [pair, sizes]);

  const active =
    SLOTS.some((slot) => pair[slot] !== DEFAULT_FONT_INDEX) ||
    SLOTS.some((slot) => sizes[slot] !== 0);

  // Text is tagged by role while a font or a size change is on, and again as the page changes (modals opening, text updating).
  useEffect(() => {
    if (!active) {
      clearTextRoles();
      return;
    }
    const dirty = new Set<Element>();
    tagTextRoles(document.body, dirty);
    let frame = 0;
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) if (m.type === 'attributes') dirty.add(m.target as Element);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        tagTextRoles(document.body, dirty);
        dirty.clear();
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [active]);

  useEffect(
    () => () => {
      clearTextRoles();
      clearRoot();
    },
    [],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const match = fontShortcut(event);
      if (match === null || isTypingTarget(event.target)) return;
      event.preventDefault();
      shortcut(match.target, match.direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcut]);

  return { pair, sizes, setFont, stepFontSize, clearFontSize, reset };
};
