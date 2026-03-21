# GNV OnBoard Application

[![Tests](https://github.com/wemmediapro/app-v2/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/wemmediapro/app-v2/actions/workflows/tests.yml)
[![Load tests](https://github.com/wemmediapro/app-v2/actions/workflows/load-test.yml/badge.svg?branch=main)](https://github.com/wemmediapro/app-v2/actions/workflows/load-test.yml)
[![Security](https://github.com/wemmediapro/app-v2/actions/workflows/security.yml/badge.svg)](https://github.com/wemmediapro/app-v2/actions/workflows/security.yml)
[![Codecov](https://codecov.io/gh/wemmediapro/app-v2/branch/main/graph/badge.svg)](https://codecov.io/gh/wemmediapro/app-v2)

Application complète pour la gestion des services à bord du navire GNV Excelsior.

> **CI/CD** : voir [docs/GITHUB_CI_CD.md](docs/GITHUB_CI_CD.md) (secrets, protections de branche, Codecov).

## 🚢 Fonctionnalités

### Frontend (Application Passagers)

- **Accueil** : Vue d'ensemble des services disponibles
- **Radio GNV** : Lecteur audio avec stations en direct
- **Films & Séries** : Catalogue de contenus multimédias
- **Magazine** : Articles et actualités du navire
- **Restaurants** : Menus, promotions et réservations
- **Espace Enfant** : Activités et jeux pour enfants
- **Shop** : Boutique en ligne avec produits duty-free
- **Plan du Navire** : Carte interactive des ponts
- **Messages** : Chat entre passagers
- **Support** : Système de feedback et réclamations

### Backend API

- **Authentification** : JWT avec gestion des rôles
- **Gestion des utilisateurs** : CRUD complet
- **Restaurants** : API pour menus et promotions
- **Messages** : Chat en temps réel avec Socket.io
- **Feedback** : Système de tickets et réclamations
- **Sécurité** : Rate limiting, validation, CORS

### Dashboard Administrateur

- **Tableau de bord** : Statistiques en temps réel
- **Gestion des utilisateurs** : Administration complète
- **Restaurants** : Gestion des menus et promotions
- **Feedback** : Traitement des réclamations
- **Messages** : Modération des conversations
- **Graphiques** : Visualisation des données

## 🛠️ Technologies

### Frontend

- **React 18** avec Vite
- **Tailwind CSS** pour le styling
- **Framer Motion** pour les animations
- **Lucide React** pour les icônes

### Backend

- **Node.js** avec Express
- **MongoDB** avec Mongoose
- **JWT** pour l'authentification
- **Socket.io** pour le temps réel
- **Express Validator** pour la validation
- **Bcrypt** pour le hachage des mots de passe

### Dashboard

- **React 18** avec Vite
- **React Router** pour la navigation
- **Recharts** pour les graphiques
- **Axios** pour les appels API
- **React Hot Toast** pour les notifications

## 🚀 Installation

### Prérequis

- Node.js 22+ (aligné avec GitHub Actions)
- MongoDB (local ou Atlas)
- npm ou yarn

### Installation automatique

```bash
./setup.sh
```

### Installation manuelle

1. **Cloner le projet**

```bash
git clone <repository-url>
cd gnv_onboard_app
```

2. **Installer les dépendances**

```bash
# Frontend
npm install

# Backend
cd backend
npm install

# Dashboard
cd ../dashboard
npm install
```

3. **Configuration**

```bash
# Backend
cp backend/env.example backend/.env
# Éditer backend/.env avec vos paramètres

# Dashboard
echo "VITE_API_URL=http://localhost:3000/api" > dashboard/.env
```

## 🏃‍♂️ Démarrage

### Développement

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Dashboard
cd dashboard
npm run dev

# Terminal 3 - Frontend
npm run dev
```

### Production

```bash
# Build
npm run build
cd backend && npm run build
cd ../dashboard && npm run build

# Start
cd backend && npm start
```

## 📚 Déploiement, sécurité & documentation développeur

- **[Guide de déploiement (vue d’ensemble)](docs/DEPLOYMENT.md)** — checklist, init base, liens Nginx / PM2 / `PRODUCTION-GUIDE.md`
- **Backend** : [Sécurité](backend/docs/SECURITY.md) · [Validateurs API](backend/docs/VALIDATION.md)
- **OpenAPI / Swagger** : [docs/OPENAPI.md](docs/OPENAPI.md) — UI `/api-docs`, export `npm run openapi:json` → `backend/docs/openapi.json`
- **Tests** : [docs/TESTING.md](docs/TESTING.md) · détail Jest : [backend/tests/README.md](backend/tests/README.md)
- **Performance** : [docs/PERFORMANCE.md](docs/PERFORMANCE.md) · charge : [tests/load/README.md](tests/load/README.md)
- **Sécurité (synthèse dev)** : [docs/SECURITY-BEST-PRACTICES.md](docs/SECURITY-BEST-PRACTICES.md) · [SECURITY.md](SECURITY.md)
- **Schémas API (Mongoose vs OpenAPI)** : [docs/API-SCHEMA.md](docs/API-SCHEMA.md)

## 📱 URLs d'accès

- **Frontend** : http://localhost:5173
- **Dashboard** : http://localhost:3001
- **Backend API** : http://localhost:3000 — REST versionné sous **`/api/v1`** (alias **`/api`** pour rétrocompatibilité)
- **Health (liveness)** : http://localhost:3000/api/v1/health · **Swagger** : http://localhost:3000/api-docs (si activé)

## 🔑 Connexion administrateur

Aucun identifiant par défaut (sécurité). Créez un admin une fois la base configurée :

```bash
cd backend
# Définir ADMIN_EMAIL et ADMIN_PASSWORD dans config.env
node scripts/init-admin.js
```

Conservez le mot de passe temporaire affiché et changez-le à la première connexion.

## 📊 Structure du projet

```
gnv_onboard_app/
├── src/                    # Frontend React
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── backend/                 # Backend Node.js
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── utils/
│   ├── server.js
│   └── package.json
├── dashboard/              # Dashboard Admin
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   └── package.json
├── package.json           # Frontend
└── README.md
```

## 🔧 Configuration

### Variables d'environnement Backend

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/gnv_onboard
JWT_SECRET=your-secret-key-min-32-characters-required-in-production
JWT_EXPIRE=7d
ADMIN_EMAIL=admin@votredomaine.local
ADMIN_PASSWORD=MotDePasseFort!
FRONTEND_URL=http://localhost:5173
REDIS_URI=redis://localhost:6379
```

En production : `JWT_SECRET` (≥ 32 caractères), `ADMIN_PASSWORD` et `MONGODB_URI` sont obligatoires.

### Variables d'environnement Dashboard

```env
VITE_API_URL=http://localhost:3000/api
```

## 📈 API Endpoints

### Authentification

- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil utilisateur
- `PUT /api/auth/profile` - Mise à jour profil

### Utilisateurs

- `GET /api/users` - Liste des utilisateurs
- `GET /api/users/:id` - Détails utilisateur

### Restaurants

- `GET /api/restaurants` - Liste des restaurants
- `GET /api/restaurants/:id` - Détails restaurant
- `POST /api/restaurants` - Créer restaurant (Admin)
- `PUT /api/restaurants/:id` - Modifier restaurant (Admin)

### Messages

- `GET /api/messages` - Conversations
- `GET /api/messages/:userId` - Messages avec utilisateur
- `POST /api/messages` - Envoyer message

### Feedback

- `POST /api/feedback` - Soumettre feedback
- `GET /api/feedback` - Mes feedbacks
- `GET /api/feedback/admin/all` - Tous les feedbacks (Admin)

### Admin

- `GET /api/admin/dashboard` - Statistiques dashboard
- `GET /api/admin/users` - Gestion utilisateurs
- `PUT /api/admin/users/:id` - Modifier utilisateur

## 🎨 Design System

### Couleurs

- **Primaire** : Bleu (#3B82F6)
- **Secondaire** : Cyan (#06B6D4)
- **Succès** : Vert (#10B981)
- **Attention** : Orange (#F59E0B)
- **Erreur** : Rouge (#EF4444)

### Typographie

- **Police** : Inter (sans-serif)
- **Tailles** : text-xs à text-6xl
- **Poids** : font-normal à font-bold

## 🔒 Sécurité

- **Authentification JWT** avec expiration
- **Validation des données** avec express-validator
- **Rate limiting** pour prévenir les abus
- **CORS** configuré pour les domaines autorisés
- **Helmet** pour les headers de sécurité
- **Hachage des mots de passe** avec bcrypt

## 🧪 Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
npm test
```

## 📦 Déploiement

### 🚀 Déploiement Moderne avec GitHub + Vercel + Railway/Render

Ce projet est configuré pour un déploiement automatisé via GitHub.

#### Prérequis

- Un compte GitHub
- Un compte Vercel (gratuit)
- Un compte Railway ou Render (gratuit pour commencer)
- MongoDB Atlas (gratuit) ou une base MongoDB

#### 1. Configuration GitHub

Le projet est déjà configuré avec Git. Assurez-vous que votre code est poussé sur GitHub :

```bash
git add .
git commit -m "Initial commit"
git push -u origin master
```

#### 2. Déploiement du Dashboard sur Vercel

1. **Connecter Vercel à GitHub** :
   - Allez sur [vercel.com](https://vercel.com)
   - Connectez votre compte GitHub
   - Cliquez sur "New Project"
   - Sélectionnez votre repository `ahmed-test-`

2. **Configuration Vercel** :
   - **Root Directory** : `dashboard`
   - **Framework Preset** : Vite
   - **Build Command** : `npm run build`
   - **Output Directory** : `dist`
   - **Install Command** : `npm install`

3. **Variables d'environnement** :
   - Ajoutez `VITE_API_URL` avec l'URL de votre backend déployé
   - Exemple : `https://votre-backend.railway.app/api`

4. **Déploiement** :
   - Vercel déploiera automatiquement à chaque push sur `master`
   - Vous recevrez une URL comme : `https://votre-app.vercel.app`

#### 3. Déploiement du Backend sur Railway

**Option A : Railway (Recommandé)**

1. **Créer un compte** :
   - Allez sur [railway.app](https://railway.app)
   - Connectez avec GitHub

2. **Nouveau projet** :
   - Cliquez sur "New Project"
   - Sélectionnez "Deploy from GitHub repo"
   - Choisissez votre repository

3. **Configuration** :
   - Railway détectera automatiquement le dossier `backend`
   - Ou configurez manuellement :
     - **Root Directory** : `backend`
     - **Start Command** : `npm start`
     - **Build Command** : `npm install`

4. **Variables d'environnement** :

   ```
   PORT=3000
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
   JWT_SECRET=votre-secret-jwt-tres-securise
   FRONTEND_URL=https://votre-dashboard.vercel.app
   ```

5. **MongoDB** :
   - Railway peut créer une base MongoDB automatiquement
   - Ou utilisez MongoDB Atlas (gratuit)

6. **Domaine** :
   - Railway génère automatiquement une URL
   - Exemple : `https://votre-app.railway.app`

**Option B : Render (Alternative gratuite)**

1. **Créer un compte** :
   - Allez sur [render.com](https://render.com)
   - Connectez avec GitHub

2. **Nouveau Web Service** :
   - Cliquez sur "New +" → "Web Service"
   - Connectez votre repository GitHub

3. **Configuration** :
   - Le fichier `render.yaml` est déjà configuré
   - Render utilisera automatiquement ces paramètres

4. **Variables d'environnement** :
   - Configurez les mêmes variables que Railway dans le dashboard Render

#### 4. Configuration finale

1. **Mettre à jour Vercel** :
   - Retournez sur Vercel
   - Mettez à jour `VITE_API_URL` avec l'URL de votre backend Railway/Render
   - Redéployez le dashboard

2. **CORS** :
   - Assurez-vous que `FRONTEND_URL` dans le backend correspond à votre URL Vercel
   - Le backend autorisera automatiquement les requêtes depuis Vercel

#### 5. Déploiement automatique

Une fois configuré :

- **Push sur GitHub** → Déploiement automatique sur Vercel et Railway/Render
- **Pull Requests** → Prévisualisation automatique
- **Branches** → Environnements de staging automatiques

### 📝 Notes importantes

- **MongoDB Atlas** : Créez un cluster gratuit sur [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
- **Variables sensibles** : Ne jamais commiter les fichiers `.env` (déjà dans `.gitignore`)
- **JWT_SECRET** : Utilisez un secret fort en production
- **FRONTEND_URL** : Doit correspondre exactement à votre URL Vercel

### 🔧 Déploiement local (Docker)

```bash
docker-compose up -d
```

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 📞 Support

Pour toute question ou problème :

- **Email** : support@gnv.com
- **Documentation** : [Wiki du projet]
- **Issues** : [GitHub Issues]

## 🙏 Remerciements

- Équipe GNV pour la collaboration
- Communauté React et Node.js
- Contributeurs open source
