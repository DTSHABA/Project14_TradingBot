#!/bin/bash
# VPS Setup Script for Scalping Bot
# Run this script as root or with sudo

set -e

echo "🚀 Starting VPS Setup for Scalping Bot..."

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

# Update system
echo -e "${GREEN}Updating system packages...${NC}"
apt update && apt upgrade -y

# Install Node.js 20.x
echo -e "${GREEN}Installing Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install pnpm
echo -e "${GREEN}Installing pnpm...${NC}"
npm install -g pnpm

# Install Python and dependencies
echo -e "${GREEN}Installing Python 3 and pip...${NC}"
apt install -y python3 python3-pip python3-venv

# Install PostgreSQL (optional, if not using Supabase)
echo -e "${YELLOW}Installing PostgreSQL...${NC}"
echo "Do you want to install PostgreSQL locally? (y/n)"
read -r install_postgres
if [ "$install_postgres" = "y" ]; then
    apt install -y postgresql postgresql-contrib
    echo -e "${GREEN}PostgreSQL installed.${NC}"
    echo -e "${YELLOW}Run deployment/setup-postgresql.sh to configure database.${NC}"
fi

# Install PgBouncer (optional, recommended for connection pooling)
echo -e "${YELLOW}Installing PgBouncer (connection pooler)...${NC}"
echo "Do you want to install PgBouncer for connection pooling? (y/n)"
read -r install_pgbouncer
if [ "$install_pgbouncer" = "y" ]; then
    apt install -y pgbouncer
    echo -e "${GREEN}PgBouncer installed.${NC}"
    echo -e "${YELLOW}Run deployment/setup-pgbouncer.sh to configure PgBouncer.${NC}"
fi

# Install Nginx
echo -e "${GREEN}Installing Nginx...${NC}"
apt install -y nginx

# Install PM2
echo -e "${GREEN}Installing PM2...${NC}"
npm install -g pm2

# Install Certbot for SSL
echo -e "${GREEN}Installing Certbot...${NC}"
apt install -y certbot python3-certbot-nginx

# Install build essentials
echo -e "${GREEN}Installing build essentials...${NC}"
apt install -y build-essential

# Create application user
echo -e "${GREEN}Creating application user...${NC}"
if id "scalpingbot" &>/dev/null; then
    echo -e "${YELLOW}User 'scalpingbot' already exists${NC}"
else
    adduser --disabled-password --gecos "" scalpingbot
    usermod -aG sudo scalpingbot
    echo -e "${GREEN}User 'scalpingbot' created${NC}"
fi

# Create directories
echo -e "${GREEN}Creating directories...${NC}"
mkdir -p /home/scalpingbot/.pm2/logs
mkdir -p /home/scalpingbot/app
chown -R scalpingbot:scalpingbot /home/scalpingbot

# Setup firewall
echo -e "${GREEN}Configuring firewall...${NC}"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable

echo -e "${GREEN}✅ VPS setup complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Clone your repository to /home/scalpingbot/app"
echo "2. Switch to scalpingbot user: sudo su - scalpingbot"
echo "3. Install dependencies: cd app && pnpm install"
echo "4. Configure environment variables (see deployment/env.template)"
echo "5. Build frontend: cd ui && pnpm build"
echo "6. Setup PM2: pm2 start ecosystem.config.js"
echo "7. Configure Nginx (see deployment/nginx.conf)"
echo "8. Setup SSL: certbot --nginx -d yourdomain.com"

