#!/bin/bash
# PgBouncer Setup Script
# Installs and configures PgBouncer for connection pooling
# Run this script as root or with sudo

set -e

echo "🚀 Setting up PgBouncer..."

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

# Install PgBouncer
echo -e "${GREEN}Installing PgBouncer...${NC}"
apt update
apt install -y pgbouncer

# Get database connection details
echo -e "${YELLOW}Enter PostgreSQL connection details:${NC}"
read -p "Database host [localhost]: " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Database port [5432]: " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Database name [scalpingbot]: " DB_NAME
DB_NAME=${DB_NAME:-scalpingbot}

read -p "Database user [scalpingbot]: " DB_USER
DB_USER=${DB_USER:-scalpingbot}

read -sp "Database password: " DB_PASSWORD
echo ""

# PgBouncer configuration directory
PGBOUNCER_DIR="/etc/pgbouncer"
PGBOUNCER_CONFIG="${PGBOUNCER_DIR}/pgbouncer.ini"
PGBOUNCER_USERLIST="${PGBOUNCER_DIR}/userlist.txt"

# Backup existing config if it exists
if [ -f "$PGBOUNCER_CONFIG" ]; then
    echo -e "${YELLOW}Backing up existing PgBouncer config...${NC}"
    cp "$PGBOUNCER_CONFIG" "${PGBOUNCER_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Create PgBouncer config
echo -e "${GREEN}Creating PgBouncer configuration...${NC}"
cat > "$PGBOUNCER_CONFIG" <<EOF
[databases]
scalpingbot = host=${DB_HOST} port=${DB_PORT} dbname=${DB_NAME}

[pgbouncer]
; Pool settings
pool_mode = transaction
max_client_conn = 100
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3

; Connection settings
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = ${PGBOUNCER_USERLIST}

; Logging
logfile = /var/log/pgbouncer/pgbouncer.log
pidfile = /var/run/pgbouncer/pgbouncer.pid
admin_users = ${DB_USER}
stats_users = ${DB_USER}

; Security
ignore_startup_parameters = extra_float_digits

; Performance
server_round_robin = 0
server_lifetime = 3600
server_idle_timeout = 600
query_wait_timeout = 120
query_timeout = 0
client_idle_timeout = 0
client_login_timeout = 60
autodb_idle_timeout = 3600
EOF

# Create userlist file with MD5 hash
echo -e "${GREEN}Creating userlist file...${NC}"
mkdir -p "$(dirname "$PGBOUNCER_USERLIST")"

# Generate MD5 hash for password
MD5_HASH=$(echo -n "${DB_PASSWORD}${DB_USER}" | md5sum | awk '{print $1}')

cat > "$PGBOUNCER_USERLIST" <<EOF
"${DB_USER}" "md5${MD5_HASH}"
EOF

chmod 600 "$PGBOUNCER_USERLIST"

# Create log and run directories
echo -e "${GREEN}Creating log and run directories...${NC}"
mkdir -p /var/log/pgbouncer
mkdir -p /var/run/pgbouncer
chown postgres:postgres /var/log/pgbouncer
chown postgres:postgres /var/run/pgbouncer

# Update systemd service to use correct user
echo -e "${GREEN}Configuring systemd service...${NC}"
if [ -f /etc/systemd/system/pgbouncer.service ]; then
    systemctl stop pgbouncer || true
fi

cat > /etc/systemd/system/pgbouncer.service <<EOF
[Unit]
Description=pgbouncer - lightweight connection pooler for PostgreSQL
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=forking
User=postgres
Group=postgres
ExecStart=/usr/bin/pgbouncer -d ${PGBOUNCER_CONFIG}
ExecReload=/bin/kill -HUP \$MAINPID
PIDFile=/var/run/pgbouncer/pgbouncer.pid
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start PgBouncer
systemctl daemon-reload
systemctl enable pgbouncer
systemctl start pgbouncer

# Wait a moment for service to start
sleep 2

# Check if PgBouncer is running
if systemctl is-active --quiet pgbouncer; then
    echo -e "${GREEN}✅ PgBouncer is running!${NC}"
    echo ""
    echo -e "${GREEN}Configuration Summary:${NC}"
    echo "  - Listen address: 127.0.0.1:6432"
    echo "  - Pool mode: transaction"
    echo "  - Max pool size: 25 connections"
    echo "  - Database: ${DB_NAME}"
    echo ""
    echo -e "${YELLOW}Update your DATABASE_URL to use PgBouncer:${NC}"
    echo "  DATABASE_URL=postgresql://${DB_USER}:[password]@localhost:6432/${DB_NAME}"
    echo ""
    echo -e "${YELLOW}For direct PostgreSQL access (migrations), use:${NC}"
    echo "  PGDIRECT_URL=postgresql://${DB_USER}:[password]@localhost:${DB_PORT}/${DB_NAME}"
    echo ""
    echo -e "${GREEN}PgBouncer setup complete!${NC}"
else
    echo -e "${RED}❌ PgBouncer failed to start. Check logs:${NC}"
    echo "  sudo journalctl -u pgbouncer -n 50"
    exit 1
fi


