#!/bin/bash
# PostgreSQL Setup Script
# Installs and configures PostgreSQL for local use
# Run this script as root or with sudo

set -e

echo "🚀 Setting up PostgreSQL..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Install PostgreSQL
echo -e "${GREEN}Installing PostgreSQL...${NC}"
apt update
apt install -y postgresql postgresql-contrib

# Get configuration values
echo -e "${YELLOW}Enter PostgreSQL configuration:${NC}"
read -p "Database name [scalpingbot]: " DB_NAME
DB_NAME=${DB_NAME:-scalpingbot}

read -p "Database user [scalpingbot]: " DB_USER
DB_USER=${DB_USER:-scalpingbot}

read -sp "Database password: " DB_PASSWORD
echo ""

# Create database and user
echo -e "${GREEN}Creating database and user...${NC}"
sudo -u postgres psql <<EOF
-- Create user
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    ELSE
        ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- Create database
SELECT 'CREATE DATABASE $DB_NAME'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
EOF

# Configure PostgreSQL connection limits
echo -e "${GREEN}Configuring PostgreSQL connection limits...${NC}"
PG_VERSION=$(psql --version | grep -oP '\d+' | head -1)
PG_CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
PG_HBA="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

# Update postgresql.conf for connection pooling
if [ -f "$PG_CONF" ]; then
    # Set max connections
    sed -i "s/#max_connections = 100/max_connections = 100/" "$PG_CONF" || \
    sed -i "s/max_connections = .*/max_connections = 100/" "$PG_CONF" || \
    echo "max_connections = 100" >> "$PG_CONF"
    
    # Enable necessary extensions
    echo "shared_preload_libraries = 'pg_stat_statements'" >> "$PG_CONF" || true
    
    echo -e "${GREEN}✓ PostgreSQL configuration updated${NC}"
fi

# Configure pg_hba.conf for local connections
if [ -f "$PG_HBA" ]; then
    # Add local connection if not exists
    if ! grep -q "local   $DB_NAME" "$PG_HBA"; then
        echo "local   $DB_NAME    $DB_USER                    md5" >> "$PG_HBA"
    fi
    if ! grep -q "host    $DB_NAME" "$PG_HBA"; then
        echo "host    $DB_NAME    $DB_USER    127.0.0.1/32    md5" >> "$PG_HBA"
        echo "host    $DB_NAME    $DB_USER    ::1/128         md5" >> "$PG_HBA"
    fi
    echo -e "${GREEN}✓ pg_hba.conf updated${NC}"
fi

# Create necessary extensions
echo -e "${GREEN}Creating database extensions...${NC}"
sudo -u postgres psql -d "$DB_NAME" <<EOF
-- Create pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Create pg_stat_statements extension for query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EOF

# Restart PostgreSQL
echo -e "${GREEN}Restarting PostgreSQL...${NC}"
systemctl restart postgresql

# Wait a moment for service to start
sleep 2

# Verify PostgreSQL is running
if systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✅ PostgreSQL is running!${NC}"
    echo ""
    echo -e "${GREEN}Configuration Summary:${NC}"
    echo "  - Database: $DB_NAME"
    echo "  - User: $DB_USER"
    echo "  - Max connections: 100"
    echo "  - Extensions: pgcrypto, pg_stat_statements"
    echo ""
    echo -e "${YELLOW}Connection strings:${NC}"
    echo "  Direct PostgreSQL: postgresql://$DB_USER:[password]@localhost:5432/$DB_NAME"
    echo "  Via PgBouncer: postgresql://$DB_USER:[password]@localhost:6432/$DB_NAME"
    echo ""
    echo -e "${YELLOW}Update your DATABASE_URL in server/.env:${NC}"
    echo "  DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
    echo ""
    echo -e "${GREEN}PostgreSQL setup complete!${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Update server/.env with the connection string above"
    echo "  2. Run database migrations: cd server && pnpm db:push"
    echo "  3. (Optional) Setup PgBouncer for connection pooling: bash deployment/setup-pgbouncer.sh"
else
    echo -e "${RED}❌ PostgreSQL failed to start. Check logs:${NC}"
    echo "  sudo journalctl -u postgresql -n 50"
    exit 1
fi


