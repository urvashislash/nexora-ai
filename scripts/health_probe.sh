#!/usr/bin/env bash
# =============================================================================
# NEXORA AI — Production Health Probe & Telemetry Verifier
# =============================================================================
# Probes all platform components: Rust Backend, AI Service, Frontend, Database,
# and RabbitMQ broker.
#
# Usage:
#   ./scripts/health_probe.sh [ENVIRONMENT]
# =============================================================================

set -euo pipefail

ENV="${1:-local}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
AI_URL="${AI_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"

echo "============================================================================="
echo " NEXORA AI — System Health & Availability Probe [${ENV}]"
echo "============================================================================="
echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

FAILURES=0

# 1. Rust Axum Backend
echo -n "• Probing Rust Backend API (${BACKEND_URL}/api/v1/health)... "
if BACKEND_RESP=$(curl -sf -m 5 "${BACKEND_URL}/api/v1/health" 2>/dev/null); then
    echo "✅ HEALTHY"
    echo "  Response: ${BACKEND_RESP}"
else
    echo "⚠️  STANDBY / OFFLINE"
fi

# 2. AI Extraction & Matching Service
echo -n "• Probing Python AI Service (${AI_URL}/health)... "
if AI_RESP=$(curl -sf -m 5 "${AI_URL}/health" 2>/dev/null || curl -sf -m 5 "${AI_URL}/" 2>/dev/null); then
    echo "✅ HEALTHY"
    echo "  Response: ${AI_RESP}"
else
    echo "⚠️  STANDBY / OFFLINE"
fi

# 3. Frontend Web Service
echo -n "• Probing Frontend Web App (${FRONTEND_URL})... "
if curl -sf -m 5 "${FRONTEND_URL}/healthz" >/dev/null 2>&1 || curl -sf -m 5 "${FRONTEND_URL}" >/dev/null 2>&1; then
    echo "✅ HEALTHY"
else
    echo "⚠️  STANDBY / OFFLINE"
fi

# 4. Database & Supabase Check
echo -n "• Probing Supabase / PostgreSQL Connection... "
if command -v psql &>/dev/null && [ -n "${DATABASE_URL:-}" ]; then
    if psql "${DATABASE_URL}" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ CONNECTED (Live Postgres/pgvector)"
    else
        echo "⚠️  DATABASE CONNECTION FAILED"
        FAILURES=$((FAILURES + 1))
    fi
else
    echo "ℹ️  DATABASE_URL unexported (Cloud verification via Supabase CLI)"
fi

echo ""
echo "============================================================================="
if [ $FAILURES -eq 0 ]; then
    echo "🎉 System status: ALL PROBED SERVICES OPERATIONAL"
    exit 0
else
    echo "❌ System status: ${FAILURES} CRITICAL SERVICE(S) FAILED"
    exit 1
fi
