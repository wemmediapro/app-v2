# Bannière d’accueil — Comment c’est géré

## En résumé

- **Backend** : l’API `GET /api/banners` et le dashboard (page Bannières) permettent de créer/modifier des bannières (titre, description, image, lien, position, dates, etc.).
- **App passagers** : la bannière affichée sur l’écran d’accueil peut venir **soit** de l’API (première bannière active en position `home-top` ou `home`), **soit** d’un contenu **par défaut en dur** dans le code si l’API ne renvoie rien ou échoue.

## Gestion actuelle

1. **Au chargement de l’app** : un appel `GET /api/banners` est fait (sans auth). On filtre côté client les bannières actives dont la position est `home-top` ou `home`, tri par `order` puis date.
2. **Si au moins une bannière est trouvée** : la première est affichée (image en fond si présente, titre, description, lien optionnel).
3. **Sinon** : on affiche le bloc **statique** défini dans `src/App.jsx` (titre « ¡EL VERANO 2026 TE ESPERA… », encadré orange, lien « DESCUBRE LOS DETALLES »).

## Où modifier

| Objectif                                                      | Où                                                                                                                    |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Changer le contenu **par défaut** (quand pas de bannière API) | `src/App.jsx` : section « Promotional Banner »                                                                        |
| Gérer les bannières (CRUD, position, dates)                   | **Dashboard** → Bannières (`/banners`)                                                                                |
| API bannières                                                 | `backend/src/routes/banners.js`                                                                                       |
| Modèle (champs)                                               | `backend/src/models/Banner.js` (title, description, position, image, link, startDate, endDate, isActive, order, etc.) |

## Positions utilisées pour l’accueil

- Pour apparaître en haut de l’écran d’accueil, une bannière doit avoir la position **`home-top`** ou **`home`** et être **active** (`isActive: true`). L’app utilise la première de la liste retournée (après tri).

## Résumé technique

- **State** : `homeBanner` (objet ou null) dans `App.jsx`.
- **Fetch** : `useEffect` au montage, `apiService.getBanners()`, puis filtre + tri pour garder la bannière « home » à afficher.
- **Affichage** : si `homeBanner` existe → rendu dynamique (image, titre, description, lien) ; sinon → rendu statique actuel.
