# Refactorisation App.jsx — Composant monolithique (ex ~2800 lignes)

## Statut (dernière mise à jour)

- **useBanners** : fait. **useRadio** : fait. **useWebtv** : fait. **useShipmap** : fait. **useChat** : fait. **useOnline** : fait (ARCH-2).
- **App.jsx** : shell minimal (~15 lignes) ; orchestration dans `usePassengerAppModel`, UI dans `AppPassengerLayout`, chat et domaines via hooks + contexte `MainContent`.
- **Taille historique** : ~2800 lignes monolithiques → découpée en hooks / layout ; la logique métier vit dans `src/hooks/` et `MainContent.jsx`.
- **Risque de maintenance** : modéré — l’orchestration reste centralisée dans `usePassengerAppModel.js` ; nouvelles pages = entrée `mainContentRoutes` + hook si besoin.
- Pour afficher la page Messages : ajouter `page === 'messages'` dans MainContent et un composant qui consomme `props.chat`.

## Problème

- **Un seul composant** (`App.jsx`) gère :
  - Radio (lecture, synchro heure serveur, programmation)
  - WebTV (streaming, offline, sync serveur)
  - Magazine, Restaurant, Shop
  - Chat temps réel (Socket.io)
  - 50+ variables d’état dans un même composant

Conséquences : maintenance difficile, re-renders inutiles, tests et évolutions coûteux.

## Stratégie : hooks par domaine

Chaque domaine est extrait dans un **hook dédié**. `App.jsx` ne fait plus qu’orchestrer ces hooks et passer les props à `MainContent`.

| Hook                                    | Responsabilité                                                           | Réduction estimée |
| --------------------------------------- | ------------------------------------------------------------------------ | ----------------- |
| `useRadio(language, isAnyVideoPlaying)` | État radio, chargement stations, lecture, seek serveur, MediaSession     | ~650 lignes       |
| `useWebtv(language, page)`              | Chaînes, programme du jour, sync heure serveur, playback URL, ended/loop | ~450 lignes       |
| `useBanners(page, language)`            | Bannières API, rotation, largeur viewport, impression/click              | ~80 lignes        |
| `useShipmap(language)`                  | Navires GNV, ponts, deckServices, refetchShipmap                         | ~120 lignes       |
| (optionnel) `useChat()`                 | Socket.io, conversations, messages, typing                               | ~400 lignes       |

Hooks **déjà en place** : `useMagazine`, `useRestaurant`, `useEnfant`, `useNotifications`, `useMoviesState`.

**Façades « domaine »** : `useMoviesLogic`, `useMagazineLogic`, `useRestaurantsLogic`, `useShopLogic`, `useEnfantLogic`, `useRadioLogic`, `useChatLogic`.

**App.jsx minimal (~15 lignes)** : composition via `usePassengerAppModel` + `AppPassengerLayout`. Navigation (`useAppNavigation`), sync profil (`useFavoritesProfileSync`), WebTV plein écran (`useWebtvFullscreenResume`), plan navire (`useShipmapFromBoatConfig`), promos accueil (`useHomePromosDerived`). Props `MainContent` mémoïsées dans le model ; **`PassengerMainContentContext`** fournit le bundle à `MainContent` (fallback props pour tests).

**Couverture backend** : périmètre `collectCoverageFrom` — **100 %** lignes / statements / fonctions ; branches globales typiquement **~97 %** (seuil **≥ 87 %**). Seuils Jest : **≥ 99 %** `lines` / `statements`, **100 %** `functions`, **≥ 87 %** `branches`. Exécution **un worker** (`maxWorkers: 1`) pour limiter les interférences entre suites. **Validation** : `validation.unit.test.js` (dont `validatePassword()` défaut `minLen=8`, `validateMongoId()` sans argument, `validateEmail` + `validateObjectId`). **Auth** : `POST /refresh` → `require('../middleware/auth').verifyToken` (spy) ; `auth.extended` ; `auth.2fa-flow` (dont verify 401 avec secret TOTP valide + code faux) ; `auth.getSecret.production.test.js` (`jest.isolateModules`, branches `getSecret` en `NODE_ENV=production`). **User** : `user.model.save-hook.test.js` + `mongodb-memory-server`. **Sync** : `sync.offline-queue.test.js`, `sync.parse-receiver.test.js` (`__testParseReceiver`). Messages : `messages.routes.test.js` + `messages.search-sanitize-branches.test.js`.

**Sécurité** : dernier admin non supprimable (`DELETE /admin/users/:id`, code `LAST_ADMIN`, test `tests/unit/routes/admin.last-admin.test.js`) ; uploads sous même CSRF que l’API (test `security.test.js`). HTML magazine : `sanitizeArticleContent` + DOMPurify (`src/utils/sanitize.js`).

## Structure cible de App.jsx

```jsx
function App() {
  const { t, language } = useLanguage();
  const [conditionsAccepted, setConditionsAccepted] = useState(...);
  const [page, setPage] = useState(...);
  const { isOnline, syncFeedback } = useOnline(); // connectivité + feedback sync hors ligne (src/hooks/useOnline.js)

  const radio = useRadio(language, isAnyVideoPlaying);
  const webtv = useWebtv(language, page);
  const banners = useBanners(page, language);
  const shipmap = useShipmap(language, t);

  const { ... } = useMagazine(language, t);
  const { ... } = useRestaurant(...);
  const { ... } = useEnfant(...);
  const { ... } = useNotifications(page, language);
  const { ... } = useMoviesState(language);

  // Favoris (sync serveur / localStorage) — peut rester dans App ou devenir useFavoritesSync
  // Chat (Socket) — optionnel useChat()

  return (
    <>
      <ConditionsGate ... />
      <AppHeader page={page} setPage={setPage} t={t} />
      <OfflineBanner isOnline={isOnline} t={t} />
      <main>
        <BannersCarousel {...banners} />
        <MainContent
          page={page}
          setPage={setPage}
          t={t}
          language={language}
          {...radio}
          {...webtv}
          {...bannersPropsForMainContent}
          {...shipmap}
          {...magazineProps}
          {...restaurantProps}
          ...
        />
      </main>
      <BottomNav ... />
    </>
  );
}
```

## Ordre d’implémentation

1. **useBanners** — petit, sans dépendance croisée.
2. **useRadio** — le plus gros, bien isolé (dépend seulement de `isAnyVideoPlaying`).
3. **useWebtv** — dépend de `page` pour la sync au retour sur la page.
4. **useShipmap** — chargement ponts + useMemo deckServices.
5. **useChat** (optionnel) — si la page Messages est activée.

## Fichiers concernés

- `src/hooks/useBanners.js` ✅ en place
- `src/hooks/useRadio.js` (à extraire depuis App.jsx — ~650 lignes)
- `src/hooks/useWebtv.js` (à extraire depuis App.jsx — ~450 lignes)
- `src/hooks/useShipmap.js` ✅ implémenté (boatConfig shipId, ponts, deckServices)
- `src/hooks/useChat.js` ✅ en place (Socket.io, conversations, messages, typing)
- `src/App.jsx` (allégé progressivement, cible ~400–600 lignes)
- `src/components/MainContent.jsx` (inchangé, reçoit les mêmes props)
