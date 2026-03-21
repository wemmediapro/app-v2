import { colors as figmaCharte } from './src/theme/charte-figma.js';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      colors: {
        /* Charte graphique GNV OnBoard — voir CHARTE-GRAPHIQUE-FRONT.md */
        gnv: {
          blue: '#0E4DA4' /* Bleu GNV — logo, nav, liens */,
          sky: '#6BBDEB' /* Bleu clair — fonds, accents */,
          orange: '#E85D2E' /* Orange CTA — boutons, offres */,
          green: '#2D9D78' /* Vert annonce / éco */,
          terracotta: '#DA6F4A' /* Accents chauds, promos */,
          teal: '#3E8A7D' /* Sections calmes */,
          sand: '#F0E6D8' /* Fonds doux, cartes */,
          mint: '#8ACD85' /* Succès, éco */,
          royal: '#2944B8' /* Titres forts, header sombre */,
        },
        /* Charte Figma Airline Entertainment System — source: src/theme/charte-figma.js */
        aes: {
          primary: figmaCharte.primary,
          'primary-dark': figmaCharte.primaryDark,
          accent: figmaCharte.accent,
        },
      },
    },
  },
  plugins: [],
};
