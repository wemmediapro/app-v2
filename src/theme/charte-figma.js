/**
 * Charte graphique — même que Figma "Airline Entertainment System"
 * Remplis les valeurs ci-dessous avec celles copiées depuis Figma (Inspect, Fill, Text).
 * Tailwind et les variables CSS utilisent ce fichier comme source.
 * Voir RECUPERER-CHARTE-FIGMA.md pour la marche à suivre.
 */

export const colors = {
  primary: '#264FFF',
  primaryDark: '#264FFF',
  accent: '#FF6B35',
  white: '#FFFFFF',
  success: '#2D9D78',
  alert: '#E85D2E',
  textPrimary: '#1E293B',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  background: '#F9FAFB',
  border: '#E5E7EB',
};

export const typography = {
  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontFamilyMono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
  title: { fontSize: '1.25rem', fontWeight: 700 },
  titleLg: { fontSize: '1.5rem', fontWeight: 700 },
  body: { fontSize: '0.875rem', fontWeight: 400 },
  bodyLg: { fontSize: '1rem', fontWeight: 400 },
  caption: { fontSize: '0.75rem', fontWeight: 400 },
};

export const spacing = {
  section: '1rem',
  sectionLg: '1.5rem',
  card: '1rem',
  gap: '0.5rem',
  gapLg: '0.75rem',
};

export const radius = {
  button: '0.75rem',
  card: '1rem',
  cardLg: '1.5rem',
};

/** Pour usage dans style={{ color: charte.colors.primary }} */
export default { colors, typography, spacing, radius };
