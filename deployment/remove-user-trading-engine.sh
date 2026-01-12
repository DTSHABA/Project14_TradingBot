#!/bin/bash
# Remove User Trading Engine Script
# Manually removes a trading engine process for a specific user
# Usage: ./remove-user-trading-engine.sh <user_id>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Usage: $0 <user_id>${NC}"
    echo "  user_id: Required - User ID from database"
    exit 1
fi

USER_ID="$1"

echo -e "${GREEN}Removing trading engine for user: $USER_ID${NC}"

# Find all processes matching the user ID pattern
PROCESS_PATTERN="trading-engine-${USER_ID:0:8}"

echo -e "${YELLOW}Searching for processes matching: $PROCESS_PATTERN${NC}"

# Get list of matching processes
MATCHING_PROCESSES=$(pm2 jlist | jq -r ".[] | select(.name | startswith(\"$PROCESS_PATTERN\")) | .name" 2>/dev/null || echo "")

if [ -z "$MATCHING_PROCESSES" ]; then
    echo -e "${YELLOW}No trading engine processes found for user $USER_ID${NC}"
    exit 0
fi

# Stop and delete each matching process
for process_name in $MATCHING_PROCESSES; do
    echo -e "${YELLOW}Stopping process: $process_name${NC}"
    
    if pm2 describe "$process_name" > /dev/null 2>&1; then
        pm2 delete "$process_name" || pm2 stop "$process_name" && pm2 delete "$process_name"
        echo -e "${GREEN}✓ Stopped and removed: $process_name${NC}"
    else
        echo -e "${YELLOW}Process $process_name not found in PM2${NC}"
    fi
done

# Save PM2 process list
pm2 save

echo ""
echo -e "${GREEN}✓ Trading engine processes removed for user $USER_ID${NC}"
echo -e "${YELLOW}Note: The trading-engine-manager may restart these processes if the user is still active in the database${NC}"


