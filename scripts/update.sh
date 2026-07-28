#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# HyperSync Engine — Update Backend
# Usage: ./scripts/update.sh
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "═══════════════════════════════════════════════════"
echo "  HyperSync Engine — Updating Backend..."
echo "═══════════════════════════════════════════════════"

cd "$ROOT_DIR"

echo ""
echo "▸ Pulling latest code..."
git pull origin main

echo ""
echo "▸ Rebuilding and restarting..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✓ Backend updated!"
echo "═══════════════════════════════════════════════════"
