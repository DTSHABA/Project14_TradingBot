#!/bin/bash

# Quick Setup Script for MT5 Account Encryption
# This script generates an encryption key and provides instructions

echo "🔐 MT5 Account Encryption Setup"
echo "================================"
echo ""

# Generate encryption key
echo "📝 Generating encryption key..."
cd server
KEY=$(node scripts/generate-encryption-key.mjs | grep -A 1 "Add this to your .env file:" | tail -n 1)
cd ..

echo ""
echo "✅ Generated encryption key!"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Add the following line to your server/.env file:"
echo ""
echo "   $KEY"
echo ""
echo "2. Restart your development server:"
echo "   - Press Ctrl+C to stop the current server"
echo "   - Run: pnpm dev"
echo ""
echo "3. Test your MT5 account connection in the UI"
echo ""
echo "⚠️  Important: Keep this key secure and never commit it to version control!"
echo ""

