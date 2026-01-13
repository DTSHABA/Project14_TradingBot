#!/bin/bash
# Fix PM2 services - Rename trading-engine-manager and restart services

set -e

cd /home/scalpingbot/app

echo "Step 1: Checking trading-engine-manager file..."
if [ -f "deployment/trading-engine-manager.js" ]; then
    echo "Found .js file, renaming to .cjs..."
    mv deployment/trading-engine-manager.js deployment/trading-engine-manager.cjs
elif [ -f "deployment/trading-engine-manager.cjs" ]; then
    echo "File already renamed to .cjs"
else
    echo "ERROR: trading-engine-manager file not found!"
    find /home/scalpingbot/app -name "*trading-engine-manager*" -type f
    exit 1
fi

echo "Step 2: Updating ecosystem.config.cjs..."
sed -i 's|deployment/trading-engine-manager.js|deployment/trading-engine-manager.cjs|' ecosystem.config.cjs

echo "Step 3: Stopping and deleting old PM2 processes..."
pm2 delete mt5-api 2>/dev/null || true
pm2 delete trading-engine-manager 2>/dev/null || true

echo "Step 4: Starting PM2 with updated config..."
pm2 start ecosystem.config.cjs

echo "Step 5: Saving PM2 configuration..."
pm2 save

echo "Step 6: Checking PM2 status..."
pm2 status

echo ""
echo "✅ Done! Check the status above."

