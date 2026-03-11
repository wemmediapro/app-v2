# 🌐 Instructions pour le Tunnel de Démonstration

## ✅ Tunnel Créé !

Le serveur et le tunnel sont maintenant actifs en arrière-plan.

## 📱 Comment obtenir l'URL du tunnel

### Option 1: Vérifier les processus actifs
Le tunnel est en cours d'exécution. Pour voir l'URL, ouvrez un **nouveau terminal** et exécutez:

```bash
cd "/Users/mac/Desktop/appli final/dashboard"
npx localtunnel --port 5173
```

L'URL et le mot de passe seront affichés dans ce terminal.

### Option 2: URL locale
Si vous êtes sur le même réseau, utilisez:
```
http://localhost:5173
```

## 🔑 Mot de Passe

Quand vous accédez à l'URL publique, une page de sécurité s'affichera. Le mot de passe est affiché dans le terminal où `localtunnel` s'exécute.

## 🛑 Arrêter le tunnel

Pour arrêter tous les processus:
```bash
pkill -f "vite"
pkill -f "localtunnel"
```

## 💡 Astuce

Pour une démo rapide sans mot de passe, vous pouvez utiliser l'URL locale si vous êtes sur le même réseau WiFi.






