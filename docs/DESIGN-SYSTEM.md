# Design System — GNV OnBoard

Document de référence pour harmoniser les couleurs, la typographie et les espacements entre l’app passagers et le dashboard admin.

---

## 1. Palette de couleurs

### Primaire (marque GNV)
| Usage        | App passagers      | Dashboard          | Token suggéré |
|-------------|--------------------|--------------------|---------------|
| Principal   | `#264FFF`          | `blue-600` / `cyan-600` | `--gnv-primary` |
| Hover       | `#264FFF` + brightness | `blue-700` / `cyan-700` | — |
| Fond clair  | `#F0F8FF`         | `blue-50`          | `--gnv-primary-bg` |

### Texte
| Contexte    | Classe(s)                    | Contraste (recommandé ≥ 4,5:1) |
|------------|------------------------------|---------------------------------|
| Titre      | `text-slate-900` / `text-gray-900` | Fort |
| Corps      | `text-slate-700` / `text-gray-700` | Bon |
| Secondaire | `text-slate-600` / `text-gray-600` | Bon |
| Tertiaire  | `text-slate-500` / `text-gray-500` | À limiter sur fond clair |
| Placeholder| `placeholder:text-slate-500`  | Suffisant sur blanc |

### Fond
| Contexte     | App passagers      | Dashboard   |
|-------------|--------------------|-------------|
| Page        | `bg-gray-50` / dégradés | `bg-gray-50` |
| Carte       | `bg-white` + bordure    | `bg-white` + `border-gray-200` |
| Survol      | `bg-slate-50` / `hover:bg-white` | `hover:bg-gray-50` |

### Sémantique
| Type     | Couleur        | Exemple        |
|----------|----------------|----------------|
| Succès   | `green-600`    | Confirmation   |
| Erreur   | `red-600`      | Message d’erreur |
| Alerte   | `amber-500`    | Bandeau offline, avertissement |
| Info     | `blue-600`     | Liens, états actifs |

---

## 2. Typographie

- **Titres de page** : `text-2xl` à `text-3xl`, `font-bold`, `text-gray-900` / `text-slate-900`.
- **Sous-titres** : `text-base` ou `text-lg`, `text-gray-600` / `text-slate-600`.
- **Corps** : `text-sm` ou `text-base`, `font-medium` ou normal.
- **Labels** : `text-sm` ou `text-xs`, `font-medium`, `text-gray-700` / `text-slate-600`.
- **Légendes / secondaire** : `text-xs`, `text-gray-500` / `text-slate-500`.

Hiérarchie : un seul niveau de titre principal par écran, sous-titres et corps clairement différenciés.

---

## 3. Espacements

- **Base** : multiples de 4px (Tailwind : `1` = 4px).
- **Padding cartes** : `p-4` (16px) à `p-6` (24px).
- **Gap grilles** : `gap-3` (12px), `gap-4` (16px), `gap-6` (24px).
- **Marges sections** : `mt-4` à `mt-6`, `mb-4` à `mb-6`.
- **Formulaires** : `space-y-4` ou `space-y-5` entre les champs.

---

## 4. Composants réutilisables

### Boutons
- **Primaire** : `bg-[#264FFF]` ou dégradé `from-blue-600 to-cyan-600`, `text-white`, `rounded-xl`, `py-3` `px-4` ou `px-5`, `font-medium` / `font-semibold`, `focus:ring-2 focus:ring-offset-2`.
- **Secondaire** : bordure `border-gray-300` ou `border-slate-200`, fond blanc ou gris clair, même padding et rayons.
- **Icône seul** : cible tactile ≥ 44×44px sur mobile (`min-h-[44px] min-w-[44px]`), `p-2` sur desktop.

### Cartes
- `bg-white`, `rounded-xl`, `shadow-sm`, `border border-gray-200` (ou `border-slate-200`).
- Padding : `p-4` à `p-6`.

### Champs de formulaire
- `border border-gray-300` (ou `border-slate-200`), `rounded-xl`, `px-4 py-3`, `focus:ring-2 focus:ring-blue-500 focus:border-transparent`.
- Label au-dessus : `block text-sm font-medium text-gray-700 mb-1.5`.

### Accessibilité
- Tous les boutons icône : `aria-label` explicite.
- Modales : `role="dialog"`, `aria-modal="true"`, `aria-labelledby` si titre présent.
- Messages d’erreur : `role="alert"` ou `aria-live="assertive"`.
- Cibles tactiles : minimum 44×44 px pour les zones cliquables sur mobile.

---

## 5. Cohérence entre app passagers et dashboard

- Utiliser les mêmes principes de contraste (texte sombre sur fond clair).
- Réutiliser les mêmes rayons de bordure (`rounded-xl` pour cartes et boutons).
- Aligner les espacements (gap, padding) sur les valeurs ci-dessus.
- Conserver la même sémantique de couleurs (succès, erreur, alerte).

Ce document peut être complété par des exemples de code (snippets Tailwind ou composants React) et une liste de composants partagés à créer (Button, Card, Input, etc.).
