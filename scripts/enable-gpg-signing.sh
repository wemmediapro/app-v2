#!/usr/bin/env bash
# Active la signature des commits (GPG ou SSH) pour ce dépôt uniquement.
# Prérequis : avoir configuré une clé (voir docs/GIT-SIGNATURE-EMAIL.md).

set -e
cd "$(git rev-parse --show-toplevel)"

git config --local commit.gpgsign true

if [ -n "$GPG_SIGNING_KEY_ID" ]; then
  git config --local user.signingkey "$GPG_SIGNING_KEY_ID"
  echo "✅ Signature activée pour ce dépôt (clé: $GPG_SIGNING_KEY_ID)"
else
  echo "✅ commit.gpgsign activé pour ce dépôt (clé = config globale user.signingkey)"
fi
