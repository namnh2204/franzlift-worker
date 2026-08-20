#!/usr/bin/env bash
# Source this file to configure AWS CLI or another S3-compatible client for R2:
#   source deployment/r2-env.sh
set -a
# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/.env"
set +a

export AWS_ENDPOINT_URL="$CLOUDFLARE_R2_ENDPOINT"
export AWS_DEFAULT_REGION=auto

echo "R2 environment loaded for $CLOUDFLARE_R2_ENDPOINT (bucket: $CLOUDFLARE_R2_BUCKET)."
