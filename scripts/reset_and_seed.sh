#!/usr/bin/env bash
# =============================================================================
# NEXORA AI — Reset and Seed Local Database
# =============================================================================
# Drops and recreates the local Postgres database, applies all migrations in
# order, then runs the seed script. Intended for repeatable local dev onboarding.
#
# Usage:
#   ./scripts/reset_and_seed.sh
#
# Prerequisites:
#   - Docker Compose running (docker compose up -d)
#   - psql available on PATH
# =============================================================================

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
DB_HOST="${NEXORA_DB_HOST:-localhost}"
DB_PORT="${NEXORA_DB_PORT:-5432}"
DB_NAME="${NEXORA_DB_NAME:-nexora}"
DB_USER="${NEXORA_DB_USER:-postgres}"
DB_PASSWORD="${NEXORA_DB_PASSWORD:-postgres}"

export PGPASSWORD="$DB_PASSWORD"

MIGRATIONS_DIR="$(cd "$(dirname "$0")/../database/migrations" && pwd)"
SEEDS_DIR="$(cd "$(dirname "$0")/../database/seeds" && pwd)"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║        NEXORA AI — Database Reset & Seed                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "  Host:     $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User:     $DB_USER"
echo ""

# ─── Drop and Recreate ──────────────────────────────────────────────────────
echo "→ Dropping database '$DB_NAME' (if exists)..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" 2>/dev/null || true

echo "→ Creating database '$DB_NAME'..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres \
  -c "CREATE DATABASE \"$DB_NAME\";"

# ─── Apply Migrations ───────────────────────────────────────────────────────
echo ""
echo "→ Applying migrations..."
for migration in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  echo "  ✓ $(basename "$migration")"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$migration" -v ON_ERROR_STOP=1 --quiet
done

# ─── Apply Seeds ────────────────────────────────────────────────────────────
echo ""
echo "→ Applying seed data..."
for seed in $(ls "$SEEDS_DIR"/*.sql | sort); do
  echo "  ✓ $(basename "$seed")"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$seed" -v ON_ERROR_STOP=1 --quiet
done

# ─── Verification ────────────────────────────────────────────────────────────
echo ""
echo "→ Verification counts:"
for table in projects project_members schedule_versions wbs_nodes activities \
             activity_current_state activity_dependencies documents \
             work_observations match_proposals actual_events approvals \
             audit_events terminology; do
  count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -t -A -c "SELECT count(*) FROM $table;" 2>/dev/null || echo "N/A")
  printf "  %-30s %s\n" "$table" "$count"
done

echo ""
echo "✅ Database reset and seed complete."
