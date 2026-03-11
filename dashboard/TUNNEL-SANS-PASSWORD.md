# 🌐 Tunnel Sans Mot de Passe - Pour Démonstration

## ✅ Solution Implémentée

J'ai créé un serveur HTTP simple qui accepte tous les hosts, puis utilisé cloudflared pour créer un tunnel **SANS mot de passe**.

## 📱 URL Publique

**URL:** `https://experimental-activists-bus-house.trycloudflare.com`

## 🏗️ Architecture

```
Internet → Cloudflare Tunnel → Serveur HTTP (port 8080) → Vite (port 5173)
```

## ✅ Avantages

- ✅ **Aucun mot de passe requis** - Accès direct pour la démonstration
- ✅ Accepte tous les hosts sans restriction
- ✅ Solution stable et fiable
- ✅ Parfait pour les démonstrations

## 🚀 Démarrage

Les services sont déjà actifs en arrière-plan. Pour redémarrer:

```bash
cd dashboard

# Terminal 1 - Serveur HTTP
node simple-http-server.js

# Terminal 2 - Tunnel
npx cloudflared tunnel --url http://localhost:8080
```

## 🛑 Arrêt

```bash
pkill -f cloudflared
pkill -f simple-http-server
```

## 💡 Note

Cette solution utilise un serveur HTTP intermédiaire qui contourne toutes les restrictions de vérification du host, permettant un accès direct sans mot de passe.






