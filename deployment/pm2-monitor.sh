#!/bin/bash
# PM2 Monitoring Dashboard Script
# Displays PM2 process status, resource usage, and system health

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  PM2 Monitoring Dashboard${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# PM2 Process Status
echo -e "${GREEN}PM2 Process Status:${NC}"
pm2 status
echo ""

# Trading Engine Processes Detail
echo -e "${GREEN}Trading Engine Processes:${NC}"
pm2 jlist | jq -r '.[] | select(.name | startswith("trading-engine-")) | "\(.name) - Status: \(.pm2_env.status) - Uptime: \(.pm2_env.pm_uptime // 0)ms - Memory: \(.monit.memory // 0)MB"'
echo ""

# System Resources
echo -e "${GREEN}System Resources:${NC}"
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print "  Idle: " 100 - $1 "%"}'
echo ""

echo "Memory Usage:"
free -h | grep -E "^Mem|^Swap" | awk '{print "  " $1 ": " $3 " / " $2 " (" $3/$2*100 "%)"}'
echo ""

# Disk Usage
echo -e "${GREEN}Disk Usage:${NC}"
df -h / | tail -1 | awk '{print "  /: " $3 " / " $2 " (" $5 " used)"}'
df -h /home | tail -1 | awk '{print "  /home: " $3 " / " $2 " (" $5 " used)"}'
echo ""

# Recent Logs (last 10 lines from each trading engine)
echo -e "${GREEN}Recent Trading Engine Logs (Last 10 lines):${NC}"
TRADING_ENGINES=$(pm2 jlist | jq -r '.[] | select(.name | startswith("trading-engine-")) | .name')
for engine in $TRADING_ENGINES; do
    echo -e "${YELLOW}--- $engine ---${NC}"
    pm2 logs "$engine" --lines 10 --nostream 2>/dev/null || echo "  No logs available"
    echo ""
done

# Health Check
echo -e "${GREEN}Health Check:${NC}"
if command -v curl &> /dev/null; then
    HEALTH=$(curl -s http://localhost:5500/api/v1/health 2>/dev/null || echo "{\"status\":\"error\"}")
    echo "$HEALTH" | jq -r '.status // "error"' | awk '{print "  Backend API: " $1}'
else
    echo "  Backend API: curl not available"
fi
echo ""

# PM2 Monitoring Command
echo -e "${YELLOW}For real-time monitoring, run:${NC}"
echo "  pm2 monit"
echo ""

# PM2 Logs Command
echo -e "${YELLOW}To view logs, run:${NC}"
echo "  pm2 logs [process-name]"
echo "  pm2 logs --lines 100  # Last 100 lines of all logs"
echo ""


