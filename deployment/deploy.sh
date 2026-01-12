#!/bin/bash
# Deployment Script for Scalping Bot
# Run this script as the scalpingbot user (not root)

set -e

echo "🚀 Starting deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

APP_DIR="/home/scalpingbot/app"

# Check if we're in the right directory
if [ ! -f "$APP_DIR/package.json" ]; then
    echo -e "${RED}Error: package.json not found. Are you in the app directory?${NC}"
    exit 1
fi

cd "$APP_DIR"

# Pull latest changes
echo -e "${GREEN}Pulling latest changes from git...${NC}"
git pull

# Install/update dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
pnpm install

# Install UI dependencies
echo -e "${GREEN}Installing UI dependencies...${NC}"
cd ui
pnpm install
cd ..

# Install server dependencies
echo -e "${GREEN}Installing server dependencies...${NC}"
cd server
pnpm install
cd ..

# Install Python dependencies
echo -e "${GREEN}Installing Python dependencies...${NC}"
cd trading-engine
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..

# Build frontend
echo -e "${GREEN}Building frontend...${NC}"
cd ui
pnpm build
cd ..

# Run database migrations
echo -e "${GREEN}Running database migrations...${NC}"
cd server
pnpm db:push || echo -e "${YELLOW}Database migration failed or already up to date${NC}"
cd ..

# Trigger trading engine manager to sync processes (if running)
echo -e "${GREEN}Syncing trading engine processes...${NC}"
if pm2 describe trading-engine-manager > /dev/null 2>&1; then
    # Manager will automatically sync on next poll cycle
    echo -e "${YELLOW}Trading engine manager will sync processes automatically${NC}"
else
    echo -e "${YELLOW}Note: Trading engine manager is not running. Start it with: pm2 start ecosystem.config.js${NC}"
fi

# Restart PM2 services (base services, not trading engines - they're managed dynamically)
echo -e "${GREEN}Restarting base PM2 services...${NC}"
pm2 restart backend || true
pm2 restart mt5-api || true
pm2 restart trading-engine-manager || true

# Wait a moment for services to start
sleep 3

# Verify all base services are healthy
echo -e "${GREEN}Verifying services health...${NC}"
BACKEND_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="backend") | .pm2_env.status' 2>/dev/null || echo "unknown")
MT5_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="mt5-api") | .pm2_env.status' 2>/dev/null || echo "unknown")
MANAGER_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="trading-engine-manager") | .pm2_env.status' 2>/dev/null || echo "unknown")

if [ "$BACKEND_STATUS" = "online" ]; then
    echo -e "${GREEN}  ✓ Backend: $BACKEND_STATUS${NC}"
else
    echo -e "${RED}  ✗ Backend: $BACKEND_STATUS${NC}"
fi

if [ "$MT5_STATUS" = "online" ]; then
    echo -e "${GREEN}  ✓ MT5 API: $MT5_STATUS${NC}"
else
    echo -e "${RED}  ✗ MT5 API: $MT5_STATUS${NC}"
fi

if [ "$MANAGER_STATUS" = "online" ]; then
    echo -e "${GREEN}  ✓ Trading Engine Manager: $MANAGER_STATUS${NC}"
else
    echo -e "${RED}  ✗ Trading Engine Manager: $MANAGER_STATUS${NC}"
fi

# Show status
echo ""
echo -e "${GREEN}Deployment complete!${NC}"
echo ""
pm2 status
echo ""
echo -e "${YELLOW}Note: Trading engine instances are managed dynamically by trading-engine-manager${NC}"
echo -e "${YELLOW}They will be automatically started/stopped based on active users in the database${NC}"

