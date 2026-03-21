# Mise à jour de l'application côté serveur d'hébergement

Ce guide décrit comment mettre à jour l'application GNV OnBoard sur votre serveur d'hébergement selon le type de déploiement.

---

## 1. VPS (serveur dédié / VM — ex. 187.77.168.205)

### Option A : Mise à jour rapide (code + build + redémarrage)

Sans réinstaller MongoDB/Redis/Nginx, sans toucher à la base de données :

```bash
./scripts/update-vps.sh
```

Avec mot de passe SSH :

```bash
SSHPASS='votre_mot_de_passe' ./scripts/update-vps.sh
```

Ce script :

- synchronise le code depuis votre machine vers le VPS ;
- installe les dépendances (npm ci) et rebuild (frontend + dashboard) ;
- recharge les processus PM2 (backend, frontend, dashboard).

### Option A bis : Mise à jour avec la base de données

Pour mettre à jour **à la fois le code et la base de données** (la base locale est exportée puis restaurée sur le VPS) :

```bash
UPDATE_DB=1 ./scripts/update-vps.sh
```

ou :

```bash
./scripts/update-vps.sh --with-db
```

Avec mot de passe SSH :

```bash
SSHPASS='votre_mot_de_passe' ./scripts/update-vps.sh --with-db
```

**Prérequis** : MongoDB doit tourner en local et `mongodump` doit être disponible (MongoDB Tools). L’URI est lue depuis `backend/config.env` ou `backend/.env` (MONGODB_URI ou DATABASE_URL).

### Option B : Déploiement complet (code + export/import base locale)

Si vous voulez aussi pousser la base MongoDB locale vers le serveur :

```bash
./scripts/deploy-to-vps.sh
```

Ou avec mot de passe :

```bash
SSHPASS='votre_mot_de_passe' ./scripts/deploy-to-vps.sh
```

Ce script :

- exporte la base locale (mongodump) ;
- synchronise tout le code ;
- exécute l’installation sur le VPS (Node, MongoDB, Redis, Nginx, PM2 si besoin) ;
- importe la base sur le serveur (mongorestore ou init-db).

**À adapter** : dans `scripts/deploy-to-vps.sh`, vérifiez la variable `VPS` (ex. `root@187.77.168.205`) et `APP_DIR` (ex. `/var/www/gnv-app`).

---

## 2. Hostinger (ou hébergeur avec accès SSH + PM2)

1. **Modifiez** `deploy.sh` :
   - `REPO_URL` : URL du dépôt Git (avec token si besoin) ;
   - `BRANCH` : branche à déployer (ex. `main`) ;
   - `DEPLOY_DIR` : chemin sur Hostinger (ex. `$HOME/domains/votre-domaine.com/public_html/api`).

2. **Sur le serveur** (SSH Hostinger), exécutez :

```bash
cd /chemin/vers/votre/site
./deploy.sh
```

Ou depuis votre machine si vous avez SSH vers Hostinger :

```bash
ssh utilisateur@votre-domaine.com "cd public_html/api && ./deploy.sh"
```

Le script fait : `git pull` → sauvegarde `config.env` → `npm ci --production` dans `backend` → `pm2 restart gnv-backend`.

---

## 3. Railway / Render (PaaS)

La mise à jour se fait en **poussant le code sur GitHub** :

```bash
git add .
git commit -m "Mise à jour: description des changements"
git push origin main
```

- **Railway** et **Render** sont en général branchés sur le dépôt : chaque push déclenche un nouveau build et déploiement du backend.
- Vérifiez dans le dashboard (Railway/Render) que la branche déployée est bien `main` (ou celle configurée).
- Les variables d’environnement (MONGODB_URI, JWT_SECRET, etc.) restent inchangées sauf si vous les modifiez dans le dashboard.

---

## 4. Vercel (frontend / dashboard)

Même principe : **push sur la branche connectée** (souvent `main`) :

```bash
git add .
git commit -m "Mise à jour frontend / dashboard"
git push origin main
```

Vercel rebuild et redéploie automatiquement. Vérifiez dans Vercel que `VITE_API_URL` pointe bien vers l’URL de votre backend.

---

## Résumé

| Hébergement                   | Commande / action principale                                                 |
| ----------------------------- | ---------------------------------------------------------------------------- |
| **VPS** (mise à jour légère)  | `./scripts/update-vps.sh`                                                    |
| **VPS** (mise à jour + base)  | `UPDATE_DB=1 ./scripts/update-vps.sh` ou `./scripts/update-vps.sh --with-db` |
| **VPS** (déploiement complet) | `./scripts/deploy-to-vps.sh`                                                 |
| **Hostinger**                 | Adapter `deploy.sh` puis exécuter `./deploy.sh` sur le serveur               |
| **Railway / Render**          | `git push origin main` (déploiement auto)                                    |
| **Vercel**                    | `git push origin main` (déploiement auto)                                    |

---

## Vérifications après mise à jour

- **Backend** : `curl https://votre-serveur/api/health` (ou `http://IP/api/health` sur VPS).
- **Frontend** : ouvrir l’URL du site et vérifier que l’app se charge.
- **Logs** (VPS avec PM2) : `ssh root@IP 'pm2 logs gnv-backend --lines 50'`.
