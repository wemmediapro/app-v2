# 🔧 Résolution des problèmes - Tunnel ngrok

## Problème: Page blanche

### Solutions à essayer dans l'ordre:

1. **Vider le cache du navigateur**
   - Chrome/Edge: `Ctrl+Shift+Delete` (Windows) ou `Cmd+Shift+Delete` (Mac)
   - Sélectionnez "Images et fichiers en cache"
   - Cliquez sur "Effacer les données"

2. **Forcer le rechargement**
   - Windows: `Ctrl+F5` ou `Ctrl+Shift+R`
   - Mac: `Cmd+Shift+R`

3. **Page d'avertissement ngrok**
   - Si vous voyez une page d'avertissement ngrok, cliquez sur le bouton **"Visit Site"**
   - Cette page apparaît une seule fois par session

4. **Ouvrir la console développeur**
   - Appuyez sur `F12` ou `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Allez dans l'onglet "Console"
   - Vérifiez s'il y a des erreurs en rouge

5. **Navigation privée/Incognito**
   - Ouvrez une fenêtre de navigation privée
   - Accédez à l'URL du tunnel
   - Cela évite les problèmes de cache

6. **Vérifier que le tunnel est actif**

   ```bash
   curl http://localhost:4040/api/tunnels
   ```

7. **Vérifier que le frontend est actif**
   ```bash
   curl http://localhost:5173
   ```

## Problème: Les données ne se chargent pas

Si la page se charge mais les données ne s'affichent pas, c'est normal car le backend (port 3001) n'est pas exposé via le tunnel.

### Solution: Créer un tunnel pour le backend

```bash
export NGROK_AUTH_TOKEN='35Nq9utRoqcximJfj3ZKwUmLxEa_82pJABufoWAenkbPWxDzH'
npx ngrok http 3001
```

Puis modifier les appels API dans le code pour utiliser l'URL publique du backend.

## Vérifier l'état du tunnel

```bash
# Voir l'URL actuelle
curl http://localhost:4040/api/tunnels | python3 -m json.tool

# Interface web ngrok
# Ouvrez: http://localhost:4040
```
