# Base de données GNV OnBoard — export du 2 mars 2026

Base **gnv_onboard** exportée avec `mongodump`.

## Restauration

Sur une machine avec MongoDB démarré :

```bash
mongorestore --uri="mongodb://localhost:27017" --db=gnv_onboard --drop gnv_onboard/
```

Ou depuis le dossier parent de ce README :

```bash
mongorestore --uri="mongodb://localhost:27017" --db=gnv_onboard --drop "base-donnees-gnv-20260302-1548/gnv_onboard/"
```

`--drop` supprime les collections existantes avant de restaurer (optionnel si la base est vide).
