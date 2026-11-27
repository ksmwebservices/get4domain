#!/bin/sh
# Deploy 4 step 2. Runs the nightly backup job on demand, then proves the new file decrypts and holds a complete dump. No data and no passphrase is printed.
# (backup.sh also deletes backups older than 14 days, as it does every night.)
# exit 0 and a record in deploy4-backup.txt, which the migration step requires; 1 no usable backup
. "$(dirname "$0")/common-deploy4.sh"
stop() { echo "BACKUP-FAILED: $1"; exit 1; }
rm -f $R/deploy4-backup.txt || stop "cannot clear the old record"
out=$(bash $R/backup.sh </dev/null 2>&1) || { echo "$out" | mask; stop "backup.sh failed"; }
f=$(echo "$out" | sed -n 's/^.* backup ok //p' | tail -1)
[ -n "$f" ] && [ -s "$f" ] || stop "backup.sh named no file"
size=$(wc -c < "$f" | tr -d ' ')
[ "$size" -ge 100000 ] || stop "the file is only $size bytes"
open() { openssl enc -d -aes-256-cbc -pbkdf2 -pass file:$R/secrets/backup_pass -in "$f" | gunzip; }
open | tail -n 20 | grep -q 'PostgreSQL database dump complete' || stop "the file does not decrypt to a complete dump"
n=$(open | grep -c -E '^COPY public\.(g4d_theme_market_packages|_prisma_migrations) ')
[ "$n" = 2 ] || stop "the theme table and the migration table are not both in the dump"
echo "$(date +%s) $f" > $R/deploy4-backup.txt || stop "cannot write the record"
echo "BACKUP-OK $f ($size bytes), decrypts, dump complete"
