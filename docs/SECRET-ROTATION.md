# Rotation des secrets — guide opérationnel

Procédures **génériques** pour GNV OnBoard. Adaptez les noms de fichiers (`config.env`, `.env`) à votre déploiement.

## Principes

1. **Ne jamais** committer les secrets dans Git.
2. Après rotation, **redémarrer** les processus Node (PM2, systemd, conteneur) pour charger les nouvelles variables.
3. Prévoir une **fenêtre de maintenance** pour `JWT_SECRET` : tous les JWT émis avant la rotation deviennent invalides.

---

## JWT (`JWT_SECRET`)

1. Générer une nouvelle chaîne **≥ 32 caractères** (ex. `openssl rand -base64 48`).
2. Mettre à jour la variable sur **tous** les environnements qui signent ou vérifient les tokens (API, workers si séparés).
3. Redémarrer l’API.
4. **Impact** : déconnexion de tous les utilisateurs ; ils doivent se reconnecter.

---

## MongoDB (`MONGODB_URI` / `DATABASE_URL`)

1. Changer le mot de passe utilisateur dans MongoDB (Atlas : Database Access, ou `db.updateUser` en self-hosted).
2. Mettre à jour l’URI dans les fichiers d’environnement / secrets CI.
3. Redémarrer l’application.
4. Vérifier **`GET /api/v1/health/ready`**.

---

## Redis (`REDIS_URI`)

1. Modifier le mot de passe côté Redis (ou faire pivoter l’instance).
2. Mettre à jour `REDIS_URI` (format `redis://:password@host:6379`).
3. Redémarrer l’API (cache, rate limit, Socket.io adapter selon config).

---

## Compte administrateur initial (`ADMIN_EMAIL` / `ADMIN_PASSWORD`)

- Utilisés au seed / première connexion selon votre flux — voir `SECURITY.md`.
- Rotation : changer le mot de passe via le flux dashboard admin ou script `reset-admin-password` si présent dans `backend/scripts/`.
- Mettre à jour les secrets déploiement si vous réinitialisez depuis l’environnement.

---

## 2FA (TOTP)

- Configuration utilisateur : [2FA-USER-GUIDE.md](./2FA-USER-GUIDE.md).
- Politique admin : [2FA-ADMIN-POLICIES.md](./2FA-ADMIN-POLICIES.md).

---

## Sentry (`SENTRY_DSN`)

- Régénérer le DSN dans le projet Sentry si compromis ; mettre à jour `config.env` / variables hébergeur ; redémarrer.

---

## Clés API tierces (email, OpenAI, etc.)

- Suivre la console du fournisseur ; mettre à jour `.env` / secrets GitHub Actions ; redémarrer les jobs ou l’API.

---

## Checklist post-rotation

- [ ] Variables mises à jour partout (VM, CI, staging, prod).
- [ ] Services redémarrés.
- [ ] Health checks OK.
- [ ] Test login / action critique.
- [ ] Anciens secrets révoqués côté fournisseur si applicable.

## Références

- [SECURITY.md](../SECURITY.md)
- [SECURITY-BEST-PRACTICES.md](./SECURITY-BEST-PRACTICES.md)
- [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md)
