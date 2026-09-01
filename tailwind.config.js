/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        comic: {
          yellow: '#FFDE00',
          red: '#ED1D24',
          blue: '#0284C7',
          green: '#16A34A',
          darkBlue: '#0F172A',
          black: '#111111',
          paper: '#FBF8EE',
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
        comic: ['"Bangers"', 'Impact', 'system-ui', 'sans-serif'],
        dialogue: ['"Komika Text"', '"Comic Relief"', '"Comic Sans MS"', 'cursive', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'comic-sm': '2px 2px 0px 0px #111111',
        'comic': '4px 4px 0px 0px #111111',
        'comic-lg': '8px 8px 0px 0px #111111',
      },
      borderWidth: {
        'comic': '3px',
      }
    },
  },
  plugins: [],
}
