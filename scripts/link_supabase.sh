#!/usr/bin/env bash
# =============================================================================
# NEXORA AI — Supabase Cloud Link Script
# =============================================================================
# Helps link the local repository to a remote Supabase Cloud project.
#
# Usage:
#   ./scripts/link_supabase.sh <project-ref> [environment]
# =============================================================================

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Error: Supabase Project Ref is required."
  echo "Usage: $0 <project-ref> [environment (default: staging)]"
  echo "You can find your Project Ref in your Supabase Dashboard Settings."
  exit 1
fi

PROJECT_REF="$1"
ENV="${2:-staging}"

echo "Linking local repository to Supabase project '$PROJECT_REF' ($ENV)..."

# Ensure supabase CLI is available
if ! command -v npx &> /dev/null; then
    echo "Error: npm/npx is not installed."
    exit 1
fi

# Link project
npx supabase link --project-ref "$PROJECT_REF"

echo "✅ Supabase project linked successfully."
echo ""
echo "Next steps:"
echo "1. Pull any existing remote migrations: npx supabase db pull"
echo "2. Push local migrations: ./scripts/deploy_to_supabase.sh"
echo "3. Fetch remote env vars to frontend: npx supabase secrets pull --project-ref $PROJECT_REF -f frontend/.env.$ENV"
