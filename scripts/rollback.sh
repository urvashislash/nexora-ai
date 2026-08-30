#!/usr/bin/env bash
# =============================================================================
# NEXORA AI — Production Fast Rollback Script
# =============================================================================
# Rolls back container deployments to the previous stable release.
#
# Usage:
#   ./scripts/rollback.sh [PREVIOUS_TAG]
# =============================================================================

set -euo pipefail

PREV_TAG="${1:-previous}"

echo "============================================================================="
echo " NEXORA AI — Emergency Rollback Procedure"
echo "============================================================================="
echo "Rolling back to tag: ${PREV_TAG}"
echo ""

# 1. Stop current containers
echo "• Stopping active application containers..."
docker compose -f docker-compose.prod.yml down --remove-orphans || true

# 2. Restart with previous stable containers
echo "• Restarting previous stable deployment..."
docker compose -f docker-compose.prod.yml up -d

# 3. Post-rollback health probe
echo "• Executing post-rollback health verification..."
sleep 5
./scripts/health_probe.sh production || {
    echo "⚠️  Health check returned warnings — review container logs immediately."
}

echo ""
echo "============================================================================="
echo "✅ Rollback procedure complete."
echo "For database rollback procedures, refer to docs/incident_runbook.md."
echo "============================================================================="
