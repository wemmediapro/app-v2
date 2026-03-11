# Affiches de films (TMDB et Google)

Les affiches peuvent provenir de **TMDB** (URL directe) ou de la **recherche Google Images** (Custom Search API).

---

## Option 1 : Recherche Google (recommandée pour trouver une affiche à partir du titre)

L’API utilise **Google Custom Search** (recherche d’images) pour récupérer une URL d’affiche à partir du titre du film.

### Configuration

Dans le fichier `backend/.env` :

```env
GOOGLE_CSE_API_KEY=votre_cle_api_google
GOOGLE_CSE_CX=id_du_moteur_recherche
```

- **API Key** : [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → Create API Key. Activer l’API « Custom Search API ».
- **CX (Search Engine ID)** : [Programmable Search Engine](https://programmablesearchengine.google.com/) → créer un moteur qui recherche **tout le Web** et cocher **« Search the entire web »**. Dans les paramètres, activer **« Image search »**. L’ID (cx) s’affiche dans le tableau de bord.

Limite : environ **100 requêtes/jour gratuites**.

### Endpoints

- **`GET /api/movies/poster-search?q=Inception`**  
  Retourne `{ "url": "https://..." }` (première image trouvée pour la requête « Inception movie poster »).

- **`POST /api/movies/:id/fetch-poster`** (admin)  
  Utilise le titre du film pour faire une recherche Google, récupère l’URL de l’affiche et met à jour le champ `poster` du film.

---

## Option 2 : TMDB (affichage sans clé, chemins manuels)

Les images TMDB sont servies sans clé. Format : `https://image.tmdb.org/t/p/w500` + `poster_path`.

### Dans l’API Films

Chaque film peut avoir :

- **`poster`** : URL complète de l’affiche (prioritaire). Peut être remplie par la recherche Google ci‑dessus.
- **`tmdbPosterPath`** : chemin TMDB (ex. `/kqjL17yufvn9OVLyXYpvtyrFfak.jpg`).  
  Si `poster` est vide, l’API construit l’URL TMDB à partir de ce champ.

### Récupérer les chemins TMDB

1. Compte sur [themoviedb.org](https://www.themoviedb.org/) → API Key (gratuit).
2. `GET https://api.themoviedb.org/3/search/movie?api_key=XXX&query=Titre+du+film` → `results[].poster_path`.
3. Enregistrer dans **`tmdbPosterPath`** ou mettre l’URL complète dans **`poster`**.
