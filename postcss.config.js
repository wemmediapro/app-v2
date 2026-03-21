/**
 * Tailwind v3+ : le JIT élimine déjà les utilitaires non utilisés (content: dans tailwind.config).
 * Ne pas ajouter PurgeCSS en parallèle (risque de casser les classes dynamiques).
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
