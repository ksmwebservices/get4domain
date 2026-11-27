#!/bin/sh
# Deploy 4, whole rollback: puts site and then api back on the images that ran before, and restores compose.env if this deploy changed it.
# The database is NOT touched (the old API works with the two new columns). vendor, admin and partner are not touched.
# exit 0 rolled back; 1 something is not confirmed
. "$(dirname "$0")/common-deploy4.sh"
bad=""
for s in site api; do
  oldid=$(imgid get4domain-v3-$s:$OLD)
  if [ -z "$oldid" ]; then bad="$bad $s(no-old-image)"; continue; fi
  if [ "$(cfg $s)" = "get4domain-v3-$s:$OLD" ] && [ "$(runid $s)" = "$oldid" ] && [ "$(health $s)" = healthy ]; then echo "$s already runs $OLD"; continue; fi
  IMAGE_TAG=$OLD $C up -d --no-build --no-deps $s </dev/null || { bad="$bad $s(compose)"; continue; }
  healthy $s || bad="$bad $s(not-healthy)"
  [ "$(cfg $s)" = "get4domain-v3-$s:$OLD" ] && [ "$(runid $s)" = "$oldid" ] || bad="$bad $s(image)"
done
if [ -f $E.pre-deploy4 ]; then if cp -p $E.pre-deploy4 $E; then echo "compose.env restored"; else bad="$bad compose.env"; fi; fi
apiready || bad="$bad api-ready"
themes_ok || bad="$bad theme-list"
manifest_ok || bad="$bad manifest"
hosts_ok || bad="$bad public-addresses"
docker ps --format '{{.Names}} {{.Image}} {{.Status}}' | grep g4d-v3
[ -z "$bad" ] || { echo "ROLLBACK-FAILED or unconfirmed:$bad"; exit 1; }
echo ROLLED-BACK
