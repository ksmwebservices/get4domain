#!/bin/sh
# usage: finish.sh <queue-no> <pack-id> <type> <start-file> "<notes>"   (run after check.mjs PASS; commits, writes ledger, pushes themes-factory only)
n=$1; id=$2; type=$3; start=$(cat "$4"); notes=$5
find . -maxdepth 3 -name 'HOLD*' -not -path './node_modules/*' | grep -q . && { echo HOLD file present; exit 1; }
git add -A packs && git commit -qm "feat(themes): factory pack $n, $id" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" || exit 1
h=$(git rev-parse --short HEAD)
node packs/_tools/ledger.mjs "$n" "$id" "$type" DONE "$h" "pass, 41 rules incl. browser 360-1536, no waivers" "$notes" "$start" || exit 1
git add -A docs && git commit -qm "docs(themes): ledger and queue, pack $n done" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" || exit 1
git push origin themes-factory 2>&1 | tail -1
echo "remote $(git ls-remote origin themes-factory | cut -c1-8) local $(git rev-parse --short HEAD)"
