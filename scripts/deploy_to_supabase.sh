#!/usr/bin/env bash
# =============================================================================
# NEXORA AI — Deploy to Supabase Cloud
# =============================================================================
# Pushes local migrations to the linked Supabase Cloud project.
#
# Usage:
#   ./scripts/deploy_to_supabase.sh
# =============================================================================

set -euo pipefail

echo "Deploying local migrations to Supabase..."

# Ensure supabase CLI is available
if ! command -v npx &> /dev/null; then
    echo "Error: npm/npx is not installed."
    exit 1
fi

npx supabase db push

echo "✅ Migrations deployed to Supabase."
