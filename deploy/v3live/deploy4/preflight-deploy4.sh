#!/bin/sh
# Deploy 4 step 1. READ ONLY: is the server in the state this plan was written for? Changes nothing.
# exit 0 ready; 1 something differs (do not continue)
. "$(dirname "$0")/common-deploy4.sh"
bad=0
is() { if [ "$2" = "$3" ]; then echo "  ok $1: $2"; else echo "  DIFFERS $1: found '$2', expected '$3'"; bad=1; fi; }
for s in api site; do is "$s image" "$(cfg $s)" "get4domain-v3-$s:$OLD"; is "$s health" "$(health $s)" healthy; done
for s in vendor admin partner; do is "$s image" "$(cfg $s)" "get4domain-v3-$s:$UI"; is "$s health" "$(health $s)" healthy; done
is "compose.env tag" "$(grep '^IMAGE_TAG=' $E)" "IMAGE_TAG=$UI"
is "migrations applied" "$(applied)" $BEFORE
is "unfinished migrations" "$(unfinished)" 0
is "new migration rows" "$(sql "select count(*) from _prisma_migrations where migration_name='$MIG'")" 0
is "source clone changes" "$(git -C $R/src/backend status --porcelain | wc -l | tr -d ' ')" 0
for f in $R/backup.sh $R/secrets/backup_pass $R/env/api.env; do [ -f $f ] && echo "  ok present $f" || { echo "  DIFFERS missing $f"; bad=1; }; done
imgid get4domain-v3-ops:$OLD >/dev/null && echo "  ok old ops image present" || { echo "  DIFFERS no old ops image"; bad=1; }
free=$(df -Pk $R | awk 'NR==2{print $4}'); if [ "$free" -ge 10485760 ] 2>/dev/null; then echo "  ok disk free ${free} KiB"; else echo "  DIFFERS disk free '${free}' KiB, 10 GiB wanted"; bad=1; fi
apiready && echo "  ok API ready" || { echo "  DIFFERS API not ready"; bad=1; }
hosts_ok || bad=1
if [ $bad = 0 ]; then echo "PREFLIGHT-OK"; else echo "PREFLIGHT-FAILED: do not continue"; fi
exit $bad
