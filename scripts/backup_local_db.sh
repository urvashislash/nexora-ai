#!/usr/bin/env bash
# =============================================================================
# NEXORA AI — Local Database Backup Script
# =============================================================================
# Takes a timestamped custom-format pg_dump of the local database.
#
# Usage:
#   ./scripts/backup_local_db.sh
# =============================================================================

set -euo pipefail

DB_HOST="${NEXORA_DB_HOST:-localhost}"
DB_PORT="${NEXORA_DB_PORT:-5432}"
DB_NAME="${NEXORA_DB_NAME:-nexora}"
DB_USER="${NEXORA_DB_USER:-postgres}"
DB_PASSWORD="${NEXORA_DB_PASSWORD:-postgres}"

export PGPASSWORD="$DB_PASSWORD"

BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_${TIMESTAMP}.dump"

echo "Creating backup for $DB_NAME..."
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -F c -b -v -f "$BACKUP_FILE" "$DB_NAME"

echo "✅ Backup successfully created at: $BACKUP_FILE"
