#!/bin/sh
# Deploy 4 step 4, run by the OWNER in a terminal. Applies the one pending migration to the live V3 database; the tool asks for the word LIVE.
# exit 0 applied and verified; 9 nothing changed; 2 the migration command failed; 3 applied but a verification failed (do not swap)
. "$(dirname "$0")/common-deploy4.sh"
no() { echo "MIGRATE-NOT-STARTED: $1; nothing changed"; exit 9; }
[ -f $R/deploy4-backup.txt ] || no "no backup recorded, run backup-deploy4.sh first"
read -r at file < $R/deploy4-backup.txt
age=$(( $(date +%s) - ${at:-0} )); [ $age -ge 0 ] && [ $age -le 7200 ] || no "the recorded backup is older than 2 hours"
[ -s "$file" ] || no "the recorded backup file is missing"
[ -n "$(imgid get4domain-v3-ops:$TAG)" ] || no "no new ops image, run build-deploy4.sh first"
[ -n "$(imgid get4domain-v3-ops:$OLD)" ] || no "no old ops image"
[ "$(applied)" = $BEFORE ] || no "expected $BEFORE applied migrations"
[ "$(unfinished)" = 0 ] || no "there is an unfinished migration"
mig_done && no "$MIG is already applied"
[ "$(sql "select count(*) from pg_stat_activity where datname='get4domain_v3' and xact_start < now() - interval '1 minute'")" = 0 ] || no "a long database transaction is open; try again in a few minutes"
rows=$(theme_rows); [ -n "$rows" ] || no "cannot count the themes"
ops() { _tag=$1; _cmd=$2; docker run --rm --network v3net --env-file $R/env/api.env get4domain-v3-ops:$_tag node scripts/live/migrate-live.js $_cmd </dev/null 2>&1; }
pending=$(ops $TAG status | tr -d '\r' | grep -E '^[0-9]{14}_[a-z0-9_]+$')
[ "$pending" = "$MIG" ] || no "expected exactly one pending migration ($MIG), found: $(echo $pending)"
# the schema differences that exist today, seen with the old code's schema; the new code must show exactly the same ones afterwards
diffs() { _o=$(ops $1 drift); _rc=$?; [ $_rc = 0 ] || [ $_rc = 2 ] || return 1; echo "$_o" | tr -d '\r' | grep -E '^ *\[[*+~-]\]'; }
# three old differences are known to exist, so an empty list means the check itself did not work
diffs $OLD > $R/deploy4-drift-before.txt && [ -s $R/deploy4-drift-before.txt ] || no "cannot read the schema differences"
echo "== applying $MIG (backup: $file)"
docker run --rm -it --network v3net --env-file $R/env/api.env get4domain-v3-ops:$TAG node scripts/live/migrate-live.js deploy
rc=$?
if [ $rc != 0 ]; then
  echo "MIGRATE-FAILED (exit $rc). applied=$(applied) unfinished=$(unfinished). Do not swap; the running API is unchanged."
  [ "$(applied)" = $BEFORE ] && [ "$(unfinished)" = 0 ] && echo "The database is as before."
  exit 2
fi
bad() { echo "MIGRATE-VERIFY-FAILED: $1. Do not swap."; exit 3; }
[ "$(applied)" = $AFTER ] || bad "applied is not $AFTER"
[ "$(unfinished)" = 0 ] || bad "unfinished migration"
mig_done || bad "$MIG is not recorded"
[ "$(sql "select count(*) from information_schema.columns where table_schema='public' and table_name='g4d_theme_market_packages' and column_name in ('deletedAt','deletedById') and is_nullable='YES'")" = 2 ] || bad "the two nullable columns are not there"
[ "$(sql "select count(*) from pg_constraint where conname='g4d_theme_market_packages_deleted_check' and convalidated")" = 1 ] || bad "the check constraint is not there"
[ "$(theme_rows)" = "$rows" ] || bad "the number of theme rows changed (an upload during the step also does this)"
[ "$(sql 'select count(*) from g4d_theme_market_packages where "deletedAt" is not null')" = 0 ] || bad "a row is stamped as deleted"
ops $TAG rls >/dev/null || bad "row level security is off on a public table"
diffs $TAG > $R/deploy4-drift-after.txt || bad "cannot read the schema differences after the migration"
diff $R/deploy4-drift-before.txt $R/deploy4-drift-after.txt >/dev/null || bad "the schema differences changed (compare deploy4-drift-before.txt and deploy4-drift-after.txt)"
apiready || bad "the running API is not ready"
themes_ok || bad "the running API cannot list themes"
echo "MIGRATE-OK: $AFTER applied, two columns and the check present, $rows theme rows, schema differences unchanged, old API ready"
