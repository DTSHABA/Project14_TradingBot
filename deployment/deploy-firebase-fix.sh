#!/bin/bash
# Quick deployment script for Firebase configuration fix
# Run this on your VPS as the scalpingbot user

set -e

echo "🔧 Deploying Firebase Configuration Fix..."
echo ""

APP_DIR="/home/scalpingbot/app"
cd "$APP_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Pull latest changes
echo -e "${GREEN}[1/6] Pulling latest changes from git...${NC}"
git pull

# Step 2: Verify Firebase config exists and is valid
echo -e "${GREEN}[2/6] Verifying Firebase configuration...${NC}"
if [ ! -f "ui/src/lib/firebase-config.json" ]; then
    echo -e "${RED}Error: Firebase config file not found!${NC}"
    exit 1
fi

# Check for demo/placeholder values
if grep -q "demo-api-key\|demo-project" "ui/src/lib/firebase-config.json"; then
    echo -e "${RED}Error: Firebase config contains demo/placeholder values!${NC}"
    echo -e "${YELLOW}Please update ui/src/lib/firebase-config.json with valid Firebase credentials${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Firebase config looks valid${NC}"

# Step 3: Install dependencies
echo -e "${GREEN}[3/6] Installing dependencies...${NC}"
pnpm install
cd ui && pnpm install && cd ..
cd server && pnpm install && cd ..

# Step 4: Build frontend (includes Firebase config)
echo -e "${GREEN}[4/6] Building frontend...${NC}"
cd ui
pnpm build
cd ..

# Step 5: Restart services
echo -e "${GREEN}[5/6] Restarting services...${NC}"
pm2 restart backend || true
pm2 restart all || true

# Step 6: Reload Nginx
echo -e "${GREEN}[6/6] Reloading Nginx...${NC}"
sudo systemctl reload nginx || echo -e "${YELLOW}Note: Could not reload Nginx (may need sudo access)${NC}"

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Verify domain is authorized in Firebase Console:"
echo "   https://console.firebase.google.com/project/my-first-project-31367/authentication/settings"
echo "2. Ensure Google sign-in is enabled:"
echo "   https://console.firebase.google.com/project/my-first-project-31367/authentication/providers"
echo "3. Test login at: http://aibotrades.com"
echo "4. Check browser console for: ✅ Firebase initialized"
echo ""
pm2 status
