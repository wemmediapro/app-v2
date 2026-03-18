# Signature des commits (GPG/SSH) et email Git

Pour **activer la signature GPG des commits** (recommandé pour la traçabilité), suivre les sections 2 ou 3 ci-dessous.

## 1. Email Git valide

Pour que les commits affichent un email cohérent (et évitent l’avertissement « configured automatically based on your username and hostname »).

**Ne pas utiliser une adresse IP locale** (ex. `ahmed@192.168.11.107`) comme `user.email` : cela expose une IP privée dans l’historique Git. Utiliser une adresse email valide (ex. `vous@domaine.com` ou l’email no-reply GitHub).

```bash
# Global (tous les dépôts)
git config --global user.email "votre.email@domaine.com"
git config --global user.name "Votre Nom"

# Ou uniquement pour ce projet
cd /chemin/vers/app3-backup-10mars
git config user.email "votre.email@domaine.com"
git config user.name "Votre Nom"
```

Vérification : `git config user.email` et `git config user.name`.

---

## 2. Signature des commits avec GPG

### Créer une clé GPG (si besoin)

```bash
gpg --full-generate-key
# Choisir RSA and RSA, 4096 bits, durée au goût.
# Associer l’email à celui utilisé dans Git.
```

### Récupérer l’ID de la clé

```bash
gpg --list-secret-keys --keyid-format=long
# Utiliser l’ID (ex. 3AA5C34371567BD2) de la clé à utiliser.
```

### Configurer Git pour signer avec cette clé

```bash
git config --global user.signingkey 3AA5C34371567BD2   # remplacer par votre ID
git config --global commit.gpgsign true
```

Pour signer uniquement ce dépôt : remplacer `--global` par une config locale dans le repo.

### Exporter la clé publique (pour GitHub/GitLab)

- GitHub : Settings → SSH and GPG keys → New GPG key, coller la sortie de :
  ```bash
  gpg --armor --export 3AA5C34371567BD2
  ```

---

## 3. Signature des commits avec SSH (GitHub)

Git 2.34+ permet de signer avec une clé SSH existante.

```bash
# Activer la signature par défaut avec SSH
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub   # ou id_rsa.pub

# Optionnel : signer tous les commits par défaut
git config --global commit.gpgsign true
```

Sur GitHub : Settings → SSH and GPG keys → Signing keys → Add (ajouter la même clé SSH que pour le push).

---

## Vérification

- Après un commit signé : `git log -1 --show-signature`
- Pour corriger l’auteur du dernier commit :  
  `git commit --amend --reset-author --no-edit`

---

## 4. Application dans ce dépôt

Pour **activer la signature des commits** uniquement dans ce projet (sans toucher à la config globale) :

1. Avoir configuré une clé GPG (section 2) ou SSH (section 3) **avant**.
2. Exécuter le script fourni (config locale du dépôt) :

```bash
./scripts/enable-gpg-signing.sh
```

Ce script définit pour ce dépôt :

- `commit.gpgsign true` — tous les futurs commits seront signés.
- Optionnel : `user.signingkey` si la variable d'environnement `GPG_SIGNING_KEY_ID` est définie (ex. `export GPG_SIGNING_KEY_ID=3AA5C34371567BD2` puis relancer le script).

Sans `GPG_SIGNING_KEY_ID`, seule l'option « signer les commits » est activée ; la clé utilisée reste celle de votre config Git globale (`user.signingkey`).

**Vérification** : après un nouveau commit, `git log -1 --show-signature` doit afficher `Good signature` (GPG) ou l'équivalent pour SSH.
