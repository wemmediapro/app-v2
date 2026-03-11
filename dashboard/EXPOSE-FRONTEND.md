# 🌐 Exposer le Frontend sur une URL Publique

Ce guide explique comment exposer votre frontend local (`http://localhost:5173`) sur une URL publique accessible depuis Internet.

## 🚀 Méthode Rapide (Recommandée)

### Option 1: Script Automatique

```bash
cd dashboard
./expose-frontend.sh
```

Le script va :
1. Vérifier que le serveur tourne sur le port 5173
2. Créer un tunnel public avec localtunnel
3. Afficher l'URL publique

### Option 2: Commande Directe

```bash
cd dashboard
npx -y localtunnel --port 5173 --subdomain gnv-dashboard
```

## 📋 Autres Options

### Option 3: Utiliser ngrok (si installé)

```bash
# Installer ngrok (si pas déjà installé)
brew install ngrok/ngrok/ngrok

# Créer un tunnel
ngrok http 5173
```

### Option 4: Utiliser Cloudflare Tunnel

```bash
# Installer cloudflared
brew install cloudflared

# Créer un tunnel
cloudflared tunnel --url http://localhost:5173
```

## 🔧 Configuration

### Vérifier que le serveur tourne

```bash
# Vérifier le port 5173
lsof -i :5173

# Si le serveur n'est pas démarré
cd dashboard
npm run dev
```

### Changer le sous-domaine

Modifiez la variable `SUBDOMAIN` dans `expose-frontend.sh` :

```bash
SUBDOMAIN="votre-sous-domaine"
```

## ⚠️ Notes Importantes

1. **Sécurité** : Les tunnels publics exposent votre application localement. Ne les utilisez que pour le développement/test.

2. **Stabilité** : Les URLs générées peuvent changer à chaque redémarrage du tunnel.

3. **Performance** : Les tunnels peuvent introduire une latence supplémentaire.

4. **Backend** : Assurez-vous que le backend est également accessible si nécessaire (port 3001).

## 🔗 URLs Générées

- **Localtunnel** : `https://gnv-dashboard.loca.lt`
- **ngrok** : `https://xxxx-xx-xx-xx-xx.ngrok-free.app`
- **Cloudflare** : `https://xxxx-xxxx.trycloudflare.com`

## 🛑 Arrêter le Tunnel

Appuyez sur `Ctrl+C` dans le terminal où le tunnel est actif.

## 📝 Exemple d'Utilisation

```bash
# Terminal 1: Démarrer le serveur
cd dashboard
npm run dev

# Terminal 2: Exposer le frontend
cd dashboard
./expose-frontend.sh

# Résultat:
# ✅ Frontend accessible sur:
#    https://gnv-dashboard.loca.lt
```

## 🔍 Dépannage

### Le tunnel ne se connecte pas
- Vérifiez que le port 5173 est bien utilisé
- Essayez un autre sous-domaine
- Vérifiez votre connexion Internet

### L'URL ne fonctionne pas
- Vérifiez que le serveur local fonctionne
- Réessayez avec un nouveau tunnel
- Vérifiez les logs du tunnel


