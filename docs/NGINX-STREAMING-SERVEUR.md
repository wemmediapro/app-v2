# Activer la livraison directe des médias par Nginx

Les vidéos et l’audio sont servis **directement par Nginx** (sans passer par Node) pour un démarrage plus rapide.

---

## Option A : Déploiement avec Ansible

1. **Vérifier la variable** (déjà activée dans le projet) :
   - `ansible/group_vars/all.yml` → `nginx_serve_uploads_static: true`
   - `app_deploy_path: /var/www/gnv-app` (ou votre chemin de déploiement)

2. **Lancer le playbook** pour mettre à jour la config Nginx sur le serveur :

   ```bash
   cd ansible
   ansible-playbook -i inventory.yml playbook.yml
   ```

   (Adaptez le nom du playbook si nécessaire.)

3. **Sur le serveur** (en SSH), tester et recharger Nginx :

   ```bash
   nginx -t && systemctl reload nginx
   ```

4. **Vérifier le chemin des médias** : les fichiers doivent être dans :
   ```
   /var/www/gnv-app/backend/public/uploads/
   ├── videos/
   ├── audio/
   └── images/
   ```

---

## Option B : Configuration à la main (sans Ansible)

1. **Se connecter au serveur** :

   ```bash
   ssh root@VOTRE_IP
   ```

2. **Éditer la config Nginx** (ex. `/etc/nginx/sites-available/gnv-app`) et **remplacer** le bloc `location /uploads/` par :

   ```nginx
   # Servir vidéo/audio directement depuis le disque (sans Node)
   location /uploads/ {
       alias /var/www/gnv-app/backend/public/uploads/;
       add_header Accept-Ranges bytes;
       add_header Cache-Control "public, max-age=3600";
   }
   ```

   ⚠️ Remplacez `/var/www/gnv-app` par le chemin réel de votre projet sur le serveur.

3. **Tester et recharger** :

   ```bash
   nginx -t && systemctl reload nginx
   ```

4. **Vérifier** que les dossiers existent :
   ```bash
   ls -la /var/www/gnv-app/backend/public/uploads/videos
   ls -la /var/www/gnv-app/backend/public/uploads/audio
   ```

---

## Vérifications

- **Frontend** : le front utilise déjà `/uploads/videos/` pour les vidéos (et `/uploads/audio/` pour l’audio). Aucun changement à faire côté code si vous avez déployé la dernière version.
- **Test** : ouvrir une vidéo ou une radio dans l’app et vérifier que le démarrage est plus rapide. En dev outils (onglet Network), l’URL des médias doit être du type `https://votre-domaine.com/uploads/videos/nom-du-fichier.mp4`.

---

## En cas de problème

- **404 sur les vidéos** : vérifier que `alias` pointe vers le bon répertoire et qu’il se termine par `/`.
- **Toujours lent** : s’assurer qu’il n’y a pas une autre `location /uploads/` plus haute dans la config qui fait encore `proxy_pass` vers le backend.
- **Forcer l’ancien comportement (tout via Node)** : au build du front, définir `VITE_STREAM_VIA_UPLOADS=0`.

---

## Commande rapide (sur le serveur, en root)

```bash
nginx -t && systemctl reload nginx
```
