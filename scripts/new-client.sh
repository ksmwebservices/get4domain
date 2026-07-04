#!/usr/bin/env bash
# new-client.sh — scaffold a new client project folder under CLIENT_PROJECTS
#
# Usage: ./scripts/new-client.sh CLIENT_ID repo-slug
# Example: ./scripts/new-client.sh MR_TRAVELS_001 mr-travels-001

set -euo pipefail

CLIENT_ID="${1:?Usage: new-client.sh CLIENT_ID repo-slug}"
REPO_SLUG="${2:?Usage: new-client.sh CLIENT_ID repo-slug}"

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_PROJECTS_DIR="${WORKSPACE_ROOT}/CLIENT_PROJECTS"
CLIENT_DIR="${CLIENT_PROJECTS_DIR}/${CLIENT_ID}"

if [ -d "${CLIENT_DIR}" ]; then
  echo "Client folder already exists: ${CLIENT_DIR}"
  exit 1
fi

echo "Cloning github.com/ksmwebservices/${REPO_SLUG} into ${CLIENT_DIR} ..."
git clone "https://github.com/ksmwebservices/${REPO_SLUG}" "${CLIENT_DIR}"

echo "Done. Next: run the P001 prompt against ${CLIENT_DIR} with:"
echo "  Client ID:   ${CLIENT_ID}"
echo "  GitHub Repo: github.com/ksmwebservices/${REPO_SLUG}"
