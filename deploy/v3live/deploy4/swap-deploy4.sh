#!/bin/sh
# Deploy 4 step 5. usage: sh swap-deploy4.sh api|site     (api first, then site)
# Starts ONE service on the Deploy 4 image, checks it, and puts that service back by itself if a check fails. The database is never changed.
# exit 0 passed; 1 failed and rolled back; 2 failed AND rollback not confirmed; 9 nothing changed
. "$(dirname "$0")/common-deploy4.sh"
s="$1"
case "$s" in api|site) ;; *) echo "only api or site; nothing changed"; exit 9 ;; esac
no() { echo "SWAP-NOT-STARTED $s: $1; nothing changed"; exit 9; }
newid=$(imgid get4domain-v3-$s:$TAG); [ -n "$newid" ] || no "no new image"
oldid=$(imgid get4domain-v3-$s:$OLD); [ -n "$oldid" ] || no "no rollback image"
[ "$(cfg $s)" = "get4domain-v3-$s:$OLD" ] || no "it is not running $OLD"
[ "$(runid $s)" = "$oldid" ] || no "the running image is not the rollback image"
mig_done || no "the migration is not applied"
if [ $s = site ]; then [ "$(cfg api)" = "get4domain-v3-api:$TAG" ] && [ "$(health api)" = healthy ] || no "swap api first"; fi
apiready || no "the API is not ready"
hosts_ok || no "a public address fails before the swap"
others() { for o in api site vendor admin partner; do [ $o = $s ] || docker inspect -f '{{.Name}} {{.Id}} {{.State.StartedAt}}' g4d-v3-$o || return 1; done; docker inspect -f '{{.Name}} {{.Id}} {{.State.StartedAt}}' $DBC; }
before=$(others) && [ -n "$before" ] || no "cannot read the other containers"
back() {
  echo "CHECK-FAILED $s: $1"; echo "--- last log lines of the failed container"; docker logs --tail 25 g4d-v3-$s 2>&1 | mask
  echo "rolling back $s to $OLD"
  IMAGE_TAG=$OLD $C up -d --no-build --no-deps $s </dev/null || { echo "ROLLBACK-FAILED $s (compose)"; exit 2; }
  healthy $s || { echo "ROLLBACK-FAILED $s (not healthy)"; exit 2; }
  [ "$(cfg $s)" = "get4domain-v3-$s:$OLD" ] && [ "$(runid $s)" = "$oldid" ] || { echo "ROLLBACK-FAILED $s (image)"; exit 2; }
  if [ $s = api ]; then apiready && themes_ok || { echo "ROLLBACK-UNCONFIRMED $s (ready or theme list)"; exit 2; }
  else manifest_ok || { echo "ROLLBACK-UNCONFIRMED $s (manifest)"; exit 2; }; fi
  hosts_ok || { echo "ROLLBACK-UNCONFIRMED $s (public addresses)"; exit 2; }
  echo "ROLLED-BACK $s, healthy on $OLD"; exit 1; }
trap 'trap "" INT TERM HUP; back "interrupted"' INT TERM HUP
echo "== swap $s -> $TAG $(date -u +%T)"
IMAGE_TAG=$TAG $C up -d --no-build --no-deps $s </dev/null || back "compose up"
healthy $s || back "not healthy within 240 s"
[ "$(cfg $s)" = "get4domain-v3-$s:$TAG" ] || back "wrong image name running"
[ "$(runid $s)" = "$newid" ] || back "wrong image id running"
echo "  ok healthy on the new image"
if [ $s = api ]; then
  apiready || back "/health/ready"; echo "  ok /health/ready, database up"
  themes_ok || back "public theme list"; echo "  ok public theme list"
  c=$(code http://$IP:3008/v3/admin/telecaller/vendors); [ "$c" = 401 ] || back "new staff route answered $c, expected 401"
  c=$(code -X DELETE http://$IP:3008/v3/admin/theme-market/themes/deploy4-check-0000); [ "$c" = 401 ] || back "delete route without a token answered $c, expected 401"
  c=$(code http://$IP:3008/v3/public/site/hosts); [ "$c" = 200 ] || back "public host list answered $c, expected 200"
  echo "  ok new routes: 401, 401, 200"
  logs=$(docker logs g4d-v3-api 2>&1) || back "cannot read the API log"
  echo "$logs" | grep -q 'marketplace themes could not be read' && back "the API could not read the themes at start"
  echo "  info API log error lines: $(echo "$logs" | sed -E 's/\x1b\[[0-9;]*m//g' | grep -c -E '\[Nest\].* ERROR ')"
else
  manifest_ok || back "manifest"; echo "  ok manifest"
fi
hosts_ok || back "a public address (health or noindex)"
[ "$(restarts $s)" = 0 ] || back "container restarted"
echo "  ok restarts 0"
apiready || back "API not ready after swapping $s"
[ "$(others)" = "$before" ] || back "another container changed during this swap"
echo "  ok API ready; other containers untouched"
echo "PASSED $s $(date -u +%T)"
