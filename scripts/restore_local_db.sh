#!/usr/bin/env bash
# =============================================================================
# NEXORA AI — Local Database Restore Script
# =============================================================================
# Restores a custom-format pg_dump created by backup_local_db.sh.
#
# Usage:
#   ./scripts/restore_local_db.sh path/to/backup.dump
# =============================================================================

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Error: Path to backup file required."
  echo "Usage: $0 path/to/backup.dump"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file '$BACKUP_FILE' does not exist."
  exit 1
fi

DB_HOST="${NEXORA_DB_HOST:-localhost}"
DB_PORT="${NEXORA_DB_PORT:-5432}"
DB_NAME="${NEXORA_DB_NAME:-nexora}"
DB_USER="${NEXORA_DB_USER:-postgres}"
DB_PASSWORD="${NEXORA_DB_PASSWORD:-postgres}"

export PGPASSWORD="$DB_PASSWORD"

echo "Restoring $BACKUP_FILE into $DB_NAME on $DB_HOST:$DB_PORT..."
pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --clean --if-exists -v "$BACKUP_FILE"

echo "✅ Database restored successfully from: $BACKUP_FILE"
