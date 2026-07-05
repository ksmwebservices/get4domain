#!/bin/bash
# Get4Domain — New Client Setup Script
# Usage: ./scripts/new-client.sh INDUSTRY CLIENT_ID
# Example: ./scripts/new-client.sh TRAVEL MR_TRAVELS_001

INDUSTRY=$1
CLIENT_ID=$2

if [ -z "$INDUSTRY" ] || [ -z "$CLIENT_ID" ]; then
  echo "Usage: ./scripts/new-client.sh INDUSTRY CLIENT_ID"
  echo "Example: ./scripts/new-client.sh TRAVEL MR_TRAVELS_001"
  exit 1
fi

REPO_NAME=$(echo "$CLIENT_ID" | tr '[:upper:]' '[:lower:]' | tr '_' '-')
LOCAL_PATH="C:/Get4Domain/CLIENT_PROJECTS/$INDUSTRY/CLIENTS/$CLIENT_ID"

echo "================================================"
echo "  New Client Setup: $CLIENT_ID"
echo "  Industry: $INDUSTRY"
echo "  Repo: github.com/ksmwebservices/$REPO_NAME"
echo "  Local: $LOCAL_PATH"
echo "================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Create GitHub repo:"
echo "   https://github.com/new"
echo "   Name: $REPO_NAME"
echo "   Visibility: Private"
echo "   Do NOT initialize with README"
echo ""
echo "2. Create local folder:"
echo "   mkdir -p $LOCAL_PATH"
echo "   cd $LOCAL_PATH"
echo "   git clone https://github.com/ksmwebservices/$REPO_NAME ."
echo ""
echo "3. Update PROJECT_REGISTRY.json in get4domain repo"
echo "   Add client entry under industry: $INDUSTRY"
echo ""
echo "4. Update CURRENT_TASK.md"
echo "   Set activeProject: $CLIENT_ID"
echo ""
echo "5. Start Claude Code in $LOCAL_PATH and paste:"
echo ""
echo "   Read CLAUDE.md, WORKFLOW.md, GITHUB.md, CURRENT_TASK.md,"
echo "   PROJECT_REGISTRY.json, REPOSITORY_RULES.md."
echo "   Then execute engineering/prompts/phases/P001-PROJECT-INIT.md"
echo ""
echo "================================================"
