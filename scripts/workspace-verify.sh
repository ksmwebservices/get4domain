#!/bin/bash
# Get4Domain — Workspace Verification Script
# Run from inside C:\Get4Domain\ to verify workspace is complete

echo "================================================"
echo "  Get4Domain Workspace Verification"
echo "================================================"
echo ""

ROOT="C:/Get4Domain"
PASS=0
FAIL=0

check_dir() {
  if [ -d "$1" ]; then
    echo "  ✅ $1"
    PASS=$((PASS + 1))
  else
    echo "  ❌ MISSING: $1"
    FAIL=$((FAIL + 1))
  fi
}

check_file() {
  if [ -f "$1" ]; then
    echo "  ✅ $1"
    PASS=$((PASS + 1))
  else
    echo "  ❌ MISSING: $1"
    FAIL=$((FAIL + 1))
  fi
}

echo "── Session Files (repo root) ──────────────────"
check_file "CLAUDE.md"
check_file "WORKFLOW.md"
check_file "GITHUB.md"
check_file "CURRENT_TASK.md"
check_file "PROJECT_REGISTRY.json"
check_file "REPOSITORY_RULES.md"

echo ""
echo "── Engineering Structure ──────────────────────"
check_dir "engineering/prompts/phases"
check_file "engineering/prompts/phases/P000-WORKSPACE-INIT.md"
check_file "engineering/prompts/phases/P001-PROJECT-INIT.md"
check_file "engineering/prompts/phases/P002-BOLT-UI.md"
check_file "engineering/prompts/phases/P003-BACKEND.md"
check_file "engineering/prompts/phases/P004-INTEGRATION.md"
check_file "engineering/prompts/phases/P005-TESTING.md"
check_file "engineering/prompts/phases/P006-DEPLOYMENT.md"
check_dir "engineering/coding-standards"
check_dir "engineering/checklists"
check_dir "engineering/industry-reference/travel"

echo ""
echo "── Industry Reference ─────────────────────────"
check_file "engineering/industry-reference/travel/OVERVIEW.md"
check_file "engineering/industry-reference/travel/MODULES.md"
check_file "engineering/industry-reference/travel/DB_GUIDE.md"
check_file "engineering/industry-reference/travel/API_GUIDE.md"
check_file "engineering/industry-reference/travel/UI_GUIDE.md"
check_file "engineering/industry-reference/travel/IMPLEMENTATION_NOTES.md"
check_file "engineering/industry-reference/travel/MODULE_CHECKLIST.md"

echo ""
echo "── Workspace Sibling Folders ──────────────────"
echo "  (These live outside the repo — verify manually)"
echo "  CLIENT_PROJECTS/TRAVEL/CLIENTS/"
echo "  CLIENT_PROJECTS/HR/CLIENTS/"
echo "  CLIENT_PROJECTS/HOSPITAL/CLIENTS/"
echo "  SHARED_LIBRARIES/"
echo "  TOOLS/"
echo "  BACKUPS/"

echo ""
echo "================================================"
echo "  Results: $PASS passed | $FAIL failed"
if [ "$FAIL" -eq 0 ]; then
  echo "  ✅ Workspace verified. Ready for P001."
else
  echo "  ❌ Fix missing items before proceeding."
fi
echo "================================================"
