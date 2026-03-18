# Prisma dans le backend

## Rôle

**Prisma n’est pas utilisé par les routes API.** L’API Express repose sur **Mongoose** (MongoDB) pour tous les modèles et requêtes (auth, users, restaurants, etc.).

Prisma est utilisé **uniquement** dans des scripts d’initialisation / seed :

- `backend/scripts/init-database-prisma.js` — seed utilisateurs, restaurants, etc. (commande : `npm run init-db-prisma`).

Le client Prisma est instancié **dans ce script** (`new PrismaClient()`). Il n’existe pas de module partagé `backend/src/lib/prisma.js` utilisé par les routes.

## Conséquences

- Aucune route dans `backend/src/routes/` ne dépend de Prisma.
- Pour modifier les données en production ou en dev côté API, utiliser les modèles Mongoose et les contrôleurs existants.
- Pour initialiser ou réinitialiser la base avec des données de seed, utiliser le script Prisma ci-dessus (ou les seeds Mongoose si présents).

## Schéma et commandes

- Schéma Prisma : `backend/prisma/schema.prisma`
- Génération du client : `npm run prisma:generate` (dans `backend/`)
- Studio (optionnel) : `npm run prisma:studio`
