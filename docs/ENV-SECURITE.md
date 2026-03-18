# Fichiers d’environnement et clés API — non trackés

## Fichiers ignorés par Git (.gitignore)

Les fichiers suivants **ne doivent pas** être commités (déjà dans `.gitignore`) :

- `.env`, `.env.local`, `.env.*.local`
- `config.env`
- `backend/config.env`, `backend/config.env.bak`, `backend/.env`
- `dashboard/.env`, `dashboard/.env.local`, `dashboard/.env.production`
- `scripts/vps-config.env`

## Fichiers autorisés à être trackés (sans secrets)

- `backend/config.env.example`, `backend/config.production.env.example`, `backend/.env.production.example`
- `.env.example`
- `dashboard/.env.development` — uniquement si contenu sans clé secrète (ex. `VITE_API_URL=/api`)

## Vérification rapide

```bash
# Aucun fichier contenant des secrets ne doit apparaître
git ls-files | grep -E '\.env|config\.env'
# Attendu : seulement des .example ou .env.development sans secrets
```

Si un fichier contenant des clés API a été commité par erreur :

```bash
git rm --cached chemin/vers/fichier.env
echo "chemin/vers/fichier.env" >> .gitignore
git commit -m "chore: stop tracking sensitive env file"
# Puis régénérer les secrets exposés (JWT, DB, etc.).
```
