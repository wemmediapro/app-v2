# Ansible — Déploiement GNV OnBoard

Ce dossier permet de déployer **GNV OnBoard** sur un serveur **Ubuntu 22.04** de façon reproductible.

## Prérequis

- **Ansible** 2.14+ sur la machine qui lance le playbook (pas obligatoirement sur le serveur).
- Accès **SSH** au serveur (clé ou mot de passe).
- Serveur **Ubuntu 22.04** avec accès sudo/root.

## Configuration

1. **Inventaire**  
   Éditer `inventory.yml` et remplacer `IP_OU_DOMAINE` par l’IP ou le hostname du serveur.

2. **Variables**  
   Éditer `group_vars/all.yml` :
   - `nginx_server_name` : domaine ou IP du site
   - `jwt_secret`, `admin_password` : à changer en production (ou passer en `-e` / vault)
   - `mongodb_uri` : par défaut `mongodb://localhost:27017/gnv_onboard?directConnection=true`
   - `redis_uri` : par défaut `redis://localhost:6379`
   - `app_deploy_path` : répertoire sur le serveur (défaut `/var/www/gnv-app`)
   - `app_user` : utilisateur qui possède l’app et lance PM2 (défaut : l’utilisateur Ansible)

3. **Déploiement du code**  
   - **Par défaut** : le playbook copie le projet depuis votre machine (répertoire parent de `ansible/`) vers le serveur avec `rsync` (exclut `node_modules`, `.git`, `ansible/`).
   - **Par Git** : définir `app_git_repo` et `app_git_version` dans les variables et `app_deploy_method: git`.

## Lancement

Depuis la **racine du projet** (parent de `ansible/`) :

```bash
# Déploiement complet
ansible-playbook -i ansible/inventory.yml ansible/playbook.yml

# Avec variables en ligne (sans modifier les fichiers)
ansible-playbook -i ansible/inventory.yml ansible/playbook.yml \
  -e "nginx_server_name=app.example.com" \
  -e "admin_password=MonMotDePasseSecurise" \
  -e "jwt_secret=un-secret-jwt-long-et-aleatoire"
```

Ou depuis le dossier `ansible/` :

```bash
cd ansible
ansible-playbook -i inventory.yml playbook.yml
```

## Rôles et tags

| Tag        | Rôle     | Description                          |
|-----------|----------|--------------------------------------|
| `common`  | common   | Paquets de base, UFW                 |
| `mongodb` | mongodb  | MongoDB 7 (22.04) ou 8 (24.04, recommandé) |
| `redis`   | redis    | Redis (apt)                          |
| `nodejs`  | nodejs   | NVM, Node 20, PM2                    |
| `nginx`   | nginx    | Nginx + site GNV                    |
| `app`     | app      | Déploiement code, build, PM2         |

Exemples :

```bash
# Uniquement Nginx + app (serveur déjà préparé)
ansible-playbook -i ansible/inventory.yml ansible/playbook.yml --tags nginx,app

# Tout sauf UFW
ansible-playbook -i ansible/inventory.yml ansible/playbook.yml --skip-tags common
```

## Après le déploiement

1. **PM2 startup**  
   Si Ansible affiche une commande du type `pm2 startup systemd -u ...`, se connecter en SSH au serveur et l’exécuter une fois (en root si demandé) pour que les processus redémarrent après un reboot.

2. **Initialisation de la base**  
   Sur le serveur :
   ```bash
   cd /var/www/gnv-app && . ~/.nvm/nvm.sh && cd backend && npm run init-db
   ```
   (À adapter si vous utilisez un autre `app_deploy_path` ou utilisateur.)

3. **HTTPS**  
   Le playbook configure Nginx en HTTP. Pour le TLS, configurer Certbot (Let’s Encrypt) manuellement ou ajouter un rôle `certbot` et un vhost 443.

## Sécurité

- Ne pas commiter de secrets dans `group_vars/all.yml`. Utiliser **Ansible Vault** ou `-e` pour `jwt_secret`, `admin_password`, etc.
- En production, changer `jwt_secret` et `admin_password` immédiatement après le premier déploiement.

## Dépannage

- **Connexion SSH** : vérifier que la clé est utilisée (`ansible_ssh_private_key_file` dans l’inventaire) ou que l’authentification par mot de passe est autorisée.
- **Synchronisation** : le déploiement par `sync` suppose que le playbook est lancé depuis la machine qui contient le code (répertoire parent de `ansible/`). Sinon, utiliser le déploiement par Git.
- **PM2** : les commandes PM2 s’exécutent avec l’utilisateur `app_user` et le NVM de cet utilisateur ; en root, utiliser le chemin complet vers `node`/`pm2` ou le wrapper `/usr/local/bin/gnv-pm2` si défini.
