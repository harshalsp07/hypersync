#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# HyperSync Engine — Backup Script
# Usage: ./scripts/backup.sh [backup-dir]
# ═══════════════════════════════════════════════════════════════

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

mkdir -p "$BACKUP_DIR"

echo "═══════════════════════════════════════════════════"
echo "  HyperSync Engine — Database Backup"
echo "═══════════════════════════════════════════════════"

# Source env
source .env.prod

echo ""
echo "▸ Backing up PostgreSQL..."
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$BACKUP_DIR/pg_${TIMESTAMP}.sql.gz"

echo "  ✓ Saved: $BACKUP_DIR/pg_${TIMESTAMP}.sql.gz"

echo ""
echo "▸ Backing up Redis..."
docker compose -f docker-compose.prod.yml exec -T redis \
  redis-cli -a "$REDIS_PASSWORD" BGSAVE >/dev/null 2>&1
sleep 2
docker cp "$(docker compose -f docker-compose.prod.yml ps -q redis):/data/dump.rdb" \
  "$BACKUP_DIR/redis_${TIMESTAMP}.rdb" 2>/dev/null || true

echo "  ✓ Saved: $BACKUP_DIR/redis_${TIMESTAMP}.rdb"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✓ Backup complete: $BACKUP_DIR"
echo "═══════════════════════════════════════════════════"
