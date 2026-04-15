#!/bin/bash
# Safe Docker Compose wrapper — prevents accidental volume deletion
# Use this instead of `docker compose` directly.

set -e

SAFE_CMD="$*"

# Block any invocation that contains `down -v` or `down --volumes`
if echo "$SAFE_CMD" | grep -qE 'down\s+.*(-v\b|--volumes)'; then
  echo ""
  echo "  BLOCKED: 'docker compose down -v' / '--volumes' is not allowed."
  echo "  This command would permanently delete the SQLite database and uploads."
  echo ""
  echo "  Safe alternatives:"
  echo "    Restart containers:  docker compose restart"
  echo "    Stop only:           docker compose stop"
  echo "    Remove containers:   docker compose down   (volumes are kept)"
  echo "    Backup DB first:     ./backup-db.sh        (then use down -v if truly needed)"
  echo ""
  exit 1
fi

docker compose $SAFE_CMD
