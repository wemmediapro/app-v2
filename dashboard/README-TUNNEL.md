# 🌐 Tunnel de Démonstration - Dashboard GNV

## Démarrage rapide

### Option 1: Script automatique (Recommandé)
```bash
cd dashboard
./start-tunnel.sh
```

### Option 2: Commandes manuelles

1. Démarrer le serveur de développement:
```bash
npm run dev:tunnel
```

2. Dans un autre terminal, créer le tunnel:
```bash
npx localtunnel --port 5173 --subdomain gnv-dashboard
```

## URLs

- **Local**: http://localhost:5173
- **Tunnel public**: https://gnv-dashboard.loca.lt (ou l'URL affichée)

## Notes

- Le tunnel est gratuit mais l'URL peut changer à chaque démarrage
- Pour une URL fixe, utilisez un service payant comme ngrok
- Le tunnel se ferme automatiquement après 30 minutes d'inactivité (localtunnel gratuit)

## Arrêt

Appuyez sur `Ctrl+C` pour arrêter le tunnel et le serveur.







