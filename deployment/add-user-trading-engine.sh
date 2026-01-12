#!/bin/bash
# Add User Trading Engine Script
# Manually adds a trading engine process for a specific user
# Usage: ./add-user-trading-engine.sh <user_id> [mt5_account_id]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

APP_DIR="/home/scalpingbot/app"
TRADING_ENGINE_DIR="$APP_DIR/trading-engine"

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Usage: $0 <user_id> [mt5_account_id]${NC}"
    echo "  user_id: Required - User ID from database"
    echo "  mt5_account_id: Optional - Specific MT5 account ID (uses active account if not provided)"
    exit 1
fi

USER_ID="$1"
MT5_ACCOUNT_ID="$2"

echo -e "${GREEN}Adding trading engine for user: $USER_ID${NC}"
if [ -n "$MT5_ACCOUNT_ID" ]; then
    echo -e "${GREEN}Using MT5 account: $MT5_ACCOUNT_ID${NC}"
else
    echo -e "${YELLOW}Will use active MT5 account for user${NC}"
fi

# Load environment variables
if [ ! -f "$APP_DIR/server/.env" ]; then
    echo -e "${RED}Error: server/.env file not found${NC}"
    exit 1
fi

# Source environment variables
export $(grep -v '^#' "$APP_DIR/server/.env" | xargs)

# Generate process name
PROCESS_NAME="trading-engine-${USER_ID:0:8}"
if [ -n "$MT5_ACCOUNT_ID" ]; then
    PROCESS_NAME="${PROCESS_NAME}-${MT5_ACCOUNT_ID:0:8}"
fi

# Check if process already exists
if pm2 describe "$PROCESS_NAME" > /dev/null 2>&1; then
    echo -e "${YELLOW}Process $PROCESS_NAME already exists${NC}"
    echo -e "${YELLOW}Stopping existing process...${NC}"
    pm2 delete "$PROCESS_NAME" || true
fi

# Create environment variables for this instance
ENV_VARS=(
    "TRADING_ENGINE_API_URL=${TRADING_ENGINE_API_URL:-http://localhost:5500}"
    "TRADING_ENGINE_API_KEY=${TRADING_ENGINE_API_KEY:-trading-engine-key}"
    "TRADING_ENGINE_USER_ID=$USER_ID"
    "DATABASE_URL=${DATABASE_URL}"
    "MT5_SYMBOL=${MT5_SYMBOL:-XAUUSD}"
    "PYTHONUNBUFFERED=1"
)

if [ -n "$MT5_ACCOUNT_ID" ]; then
    ENV_VARS+=("TRADING_ENGINE_MT5_ACCOUNT_ID=$MT5_ACCOUNT_ID")
fi

# Start trading engine process
echo -e "${GREEN}Starting trading engine process...${NC}"
cd "$APP_DIR"

pm2 start ecosystem.config.js --update-env || pm2 start \
    --name "$PROCESS_NAME" \
    --interpreter "$TRADING_ENGINE_DIR/venv/bin/python" \
    --cwd "$TRADING_ENGINE_DIR" \
    --script "-m" \
    --args "src.main" \
    --max-memory-restart 1G \
    --min-uptime 10s \
    --max-restarts 10 \
    --restart-delay 5000 \
    --log-date-format "YYYY-MM-DD HH:mm:ss Z" \
    --merge-logs \
    --autorestart \
    --no-watch \
    --error-log "/home/scalpingbot/.pm2/logs/${PROCESS_NAME}-error.log" \
    --out-log "/home/scalpingbot/.pm2/logs/${PROCESS_NAME}-out.log" \
    --update-env

# Set environment variables
for env_var in "${ENV_VARS[@]}"; do
    pm2 set "$PROCESS_NAME" "$env_var" 2>/dev/null || true
done

# Save PM2 process list
pm2 save

# Wait a moment for process to start
sleep 2

# Verify process is running
PROCESS_STATUS=$(pm2 jlist | jq -r ".[] | select(.name==\"$PROCESS_NAME\") | .pm2_env.status" 2>/dev/null || echo "unknown")

if [ "$PROCESS_STATUS" = "online" ]; then
    echo -e "${GREEN}✓ Trading engine process started successfully${NC}"
    echo -e "${GREEN}  Process name: $PROCESS_NAME${NC}"
    echo -e "${GREEN}  Status: $PROCESS_STATUS${NC}"
    echo ""
    echo -e "${YELLOW}Note: This process will be managed by trading-engine-manager${NC}"
    echo -e "${YELLOW}The manager may restart or stop this process based on database state${NC}"
else
    echo -e "${RED}✗ Failed to start trading engine process${NC}"
    echo -e "${RED}  Status: $PROCESS_STATUS${NC}"
    echo -e "${YELLOW}Check logs: pm2 logs $PROCESS_NAME${NC}"
    exit 1
fi


