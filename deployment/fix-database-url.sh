#!/bin/bash
# Fix DATABASE_URL port in server/.env

cd /home/scalpingbot/app/server

echo "Current DATABASE_URL:"
grep DATABASE_URL .env

echo ""
echo "Fixing port from 5702 to 5432..."
sed -i 's|:5702/|:5432/|' .env

echo "Updated DATABASE_URL:"
grep DATABASE_URL .env

echo ""
echo "Testing database connection..."
if psql "$(grep DATABASE_URL .env | cut -d '=' -f2)" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database connection successful!"
else
    echo "❌ Database connection failed. Please check:"
    echo "  1. PostgreSQL is running: sudo systemctl status postgresql"
    echo "  2. Database credentials in .env are correct"
    echo "  3. Database exists: psql -U postgres -l"
fi

