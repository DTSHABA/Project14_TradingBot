#!/bin/bash
# COMPLETE FIX - Run this on VPS to fix all issues
# Usage: bash deployment/COMPLETE_FIX.sh <ngrok-url>
# Example: bash deployment/COMPLETE_FIX.sh https://christoper-gyroscopic-ludie.ngrok-free.dev

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

NGROK_URL="${1:-https://christoper-gyroscopic-ludie.ngrok-free.dev}"

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  COMPLETE FIX FOR AIBOTRADES.COM${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "Using ngrok URL: ${GREEN}$NGROK_URL${NC}"
echo ""

# Step 1: Navigate to app directory
cd /home/scalpingbot/app
echo -e "${YELLOW}[1/6] Working in $(pwd)${NC}"

# Step 2: Pull latest changes
echo ""
echo -e "${YELLOW}[2/6] Pulling latest changes from git...${NC}"
git pull origin main || echo "Git pull skipped (may have local changes)"

# Step 3: Fix UI .env.production (HTTP not HTTPS)
echo ""
echo -e "${YELLOW}[3/6] Fixing UI production environment...${NC}"
cat > ui/.env.production << 'ENVEOF'
# Production Environment Variables
# API URL - Use HTTP (site is not on HTTPS yet)
VITE_API_URL=http://aibotrades.com

# Firebase Emulator (should be false in production)
VITE_USE_FIREBASE_EMULATOR=false
ENVEOF
echo -e "${GREEN}✓${NC} Updated ui/.env.production"
cat ui/.env.production

# Step 4: Rebuild frontend
echo ""
echo -e "${YELLOW}[4/6] Rebuilding frontend...${NC}"
cd ui
pnpm install
pnpm build
echo -e "${GREEN}✓${NC} Frontend rebuilt"

# Verify build
if grep -r "http://aibotrades.com" dist/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Build contains correct API URL (http://aibotrades.com)"
else
    echo -e "${RED}!${NC} Warning: Could not verify API URL in build"
fi

if grep -r "localhost:5500" dist/ > /dev/null 2>&1; then
    echo -e "${RED}!${NC} Warning: localhost:5500 still found in build!"
else
    echo -e "${GREEN}✓${NC} No localhost:5500 in build"
fi

# Step 5: Update backend MT5_API_URL
echo ""
echo -e "${YELLOW}[5/6] Updating backend MT5 API URL...${NC}"
cd /home/scalpingbot/app/server

# Update .env
if grep -q "^MT5_API_URL=" .env 2>/dev/null; then
    sed -i "s|^MT5_API_URL=.*|MT5_API_URL=$NGROK_URL|" .env
    echo -e "${GREEN}✓${NC} Updated MT5_API_URL"
else
    echo "MT5_API_URL=$NGROK_URL" >> .env
    echo -e "${GREEN}✓${NC} Added MT5_API_URL"
fi

echo "Current MT5_API_URL:"
grep "MT5_API_URL" .env

# Step 6: Restart services
echo ""
echo -e "${YELLOW}[6/6] Restarting services...${NC}"
cd /home/scalpingbot/app
pm2 restart backend --update-env
pm2 restart trading-engine-manager 2>/dev/null || true

# Reload nginx to pick up new frontend
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  FIX COMPLETE!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""

# Show status
pm2 status

# Test MT5 API connection
echo ""
echo "Testing MT5 API connection..."
sleep 3
if curl -s --max-time 10 "$NGROK_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} MT5 API is accessible via ngrok"
    curl -s "$NGROK_URL/health" | head -c 200
    echo ""
else
    echo -e "${RED}!${NC} Could not reach MT5 API at $NGROK_URL"
    echo "Make sure MT5 API and ngrok are running on Windows"
fi

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  NEXT STEPS${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "1. Clear your browser cache (Ctrl+Shift+Delete)"
echo "2. Open: http://aibotrades.com"
echo "3. Login and go to Onboarding to connect MT5 account"
echo "4. Dashboard should then show your MT5 data"
echo ""
echo "If still not working:"
echo "  - Check ngrok is running on Windows"
echo "  - Check MT5 API is running on Windows"
echo "  - Run: pm2 logs backend"
echo ""
