#!/bin/bash
# Quick script to update MT5_API_URL on VPS
# Usage: ./update-mt5-url.sh <ngrok-url>
# Example: ./update-mt5-url.sh https://abc123.ngrok-free.app

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <ngrok-url>${NC}"
    echo ""
    echo "Example:"
    echo "  $0 https://abc123.ngrok-free.app"
    echo ""
    read -p "Enter the ngrok URL: " NGROK_URL
else
    NGROK_URL=$1
fi

if [ -z "$NGROK_URL" ]; then
    echo -e "${RED}Error: No URL provided${NC}"
    exit 1
fi

# Validate URL format
if [[ ! "$NGROK_URL" =~ ^https:// ]]; then
    echo -e "${RED}Error: URL must start with https://${NC}"
    exit 1
fi

echo ""
echo "============================================"
echo "  Updating MT5 API URL"
echo "============================================"
echo ""

ENV_FILE="/home/scalpingbot/app/server/.env"

# Backup current .env
if [ -f "$ENV_FILE" ]; then
    cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✓${NC} Backed up .env"
fi

# Update or add MT5_API_URL
if grep -q "^MT5_API_URL=" "$ENV_FILE" 2>/dev/null; then
    sed -i "s|^MT5_API_URL=.*|MT5_API_URL=$NGROK_URL|" "$ENV_FILE"
    echo -e "${GREEN}✓${NC} Updated MT5_API_URL"
else
    echo "MT5_API_URL=$NGROK_URL" >> "$ENV_FILE"
    echo -e "${GREEN}✓${NC} Added MT5_API_URL"
fi

# Show current value
echo ""
echo "Current configuration:"
grep "MT5_API_URL" "$ENV_FILE" || echo "  (not found)"

# Restart backend
echo ""
echo "Restarting backend..."
cd /home/scalpingbot/app
pm2 restart backend --update-env

echo ""
echo "Current PM2 status:"
pm2 status

# Test connection
echo ""
echo "Testing connection to MT5 API..."
sleep 3

if curl -s --max-time 10 "$NGROK_URL/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} MT5 API is accessible!"
    echo ""
    curl -s "$NGROK_URL/health" | head -c 200
    echo ""
else
    echo -e "${YELLOW}!${NC} Could not reach MT5 API (may need a moment to start)"
    echo "  Try: curl $NGROK_URL/health"
fi

echo ""
echo "============================================"
echo "  Done!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Open https://aibotrades.com"
echo "  2. Login and check Dashboard"
echo "  3. MT5 account data should appear"
echo ""
