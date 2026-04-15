#!/bin/bash
# Backup SQLite database and uploads from Docker volumes.
# Run this before any destructive operations.

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$TIMESTAMP"

mkdir -p "$BACKUP_DIR"

echo "Backing up SQLite database..."
docker run --rm \
  -v contractpro_sqlite:/data \
  -v "$(pwd)/backups/$TIMESTAMP":/backup \
  alpine sh -c "cp -r /data/. /backup/sqlite/"

echo "Backing up uploads..."
docker run --rm \
  -v contractpro_uploads:/data \
  -v "$(pwd)/backups/$TIMESTAMP":/backup \
  alpine sh -c "cp -r /data/. /backup/uploads/"

echo ""
echo "Backup saved to: $BACKUP_DIR"
echo "  sqlite/  — database files"
echo "  uploads/ — uploaded files"
