# Configuration serveur pour le domaine (travelstream.fr)

Ce document décrit les réglages à faire **sur le serveur** (187.77.168.205) pour que l’application GNV OnBoard réponde correctement sur **travelstream.fr** (et www).

---

## 1. Nginx — nom de domaine et (optionnel) HTTPS

### 1.1 Fichier de site

Sur le serveur, le fichier Nginx (ex. `/etc/nginx/sites-available/gnv-app` ou le `nginx.conf` du projet) doit utiliser le bon `server_name` :

```nginx
server_name travelstream.fr www.travelstream.fr;
```

Remplacez `votre-domaine.com` par cette ligne dans votre config actuelle (voir `nginx.conf` à la racine du projet).

### 1.2 Activer le site et recharger Nginx

```bash
# Si vous utilisez sites-available/sites-enabled :
sudo ln -sf /etc/nginx/sites-available/gnv-app /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 1.3 HTTPS (recommandé) avec Let’s Encrypt

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d travelstream.fr -d www.travelstream.fr
```

Certbot ajoute automatiquement un bloc `listen 443 ssl` et les certificats. Après coup, l’accès se fera en **https://travelstream.fr**.

---

## 2. Backend (Node) — variables d’environnement

Dans `backend/config.env` ou `backend/.env` sur le serveur, définir :

### 2.1 CORS (obligatoire pour le domaine)

Pour que le navigateur accepte les requêtes depuis travelstream.fr :

```env
FRONTEND_URL=https://travelstream.fr,https://www.travelstream.fr,http://travelstream.fr,http://www.travelstream.fr
```

En HTTPS uniquement, vous pouvez réduire à :

```env
FRONTEND_URL=https://travelstream.fr,https://www.travelstream.fr
```

### 2.2 URLs des médias (recommandé)

Pour que les liens vidéo/audio/images pointent vers le bon domaine :

```env
API_BASE_URL=https://travelstream.fr
```

(Remplacez par `http://travelstream.fr` si vous n’avez pas encore de SSL.)

### 2.3 Autres variables utiles en production

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=un-secret-fort-et-unique
ADMIN_PASSWORD=mot-de-passe-admin-securise
```

Puis redémarrer le backend (ex. PM2) :

```bash
pm2 restart all
# ou
cd /chemin/vers/app3-backup-10mars/backend && node server.js
```

---

## 3. Frontend (app passagers) et Dashboard

- Le **Vite** du projet a déjà `allowedHosts: ['travelstream.fr']` en preview (`vite.config.js`).
- Si l’app et l’API sont servis **sous le même domaine** (travelstream.fr) via Nginx, **aucun `VITE_API_URL`** n’est nécessaire : le front utilise `window.location.origin` pour l’API et les streams.
- Si vous construisez l’app en statique et la servez depuis Nginx ou le dossier `public` du backend, faites le build depuis la machine de déploiement (ou avec les mêmes variables si vous en utilisez) :

```bash
# App passagers
npm run build
# Copier dist/* vers le répertoire servi par Nginx ou vers backend/public selon votre déploiement

# Dashboard (si utilisé)
cd dashboard && npm run build
```

---

## 4. Récapitulatif des flux

| Élément        | Rôle |
|---------------|------|
| **DNS**       | Déjà en place : A @ → 187.77.168.205, CNAME www → travelstream.fr |
| **Nginx**     | `server_name travelstream.fr www.travelstream.fr` ; proxy vers backend (3000) et frontend (5173) / dashboard (5174) |
| **Backend**   | `FRONTEND_URL` avec les origines du domaine ; `API_BASE_URL=https://travelstream.fr` |
| **Frontend**  | Même domaine = pas de variable d’env obligatoire ; build / preview selon votre choix de déploiement |

---

## 5. Vérifications rapides

- **HTTP** : `http://travelstream.fr` et `http://www.travelstream.fr` → page de l’app.
- **API** : `http://travelstream.fr/api/health` → réponse JSON.
- **WebSocket** : connexion depuis l’app (messages en temps réel) sans erreur CORS.
- **HTTPS** (après certbot) : `https://travelstream.fr` sans avertissement de certificat.

En cas de problème, vérifier les logs :

- Nginx : `sudo tail -f /var/log/nginx/error.log`
- Backend : logs PM2 ou sortie console du processus Node
