#!/usr/bin/env bash
# workspace-verify.sh — verify the Get4Domain platform repo and local
# workspace match the structure required by P000.

set -uo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${WORKSPACE_ROOT}"

FAIL=0

check_path() {
  if [ -e "$1" ]; then
    echo "OK   $1"
  else
    echo "MISS $1"
    FAIL=1
  fi
}

echo "== Repository structure =="
for p in \
  "CLAUDE.md" \
  "GET4DOMAIN_PLATFORM.json" \
  "README.md" \
  ".gitignore" \
  ".env.example" \
  "engineering/prompts/phases/P000-WORKSPACE-INIT.md" \
  "engineering/prompts/phases/P001-PROJECT-INIT.md" \
  "engineering/prompts/phases/P002-BOLT-UI.md" \
  "engineering/prompts/phases/P003-BACKEND.md" \
  "engineering/prompts/phases/P004-INTEGRATION.md" \
  "engineering/prompts/phases/P005-TESTING.md" \
  "engineering/prompts/phases/P006-DEPLOYMENT.md" \
  "engineering/coding-standards/TYPESCRIPT.md" \
  "engineering/coding-standards/NESTJS.md" \
  "engineering/coding-standards/DATABASE.md" \
  "engineering/coding-standards/GIT.md" \
  "engineering/checklists/PRE-LAUNCH.md" \
  "engineering/checklists/CODE-REVIEW.md" \
  "engineering/checklists/CLIENT-ONBOARDING.md" \
  "engineering/industry-packs/travel/README.md" \
  "engineering/industry-packs/travel/MODULE_LIST.md" \
  ".github/workflows/ci.yml" \
  "docs/business/PAYMENT_POLICY.md" \
  "docs/technical/ARCHITECTURE.md" \
  "scripts/new-client.sh" \
  "scripts/workspace-verify.sh" \
; do
  check_path "$p"
done

echo
echo "== Local workspace (sibling folders) =="
for p in \
  "CLIENT_PROJECTS" \
  "SHARED_LIBRARIES/auth" \
  "SHARED_LIBRARIES/ui" \
  "SHARED_LIBRARIES/notifications" \
  "SHARED_LIBRARIES/email" \
  "SHARED_LIBRARIES/logging" \
  "SHARED_LIBRARIES/utils" \
  "SHARED_LIBRARIES/types" \
  "TOOLS/scripts" \
  "TOOLS/docker" \
  "TOOLS/utilities" \
  "TOOLS/templates" \
  "BACKUPS" \
; do
  check_path "$p"
done

echo
echo "== Git =="
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "OK   git repository initialized"
  git branch --list main develop | sed 's/^/     /'
else
  echo "MISS git repository not initialized"
  FAIL=1
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "Workspace verification PASSED"
else
  echo "Workspace verification FAILED — see MISS entries above"
fi
exit "$FAIL"
