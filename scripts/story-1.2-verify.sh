#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${API_URL:-}" ]]; then
  echo "API_URL is required, example: export API_URL='https://abc.execute-api.us-east-1.amazonaws.com'"
  exit 1
fi

if [[ -z "${CORS_ORIGIN:-}" ]]; then
  echo "CORS_ORIGIN is required, example: export CORS_ORIGIN='https://your.pages.dev'"
  exit 1
fi

echo "== Health check =="
curl -sS -i "${API_URL%/}/health"
echo

echo "== CORS preflight =="
curl -sS -i -X OPTIONS "${API_URL%/}/health" \
  -H "Origin: ${CORS_ORIGIN}" \
  -H "Access-Control-Request-Method: GET"
echo
