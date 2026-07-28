#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# HyperSync Engine — VPS Backend Deployment
# Usage: ./scripts/deploy.sh <your-vercel-domain>
# Example: ./scripts/deploy.sh hypersync.vercel.app
# ═══════════════════════════════════════════════════════════════

FRONTEND_DOMAIN="${1:?Usage: $0 <vercel-domain> (e.g. hypersync.vercel.app)}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "═══════════════════════════════════════════════════"
echo "  HyperSync Engine — Backend Deploy"
echo "  Frontend: https://$FRONTEND_DOMAIN"
echo "═══════════════════════════════════════════════════"

cd "$ROOT_DIR"

# ── Generate secrets if .env.prod doesn't exist ──
if [ ! -f .env.prod ]; then
  echo ""
  echo "▸ Generating production secrets..."
  REDIS_PASS=$(openssl rand -hex 16)
  PG_PASS=$(openssl rand -hex 16)
  JWT_SECRET=$(openssl rand -hex 32)

  cat > .env.prod <<EOF
REDIS_PASSWORD=$REDIS_PASS
PG_USER=hypersync
PG_PASSWORD=$PG_PASS
PG_DB=hypersync
JWT_SECRET=$JWT_SECRET
CORS_ORIGIN=https://$FRONTEND_DOMAIN
PORT=3000
EOF

  echo "  ✓ Created .env.prod with generated secrets"
else
  echo "▸ Using existing .env.prod"
  # Update CORS_ORIGIN if domain changed
  if grep -q "CORS_ORIGIN" .env.prod; then
    sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=https://$FRONTEND_DOMAIN|" .env.prod
  else
    echo "CORS_ORIGIN=https://$FRONTEND_DOMAIN" >> .env.prod
  fi
fi

# ── Build and start services ──
echo ""
echo "▸ Building and starting backend services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo ""
echo "▸ Waiting for services to be healthy..."
sleep 5

# ── Check health ──
echo ""
echo "▸ Checking server health..."
if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
  echo "  ✓ Server is healthy"
else
  echo "  ⚠ Server may still be starting up..."
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✓ Backend deployed!"
echo ""
echo "  Backend:  http://$(hostname -I | awk '{print $1}'):3000"
echo "  Frontend: https://$FRONTEND_DOMAIN"
echo ""
echo "  Next steps:"
echo "  1. Go to https://vercel.com"
echo "  2. Import your GitHub repo"
echo "  3. Set env vars in Vercel:"
echo "     VITE_WS_URL=wss://your-vps-ip:3000"
echo "     VITE_API_URL=https://your-vps-ip:3000"
echo "  4. Deploy!"
echo ""
echo "  Commands:"
echo "    Logs:    docker compose -f docker-compose.prod.yml logs -f"
echo "    Restart: docker compose -f docker-compose.prod.yml restart"
echo "    Stop:    docker compose -f docker-compose.prod.yml down"
echo "═══════════════════════════════════════════════════"
