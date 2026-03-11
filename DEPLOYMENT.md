# 🚀 Guide de Déploiement

Guide complet pour déployer l'application GNV OnBoard avec GitHub, Vercel et Railway/Render.

## 📋 Table des matières

1. [Architecture](#architecture)
2. [Prérequis](#prérequis)
3. [Déploiement du Backend](#déploiement-du-backend)
4. [Déploiement du Dashboard](#déploiement-du-dashboard)
5. [Configuration MongoDB](#configuration-mongodb)
6. [Variables d'environnement](#variables-denvironnement)
7. [Troubleshooting](#troubleshooting)

## 🏗️ Architecture

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   GitHub    │────────▶│   Vercel    │         │  Railway/  │
│  Repository │         │  (Dashboard)│         │   Render   │
│             │         │             │         │  (Backend)  │
└─────────────┘         └──────┬──────┘         └──────┬──────┘
                               │                        │
                               └────────┬───────────────┘
                                        │
                               ┌────────▼────────┐
                               │  MongoDB Atlas  │
                               └─────────────────┘
```

## ✅ Prérequis

- [x] Compte GitHub
- [x] Compte Vercel (gratuit)
- [x] Compte Railway ou Render (gratuit)
- [x] MongoDB Atlas (gratuit) ou base MongoDB

## 🔧 Déploiement du Backend

### Option 1 : Railway (Recommandé)

#### Étape 1 : Créer un compte Railway
1. Allez sur [railway.app](https://railway.app)
2. Cliquez sur "Start a New Project"
3. Connectez avec GitHub

#### Étape 2 : Déployer depuis GitHub
1. Cliquez sur "New Project"
2. Sélectionnez "Deploy from GitHub repo"
3. Choisissez votre repository `ahmed-test-`
4. Railway détectera automatiquement le dossier `backend`

#### Étape 3 : Configuration
1. **Settings** → **Root Directory** : `backend`
2. **Settings** → **Start Command** : `npm start`
3. **Settings** → **Build Command** : `npm install`

#### Étape 4 : Variables d'environnement
Dans **Variables**, ajoutez :

```env
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname
JWT_SECRET=votre-secret-jwt-tres-securise-changez-moi
JWT_EXPIRE=7d
FRONTEND_URL=https://votre-dashboard.vercel.app
```

#### Étape 5 : MongoDB
- **Option A** : Railway peut créer une base MongoDB automatiquement
- **Option B** : Utilisez MongoDB Atlas (voir section MongoDB)

#### Étape 6 : Domaine
- Railway génère automatiquement une URL
- Exemple : `https://gnv-backend-production.up.railway.app`
- Notez cette URL pour la configuration du dashboard

### Option 2 : Render

#### Étape 1 : Créer un compte Render
1. Allez sur [render.com](https://render.com)
2. Connectez avec GitHub

#### Étape 2 : Créer un Web Service
1. Cliquez sur "New +" → "Web Service"
2. Connectez votre repository GitHub
3. Sélectionnez `ahmed-test-`

#### Étape 3 : Configuration
Le fichier `render.yaml` est déjà configuré. Render utilisera :
- **Root Directory** : `backend`
- **Build Command** : `npm install`
- **Start Command** : `npm start`

#### Étape 4 : Variables d'environnement
Dans **Environment**, ajoutez les mêmes variables que Railway.

#### Étape 5 : Plan
- Sélectionnez le plan **Free** pour commencer
- Notez l'URL générée (ex: `https://gnv-backend.onrender.com`)

## 🎨 Déploiement du Dashboard

### Vercel

#### Étape 1 : Connecter Vercel à GitHub
1. Allez sur [vercel.com](https://vercel.com)
2. Cliquez sur "Sign Up" et connectez avec GitHub
3. Autorisez l'accès à vos repositories

#### Étape 2 : Importer le projet
1. Cliquez sur "Add New..." → "Project"
2. Sélectionnez votre repository `ahmed-test-`
3. Vercel détectera automatiquement la configuration

#### Étape 3 : Configuration
1. **Framework Preset** : Vite
2. **Root Directory** : `dashboard`
3. **Build Command** : `npm run build` (automatique)
4. **Output Directory** : `dist` (automatique)
5. **Install Command** : `npm install` (automatique)

#### Étape 4 : Variables d'environnement
Dans **Environment Variables**, ajoutez :

```env
VITE_API_URL=https://votre-backend.railway.app/api
```

Remplacez par l'URL de votre backend Railway ou Render.

#### Étape 5 : Déployer
1. Cliquez sur "Deploy"
2. Vercel construira et déploiera automatiquement
3. Vous recevrez une URL : `https://votre-app.vercel.app`

#### Étape 6 : Déploiement automatique
- Chaque push sur `master` déclenchera un nouveau déploiement
- Les Pull Requests créeront des previews automatiques

## 🗄️ Configuration MongoDB

### MongoDB Atlas (Recommandé)

1. **Créer un compte** :
   - Allez sur [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
   - Créez un compte gratuit

2. **Créer un cluster** :
   - Cliquez sur "Build a Database"
   - Choisissez le plan **FREE (M0)**
   - Sélectionnez une région proche
   - Créez le cluster

3. **Configurer l'accès** :
   - **Database Access** : Créez un utilisateur avec mot de passe
   - **Network Access** : Ajoutez `0.0.0.0/0` pour autoriser toutes les IPs (ou l'IP de Railway/Render)

4. **Obtenir la connection string** :
   - Cliquez sur "Connect" sur votre cluster
   - Choisissez "Connect your application"
   - Copiez la connection string
   - Format : `mongodb+srv://username:password@cluster.mongodb.net/dbname`
   - Remplacez `<password>` par votre mot de passe

5. **Utiliser dans Railway/Render** :
   - Ajoutez la connection string dans `MONGODB_URI`

## 🔐 Variables d'environnement

### Backend (Railway/Render)

```env
# Server
PORT=3000
NODE_ENV=production

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/gnv_onboard

# JWT
JWT_SECRET=changez-moi-par-une-cle-secrete-tres-forte
JWT_EXPIRE=7d

# CORS
FRONTEND_URL=https://votre-dashboard.vercel.app

# Optionnel
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=votre-email@gmail.com
EMAIL_PASS=votre-app-password
```

### Dashboard (Vercel)

```env
VITE_API_URL=https://votre-backend.railway.app/api
```

## 🔄 Workflow de développement

### Développement local

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Éditer .env avec vos valeurs locales
npm run dev

# Dashboard
cd dashboard
npm install
cp .env.example .env
# Éditer .env avec VITE_API_URL=http://localhost:3000/api
npm run dev
```

### Déploiement

1. **Faire des changements localement**
2. **Tester localement**
3. **Commit et push sur GitHub** :
   ```bash
   git add .
   git commit -m "Description des changements"
   git push origin master
   ```
4. **Déploiement automatique** :
   - Vercel déploie automatiquement le dashboard
   - Railway/Render déploie automatiquement le backend

## 🐛 Troubleshooting

### Le dashboard ne peut pas se connecter au backend

1. **Vérifier CORS** :
   - Assurez-vous que `FRONTEND_URL` dans le backend correspond exactement à votre URL Vercel
   - Incluez le protocole `https://`

2. **Vérifier l'URL de l'API** :
   - Dans Vercel, vérifiez que `VITE_API_URL` est correcte
   - L'URL doit se terminer par `/api`

3. **Vérifier les logs** :
   - Railway/Render : Vérifiez les logs pour les erreurs CORS
   - Vercel : Vérifiez les logs de build

### Le backend ne peut pas se connecter à MongoDB

1. **Vérifier la connection string** :
   - Format correct : `mongodb+srv://user:pass@cluster.mongodb.net/dbname`
   - Le mot de passe ne doit pas contenir de caractères spéciaux non encodés

2. **Vérifier Network Access** :
   - Dans MongoDB Atlas, autorisez `0.0.0.0/0` ou l'IP de Railway/Render

3. **Vérifier les credentials** :
   - L'utilisateur MongoDB doit avoir les permissions nécessaires

### Erreurs de build sur Vercel

1. **Vérifier le Root Directory** :
   - Doit être `dashboard`

2. **Vérifier les dépendances** :
   - Toutes les dépendances doivent être dans `package.json`
   - Pas de dépendances globales

3. **Vérifier les logs de build** :
   - Dans Vercel, allez dans "Deployments" → Cliquez sur le déploiement → "Build Logs"

### Le backend redémarre constamment

1. **Vérifier les logs** :
   - Railway/Render affiche les erreurs dans les logs

2. **Vérifier PORT** :
   - Railway/Render définit automatiquement `PORT`
   - Ne définissez pas `PORT` manuellement sauf si nécessaire

3. **Vérifier les variables d'environnement** :
   - Toutes les variables requises sont définies

## 📚 Ressources

- [Documentation Vercel](https://vercel.com/docs)
- [Documentation Railway](https://docs.railway.app)
- [Documentation Render](https://render.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com)

## ✅ Checklist de déploiement

- [ ] Repository GitHub créé et code poussé
- [ ] Compte Railway/Render créé
- [ ] Backend déployé sur Railway/Render
- [ ] MongoDB Atlas configuré
- [ ] Variables d'environnement backend configurées
- [ ] URL backend obtenue
- [ ] Compte Vercel créé
- [ ] Dashboard déployé sur Vercel
- [ ] Variables d'environnement dashboard configurées (VITE_API_URL)
- [ ] FRONTEND_URL mis à jour dans le backend
- [ ] Test de connexion frontend ↔ backend
- [ ] Test de connexion backend ↔ MongoDB

## 🎉 Félicitations !

Votre application est maintenant déployée et accessible en ligne !

- **Dashboard** : `https://votre-app.vercel.app`
- **Backend API** : `https://votre-backend.railway.app/api`
- **Health Check** : `https://votre-backend.railway.app/api/health`


