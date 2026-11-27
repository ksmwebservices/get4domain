# Deploy 4: settings and checks shared by the Deploy 4 scripts. Sourced, never run. No value here is a secret and no env file is printed.
R=${G4D_ROOT:-/opt/v3live}
SHA=1401165cac9bd3da6322ef1c0ff79f3822945fe6
TAG=20261127-1401165c
OLD=20261126-d584d6fc          # what api and site run before this deploy
UI=20261127-d0e0b62            # what vendor, admin and partner run, and what compose.env names before this deploy
BASE=d584d6fca1c42a7642630889fffccda18d6507a7   # the source of the running api and site
MIG=20270112100000_v3_theme_delete
BEFORE=134
AFTER=135
IP=10.77.0.50
DBC=postgres-v3db-1
W=$R/src/backend/deploy/v3live
E=$R/env/compose.env
C="docker compose -f $W/docker-compose.apps.yml --env-file $E"
HOSTS="https://v3api.get4domain.com/health https://v3api.get4domain.com/health/ready https://v3app.get4domain.com/ https://v3admin.get4domain.com/ https://v3partner.get4domain.com/ https://v3site.get4domain.com/ https://v3directory.get4domain.com/ https://plumberboy.get4domain.com/"

# one read-only query; the session cannot write
sql() { docker exec -e PGOPTIONS='-c default_transaction_read_only=on' $DBC psql -U g4d_live -d get4domain_v3 -At -v ON_ERROR_STOP=1 -c "$1" </dev/null; }
applied() { sql "select count(*) from _prisma_migrations where finished_at is not null and rolled_back_at is null"; }
unfinished() { sql "select count(*) from _prisma_migrations where finished_at is null and rolled_back_at is null"; }
mig_done() { [ "$(sql "select count(*) from _prisma_migrations where migration_name='$MIG' and finished_at is not null and rolled_back_at is null")" = 1 ]; }
theme_rows() { sql "select count(*) from g4d_theme_market_packages"; }

cfg() { docker inspect -f '{{.Config.Image}}' g4d-v3-$1 2>/dev/null; }
runid() { docker inspect -f '{{.Image}}' g4d-v3-$1 2>/dev/null; }
health() { docker inspect -f '{{.State.Health.Status}}' g4d-v3-$1 2>/dev/null; }
restarts() { docker inspect -f '{{.RestartCount}}' g4d-v3-$1 2>/dev/null; }
imgid() { docker image inspect -f '{{.Id}}' "$1" 2>/dev/null; }
healthy() { _i=0; while [ $_i -lt 48 ]; do [ "$(health $1)" = healthy ] && return 0; _i=$((_i+1)); sleep 5; done; return 1; }

# 200 AND the noindex header, three tries
pub() { _n=0; while [ $_n -lt 3 ]; do _h=$(curl -s -D - -o /dev/null -m 25 -w 'CODE=%{http_code}' "$1" | tr -d '\r'); if echo "$_h" | grep -q 'CODE=200' && echo "$_h" | grep -qi '^x-robots-tag:.*noindex'; then echo "  ok 200+noindex $1"; return 0; fi; _n=$((_n+1)); sleep 7; done; echo "  FAILED $1 ($(echo "$_h" | grep -o 'CODE=[0-9]*'), noindex headers: $(echo "$_h" | grep -ci '^x-robots-tag:.*noindex'))"; return 1; }
hosts_ok() { for _u in $HOSTS; do pub $_u || return 1; done; }
code() { curl -s -o /dev/null -m 20 -w '%{http_code}' "$@"; }
apiready() { _r=$(curl -fsS -m 20 http://$IP:3008/health/ready) || return 1; echo "$_r" | grep -q '"status":"ready"' && echo "$_r" | grep -q '"database":"up"'; }
# the public theme list reads the theme table, so it fails when the code and the table disagree
themes_ok() { _r=$(curl -fsS -m 20 http://$IP:3008/v3/public/theme-market/themes) || return 1; echo "$_r" | grep -q '"success":true'; }
manifest_ok() { _c=$(code http://$IP:3006/manifest.webmanifest); [ "$_c" -ge 200 ] 2>/dev/null && [ "$_c" -lt 500 ]; }
mask() { sed -E 's#(postgres(ql)?://)[^ ]+#\1***#g; s#[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}#***#g; s#[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+#***@***#g' | cut -c1-220; }
