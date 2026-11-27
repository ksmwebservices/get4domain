#!/bin/sh
# Deploy 4 step 6, only after BOTH swaps passed. Changes only the IMAGE_TAG line of compose.env. Prints counts and image names, never the file.
# After it, a plain "up -d" would recreate vendor, admin and partner (same images, new tag name) and leave api and site alone.
. "$(dirname "$0")/common-deploy4.sh"
stop() { echo "SET-TAG-FAILED: $1"; exit 1; }
for s in api site; do [ "$(cfg $s)" = "get4domain-v3-$s:$TAG" ] && [ "$(health $s)" = healthy ] || stop "$s is not healthy on $TAG, nothing changed"; done
for s in vendor admin partner; do id=$(runid $s); [ -n "$id" ] && [ "$(imgid get4domain-v3-$s:$TAG)" = "$id" ] || stop "$s:$TAG is not the running $s image, nothing changed"; done
[ -f $E ] || stop "no compose.env"
[ -e $E.pre-deploy4 ] && stop "compose.env.pre-deploy4 already exists, nothing changed"
[ "$(grep -c '^IMAGE_TAG=' $E)" = 1 ] || stop "expected exactly one IMAGE_TAG line, nothing changed"
[ "$(grep -c "^IMAGE_TAG=$UI\$" $E)" = 1 ] || stop "compose.env does not name $UI, nothing changed"
cp -p $E $E.pre-deploy4 || stop "cannot copy, nothing changed"
before=$(stat -c '%a %u %g' $E); lines=$(wc -l < $E)
restore() { cp -p $E.pre-deploy4 $E || stop "$1 AND the copy could not be restored: restore compose.env.pre-deploy4 by hand"; stop "$1 (copy restored)"; }
sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=$TAG|" $E || restore "edit failed"
[ "$(grep -c "^IMAGE_TAG=$TAG\$" $E)" = 1 ] || restore "new line not found"
[ "$(diff $E.pre-deploy4 $E | grep -c '^>')" = 1 ] || restore "not exactly one line changed"
[ "$(diff $E.pre-deploy4 $E | grep -c '^> IMAGE_TAG=')" = 1 ] || restore "a different line changed"
[ "$(wc -l < $E)" = "$lines" ] || restore "line count changed"
[ "$(stat -c '%a %u %g' $E)" = "$before" ] || restore "permissions changed"
names=$($C config --images </dev/null) || restore "compose cannot read the file"
for s in api site vendor admin partner; do echo "$names" | grep -qx "get4domain-v3-$s:$TAG" || restore "compose does not name $s:$TAG"; done
echo "SET-TAG-OK: one line changed, mode and owner $before kept, copy at compose.env.pre-deploy4"
echo "--- dry run of a plain up -d (changes nothing)"
$C up -d --no-build --dry-run </dev/null 2>&1
