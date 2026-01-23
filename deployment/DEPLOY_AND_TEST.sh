#!/bin/bash
# Complete deployment and test script for Firebase fix
# Run this on VPS: sudo su - scalpingbot && cd /home/scalpingbot/app && bash deployment/DEPLOY_AND_TEST.sh

set -e

echo "🚀 Firebase Fix Deployment & Test"
echo "=================================="
echo ""

APP_DIR="/home/scalpingbot/app"
cd "$APP_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Pull latest changes
echo -e "${BLUE}[1/7] Pulling latest code from git...${NC}"
git pull
echo ""

# Step 2: Verify Firebase config
echo -e "${BLUE}[2/7] Verifying Firebase configuration...${NC}"
if [ -f "ui/src/lib/firebase-config.json" ]; then
    if grep -q "demo-api-key\|demo-project\|DemoKeyForLocalDevelopment" "ui/src/lib/firebase-config.json"; then
        echo -e "${YELLOW}⚠️  firebase-config.json contains demo values (will use hardcoded fallback)${NC}"
    else
        echo -e "${GREEN}✓ firebase-config.json looks valid${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  firebase-config.json not found (will use hardcoded fallback)${NC}"
fi
echo ""

# Step 3: Check hardcoded config in source
echo -e "${BLUE}[3/7] Verifying hardcoded Firebase config in source...${NC}"
if grep -q "AIzaSyAijr2peSKkNWRH0j3qMmb_Ve6pIwjp9dE" "ui/src/lib/firebase.ts"; then
    echo -e "${GREEN}✓ Hardcoded Firebase config found in source${NC}"
else
    echo -e "${RED}✗ Hardcoded Firebase config NOT found!${NC}"
    exit 1
fi
echo ""

# Step 4: Install dependencies
echo -e "${BLUE}[4/7] Installing dependencies...${NC}"
pnpm install
cd ui && pnpm install && cd ..
cd server && pnpm install && cd ..
echo ""

# Step 5: Build frontend
echo -e "${BLUE}[5/7] Building frontend...${NC}"
cd ui
pnpm build
cd ..
echo -e "${GREEN}✓ Frontend built successfully${NC}"
echo ""

# Step 6: Verify build contains correct API key
echo -e "${BLUE}[6/7] Verifying build contains correct Firebase API key...${NC}"
BUILD_FILE=$(find ui/dist/assets -name "*.js" -type f | head -1)
if [ -z "$BUILD_FILE" ]; then
    echo -e "${RED}✗ No build files found!${NC}"
    exit 1
fi

if grep -q "AIzaSyAijr2peSKkNWRH0j3qMmb_Ve6pIwjp9dE" "$BUILD_FILE"; then
    echo -e "${GREEN}✓ Build contains correct Firebase API key${NC}"
else
    echo -e "${YELLOW}⚠️  Could not verify API key in build (may be minified)${NC}"
fi

# Check for demo keys
if grep -q "DemoKeyForLocalDevelopment\|demo-api-key" "$BUILD_FILE"; then
    echo -e "${RED}✗ Build still contains demo keys!${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Build does not contain demo keys${NC}"
fi
echo ""

# Step 7: Restart services
echo -e "${BLUE}[7/7] Restarting services...${NC}"
pm2 restart backend || true
pm2 restart all || true
sleep 2
echo ""

# Reload Nginx
echo -e "${BLUE}Reloading Nginx...${NC}"
sudo systemctl reload nginx || echo -e "${YELLOW}⚠️  Could not reload Nginx (may need manual sudo)${NC}"
echo ""

# Show status
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "📊 Service Status:"
pm2 status
echo ""

# Test instructions
echo -e "${BLUE}🧪 Testing Instructions:${NC}"
echo ""
echo "1. Visit: http://aibotrades.com"
echo "2. Open browser DevTools (F12) > Console tab"
echo "3. Look for these messages:"
echo "   - ✅ Firebase initialized with project: my-first-project-31367"
echo "   - 📝 Using hardcoded production Firebase config (fallback)"
echo "   OR"
echo "   - 📝 Using Firebase config from firebase-config.json"
echo ""
echo "4. Try signing in with Google"
echo "5. Check console for any errors"
echo ""
echo -e "${YELLOW}⚠️  Important: If you still see errors, ensure:${NC}"
echo "   - Domain 'aibotrades.com' is added to Firebase authorized domains"
echo "   - Google sign-in is enabled in Firebase Console"
echo ""
echo "Firebase Console Links:"
echo "  - Authorized Domains: https://console.firebase.google.com/project/my-first-project-31367/authentication/settings"
echo "  - Sign-in Methods: https://console.firebase.google.com/project/my-first-project-31367/authentication/providers"
echo ""
