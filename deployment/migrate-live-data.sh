#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
	echo "Missing $ENV_FILE. Copy .env.example to .env and fill in the credentials." >&2
	exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"

cat <<'WARNING'
WARNING: This imports local data/content.json, data/uploads-map.json, and data/uploads/
into remote D1/R2. Per the project deployment policy, first pull authoritative live data.
Press Enter to continue, or Ctrl-C to stop.
WARNING
read -r

cd "$PROJECT_DIR"
node scripts/migrate-cloudflare.js --remote
