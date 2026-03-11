#!/bin/bash
#
# Lance la mise à jour complète du VPS : fichiers + base de données + médias.
# Connexion : root@187.77.168.205
#
# Usage:
#   ./scripts/deploy-full-update-vps.sh
#
# Le mot de passe SSH est lu depuis :
#   - la variable d'environnement SSHPASS si elle est définie
#   - sinon le fichier .vps-pass à la racine du projet (première ligne)
#
# Prérequis sur votre Mac :
#   - brew install sshpass   (pour passer le mot de passe automatiquement)
#   - MongoDB qui tourne en local (port 27017) pour l'export de la base
#

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export VPS="${VPS:-root@187.77.168.205}"
export APP_DIR="${APP_DIR:-/var/www/gnv-app}"

# Charger le mot de passe depuis .vps-pass si SSHPASS n'est pas déjà défini
if [ -z "$SSHPASS" ] && [ -f "$PROJECT_ROOT/.vps-pass" ]; then
  export SSHPASS="$(head -n1 "$PROJECT_ROOT/.vps-pass" | tr -d '\r\n')"
fi

if [ -z "$SSHPASS" ]; then
  echo "Mot de passe SSH non défini."
  echo "  Soit : export SSHPASS='votre_mot_de_passe'"
  echo "  Soit : créez le fichier .vps-pass à la racine du projet avec le mot de passe (1ère ligne)."
  echo ""
  echo "Lancement du déploiement (vous devrez taper le mot de passe à la demande)..."
  echo ""
fi

exec "$SCRIPT_DIR/deploy-replace-server-with-local.sh"
