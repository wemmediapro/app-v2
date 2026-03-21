# 🌐 Tunnel SANS Mot de Passe - Guide Rapide

## ✅ Solution: Cloudflared (Cloudflare Tunnel)

Cloudflared est un service gratuit de Cloudflare qui crée des tunnels **SANS mot de passe**.

## 🚀 Démarrage Rapide

### Méthode 1: Script automatique

```bash
cd dashboard
./tunnel-simple.sh
```

### Méthode 2: Commande directe

```bash
cd dashboard
npx cloudflared tunnel --url http://localhost:5173
```

## 📱 URLs

- **Locale**: http://localhost:5173
- **Publique**: L'URL sera affichée dans le terminal (format: `https://xxxxx.trycloudflare.com`)

## ✅ Avantages

- ✅ **Aucun mot de passe requis**
- ✅ Gratuit
- ✅ Rapide et fiable
- ✅ URL HTTPS automatique
- ✅ Pas d'inscription nécessaire

## 🛑 Arrêt

Appuyez sur `Ctrl+C` dans le terminal pour arrêter le tunnel.

## 💡 Note

Le tunnel cloudflared est actuellement en cours d'exécution en arrière-plan. Pour voir l'URL exacte, exécutez la commande ci-dessus dans un nouveau terminal.
