# Architecture — application passagers (SPA)

## Point d’entrée

| Fichier                | Rôle                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `src/main.jsx`         | Providers globaux : `LanguageProvider`, **`ThemeProvider`**, `BrowserRouter`, `LazyMotion`, PWA. |
| `src/App.jsx`          | Ré-export de `app/PassengerApp.jsx`.                                                             |
| `app/PassengerApp.jsx` | `usePassengerAppModel()` → `AppPassengerLayout`.                                                 |

## État et données

| Couche                                     | Rôle                                                                                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/usePassengerAppModel.js`            | Orchestre les hooks métier (`useMoviesLogic`, `useRestaurantsLogic`, `useRadioLogic`, `useMagazineLogic`, …) et produit `mainContentProps` (mémoïsé). |
| `contexts/LanguageContext.jsx`             | Langue UI + traductions JSON.                                                                                                                         |
| `contexts/ThemeContext.jsx`                | Préférence **clair / sombre / système**, persistance `localStorage` (`gnv-theme`), classe `dark` sur `<html>` (Tailwind `darkMode: 'class'`).         |
| `contexts/PassengerMainContentContext.jsx` | Fournit `mainContentProps` à `MainContent` (évite le prop drilling depuis le layout).                                                                 |

## Présentation

| Composant                           | Rôle                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `components/AppPassengerLayout.jsx` | Coque : conditions, header, bannières offline/sync, carousel, `MainContent`, `BottomNav`. |
| `components/MainContent.jsx`        | Routeur de pages lazy selon `page`.                                                       |
| `components/AppHeader.jsx`          | Logo, retour, **`ThemeToggle`**, `LanguageSelector`.                                      |
| `components/ThemeToggle.jsx`        | Cycle clair → sombre → système.                                                           |

## Évolutions possibles

- Ajouter des utilitaires `dark:` sur les pages (`HomePage`, cartes, etc.) pour un contraste homogène en mode sombre.
- Factoriser un « slice » de `usePassengerAppModel` si un domaine grossit encore.

## Commandes utiles

```bash
npm test
npm run lint
```
