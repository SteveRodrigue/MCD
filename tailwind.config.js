import { Z } from './src/ui/styles/z-layers';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        comic: {
          yellow: '#FFDE00',
          red: '#ED1D24',
          blue: '#0284C7',
          accent: '#0284C7',
          green: '#16A34A',
          darkBlue: '#0F172A',
          dark: '#0F172A',
          black: '#111111',
          paper: '#FBF8EE',
          panel: '#FFFFFF',
          burst: '#FF3B30',
        },
        resource: {
          physical: '#D97706',
          energy: '#2563EB',
          mental: '#16A34A',
          wild: '#9333EA',
        },
      },
      fontFamily: {
        // Roles, not fixed fonts: a theme can swap them (see `fonts` in modal-styles.ts). Defaults are in index.css.
        comic: ['var(--font-comic)'],
        body: ['var(--font-body)'],
        // `font-mono` is the font for numbers and codes: a theme sets it with `fonts.numbers`.
        mono: ['var(--font-numbers)'],
        // Newspaper roles: a newspaper surface can set its own headline and body fonts; unset they follow the theme.
        'news-headline': ['var(--font-news-headline, var(--font-comic))'],
        'news-body': ['var(--font-news-body, var(--font-body))'],
      },
      // Body-sized text and headline-sized text each add a size change of the theme (see `sizes` in
      // modal-styles.ts and the .font-mono rule in index.css). Unset, the change is 0 and the sizes are Tailwind's own.
      fontSize: {
        nano: 'calc(9px + var(--text-adjust, 0px))',
        micro: 'calc(10px + var(--text-adjust, 0px))',
        mini: 'calc(11px + var(--text-adjust, 0px))',
        xs: ['calc(0.75rem + var(--text-adjust, 0px))', { lineHeight: '1rem' }],
        sm: ['calc(0.875rem + var(--text-adjust, 0px))', { lineHeight: '1.25rem' }],
        base: ['calc(1rem + var(--text-headline-adjust, 0px))', { lineHeight: '1.5rem' }],
        lg: ['calc(1.125rem + var(--text-headline-adjust, 0px))', { lineHeight: '1.75rem' }],
        xl: ['calc(1.25rem + var(--text-headline-adjust, 0px))', { lineHeight: '1.75rem' }],
        '2xl': ['calc(1.5rem + var(--text-headline-adjust, 0px))', { lineHeight: '2rem' }],
        '3xl': ['calc(1.875rem + var(--text-headline-adjust, 0px))', { lineHeight: '2.25rem' }],
        '4xl': ['calc(2.25rem + var(--text-headline-adjust, 0px))', { lineHeight: '2.5rem' }],
        '5xl': ['calc(3rem + var(--text-headline-adjust, 0px))', { lineHeight: '1' }],
        '6xl': ['calc(3.75rem + var(--text-headline-adjust, 0px))', { lineHeight: '1' }],
      },
      boxShadow: {
        'comic-xs': '1px 1px 0px 0px #111111',
        'comic-sm': '2px 2px 0px 0px #111111',
        'comic-md': '3px 3px 0px 0px #111111',
        comic: '4px 4px 0px 0px #111111',
        'comic-pop': '4px 4px 0px 0px #111111',
        'comic-lg': '8px 8px 0px 0px #111111',
        'comic-xl': '12px 12px 0px 0px #111111',
      },
      borderWidth: {
        comic: '3px',
      },
      keyframes: {
        'section-open': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'section-open': 'section-open 200ms ease-in-out',
      },
      zIndex: Object.fromEntries(Object.entries(Z).map(([key, value]) => [key, String(value)])),
    },
  },
  plugins: [],
};
