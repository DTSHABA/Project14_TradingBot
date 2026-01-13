#!/bin/bash
# Fix database connection and install missing dependencies

set -e

cd /home/scalpingbot/app

echo "🔧 Fixing database connection and dependencies..."

# Step 1: Fix DATABASE_URL - encode @ in password
echo "Step 1: Fixing DATABASE_URL password encoding..."
cd server
if grep -q "Kefilwe@1vusi" .env; then
    # URL encode @ as %40
    sed -i 's|Kefilwe@1vusi|Kefilwe%401vusi|' .env
    echo "✓ Fixed password encoding in DATABASE_URL"
fi

# Show the fixed URL (without password)
echo "DATABASE_URL (masked):"
grep DATABASE_URL .env | sed 's/:[^:@]*@/:****@/'

# Step 2: Test database connection
echo ""
echo "Step 2: Testing database connection..."
DB_URL=$(grep "^DATABASE_URL=" .env | cut -d '=' -f2-)
if psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✓ Database connection successful!"
else
    echo "✗ Database connection failed. Checking database exists..."
    # Check if database exists
    DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    echo "Database name: $DB_NAME"
    echo "Try creating the database if it doesn't exist:"
    echo "  sudo -u postgres createdb $DB_NAME"
fi

# Step 3: Install missing npm packages for trading-engine-manager
echo ""
echo "Step 3: Installing missing npm packages..."
cd /home/scalpingbot/app
pnpm add -w pm2 postgres dotenv

echo ""
echo "✅ Fixes completed!"
echo ""
echo "Next steps:"
echo "  1. Restart trading-engine-manager: pm2 restart trading-engine-manager"
echo "  2. Check logs: pm2 logs trading-engine-manager"
echo "  3. Run database migrations: cd server && pnpm db:push"

