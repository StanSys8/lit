#!/usr/bin/env bash
set -euo pipefail

# Sync BMAD modules and regenerate tool integrations for this repository.
# Override defaults with environment variables if needed.
TOOLS="${BMAD_TOOLS:-codex,claude-code}"
MODULES="${BMAD_MODULES:-bmm}"
ROOT_DIR="${BMAD_ROOT_DIR:-$(pwd)}"

echo "Syncing BMAD in: ${ROOT_DIR}"
echo "Modules: ${MODULES}"
echo "Tools: ${TOOLS}"

npx bmad-method install \
  --action update \
  --yes \
  --modules "${MODULES}" \
  --tools "${TOOLS}" \
  --directory "${ROOT_DIR}"
