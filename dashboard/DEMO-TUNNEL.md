# 🌐 Tunnel de Démonstration - Guide Rapide

## 🚀 Solution Technique Complète

Pour une solution technique complète avec plusieurs options, consultez **[SOLUTION-DEMO-TECHNIQUE.md](./SOLUTION-DEMO-TECHNIQUE.md)**

## Démarrage Rapide

### Méthode 1: Script automatique complet (Recommandé) ⭐
```bash
cd dashboard
./demo-complete.sh
```
Ce script détecte automatiquement la meilleure solution disponible (Cloudflare, Ngrok, ou Localtunnel).

### Méthode 2: Script localtunnel (Simple)
```bash
cd dashboard
./demo-tunnel.sh
```

### Méthode 3: Commandes manuelles

**Terminal 1** - Démarrer le serveur:
```bash
cd dashboard
npm run dev:tunnel
```

**Terminal 2** - Créer le tunnel:
```bash
cd dashboard
npx localtunnel --port 5173
```

## URLs

- **Locale**: http://localhost:5173
- **Publique**: L'URL sera affichée dans le terminal (format: `https://xxxxx.loca.lt`)

## Mot de Passe

Localtunnel affiche une page de sécurité avec un mot de passe. Le mot de passe est affiché dans le terminal où vous avez lancé `npx localtunnel`.

**Exemple de sortie:**
```
your url is: https://xxxxx.loca.lt
Tunnel password: abc123xyz
```

## Options Avancées

Pour une démo sans mot de passe ou avec plus d'options:
- **Cloudflare Tunnel** (gratuit, sans mot de passe): `./demo-cloudflare.sh`
- **Ngrok** (professionnel, URL fixe): `./demo-ngrok.sh`
- **Serveur local** (même réseau): `./demo-local.sh`

Consultez [SOLUTION-DEMO-TECHNIQUE.md](./SOLUTION-DEMO-TECHNIQUE.md) pour plus de détails.

## Arrêt

Appuyez sur `Ctrl+C` dans les terminaux pour arrêter le serveur et le tunnel.

