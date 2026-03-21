# 🚀 Guide de Déploiement PRODUCTION

## Vue d'ensemble

Ce guide explique comment déployer l'application GNV OnBoard en mode **PRODUCTION** optimisé pour **2000+ connexions simultanées**.

## 📋 Prérequis

- Node.js 18+ installé
- MongoDB (local ou Atlas)
- **Redis** (obligatoire en production : Socket.io, rate limit, cache — le serveur refuse de démarrer sans REDIS_URI/REDIS_URL)
- PM2 installé globalement (`npm install -g pm2`)
- Nginx pour servir le frontend et le dashboard en statique (recommandé, voir `nginx.conf`)

## 🔧 Configuration

### 1. Configuration de l'environnement

Copiez le fichier d'exemple de configuration :

```bash
cp backend/config.production.env.example backend/config.env
```

Éditez `backend/config.env` et configurez :

- **MONGODB_URI** : URL de connexion MongoDB (recommandé: MongoDB Atlas)
- **JWT_SECRET** : Clé secrète pour JWT (changez-la en production!)
- **FRONTEND_URL** : URL(s) de votre frontend (séparées par des virgules)
- **REDIS_URI** ou **REDIS_URL** : URL Redis (obligatoire en production)
- **SENTRY_DSN** : (Optionnel) DSN Sentry pour le monitoring des erreurs
- **CLUSTER_WORKERS** : Nombre de workers (par défaut: `max` = tous les CPU)

### 2. Installation des dépendances

Le script `start-production.sh` installera automatiquement les dépendances, mais vous pouvez le faire manuellement :

```bash
# Backend
cd backend
npm install --production

# Frontend principal
cd ..
npm install --production

# Dashboard
cd dashboard
npm install --production
cd ..
```

## 🚀 Démarrage en Production

### Méthode 1 : Script automatique (Recommandé)

```bash
./start-production.sh
```

Ce script va :

1. ✅ Vérifier les prérequis
2. ✅ Installer les dépendances si nécessaire
3. ✅ Builder les applications frontend
4. ✅ Démarrer avec PM2 en mode cluster
5. ✅ Afficher les informations de statut

### Méthode 2 : Démarrage manuel

```bash
# 1. Build des frontends
npm run build
cd dashboard && npm run build && cd ..

# 2. Démarrer avec PM2 (backend uniquement ; frontend/dashboard servis par Nginx)
pm2 start ecosystem.production.cjs --env production

# 3. Sauvegarder la configuration
pm2 save
```

## 📊 Architecture de Production

### Clustering

L'application utilise le **clustering Node.js** avec PM2 pour répartir la charge sur plusieurs workers :

- **Workers** : Par défaut, un worker par CPU disponible
- **Capacité** : ~500 connexions simultanées par worker
- **Exemple** : 4 CPU = ~2000 connexions simultanées

### Optimisations

1. **Socket.io** :
   - Configuration optimisée pour les connexions multiples
   - Redis adapter obligatoire en production (clustering)
   - Timeouts et limites configurés

2. **Express** :
   - Rate limiting adapté (1000 req/15min en production)
   - Compression et cache des fichiers statiques
   - Timeouts HTTP augmentés

3. **MongoDB** :
   - Pool de connexions optimisé
   - Retry automatique
   - Timeouts configurés

## 🔍 Monitoring

### Commandes PM2 utiles

```bash
# Voir le statut
pm2 status

# Voir les logs
pm2 logs
pm2 logs gnv-backend

# Monitoring en temps réel
pm2 monit

# Redémarrer
pm2 restart all
pm2 restart gnv-backend

# Arrêter
pm2 stop all

# Supprimer
pm2 delete all
```

### Health Check

Vérifiez l'état de l'application :

```bash
curl http://localhost:3000/api/health
```

Réponse attendue :

```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "worker": 1,
  "pid": 12345,
  "memory": {
    "used": 150,
    "total": 200
  }
}
```

## 🌐 URLs d'accès

- **Backend API** : http://localhost:3000
- **Frontend** : http://localhost:5173
- **Dashboard** : http://localhost:5174
- **Health Check** : http://localhost:3000/api/health

## ⚙️ Configuration Avancée

### Ajuster le nombre de workers

Dans `backend/config.env` :

```env
# Utiliser tous les CPU disponibles
CLUSTER_WORKERS=max

# Ou spécifier un nombre exact
CLUSTER_WORKERS=4
```

Dans `ecosystem.production.cjs`, vous pouvez aussi modifier :

```javascript
instances: 4, // Nombre fixe de workers
```

### Redis pour Socket.io (Recommandé)

Pour activer le clustering Socket.io avec Redis :

1. Installez Redis localement ou utilisez un service cloud
2. Configurez dans `backend/config.env` :

```env
REDIS_URL=redis://localhost:6379
```

### Augmenter la capacité

Pour gérer plus de 2000 connexions :

1. **Augmenter les workers** : Plus de CPU = plus de workers
2. **Utiliser Redis** : Pour synchroniser Socket.io entre workers
3. **Load Balancer** : Utiliser Nginx ou un load balancer devant plusieurs instances
4. **MongoDB Atlas** : Utiliser un cluster MongoDB pour la scalabilité

## 🛠️ Dépannage

### Le backend ne démarre pas

1. Vérifiez les logs : `pm2 logs gnv-backend`
2. Vérifiez `backend/config.env` existe et est configuré
3. Vérifiez que MongoDB est accessible
4. Vérifiez les ports ne sont pas utilisés

### Connexions Socket.io limitées

1. Vérifiez les logs pour voir les limites atteintes
2. Augmentez `SOCKET_MAX_CONNECTIONS` dans `config.env`
3. Vérifiez que Redis est configuré si vous utilisez plusieurs workers

### Performance dégradée

1. Vérifiez la mémoire : `pm2 monit`
2. Augmentez `max_memory_restart` dans `ecosystem.production.cjs`
3. Vérifiez les connexions MongoDB
4. Considérez utiliser Redis pour Socket.io

## 📈 Métriques de Performance

### Capacité estimée

- **1 CPU** : ~500 connexions simultanées
- **2 CPU** : ~1000 connexions simultanées
- **4 CPU** : ~2000 connexions simultanées
- **8 CPU** : ~4000 connexions simultanées

### Ressources recommandées

- **RAM** : Minimum 2GB, recommandé 4GB+
- **CPU** : Minimum 2 cores, recommandé 4+ cores
- **Disque** : 10GB+ pour les logs et uploads

## 🔒 Sécurité

⚠️ **Important** : Avant de déployer en production :

1. ✅ Changez `JWT_SECRET` dans `config.env`
2. ✅ Changez `ADMIN_PASSWORD` dans `config.env`
3. ✅ Configurez `FRONTEND_URL` avec vos domaines réels
4. ✅ Activez HTTPS (via reverse proxy comme Nginx)
5. ✅ Configurez un firewall
6. ✅ Utilisez MongoDB Atlas avec authentification
7. ✅ Activez les logs de sécurité

## 📝 Notes

- Les logs sont sauvegardés dans le dossier `logs/`
- PM2 redémarre automatiquement les workers en cas de crash
- Le mode cluster répartit automatiquement la charge entre les workers
- Redis est optionnel mais recommandé pour Socket.io en production

## 🆘 Support

En cas de problème, consultez :

- Les logs PM2 : `pm2 logs`
- Le health check : `curl http://localhost:3000/api/health`
- La documentation MongoDB Atlas
- La documentation PM2 : https://pm2.keymetrics.io/
