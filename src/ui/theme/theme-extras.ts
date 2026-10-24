import type { CSSProperties } from 'react';
import type { ModalStyleId } from './modal-styles';

/**
 * Theme tokens beyond the modal shell: the table, typography roles, forms, danger buttons and the
 * Newspaper kit. Everything else a surface needs (panels, chips, buttons, options) comes from the
 * theme's `ModalStyle`. One entry per theme; the `Record` keeps a new theme from shipping without one.
 */

export interface NewspaperTokens {
  /** Name of the era, shown in the lab. */
  era: string;
  title: string;
  tagline: string;
  flashWord: string;
  /** Page container: stock, ink, border, shadow, type. */
  sheet: string;
  texture: CSSProperties;
  textureClass: string;
  mastheadWrap: string;
  mastheadTitle: string;
  edition: string;
  taglineClass: string;
  rule: string;
  section: string;
  headline: string;
  standfirst: string;
  byline: string;
  body: string;
  story: string;
  flash: string;
  ticker: string;
  quote: string;
  classified: string;
  pill: string;
  pillActive: string;
}

export interface ThemeExtras {
  table: { bg: string; text: string; texture: CSSProperties; textureClass: string };
  danger: string;
  field: string;
  newspaper: NewspaperTokens;
}

const dots = (color: string, size = 16): CSSProperties => ({
  backgroundImage: `radial-gradient(${color} 1.5px, transparent 1.5px)`,
  backgroundSize: `${size}px ${size}px`,
});

const lines = (color: string, gap = 4): CSSProperties => ({
  backgroundImage: `repeating-linear-gradient(0deg, ${color} 0 1px, transparent 1px ${gap}px)`,
});

const grid = (color: string): CSSProperties => ({
  backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
  backgroundSize: '28px 28px',
});

const popArt: ThemeExtras = {
  table: {
    bg: 'bg-comic-paper',
    text: 'text-comic-black',
    texture: dots('rgba(237,29,36,0.5)', 20),
    textureClass: 'opacity-[0.12]',
  },
  danger:
    'bg-comic-red hover:bg-red-700 text-white border-[3px] border-comic-black rounded-xl shadow-comic-sm',
  field:
    'bg-white text-slate-900 border-2 border-comic-black rounded-lg px-2.5 py-1.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-comic-blue',
  newspaper: {
    era: '1960s broadsheet',
    title: 'THE DAILY BUGLE',
    tagline: 'All the news that is fit to print',
    flashWord: 'EXTRA!',
    sheet: 'bg-[#fbf7ee] text-slate-900 border-4 border-comic-black shadow-comic-xl font-news-body',
    texture: dots('rgba(15,23,42,0.6)', 8),
    textureClass: 'opacity-[0.06]',
    mastheadWrap: 'text-center border-b-4 border-double border-slate-900 pb-2',
    mastheadTitle: 'font-news-headline font-black uppercase tracking-tight text-4xl sm:text-5xl',
    edition:
      'flex items-center justify-between text-micro font-black uppercase tracking-[0.2em] border-y border-slate-900 py-1 mt-1',
    taglineClass: 'italic text-xs',
    rule: 'border-slate-900/70',
    section:
      'font-news-headline text-mini font-black uppercase tracking-[0.25em] border-b-2 border-slate-900 pb-0.5',
    headline: 'font-news-headline font-black text-xl leading-tight',
    standfirst: 'font-news-body italic text-sm',
    byline: 'text-micro font-bold uppercase tracking-wider text-slate-600',
    body: 'font-news-body text-sm leading-snug',
    story: 'border-b border-slate-400 pb-3',
    flash:
      'font-news-headline bg-comic-red text-white font-black uppercase tracking-widest border-2 border-comic-black px-3 py-1 -rotate-2 shadow-comic-sm',
    ticker:
      'bg-comic-black text-comic-yellow font-news-body text-xs uppercase tracking-widest px-3 py-1',
    quote: 'border-l-4 border-comic-red pl-3 italic font-news-body',
    classified: 'border-2 border-slate-900 bg-white p-2 text-xs font-bold',
    pill: 'px-2 py-1 border border-slate-900 text-mini font-black uppercase bg-white hover:bg-amber-100',
    pillActive: 'px-2 py-1 border border-slate-900 text-mini font-black uppercase bg-comic-yellow',
  },
};

const storyboard: ThemeExtras = {
  table: {
    bg: 'bg-[#f3efe2]',
    text: 'text-comic-black',
    texture: dots('rgba(0,0,0,0.5)', 14),
    textureClass: 'opacity-[0.12]',
  },
  danger:
    'bg-comic-red hover:bg-red-700 text-white border-[3px] border-comic-black rounded shadow-comic-sm',
  field:
    'bg-white text-slate-900 border-2 border-comic-black rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-comic-blue',
  newspaper: {
    era: 'Comic-strip newspaper page',
    title: 'THE DAILY BUGLE',
    tagline: 'Read it in panels',
    flashWord: 'EXTRA!',
    sheet:
      'bg-white text-comic-black border-4 border-comic-black rounded-lg shadow-[8px_8px_0_0_rgba(0,0,0,1)] font-news-body',
    texture: dots('#000', 14),
    textureClass: 'opacity-[0.1]',
    mastheadWrap: 'text-center pb-3',
    mastheadTitle:
      'inline-block font-news-headline font-black uppercase text-4xl bg-comic-yellow border-[3px] border-comic-black px-4 py-1 -rotate-1 shadow-comic-sm',
    edition:
      'flex items-center justify-center gap-4 text-micro font-black uppercase tracking-widest mt-3',
    taglineClass: 'text-xs font-bold',
    rule: 'border-comic-black',
    section:
      'font-news-headline inline-block bg-comic-red text-white text-mini font-black uppercase px-2 py-0.5 -rotate-1 border-2 border-comic-black',
    headline: 'font-news-headline font-black uppercase text-lg leading-tight',
    standfirst: 'text-sm font-bold',
    byline: 'text-micro font-black uppercase text-comic-red',
    body: 'text-sm font-bold leading-snug',
    story: 'border-[3px] border-comic-black bg-comic-paper p-3 shadow-comic-sm',
    flash:
      'font-news-headline bg-comic-yellow text-comic-black border-[3px] border-comic-black font-black uppercase px-3 py-1 rotate-2 shadow-comic',
    ticker: 'bg-comic-black text-white font-news-body text-xs uppercase tracking-wider px-3 py-1',
    quote: 'bg-white border-2 border-comic-black rounded-[1.5rem] px-3 py-2 font-bold',
    classified: 'border-2 border-comic-black bg-comic-yellow/30 p-2 text-xs font-black',
    pill: 'px-2 py-1 border-2 border-comic-black text-mini font-black uppercase bg-white',
    pillActive:
      'px-2 py-1 border-2 border-comic-black text-mini font-black uppercase bg-comic-blue text-white',
  },
};

const newsprint: ThemeExtras = {
  table: {
    bg: 'bg-[#cdbd91]',
    text: 'text-[#2b2118]',
    texture: lines('rgba(43,33,24,0.6)', 3),
    textureClass: 'opacity-[0.08]',
  },
  danger:
    'bg-red-700 hover:bg-red-800 text-[#fbf3d9] border-2 border-[#2b2118] rounded-none shadow-[3px_3px_0_0_rgba(43,33,24,0.85)]',
  field:
    'bg-[#fbf3d9] text-[#2b2118] border-2 border-[#2b2118] rounded-none px-2.5 py-1.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-red-700',
  newspaper: {
    era: 'Old-school printing press',
    title: 'THE DAILY BUGLE',
    tagline: 'Set in wood type since 1897',
    flashWord: 'STOP THE PRESSES!',
    sheet:
      'bg-[#e9dcb5] text-[#2b2118] border-[3px] border-[#2b2118] shadow-[8px_8px_0_0_#2b2118] font-news-body',
    texture: lines('rgba(43,33,24,0.7)', 3),
    textureClass: 'opacity-[0.1]',
    mastheadWrap: 'text-center border-y-[6px] border-double border-[#2b2118] py-2',
    mastheadTitle: 'font-news-headline font-black uppercase tracking-tighter text-5xl',
    edition:
      'flex items-center justify-between text-micro uppercase tracking-[0.3em] border-b-2 border-[#2b2118] py-1',
    taglineClass: 'italic text-xs',
    rule: 'border-[#2b2118]',
    section:
      'font-news-headline text-mini uppercase tracking-[0.3em] font-bold border-b border-[#2b2118]',
    headline: 'font-news-headline font-black uppercase tracking-tight text-xl leading-none',
    standfirst: 'font-news-body italic text-sm',
    byline: 'text-micro uppercase tracking-widest',
    body: 'font-news-body text-sm leading-snug',
    story: 'border-b-2 border-double border-[#2b2118] pb-3',
    flash:
      'font-news-headline bg-[#2b2118] text-[#e9dcb5] font-black uppercase tracking-[0.3em] px-3 py-1 border-2 border-[#2b2118]',
    ticker: 'border-y-2 border-[#2b2118] font-news-body italic text-xs px-3 py-1',
    quote: 'border-l-4 border-[#2b2118] pl-3 italic',
    classified: 'border border-dashed border-[#2b2118] p-2 text-xs',
    pill: 'px-2 py-1 border border-[#2b2118] text-mini uppercase tracking-widest hover:bg-[#d8c995]',
    pillActive:
      'px-2 py-1 border border-[#2b2118] text-mini uppercase tracking-widest bg-[#2b2118] text-[#e9dcb5]',
  },
};

const night: ThemeExtras = {
  table: {
    bg: 'bg-slate-900',
    text: 'text-slate-100',
    texture: dots('rgba(255,255,255,0.5)', 22),
    textureClass: 'opacity-[0.05]',
  },
  danger:
    'bg-red-500 hover:bg-red-400 text-black border-[3px] border-black rounded-xl shadow-[0_0_16px_rgba(239,68,68,0.5)]',
  field:
    'bg-slate-800 text-slate-100 border-2 border-slate-600 rounded-lg px-2.5 py-1.5 text-sm font-body focus:outline-none focus:border-yellow-300',
  newspaper: {
    era: 'Dark news site',
    title: 'THE DAILY BUGLE',
    tagline: 'Live from the city that never sleeps',
    flashWord: 'BREAKING',
    sheet:
      'bg-slate-950 text-slate-100 border-4 border-yellow-300 rounded-xl shadow-[0_0_0_4px_#000,0_0_44px_rgba(255,222,0,0.25)] font-news-body',
    texture: dots('rgba(255,255,255,0.5)', 22),
    textureClass: 'opacity-[0.04]',
    mastheadWrap: 'flex flex-wrap items-end justify-between gap-2 border-b border-slate-700 pb-3',
    mastheadTitle:
      'font-news-headline font-black tracking-tight text-3xl text-yellow-300 [text-shadow:0_0_16px_rgba(255,222,0,0.5)]',
    edition: 'text-mini text-slate-400 font-news-body',
    taglineClass: 'text-xs text-slate-400',
    rule: 'border-slate-700',
    section:
      'font-news-headline inline-block text-micro font-black uppercase tracking-widest text-yellow-300 border border-yellow-300/60 rounded-full px-2 py-0.5',
    headline: 'font-news-headline font-black text-lg leading-snug text-white',
    standfirst: 'text-sm text-slate-300',
    byline: 'text-mini text-slate-500 font-news-body',
    body: 'text-sm text-slate-300 leading-relaxed',
    story: 'bg-slate-900 border border-slate-700 rounded-xl p-3 hover:border-yellow-300/60',
    flash:
      'font-news-headline bg-red-500 text-black font-black uppercase tracking-widest rounded-full px-3 py-1 shadow-[0_0_16px_rgba(239,68,68,0.6)]',
    ticker:
      'bg-slate-900 border border-slate-700 text-yellow-300 font-news-body text-xs px-3 py-1 rounded',
    quote: 'border-l-2 border-yellow-300 pl-3 text-slate-200 italic',
    classified: 'bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs',
    pill: 'rounded-full px-2.5 py-1 border border-slate-600 text-mini text-slate-300 hover:border-yellow-300',
    pillActive:
      'rounded-full px-2.5 py-1 border border-yellow-300 bg-yellow-300 text-black text-mini font-bold',
  },
};

const splash: ThemeExtras = {
  table: {
    bg: 'bg-yellow-100',
    text: 'text-comic-black',
    texture: {
      backgroundImage:
        'repeating-conic-gradient(from 0deg at 50% 30%, rgba(237,29,36,0.9) 0deg 4deg, transparent 4deg 12deg)',
    },
    textureClass: 'opacity-[0.07]',
  },
  danger:
    'bg-comic-red hover:bg-red-700 text-white border-[4px] border-comic-black rounded-2xl shadow-comic uppercase tracking-wide',
  field:
    'bg-white text-black border-[3px] border-comic-black rounded-xl px-2.5 py-1.5 text-sm focus:outline-none focus:ring-4 focus:ring-comic-yellow',
  newspaper: {
    era: 'Screaming tabloid',
    title: 'THE DAILY BUGLE',
    tagline: 'SHOCKING! SCANDALOUS! TRUE!',
    flashWord: 'EXTRA! EXTRA!',
    sheet:
      'bg-yellow-50 text-comic-black border-[6px] border-comic-black rounded-3xl shadow-[10px_10px_0_0_#ED1D24,14px_14px_0_0_#111111] font-news-body',
    texture: {
      backgroundImage:
        'repeating-conic-gradient(from 0deg at 50% 10%, rgba(237,29,36,0.9) 0deg 4deg, transparent 4deg 12deg)',
    },
    textureClass: 'opacity-[0.07]',
    mastheadWrap: 'text-center',
    mastheadTitle:
      'font-news-headline font-black uppercase text-5xl text-comic-red [text-shadow:3px_3px_0_#111] -rotate-1',
    edition:
      'inline-block bg-comic-black text-comic-yellow text-micro font-black uppercase tracking-widest px-2 py-0.5 rotate-1 mt-2',
    taglineClass: 'text-xs font-black uppercase',
    rule: 'border-comic-black',
    section:
      'font-news-headline inline-block bg-comic-black text-comic-yellow text-mini font-black uppercase px-2 py-0.5 rotate-1',
    headline:
      'font-news-headline font-black uppercase text-2xl leading-none [text-shadow:2px_2px_0_#FFDE00]',
    standfirst: 'text-sm font-bold',
    byline: 'text-micro font-black uppercase text-comic-red',
    body: 'text-sm font-bold leading-snug',
    story: 'bg-white border-[4px] border-comic-black rounded-2xl p-3 shadow-comic -rotate-[0.4deg]',
    flash:
      'font-news-headline bg-comic-red text-white font-black uppercase tracking-wide border-[4px] border-comic-black rounded-full px-4 py-1 shadow-comic-lg -rotate-3 text-lg',
    ticker:
      'bg-comic-black text-comic-yellow font-news-body text-sm uppercase tracking-wider px-3 py-1',
    quote: 'bg-white border-[3px] border-comic-black rounded-3xl px-4 py-2 font-black',
    classified: 'border-[3px] border-comic-black bg-white rounded-xl p-2 text-xs font-black',
    pill: 'px-3 py-1 border-[3px] border-comic-black rounded-full text-mini font-black uppercase bg-white',
    pillActive:
      'px-3 py-1 border-[3px] border-comic-black rounded-full text-mini font-black uppercase bg-comic-yellow',
  },
};

const dossier: ThemeExtras = {
  table: {
    bg: 'bg-[#7a6a46]',
    text: 'text-[#f7ecd0]',
    texture: lines('rgba(0,0,0,0.6)', 24),
    textureClass: 'opacity-[0.12]',
  },
  danger:
    'bg-red-700 hover:bg-red-800 text-white border-2 border-black rounded-sm uppercase tracking-widest shadow-[3px_3px_0_0_rgba(0,0,0,0.6)]',
  field:
    'bg-[#fffdf5] text-[#2a2110] border border-[#8a6d3b] rounded-sm px-2.5 py-1.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-[#8a6d3b]',
  newspaper: {
    era: 'Wire-service teletype',
    title: 'DAILY BUGLE WIRE',
    tagline: 'Bulletins as received',
    flashWord: 'FLASH',
    sheet:
      'bg-[#efe3c3] text-[#2a2110] border-2 border-[#8a6d3b] rounded-md shadow-[6px_8px_0_0_rgba(0,0,0,0.5)] font-news-body',
    texture: lines('rgba(138,109,59,0.8)', 22),
    textureClass: 'opacity-[0.12]',
    mastheadWrap: 'border-b-2 border-dashed border-[#8a6d3b] pb-2',
    mastheadTitle: 'font-news-headline font-black uppercase tracking-[0.3em] text-2xl',
    edition: 'text-micro uppercase tracking-widest flex items-center justify-between mt-1',
    taglineClass: 'text-xs',
    rule: 'border-[#8a6d3b]',
    section:
      'font-news-headline inline-block bg-black text-[#f1cf5b] text-micro font-black uppercase tracking-widest px-2 py-0.5',
    headline: 'font-news-headline font-black uppercase text-base leading-tight',
    standfirst: 'text-sm',
    byline: 'text-micro uppercase tracking-widest text-[#6a5628]',
    body: 'text-sm leading-snug',
    story: 'border border-dashed border-[#8a6d3b] bg-[#fffdf5] p-3',
    flash:
      'font-news-headline border-4 border-double border-red-700 text-red-700 font-black uppercase tracking-[0.3em] px-3 py-1 -rotate-3',
    ticker: 'bg-black text-[#f1cf5b] font-news-body text-xs tracking-widest px-3 py-1',
    quote: 'bg-[#fff3a8] border border-[#8a6d3b] p-2 text-sm',
    classified: 'border border-[#8a6d3b] bg-[#f6ecc8] p-2 text-xs',
    pill: 'px-2 py-1 border border-[#8a6d3b] text-mini uppercase tracking-widest bg-[#fffdf5]',
    pillActive:
      'px-2 py-1 border border-black text-mini uppercase tracking-widest bg-black text-[#f1cf5b]',
  },
};

const hud: ThemeExtras = {
  table: {
    bg: 'bg-[#020a14]',
    text: 'text-cyan-100',
    texture: grid('rgba(34,211,238,0.7)'),
    textureClass: 'opacity-[0.07]',
  },
  danger:
    'bg-red-500 hover:bg-red-400 text-[#021018] border border-red-200 rounded-sm uppercase tracking-widest shadow-[0_0_16px_rgba(239,68,68,0.6)]',
  field:
    'bg-[#04101c] text-cyan-100 border border-cyan-500/60 rounded-sm px-2.5 py-1.5 text-sm font-body focus:outline-none focus:border-cyan-300',
  newspaper: {
    era: 'Holographic news feed',
    title: 'DAILY BUGLE // LIVE',
    tagline: 'Streaming from 40,000 feeds',
    flashWord: 'ALERT',
    sheet:
      'bg-[#04101c] text-cyan-100 border border-cyan-400 rounded-sm shadow-[0_0_0_1px_#000,0_0_36px_rgba(34,211,238,0.35)] font-news-body',
    texture: lines('rgba(34,211,238,0.9)', 4),
    textureClass: 'opacity-[0.05]',
    mastheadWrap: 'border-b border-cyan-500/60 pb-2',
    mastheadTitle:
      'font-news-headline font-black uppercase tracking-[0.3em] text-2xl text-cyan-300 [text-shadow:0_0_12px_rgba(34,211,238,0.6)]',
    edition: 'text-micro text-cyan-200/60 uppercase tracking-widest mt-1',
    taglineClass: 'text-xs text-cyan-200/60',
    rule: 'border-cyan-500/50',
    section:
      'font-news-headline text-micro uppercase tracking-[0.25em] text-amber-300 border-l-2 border-amber-300 pl-2',
    headline: 'font-news-headline font-bold text-base text-cyan-50 leading-snug',
    standfirst: 'text-sm text-cyan-200/80',
    byline: 'text-micro uppercase tracking-widest text-cyan-200/50',
    body: 'text-sm text-cyan-100/90 leading-relaxed',
    story: 'bg-[#0a2036]/90 border border-cyan-500/60 p-3',
    flash:
      'font-news-headline bg-amber-300 text-[#021018] font-black uppercase tracking-[0.2em] px-3 py-1 shadow-[0_0_16px_rgba(252,211,77,0.6)]',
    ticker:
      'bg-[#0a2036] border border-cyan-500/60 text-cyan-300 text-xs px-3 py-1 uppercase tracking-widest',
    quote: 'border-l-2 border-cyan-400 pl-3 text-cyan-100',
    classified: 'bg-[#04101c] border border-dashed border-cyan-500/50 p-2 text-xs',
    pill: 'px-2 py-1 border border-cyan-500/60 text-mini uppercase tracking-widest text-cyan-300 hover:border-cyan-300',
    pillActive:
      'px-2 py-1 border border-cyan-300 text-mini uppercase tracking-widest bg-cyan-400 text-[#021018]',
  },
};

export const THEME_EXTRAS: Record<ModalStyleId, ThemeExtras> = {
  'pop-art': popArt,
  storyboard,
  newsprint,
  night,
  splash,
  dossier,
  hud,
};
