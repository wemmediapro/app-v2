# GNV OnBoard — Export pour hébergement sur VM

Export du **02/03/2026** : dernière version de l'application prête à être déployée sur une VM (Ubuntu 22.04 / 24.04) avec base de données et documentation.

## Contenu

| Élément | Emplacement |
|--------|-------------|
| **Code source** | Racine du dossier (backend, dashboard, src, scripts, etc.) |
| **Base de données** | `dump-mongodb/gnv_onboard/` (à restaurer sur la VM avec `mongorestore`) |
| **Documentation** | `README.md`, `INSTALLATION-RAPIDE-VM.md`, `MISE-A-JOUR-SERVEUR.md`, `docs/`, `ansible/` |
| **Config exemple** | `backend/config.env.example` (à copier en `backend/config.env` sur la VM) |
| **Scripts déploiement** | `scripts/deploy-to-vps.sh`, `scripts/update-vps.sh`, `scripts/install-on-vps-remote.sh`, `scripts/import-database-vps.sh` |

## Déploiement sur une VM

### Option 1 : Déploiement manuel

1. Copier ce dossier `appli` sur la VM (scp, rsync, clé USB, etc.).
2. Sur la VM, suivre **INSTALLATION-RAPIDE-VM.md** :
   - Installer Node.js 20 (NVM), MongoDB, Redis, Nginx, PM2
   - Créer `backend/config.env` à partir de `backend/config.env.example`
   - `npm install` à la racine, dans `backend/` et `dashboard/`
   - `npm run build` à la racine et dans `dashboard/`
   - Restaurer la base : `mongorestore --uri="mongodb://localhost:27017" --db=gnv_onboard --drop dump-mongodb/gnv_onboard`
   - `pm2 start ecosystem.config.cjs --env production`
   - Configurer Nginx (voir `docs/` ou `INSTALLATION-RAPIDE-VM.md`)

### Option 2 : Déploiement avec scripts (depuis votre machine)

Depuis votre poste (avec ce dossier ou le dépôt Git à jour) :

```bash
# Mettre à jour la variable VPS dans scripts/deploy-to-vps.sh (ex: root@IP_DE_LA_VM)
./scripts/deploy-to-vps.sh
```

Le script envoie le code + dump sur la VM, lance l’installation et importe la base.

### Option 3 : Ansible

Voir `ansible/README-ANSIBLE.md` et `INSTALLATION-RAPIDE-VM.md` (option A).

## Mise à jour après déploiement

```bash
# Code seul
./scripts/update-vps.sh

# Code + base de données
UPDATE_DB=1 ./scripts/update-vps.sh
```

Voir **MISE-A-JOUR-SERVEUR.md** pour tous les cas (VPS, Hostinger, Railway, etc.).

## Vérifications

- Backend : `http://IP_VM/api/health`
- Frontend : `http://IP_VM/`
- Dashboard : `http://IP_VM/dashboard/`
