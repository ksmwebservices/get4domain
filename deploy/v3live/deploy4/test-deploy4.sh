#!/bin/sh
# Sandbox tests of the Deploy 4 scripts. docker (incl. compose), curl, git, df, openssl and sleep are fakes that record every call; nothing real is touched.
# usage: bash test-deploy4.sh [folder with the scripts]   (the scripts under test always run under dash; run this file with bash, because dash on Windows empties large here-documents)
SRC=$(cd "${1:-$(dirname "$0")}" && pwd); BASE=$(mktemp -d); FAKE=$BASE/fake; mkdir -p $FAKE
val() { sed -n "s/^$1=\([^ ]*\).*/\1/p" $SRC/common-deploy4.sh; }
TAG=$(val TAG); OLD=$(val OLD); UI=$(val UI); SHA=$(val SHA); MIG=$(val MIG)
export TAG OLD UI MIG
PASS=0; FAILN=0

# one dump that looks like a real one (large enough), and broken variants
{ echo 'COPY public._prisma_migrations (id) FROM stdin;'; echo 'COPY public.g4d_theme_market_packages (id) FROM stdin;'; head -c 300000 /dev/urandom | base64; echo '-- PostgreSQL database dump complete'; } > $BASE/good.sql
gzip -c $BASE/good.sql > $BASE/good.gz
grep -v 'dump complete' $BASE/good.sql | gzip -c > $BASE/incomplete.gz
grep -v 'g4d_theme_market_packages' $BASE/good.sql | gzip -c > $BASE/notheme.gz
printf 'x\n' | gzip -c > $BASE/small.gz

cat > $FAKE/sleep <<'EOF'
#!/bin/sh
exit 0
EOF
cat > $FAKE/df <<'EOF'
#!/bin/sh
echo "Filesystem 1024-blocks Used Available Capacity Mounted on"
echo "/dev/x 100000000 1 ${DF_AVAIL:-20000000} 80% /"
EOF
cat > $FAKE/openssl <<'EOF'
#!/bin/sh
[ -n "$FAIL_DECRYPT" ] && exit 1
f=""; p=""; for a; do [ "$p" = -in ] && f=$a; p=$a; done; cat "$f"
EOF

cat > $FAKE/docker <<'EOF'
#!/bin/sh
echo "docker $* [IMAGE_TAG=$IMAGE_TAG]" >> $ST/calls
iid() { awk -v n="$1" '$1==n{v=$2; f=1} END{if(f)print v; exit !f}' $ST/images; }
db() { cat $ST/db/$1; }
case "$1" in
  image) for l; do :; done; v=$(iid "$l") || { echo "no such image" >&2; exit 1; }; echo "$v" ;;
  tag) [ "$FAIL_TAG" = "$3" ] && exit 1; v=$(iid "$2") || exit 1; [ "$BAD_TAG" = "$3" ] && v=sha256:other; echo "$3 $v" >> $ST/images ;;
  build) name=""; p=""; for a; do [ "$p" = -t ] && name=$a; p=$a; done; r=${name%:*}
         [ "$FAIL_BUILD" = "$r" ] && exit 17; [ "$SILENT_BUILD" = "$r" ] && exit 0; echo "$name sha256:built-$r" >> $ST/images ;;
  run) img=""; script=""; cmd=""; tty=""; for a; do case "$a" in -it) tty=1 ;; get4domain-v3-ops:*) img=$a ;; scripts/live/*) script=$a ;; status|drift|deploy|rls) cmd=$a ;; esac; done
       iid "$img" >/dev/null || { echo "no such image $img" >&2; exit 125; }; t=${img##*:}
       case "$script" in
         *check-live-env.js) [ -n "$FAIL_ENVCHECK" ] && exit 1; exit 0 ;;
         *migrate-live.js) case "$cmd" in
             status) echo "134 migrations found in prisma/migrations"; echo "Following migration have not yet been applied:"; printf '%b\n' "${PENDING-$MIG}"; echo; echo "To apply migrations in production run prisma migrate deploy."; exit 1 ;;
             drift) [ "$DRIFT_ERR" = "$t" ] && { echo "Error: P1001" >&2; exit 1; }; [ "$DRIFT_EMPTY" = "$t" ] && exit 0
                    printf '\n[*] Changed the `Vendor` table\n  [-] Removed index on columns (businessName)\nwarn something\nnpm notice at %s\n' "$t"
                    [ "$DRIFT_CHANGED" = "$t" ] && printf '  [+] Added column `deletedAt`\n'; exit 2 ;;
             deploy) [ -n "$tty" ] || { echo "needs a terminal" >&2; exit 2; }; [ -n "$FAIL_DEPLOY" ] && { [ "$FAIL_DEPLOY" = partial ] && echo 1 > $ST/db/unfinished; exit 1; }
                    [ -n "$NO_APPLY" ] || echo 135 > $ST/db/applied; echo 1 > $ST/db/mig; echo ${COLS:-2} > $ST/db/cols; echo ${CHECKS:-1} > $ST/db/check
                    [ -n "$UNFIN_AFTER" ] && echo 1 > $ST/db/unfinished; [ -n "$ROWS_CHANGE" ] && echo 11 > $ST/db/rows; [ -n "$STAMPED" ] && echo 1 > $ST/db/stamped; exit 0 ;;
             rls) [ -n "$RLS_BAD" ] && exit 1; exit 0 ;;
           esac ;;
       esac; echo "unexpected run $*" >&2; exit 1 ;;
  exec) case "$*" in *"PGOPTIONS=-c default_transaction_read_only=on"*) ;; *) echo "query without read only" >&2; exit 1 ;; esac
        [ -n "$FAIL_SQL" ] && exit 1; for q; do :; done
        case "$q" in
          *"finished_at is not null and rolled_back_at is null"*migration_name*|*"migration_name='"*"finished_at is not null"*) db mig ;;
          *"finished_at is not null and rolled_back_at is null"*) db applied ;;
          *"finished_at is null and rolled_back_at is null"*) db unfinished ;;
          *"migration_name='"*) db mig ;;
          *pg_stat_activity*) db longtx ;;
          *information_schema.columns*) db cols ;;
          *pg_constraint*) db check ;;
          *'"deletedAt" is not null'*) db stamped ;;
          *"count(*) from g4d_theme_market_packages"*) db rows ;;
          *) echo "unexpected query $q" >&2; exit 1 ;;
        esac ;;
  inspect) fmt="$3"; shift 3
         for c; do [ -d $ST/c/$c ] || exit 1
           case "$fmt" in
             '{{.State.Health.Status}}') cat $ST/c/$c/health ;;
             '{{.Config.Image}}') cat $ST/c/$c/image ;;
             '{{.Image}}') cat $ST/c/$c/id ;;
             '{{.RestartCount}}') cat $ST/c/$c/restarts ;;
             '{{.Name}} {{.Id}} {{.State.StartedAt}}') echo "/$c $(cat $ST/c/$c/cid) $(cat $ST/c/$c/started)" ;;
             *) echo "unexpected format $fmt" >&2; exit 1 ;;
           esac; done ;;
  compose) case "$*" in
           *"config --images") [ -n "$FAIL_CONFIG" ] && exit 1; t=$(sed -n 's/^IMAGE_TAG=//p' $G4D_ROOT/env/compose.env); for s in api site vendor admin partner; do [ "$CONFIG_MISSING" = $s ] || echo get4domain-v3-$s:$t; done; exit 0 ;;
           *--dry-run*) echo " Container g4d-v3-admin  Recreate"; exit 0 ;;
         esac
         for s; do :; done; c=g4d-v3-$s
         [ "$FAIL_COMPOSE" = "$s:$IMAGE_TAG" ] && exit 1
         img=get4domain-v3-$s:$IMAGE_TAG; id=$(iid $img) || exit 1
         [ "$WRONG_NAME" = "$s:$IMAGE_TAG" ] && img=get4domain-v3-$s:wrong
         [ "$WRONG_ID" = "$s:$IMAGE_TAG" ] && id=sha256:stale
         echo $img > $ST/c/$c/image; echo $id > $ST/c/$c/id; echo healthy > $ST/c/$c/health; echo 0 > $ST/c/$c/restarts; echo again > $ST/c/$c/started
         [ "$UNHEALTHY" = "$s:$IMAGE_TAG" ] && echo unhealthy > $ST/c/$c/health
         [ "$RESTARTED" = "$s:$IMAGE_TAG" ] && echo 2 > $ST/c/$c/restarts
         [ "$TOUCHES" = "$s:$IMAGE_TAG" ] && echo later > $ST/c/${TOUCHED:-g4d-v3-vendor}/started
         [ "$TERM_ON" = "$s:$IMAGE_TAG" ] && kill -TERM $PPID
         [ "$IMAGE_TAG" = "$TAG" ] && : > $ST/swapped
         exit 0 ;;
  logs) echo "log line user@example.com"; [ -n "$THEME_LOG_BAD" ] && grep -q "$TAG" $ST/c/g4d-v3-api/image && echo "[Nest] 1 - ERROR [ThemeRenderService] marketplace themes could not be read; keeping the previous set: x"; exit 0 ;;
  ps) for d in $ST/c/*; do echo "${d##*/} $(cat $d/image) Up"; done ;;
  *) echo "unexpected docker $*" >&2; exit 1 ;;
esac
EOF

cat > $FAKE/curl <<'EOF'
#!/bin/sh
echo "curl $*" >> $ST/calls
url=""; w=""; hdr=""; p=""; method=GET
for a; do case "$a" in http*) url=$a ;; esac; [ "$p" = -w ] && w=$a; [ "$p" = -X ] && method=$a; [ "$a" = -D ] && hdr=1; p=$a; done
isnew() { grep -q "$TAG" $ST/c/g4d-v3-$1/image; }
# when does an injected address failure hold: always; from the first swap on and for good; or only while one service runs the new tag
holds() { [ -n "$FAIL_ALWAYS" ] && return 0; [ -n "$FAIL_FROM_SWAP" ] && { [ -f $ST/swapped ]; return; }; [ -n "$FAIL_ON" ] && isnew $FAIL_ON; }
bad=0
if [ -n "$FAIL_URL" ] && echo "$url" | grep -qE "$FAIL_URL"; then holds && bad=1; fi
status=200; [ $bad = 1 ] && status=502
if [ -n "$hdr" ]; then
  printf 'HTTP/2 %s\r\n' $status
  { [ -n "$NOINDEX_MISSING" ] && echo "$url" | grep -qE "$NOINDEX_MISSING" && holds; } || printf 'x-robots-tag: noindex, nofollow\r\n'
  printf '\r\nCODE=%s' $status; exit 0
fi
case "$url" in
  */manifest.webmanifest) if { isnew site && [ -n "$MANIFEST_BAD" ]; } || { ! isnew site && [ -n "$MANIFEST_BAD_OLD" ]; }; then status=500; fi; printf %s $status; exit 0 ;;
  */v3/admin/telecaller/vendors) c=404; isnew api && c=401; [ -n "$ROUTE_STAFF" ] && c=$ROUTE_STAFF; printf %s $c; exit 0 ;;
  */v3/admin/theme-market/themes/*) [ $method = DELETE ] || { printf 405; exit 0; }; c=404; isnew api && c=401; [ -n "$ROUTE_DELETE" ] && c=$ROUTE_DELETE; printf %s $c; exit 0 ;;
  */v3/public/site/hosts) c=404; isnew api && c=200; [ -n "$ROUTE_HOSTS" ] && c=$ROUTE_HOSTS; printf %s $c; exit 0 ;;
esac
if [ "$w" = '%{http_code}' ]; then printf %s $status; exit 0; fi
[ $bad = 1 ] && exit 22
case "$url" in
  */health/ready) if { isnew api && [ -n "$READY_BAD" ]; } || { ! isnew api && [ -n "$READY_BAD_OLD" ]; } || { ! isnew api && [ -n "$READY_BAD_AFTER" ] && [ -f $ST/swapped ]; }; then echo '{"status":"not-ready","database":"down"}'; else echo '{"status":"ready","database":"up"}'; fi ;;
  */v3/public/theme-market/themes) if { isnew api && [ -n "$THEMES_BAD" ]; } || { ! isnew api && [ -n "$THEMES_BAD_OLD" ]; }; then exit 22; fi; echo '{"success":true,"data":{}}' ;;
  *) echo "unexpected url $url" >&2; exit 1 ;;
esac
EOF

cat > $FAKE/git <<'EOF'
#!/bin/sh
echo "git $*" >> $ST/calls
shift 2
case "$1" in
  --no-optional-locks) shift ;;
esac
case "$1" in
  status) [ -n "$DIRTY" ] && echo "?? x"; [ -n "$DIRTY_AFTER" ] && [ "$(cat $ST/head)" != old ] && echo "?? y"; exit 0 ;;
  fetch) [ -n "$FAIL_FETCH" ] && exit 1; exit 0 ;;
  checkout) [ -n "$FAIL_CHECKOUT" ] && exit 1; for l; do :; done; echo ${HEAD_AS:-$l} > $ST/head ;;
  rev-parse) cat $ST/head ;;
  diff) [ -n "$SITE_CHANGED" ] && exit 1; exit 0 ;;
  *) exit 1 ;;
esac
EOF
REALSED=$(command -v sed)
cat > $FAKE/sed <<EOF
#!/bin/sh
if [ "\$1" = -i ]; then
  [ -n "\$FAIL_SED" ] && exit 1
  if [ -n "\$SED_EXTRA" ]; then $REALSED "\$@" && $REALSED -i 's/^OTHER=.*/OTHER=changed/' "\$3"; exit; fi
  [ -n "\$SED_NOOP" ] && exit 0
fi
exec $REALSED "\$@"
EOF
chmod +x $FAKE/*
for f in $FAKE/*; do [ -s $f ] || { echo "the fake ${f##*/} is empty: run this harness with bash"; exit 1; }; done

KNOBS="DF_AVAIL FAIL_DECRYPT FAIL_TAG BAD_TAG FAIL_BUILD SILENT_BUILD FAIL_ENVCHECK PENDING DRIFT_ERR DRIFT_EMPTY DRIFT_CHANGED FAIL_DEPLOY NO_APPLY COLS CHECKS UNFIN_AFTER ROWS_CHANGE STAMPED RLS_BAD FAIL_SQL FAIL_CONFIG CONFIG_MISSING FAIL_COMPOSE WRONG_NAME WRONG_ID UNHEALTHY RESTARTED TOUCHES TOUCHED TERM_ON THEME_LOG_BAD FAIL_URL FAIL_ALWAYS FAIL_FROM_SWAP FAIL_ON NOINDEX_MISSING MANIFEST_BAD MANIFEST_BAD_OLD ROUTE_STAFF ROUTE_DELETE ROUTE_HOSTS READY_BAD READY_BAD_OLD READY_BAD_AFTER THEMES_BAD THEMES_BAD_OLD DIRTY DIRTY_AFTER FAIL_FETCH FAIL_CHECKOUT HEAD_AS SITE_CHANGED FAIL_SED SED_EXTRA SED_NOOP BK_FAIL BK_SILENT BK_FILE"

new_state() { # the server as it is before the deploy
  for _v in $KNOBS; do unset $_v; done
  ST=$(mktemp -d -p $BASE); export ST; R=$ST/root; export G4D_ROOT=$R
  mkdir -p $ST/c $ST/db $R/env $R/secrets $R/backups $R/src/backend/deploy/v3live
  : > $ST/calls; : > $ST/images; echo old > $ST/head
  for _k in api site vendor admin partner; do
    _t=$OLD; case $_k in vendor|admin|partner) _t=$UI ;; esac
    echo "get4domain-v3-$_k:$_t sha256:run-$_k" >> $ST/images
    c=$ST/c/g4d-v3-$_k; mkdir -p $c; echo get4domain-v3-$_k:$_t > $c/image; echo sha256:run-$_k > $c/id
    echo healthy > $c/health; echo 0 > $c/restarts; echo cid-$_k > $c/cid; echo t0 > $c/started
  done
  c=$ST/c/postgres-v3db-1; mkdir -p $c; echo cid-db > $c/cid; echo t0 > $c/started; echo postgres:17 > $c/image
  echo "get4domain-v3-ops:$OLD sha256:ops-old" >> $ST/images
  echo 134 > $ST/db/applied; echo 0 > $ST/db/unfinished; echo 0 > $ST/db/mig; echo 0 > $ST/db/longtx; echo 0 > $ST/db/cols; echo 0 > $ST/db/check; echo 0 > $ST/db/stamped; echo 12 > $ST/db/rows
  printf 'V3_BIND_IP=x\nIMAGE_TAG=%s\nOTHER=y\n' $UI > $R/env/compose.env; : > $R/env/api.env; : > $R/secrets/backup_pass
  cat > $R/backup.sh <<'BK'
#!/bin/bash
[ -n "$BK_FAIL" ] && { echo "pg_dump: error"; exit 1; }
[ -n "$BK_SILENT" ] && exit 0
f=$G4D_ROOT/backups/v3_test.sql.gz.enc; cp "$BK_FILE" "$f"; echo "2026-11-27T10:00:00+00:00 backup ok $f"
BK
  export BK_FILE=$BASE/good.gz
}
add_new() { echo "get4domain-v3-ops:$TAG sha256:ops-new" >> $ST/images; echo "get4domain-v3-api:$TAG sha256:new-api" >> $ST/images; echo "get4domain-v3-site:$TAG sha256:run-site" >> $ST/images
  for _k in vendor admin partner; do echo "get4domain-v3-$_k:$TAG sha256:run-$_k" >> $ST/images; done; }
migrated() { echo 135 > $ST/db/applied; echo 1 > $ST/db/mig; echo 2 > $ST/db/cols; echo 1 > $ST/db/check; }
on_new() { echo get4domain-v3-$1:$TAG > $ST/c/g4d-v3-$1/image; awk -v n="get4domain-v3-$1:$TAG" '$1==n{v=$2} END{print v}' $ST/images > $ST/c/g4d-v3-$1/id; }
record() { cp $BASE/good.gz $R/backups/b.enc; echo "$(( $(date +%s) - ${1:-60} )) $R/backups/b.enc" > $R/deploy4-backup.txt; }
run() { _sc=$1; shift; PATH=$FAKE:$PATH dash $SRC/$_sc "$@" > $ST/out 2>&1; RC=$?; }
ok() { if eval "$2"; then PASS=$((PASS+1)); else FAILN=$((FAILN+1)); echo "FAIL [$CASE] $1 (exit $RC)"; tail -4 $ST/out | sed 's/^/    /'; [ -z "$STOP_FIRST" ] || exit 1; fi; }
has() { grep -qE -- "$1" $ST/out; }
called() { grep -qE -- "$1" $ST/calls; }
count() { grep -cE -- "$1" $ST/calls; }
img() { cat $ST/c/g4d-v3-$1/image; }
nothing_changed() { ! called '^docker (compose .* up|build|tag|run)'; }
tag_line() { grep '^IMAGE_TAG=' $R/env/compose.env; }

[ -n "$TAG" ] && [ -n "$OLD" ] && [ -n "$UI" ] && [ -n "$MIG" ] || { echo "cannot read the settings"; exit 1; }

# ---------- preflight
CASE="preflight ok"; new_state; run preflight-deploy4.sh
ok "exit 0" '[ $RC = 0 ]'; ok "ok line" 'has "^PREFLIGHT-OK"'; ok "changes nothing" 'nothing_changed'
pre() { CASE="preflight: $1"; new_state; eval "$2"; run preflight-deploy4.sh; ok "exit 1" '[ $RC = 1 ]'; ok "failed line" 'has "^PREFLIGHT-FAILED"'; ok "changes nothing" 'nothing_changed'; }
pre "api on another image" 'echo x > $ST/c/g4d-v3-api/image'
pre "site unhealthy" 'echo unhealthy > $ST/c/g4d-v3-site/health'
pre "admin on another image" 'echo x > $ST/c/g4d-v3-admin/image'
pre "compose tag" 'sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=other/" $R/env/compose.env'
pre "133 migrations" 'echo 133 > $ST/db/applied'
pre "unfinished" 'echo 1 > $ST/db/unfinished'
pre "already recorded" 'echo 1 > $ST/db/mig'
pre "dirty clone" 'export DIRTY=1'
pre "no passphrase file" 'rm $R/secrets/backup_pass'
pre "no old ops image" ': > $ST/images'
pre "low disk" 'export DF_AVAIL=5000000'
pre "api not ready" 'export READY_BAD_OLD=1'
pre "a host down" 'export FAIL_URL=plumberboy FAIL_ALWAYS=1'
pre "noindex missing" 'export NOINDEX_MISSING=v3site FAIL_ALWAYS=1'

# ---------- backup
CASE="backup ok"; new_state; run backup-deploy4.sh
ok "exit 0" '[ $RC = 0 ]'; ok "record" '[ -s $R/deploy4-backup.txt ]'; ok "ok line" 'has "^BACKUP-OK"'; ok "no dump text printed" '! has "COPY public"'
bk() { CASE="backup: $1"; new_state; record; eval "$2"; run backup-deploy4.sh; ok "exit 1" '[ $RC = 1 ]'; ok "no record left" '[ ! -e $R/deploy4-backup.txt ]'; ok "failed line" 'has "^BACKUP-FAILED"'; }
bk "job fails" 'export BK_FAIL=1'
bk "job names no file" 'export BK_SILENT=1'
bk "too small" 'export BK_FILE=$BASE/small.gz'
bk "cannot decrypt" 'export FAIL_DECRYPT=1'
bk "dump incomplete" 'export BK_FILE=$BASE/incomplete.gz'
bk "theme table missing" 'export BK_FILE=$BASE/notheme.gz'

# ---------- build
CASE="build ok"; new_state; run build-deploy4.sh
ok "exit 0" '[ $RC = 0 ]'; ok "all ok" 'has "^BUILD-ALL-OK"'; ok "two builds" '[ $(count "^docker build") = 2 ]'
ok "release commit checked out" 'called "git .* checkout --detach $SHA"'
ok "env check with the new ops image" 'called "^docker run .*get4domain-v3-ops:$TAG node scripts/live/check-live-env.js"'
ok "site retagged, not built" 'called "^docker tag get4domain-v3-site:$OLD get4domain-v3-site:$TAG" && ! called "^docker build.*v3-site"'
for s in vendor admin partner; do ok "$s retagged" 'called "^docker tag get4domain-v3-$s:$UI get4domain-v3-$s:$TAG"'; done
ok "nothing running changed" '! called "^docker compose"'
bd() { CASE="build: $1"; new_state; eval "$2"; run build-deploy4.sh; ok "exit 1" '[ $RC = 1 ]'; ok "failed line" 'has "^BUILD-FAILED"'; ok "no all-ok" '! has "BUILD-ALL-OK"'; ok "no compose" '! called "^docker compose"'; }
bd "low disk" 'export DF_AVAIL=100'
bd "api already on the new tag" 'echo get4domain-v3-api:$TAG > $ST/c/g4d-v3-api/image'
bd "dirty clone" 'export DIRTY=1'
bd "fetch fails" 'export FAIL_FETCH=1'
bd "checkout fails" 'export FAIL_CHECKOUT=1'
bd "wrong commit" 'export HEAD_AS=abc'
bd "dirty after checkout" 'export DIRTY_AFTER=1'
bd "site source changed" 'export SITE_CHANGED=1'
bd "ops build fails" 'export FAIL_BUILD=get4domain-v3-ops'
bd "api build fails" 'export FAIL_BUILD=get4domain-v3-api'
bd "api build silent" 'export SILENT_BUILD=get4domain-v3-api'
bd "env check fails" 'export FAIL_ENVCHECK=1'
for s in site vendor admin partner; do
  bd "$s tag fails" "export FAIL_TAG=get4domain-v3-$s:\$TAG"
  bd "$s tag wrong image" "export BAD_TAG=get4domain-v3-$s:\$TAG"
  bd "$s running image differs from its tag" "echo sha256:else > \$ST/c/g4d-v3-$s/id"
done

# ---------- migrate
mg_state() { new_state; add_new; record; }
CASE="migrate ok"; mg_state; run migrate-deploy4.sh
ok "exit 0" '[ $RC = 0 ]'; ok "ok line" 'has "^MIGRATE-OK"'; ok "deploy once, in a terminal" '[ $(count "^docker run --rm -it .*ops:$TAG node scripts/live/migrate-live.js deploy") = 1 ]'; ok "no compose" '! called "^docker compose"'
no9() { CASE="migrate not started: $1"; mg_state; eval "$2"; run migrate-deploy4.sh; ok "exit 9" '[ $RC = 9 ]'; ok "deploy not run" '! called "migrate-live.js deploy"'; }
no9 "no backup record" 'rm $R/deploy4-backup.txt'
no9 "old backup" 'record 7300'
no9 "backup from the future" 'record -600'
no9 "backup file gone" 'rm $R/backups/b.enc'
no9 "no ops image" ': > $ST/images'
no9 "no old ops image" 'grep -v "ops:$OLD" $ST/images > $ST/i; cp $ST/i $ST/images'
no9 "133 applied" 'echo 133 > $ST/db/applied'
no9 "unfinished" 'echo 1 > $ST/db/unfinished'
no9 "already applied" 'echo 1 > $ST/db/mig'
no9 "long transaction" 'echo 1 > $ST/db/longtx'
no9 "no database answer" 'export FAIL_SQL=1'
no9 "another migration pending" 'export PENDING=20270101000000_other'
no9 "two pending" 'export PENDING="$MIG\n20270113000000_more"'
no9 "nothing pending" 'export PENDING='
no9 "drift check errors" 'export DRIFT_ERR=$OLD'
no9 "drift check empty" 'export DRIFT_EMPTY=$OLD'
CASE="migrate command fails"; mg_state; export FAIL_DEPLOY=1; run migrate-deploy4.sh; ok "exit 2" '[ $RC = 2 ]'; ok "says unchanged" 'has "database is as before"'
CASE="migrate command fails half way"; mg_state; export FAIL_DEPLOY=partial; run migrate-deploy4.sh; ok "exit 2" '[ $RC = 2 ]'; ok "does not say unchanged" '! has "database is as before"'
v3() { CASE="migrate verify: $1"; mg_state; eval "$2"; run migrate-deploy4.sh; ok "exit 3" '[ $RC = 3 ]'; ok "do not swap" 'has "^MIGRATE-VERIFY-FAILED.*Do not swap"'; ok "no ok line" '! has "^MIGRATE-OK"'; }
v3 "count" 'export NO_APPLY=1'
v3 "unfinished" 'export UNFIN_AFTER=1'
v3 "columns" 'export COLS=1'
v3 "constraint" 'export CHECKS=0'
v3 "rows" 'export ROWS_CHANGE=1'
v3 "stamped row" 'export STAMPED=1'
v3 "row level security" 'export RLS_BAD=1'
v3 "drift changed" 'export DRIFT_CHANGED=$TAG'
v3 "drift errors" 'export DRIFT_ERR=$TAG'
v3 "old api not ready" 'export READY_BAD_OLD=1'
v3 "old api cannot list themes" 'export THEMES_BAD_OLD=1'

# ---------- swap
sw_state() { new_state; add_new; migrated; [ "$1" = site ] && on_new api; return 0; }
only_one_service() { ! grep -E '^docker compose .* up ' $ST/calls | grep -vqE -- "up -d --no-build --no-deps $1 \[IMAGE_TAG=($TAG|$OLD)\]"; }
for s in api site; do
  CASE="swap $s ok"; sw_state $s; run swap-deploy4.sh $s
  ok "exit 0" '[ $RC = 0 ]'; ok "passed" 'has "^PASSED $s"'; ok "new image" '[ $(img $s) = get4domain-v3-$s:$TAG ]'
  ok "one compose up" '[ $(count "^docker compose .* up ") = 1 ]'; ok "only $s" 'only_one_service $s'
  ok "all eight hosts checked before and after" '[ $(count "^curl .*-D .*https://") = 16 ]'
  for x in api site vendor admin partner; do [ $x = $s ] || ok "$x untouched" '[ $(cat $ST/c/g4d-v3-$x/started) = t0 ]'; done
done
for a in vendor admin partner ops "" "api site"; do CASE="swap refuses '$a'"; sw_state api; run swap-deploy4.sh "$a"; ok "exit 9" '[ $RC = 9 ]'; ok "nothing changed" 'nothing_changed'; done
ns() { CASE="swap $1 not started: $2"; sw_state $1; eval "$3"; run swap-deploy4.sh $1; ok "exit 9" '[ $RC = 9 ]'; ok "no compose" '! called "^docker compose"'; }
for s in api site; do
  ns $s "no new image" "grep -v \"v3-$s:\$TAG\" \$ST/images > \$ST/i; cp \$ST/i \$ST/images"
  ns $s "no rollback image" "grep -v \"v3-$s:\$OLD\" \$ST/images > \$ST/i; cp \$ST/i \$ST/images"
  ns $s "running another tag" "echo x > \$ST/c/g4d-v3-$s/image"
  ns $s "running another image" "echo sha256:else > \$ST/c/g4d-v3-$s/id"
  ns $s "not migrated" 'echo 0 > $ST/db/mig'
  ns $s "host down before" 'export FAIL_URL=v3admin FAIL_ALWAYS=1'
  ns $s "noindex missing before" 'export NOINDEX_MISSING=v3partner FAIL_ALWAYS=1'
  ns $s "another container missing" 'rm -r $ST/c/g4d-v3-partner'
done
ns api "not ready before" 'export READY_BAD_OLD=1'
ns site "api still old" 'echo get4domain-v3-api:$OLD > $ST/c/g4d-v3-api/image'
ns site "api unhealthy" 'echo unhealthy > $ST/c/g4d-v3-api/health'
rb() { CASE="swap $1 rolls back: $2"; sw_state $1; eval "$3"; run swap-deploy4.sh $1; s=$1
  ok "exit 1" '[ $RC = 1 ]'; ok "rolled back line" 'has "^ROLLED-BACK $s"'; ok "back on the old image" '[ $(img $s) = get4domain-v3-$s:$OLD ]'
  ok "only $s" 'only_one_service $s'; ok "rollback uses the old tag" 'called "up -d --no-build --no-deps $s \[IMAGE_TAG=$OLD\]"'
  ok "api left as it should be" '[ $s = api ] || [ $(img api) = get4domain-v3-api:$TAG ]'; ok "no e-mail in the output" '! has "user@example.com"'; ok "not passed" '! has "^PASSED"'; }
for s in api site; do
  rb $s "compose up fails" "export FAIL_COMPOSE=$s:\$TAG"
  rb $s "unhealthy" "export UNHEALTHY=$s:\$TAG"
  rb $s "wrong image name" "export WRONG_NAME=$s:\$TAG"
  rb $s "wrong image id" "export WRONG_ID=$s:\$TAG"
  rb $s "restarted" "export RESTARTED=$s:\$TAG"
  rb $s "another container changed" "export TOUCHES=$s:\$TAG"
  rb $s "database container changed" "export TOUCHES=$s:\$TAG TOUCHED=postgres-v3db-1"
  rb $s "interrupted" "export TERM_ON=$s:\$TAG"
  for h in 'v3api.get4domain.com/health$' v3api.get4domain.com/health/ready v3app v3admin v3partner v3site v3directory plumberboy; do
    rb $s "$h down on the new" "export FAIL_URL='$h' FAIL_ON=$s"
    rb $s "$h loses noindex on the new" "export NOINDEX_MISSING='$h' FAIL_ON=$s"
  done
done
rb api "ready fails" 'export READY_BAD=1'
rb api "theme list fails" 'export THEMES_BAD=1'
rb api "staff route 404" 'export ROUTE_STAFF=404'
rb api "staff route open" 'export ROUTE_STAFF=200'
rb api "delete route 404" 'export ROUTE_DELETE=404'
rb api "delete route open" 'export ROUTE_DELETE=200'
rb api "host list 404" 'export ROUTE_HOSTS=404'
rb api "themes unreadable at start" 'export THEME_LOG_BAD=1'
rb site "manifest 500" 'export MANIFEST_BAD=1'
rf() { CASE="swap $1 rollback not confirmed: $2"; sw_state $1; eval "$3"; run swap-deploy4.sh $1; ok "exit 2" '[ $RC = 2 ]'; s=$1; ok "says so" 'has "^ROLLBACK-(FAILED|UNCONFIRMED) $s"'; ok "only $s" "only_one_service $s"; }
for s in api site; do
  rf $s "compose fails both ways" "export UNHEALTHY=$s:\$TAG FAIL_COMPOSE=$s:\$OLD"
  rf $s "old unhealthy" "export RESTARTED=$s:\$TAG UNHEALTHY=$s:\$OLD"
  rf $s "old wrong id" "export RESTARTED=$s:\$TAG WRONG_ID=$s:\$OLD"
done
rf api "old theme list fails" 'export RESTARTED=api:$TAG THEMES_BAD_OLD=1'
rf api "old api not ready" 'export RESTARTED=api:$TAG READY_BAD_AFTER=1'
rf site "old manifest fails" 'export MANIFEST_BAD=1 MANIFEST_BAD_OLD=1'
for s in api site; do rf $s "a host stays down after the rollback" 'export FAIL_URL=plumberboy FAIL_FROM_SWAP=1'; done

# ---------- set tag
st_state() { new_state; add_new; migrated; on_new api; on_new site; }
CASE="set-tag ok"; st_state; run set-tag-deploy4.sh
ok "exit 0" '[ $RC = 0 ]'; ok "new line" '[ "$(tag_line)" = "IMAGE_TAG=$TAG" ]'; ok "copy keeps the old" 'grep -qx "IMAGE_TAG=$UI" $R/env/compose.env.pre-deploy4'
ok "other lines kept" 'grep -qx OTHER=y $R/env/compose.env && grep -qx V3_BIND_IP=x $R/env/compose.env'; ok "dry run only" 'called "up -d --no-build --dry-run" && [ $(count "^docker compose .* up ") = 1 ]'; ok "env file not printed" '! has "V3_BIND_IP"'
stf() { CASE="set-tag: $1"; st_state; eval "$2"; cp $R/env/compose.env $ST/env.before 2>/dev/null; run set-tag-deploy4.sh; ok "exit 1" '[ $RC = 1 ]'; ok "failed line" 'has "^SET-TAG-FAILED"'; ok "compose.env as before" '[ ! -f $ST/env.before ] || cmp -s $ST/env.before $R/env/compose.env'; ok "no up" '! called "^docker compose .* up "'; }
stf "api still old" 'echo get4domain-v3-api:$OLD > $ST/c/g4d-v3-api/image'
stf "site unhealthy" 'echo unhealthy > $ST/c/g4d-v3-site/health'
stf "UI tag is another image" 'echo sha256:else > $ST/c/g4d-v3-partner/id'
stf "no compose.env" 'rm $R/env/compose.env'
stf "copy exists" ': > $R/env/compose.env.pre-deploy4'
stf "two tag lines" 'echo IMAGE_TAG=z >> $R/env/compose.env'
stf "unexpected old tag" 'sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=z/" $R/env/compose.env'
stf "edit fails" 'export FAIL_SED=1'
stf "edit does nothing" 'export SED_NOOP=1'
stf "edit changes another line" 'export SED_EXTRA=1'
stf "compose cannot read" 'export FAIL_CONFIG=1'
stf "compose misses a name" 'export CONFIG_MISSING=vendor'

# ---------- whole rollback
ro_state() { st_state; cp $R/env/compose.env $R/env/compose.env.pre-deploy4; sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/" $R/env/compose.env; }
CASE="rollback all"; ro_state; run rollback-deploy4.sh
ok "exit 0" '[ $RC = 0 ]'; ok "line" 'has "^ROLLED-BACK"'; ok "api old" '[ $(img api) = get4domain-v3-api:$OLD ]'; ok "site old" '[ $(img site) = get4domain-v3-site:$OLD ]'
ok "env restored" '[ "$(tag_line)" = "IMAGE_TAG=$UI" ]'; ok "site first" '[ "$(grep -E "^docker compose .* up " $ST/calls | head -1 | grep -c " site ")" = 1 ]'
ok "two ups, no UI service" '[ $(count "^docker compose .* up ") = 2 ] && ! called "up .*(vendor|admin|partner)"'; ok "database untouched" '! called "^docker run" && [ $(cat $ST/db/applied) = 135 ]'
CASE="rollback with only api new"; new_state; add_new; migrated; on_new api; run rollback-deploy4.sh
ok "exit 0" '[ $RC = 0 ]'; ok "one up, api" '[ $(count "^docker compose .* up ") = 1 ] && called "no-deps api"'; ok "env untouched" '[ "$(tag_line)" = "IMAGE_TAG=$UI" ]'
CASE="rollback twice"; new_state; run rollback-deploy4.sh; ok "exit 0" '[ $RC = 0 ]'; ok "no up" '! called "^docker compose .* up "'
rof() { CASE="rollback fails: $1"; ro_state; eval "$2"; run rollback-deploy4.sh; ok "exit 1" '[ $RC = 1 ]'; ok "says so" 'has "^ROLLBACK-FAILED"'; ok "env still restored" '[ "$(tag_line)" = "IMAGE_TAG=$UI" ]'; }
rof "api compose" 'export FAIL_COMPOSE=api:$OLD'
rof "site unhealthy" 'export UNHEALTHY=site:$OLD'
rof "wrong id" 'export WRONG_ID=api:$OLD'
rof "no old image" 'grep -v "v3-api:$OLD" $ST/images > $ST/i; cp $ST/i $ST/images'
rof "theme list" 'export THEMES_BAD_OLD=1'
rof "ready" 'export READY_BAD_OLD=1'
rof "manifest" 'export MANIFEST_BAD_OLD=1'
rof "host" 'export FAIL_URL=v3directory FAIL_ALWAYS=1'
rof "noindex" 'export NOINDEX_MISSING=v3app FAIL_ALWAYS=1'

rm -rf $BASE
echo "passed $PASS, failed $FAILN"
[ $FAILN = 0 ]
