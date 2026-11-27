#!/bin/sh
# Deploy 4 step 3. Builds the ops and api images from the release commit and gives the unchanged site, vendor, admin and partner images the new tag.
# Nothing running changes. Every step prints its exit code; the first failure stops the script.
. "$(dirname "$0")/common-deploy4.sh"
S=$R/src/backend
stop() { echo "BUILD-FAILED at: $1"; exit 1; }
step() { label="$1"; shift; a=$(date +%s); "$@" </dev/null >/dev/null; rc=$?; echo "$label exit=$rc ($(( $(date +%s)-a )) s)"; [ $rc = 0 ] || stop "$label"; }
free=$(df -Pk $R | awk 'NR==2{print $4}'); [ "$free" -ge 10485760 ] 2>/dev/null || stop "less than 10 GiB free"
for s in api site; do [ "$(cfg $s)" != "get4domain-v3-$s:$TAG" ] || stop "$s already runs $TAG; building now would replace its image"; done
[ -z "$(git -C $S status --porcelain)" ] || stop "the source clone has changes"
step fetch git -C $S fetch origin
step checkout git -C $S checkout --detach $SHA
[ "$(git -C $S rev-parse HEAD)" = "$SHA" ] || stop "the clone is not at $SHA"
[ -z "$(git -C $S status --porcelain)" ] || stop "the source clone has changes after checkout"
# the site image is reused, so its source, its recipe and the compose file must be what the running containers came from
step site-unchanged git -C $S diff --quiet $BASE $SHA -- get4domain_mvp deploy/v3live/site deploy/v3live/docker-compose.apps.yml
cd $S || stop "cd source"
step ops docker build -q -f deploy/v3live/api/Dockerfile --target ops -t get4domain-v3-ops:$TAG .
step api docker build -q -f deploy/v3live/api/Dockerfile --target runner -t get4domain-v3-api:$TAG .
step check-live-env docker run --rm --network v3net --env-file $R/env/api.env get4domain-v3-ops:$TAG node scripts/live/check-live-env.js
retag() { _id=$(runid $1); [ -n "$_id" ] || stop "cannot read the running $1 image"; [ "$_id" = "$(imgid get4domain-v3-$1:$2)" ] || stop "$1:$2 is not the running image"
  step tag-$1 docker tag get4domain-v3-$1:$2 get4domain-v3-$1:$TAG; [ "$(imgid get4domain-v3-$1:$TAG)" = "$_id" ] || stop "tag-$1 points at another image"; }
retag site $OLD
for s in vendor admin partner; do retag $s $UI; done
for n in ops api site vendor admin partner; do [ -n "$(imgid get4domain-v3-$n:$TAG)" ] || stop "missing image $n"; done
echo BUILD-ALL-OK
