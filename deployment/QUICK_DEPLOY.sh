#!/bin/bash
# Quick one-command deployment for Firebase fix
# Run this on VPS: sudo su - scalpingbot && cd /home/scalpingbot/app && bash deployment/QUICK_DEPLOY.sh

set -e
echo "🚀 Quick Firebase Fix Deployment"
echo ""

cd /home/scalpingbot/app

echo "📥 Pulling latest code..."
git pull

echo "🔧 Installing dependencies..."
pnpm install
cd ui && pnpm install && cd ..

echo "🏗️ Building frontend..."
cd ui
pnpm build
cd ..

echo "🔄 Restarting services..."
pm2 restart backend || true
pm2 restart all || true

echo "🌐 Reloading Nginx..."
sudo systemctl reload nginx || echo "⚠️ Could not reload Nginx (may need manual sudo)"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Verify:"
echo "1. Visit http://aibotrades.com"
echo "2. Open browser console (F12)"
echo "3. Look for: ✅ Firebase initialized with project: my-first-project-31367"
echo "4. Try signing in with Google"
echo ""

pm2 status
