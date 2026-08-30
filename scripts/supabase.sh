#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cmd="${1:-status}"

case "$cmd" in
  start)
    echo "Starting local Supabase..."
    supabase start
    ;;
  stop)
    echo "Stopping local Supabase..."
    supabase stop
    ;;
  status)
    echo "Checking local Supabase status..."
    supabase status
    ;;
  reset)
    echo "Resetting local Supabase database and applying migrations..."
    supabase db reset
    ;;
  migrate)
    echo "Applying Supabase migrations..."
    supabase db push
    ;;
  *)
    echo "Usage: $0 {start|stop|status|reset|migrate}"
    exit 1
    ;;
esac
