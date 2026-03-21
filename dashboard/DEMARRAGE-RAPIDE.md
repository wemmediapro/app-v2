# ⚡ Démarrage Rapide - Démonstration

## 🎯 En 30 secondes

```bash
cd dashboard
./demo-complete.sh
```

C'est tout ! Le script fait tout automatiquement.

## 📋 Ce que fait le script

1. ✅ Vérifie les prérequis (Node.js, npm)
2. ✅ Installe les dépendances si nécessaire
3. ✅ Démarre le serveur de développement
4. ✅ Détecte automatiquement la meilleure solution de tunnel
5. ✅ Crée le tunnel public
6. ✅ Affiche l'URL à partager

## 🌐 Solutions disponibles (par ordre de préférence)

Le script `demo-complete.sh` choisit automatiquement :

1. **Cloudflare Tunnel** (si installé) - Gratuit, rapide, sans mot de passe
2. **Ngrok** (si installé) - Professionnel, URL fixe possible
3. **Localtunnel** (toujours disponible) - Simple, peut demander un mot de passe

## 🔧 Installation optionnelle (pour de meilleures performances)

### Cloudflare Tunnel (Recommandé)

```bash
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
# Télécharger depuis: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

### Ngrok (Alternative)

```bash
# macOS
brew install ngrok/ngrok/ngrok

# Ou via npm
npm install -g ngrok
```

## 📱 Partage de l'URL

Une fois le script lancé, vous verrez :

```
📱 URL PUBLIQUE: https://xxxxx.xxxxx.xxxxx
🏠 URL LOCALE:   http://localhost:5173
```

Copiez l'URL publique et partagez-la avec vos démonstrateurs.

## 🛑 Arrêt

Appuyez sur `Ctrl+C` - le script nettoie tout automatiquement.

## ❓ Problèmes ?

Consultez [SOLUTION-DEMO-TECHNIQUE.md](./SOLUTION-DEMO-TECHNIQUE.md) pour le dépannage complet.
