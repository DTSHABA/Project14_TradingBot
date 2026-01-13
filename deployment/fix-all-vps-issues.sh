#!/bin/bash
# Master script to fix all VPS deployment issues
# Run this on your VPS after pulling the latest code

set -e

echo "🚀 Starting VPS fixes..."
cd /home/scalpingbot/app

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Rename trading-engine-manager.js to .cjs
echo -e "${YELLOW}Step 1: Fixing trading-engine-manager...${NC}"
if [ -f "deployment/trading-engine-manager.js" ]; then
    mv deployment/trading-engine-manager.js deployment/trading-engine-manager.cjs
    echo -e "${GREEN}✓ Renamed trading-engine-manager.js to .cjs${NC}"
elif [ -f "deployment/trading-engine-manager.cjs" ]; then
    echo -e "${GREEN}✓ trading-engine-manager.cjs already exists${NC}"
else
    echo -e "${RED}✗ trading-engine-manager file not found!${NC}"
    find /home/scalpingbot/app -name "*trading-engine-manager*" -type f
    exit 1
fi

# Step 2: Update ecosystem.config.cjs if needed
echo -e "${YELLOW}Step 2: Updating ecosystem.config.cjs...${NC}"
if [ -f "ecosystem.config.cjs" ]; then
    sed -i 's|deployment/trading-engine-manager.js|deployment/trading-engine-manager.cjs|' ecosystem.config.cjs
    echo -e "${GREEN}✓ Updated ecosystem.config.cjs${NC}"
else
    echo -e "${RED}✗ ecosystem.config.cjs not found!${NC}"
    exit 1
fi

# Step 3: Fix DATABASE_URL port (5702 -> 5432)
echo -e "${YELLOW}Step 3: Fixing DATABASE_URL port...${NC}"
if [ -f "server/.env" ]; then
    if grep -q ":5702/" server/.env; then
        sed -i 's|:5702/|:5432/|' server/.env
        echo -e "${GREEN}✓ Fixed DATABASE_URL port from 5702 to 5432${NC}"
    else
        echo -e "${GREEN}✓ DATABASE_URL port is already correct${NC}"
    fi
else
    echo -e "${RED}✗ server/.env not found!${NC}"
fi

# Step 4: Clean up PM2 processes
echo -e "${YELLOW}Step 4: Cleaning up PM2 processes...${NC}"
pm2 delete mt5-api 2>/dev/null || echo "  (mt5-api already deleted)"
pm2 delete trading-engine-manager 2>/dev/null || echo "  (trading-engine-manager already deleted)"
echo -e "${GREEN}✓ PM2 processes cleaned${NC}"

# Step 5: Restart PM2 with updated config
echo -e "${YELLOW}Step 5: Restarting PM2 services...${NC}"
pm2 start ecosystem.config.cjs
pm2 save
echo -e "${GREEN}✓ PM2 services restarted${NC}"

# Step 6: Test database connection
echo -e "${YELLOW}Step 6: Testing database connection...${NC}"
if [ -f "server/.env" ]; then
    DB_URL=$(grep "^DATABASE_URL=" server/.env | cut -d '=' -f2-)
    if psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database connection successful!${NC}"
    else
        echo -e "${RED}✗ Database connection failed${NC}"
        echo "  Please check:"
        echo "  1. PostgreSQL is running: sudo systemctl status postgresql"
        echo "  2. Database credentials in server/.env are correct"
    fi
fi

# Step 7: Check PM2 status
echo -e "${YELLOW}Step 7: PM2 Status:${NC}"
pm2 status

# Step 8: Test backend health
echo -e "${YELLOW}Step 8: Testing backend health...${NC}"
sleep 2
HEALTH=$(curl -s http://localhost:5500/api/v1/health || echo "failed")
if [ "$HEALTH" != "failed" ]; then
    echo -e "${GREEN}✓ Backend is responding${NC}"
    echo "$HEALTH" | head -c 200
    echo "..."
else
    echo -e "${RED}✗ Backend is not responding${NC}"
fi

echo ""
echo -e "${GREEN}✅ All fixes completed!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Run database migrations: cd server && pnpm db:push"
echo "  2. Check PM2 logs: pm2 logs"
echo "  3. Test frontend: curl http://localhost/"
echo "  4. Setup SSL: sudo certbot --nginx -d aibotrades.com"

