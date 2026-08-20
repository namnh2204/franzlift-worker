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

cd "$PROJECT_DIR"
npm ci
npm run build
npx wrangler d1 migrations apply franzlift --remote
npx wrangler deploy

echo "Deployment complete. Verify the workers.dev URL printed by Wrangler and https://franzlift.vn/."
