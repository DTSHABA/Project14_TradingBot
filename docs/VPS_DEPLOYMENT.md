# VPS Deployment Guide

This guide will help you deploy your Scalping Bot application to a VPS (Virtual Private Server).

## Prerequisites

- A VPS with Ubuntu 20.04+ or Debian 11+ (recommended: Ubuntu 22.04 LTS)
- Root or sudo access
- Domain name (optional but recommended for SSL)
- At least 2GB RAM and 20GB storage
- Node.js 20+ and Python 3.10+ installed

## Architecture Overview

Your application consists of multiple services supporting multi-user deployment:

1. **Frontend (React/Vite)** - Serves the UI (static files via Nginx)
2. **Backend API (Node.js/Hono)** - Handles API requests and authentication
3. **MT5 API Service (Python Flask)** - Manages MT5 connections
4. **Trading Engine Manager (Node.js)** - Dynamically manages trading engine processes
5. **Trading Engine Instances (Python)** - One per active user with active MT5 account
6. **PgBouncer** - Connection pooler for PostgreSQL (recommended)
7. **PostgreSQL** - Database (local or Supabase)

### Multi-User Architecture

The system automatically manages trading engine processes:
- Trading Engine Manager polls database every 60 seconds
- Spawns trading engine process for each active user with active MT5 account
- Monitors and restarts failed processes
- Stops processes when users deactivate accounts

## Step 1: Initial VPS Setup

### 1.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Required Software

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
sudo npm install -g pnpm

# Install Python 3.10+ and pip
sudo apt install -y python3 python3-pip python3-venv

# Install PostgreSQL (if not using Supabase)
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Install build essentials (for native modules)
sudo apt install -y build-essential
```

### 1.3 Create Application User

```bash
sudo adduser --disabled-password --gecos "" scalpingbot
sudo usermod -aG sudo scalpingbot
```

## Step 2: Clone and Setup Repository

### 2.1 Clone Repository

```bash
# Switch to application user
sudo su - scalpingbot

# Clone your repository
git clone <your-repo-url> /home/scalpingbot/app
cd /home/scalpingbot/app
```

### 2.2 Install Dependencies

```bash
# Install root dependencies
pnpm install

# Install UI dependencies
cd ui && pnpm install && cd ..

# Install server dependencies
cd server && pnpm install && cd ..

# Install Python dependencies
cd trading-engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..
```

## Step 3: Environment Configuration

### 3.1 Backend Environment Variables

Create `/home/scalpingbot/app/server/.env`:

```bash
# Database (use Supabase connection string or local PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/scalpingbot

# Firebase Configuration
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Server Configuration
PORT=5500
NODE_ENV=production

# MT5 API Service URL (internal)
MT5_API_URL=http://localhost:5001
```

### 3.2 Frontend Environment Variables

Create `/home/scalpingbot/app/ui/.env.production`:

```bash
VITE_API_URL=https://api.yourdomain.com
VITE_USE_FIREBASE_EMULATOR=false
```

### 3.3 Trading Engine Environment Variables

Create `/home/scalpingbot/app/trading-engine/.env`:

```bash
# MT5 API Service Configuration
MT5_API_PORT=5001
MT5_API_HOST=127.0.0.1
DEBUG=false

# MT5 Terminal Path (if MT5 is installed on VPS)
MT5_TERMINAL_PATH=/opt/mt5/terminal64.exe

# Database Configuration (if trading engine needs direct DB access)
DATABASE_URL=postgresql://user:password@localhost:5432/scalpingbot
```

## Step 4: Build Application

### 4.1 Build Frontend

```bash
cd /home/scalpingbot/app/ui
pnpm build
```

This creates the production build in `ui/dist/`.

### 4.2 Build Backend

```bash
cd /home/scalpingbot/app/server
# Backend doesn't need building, but verify TypeScript compiles
pnpm run db:push  # Push database schema
```

## Step 5: Setup Process Management with PM2

### 5.1 Create PM2 Ecosystem File

The PM2 configuration is already created in `ecosystem.config.js` at the root. Review and adjust if needed.

### 5.2 Start Services with PM2

```bash
cd /home/scalpingbot/app
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable PM2 on boot
```

### 5.3 Verify Services

```bash
pm2 status
pm2 logs
```

## Step 6: Configure Nginx

### 6.1 Create Nginx Configuration

The Nginx configuration is already created in `deployment/nginx.conf`. Copy it:

```bash
sudo cp /home/scalpingbot/app/deployment/nginx.conf /etc/nginx/sites-available/scalpingbot
sudo ln -s /etc/nginx/sites-available/scalpingbot /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site
```

### 6.2 Update Domain Name

Edit `/etc/nginx/sites-available/scalpingbot` and replace:
- `yourdomain.com` with your actual domain
- `api.yourdomain.com` with your API subdomain (or use same domain with `/api` path)

### 6.3 Test and Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Step 7: Setup SSL with Let's Encrypt

### 7.1 Obtain SSL Certificates

```bash
# For main domain
sudo certbot --nginx -d yourdomain.com

# For API subdomain (if using separate subdomain)
sudo certbot --nginx -d api.yourdomain.com
```

### 7.2 Auto-renewal

Certbot automatically sets up auto-renewal. Test it:

```bash
sudo certbot renew --dry-run
```

## Step 8: Configure Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

## Step 9: Database Setup

### Option A: Using Supabase

1. Create a Supabase project at https://supabase.com
2. Get your connection string from Supabase dashboard
3. Update `DATABASE_URL` in `server/.env`
4. Run migrations: `cd server && pnpm db:push`

**Note**: For Supabase, you can optionally set up PgBouncer locally for connection pooling.

### Option B: Local PostgreSQL

Use the automated setup script:

```bash
sudo bash deployment/setup-postgresql.sh
```

Or manually:

```bash
sudo -u postgres psql
CREATE DATABASE scalpingbot;
CREATE USER scalpingbot WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE scalpingbot TO scalpingbot;
\q
```

### Step 9.1: Setup PgBouncer (Recommended for Multi-User)

PgBouncer provides connection pooling, essential when running multiple trading engine instances:

```bash
sudo bash deployment/setup-pgbouncer.sh
```

**Important**: After setup, update `DATABASE_URL` to use PgBouncer port (6432):
- `DATABASE_URL=postgresql://user:pass@localhost:6432/scalpingbot` (via PgBouncer)
- `PGDIRECT_URL=postgresql://user:pass@localhost:5432/scalpingbot` (direct, for migrations)

Then run migrations using the direct connection or migration script:

```bash
bash deployment/migrate-database.sh
```

## Step 10: Firebase Configuration

### 10.1 Update Firebase Authorized Domains

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Authentication > Settings > Authorized domains
4. Add your domain: `yourdomain.com`

### 10.2 Update Frontend Firebase Config

Update `ui/src/lib/firebase-config.json` with production Firebase config:

```json
{
  "apiKey": "your-api-key",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "your-sender-id",
  "appId": "your-app-id"
}
```

Rebuild frontend after updating: `cd ui && pnpm build`

## Step 11: MetaTrader 5 Setup (Optional)

If you need MT5 on the VPS:

1. Install MT5 terminal on the VPS (requires GUI or headless setup)
2. Update `MT5_TERMINAL_PATH` in `trading-engine/.env`
3. Restart MT5 API service: `pm2 restart mt5-api`

**Note**: MT5 typically requires a GUI environment. Consider using:
- Xvfb (virtual display) for headless operation
- Or run MT5 on a separate Windows machine and connect remotely

## Step 12: Monitoring and Logs

### 12.1 PM2 Monitoring

```bash
pm2 monit                    # Real-time monitoring
pm2 logs                     # View all logs
pm2 logs backend             # View specific service logs
pm2 logs mt5-api
pm2 logs trading-engine-manager  # Manager that controls trading engines

# View trading engine instances (dynamically created)
pm2 list | grep trading-engine

# View specific trading engine
pm2 logs trading-engine-<user-id>-<account-id>
```

### 12.2 Trading Engine Management

Trading engine instances are managed automatically by the Trading Engine Manager:

```bash
# View manager status
pm2 logs trading-engine-manager

# Manual management (if needed)
bash deployment/add-user-trading-engine.sh <user_id> [mt5_account_id]
bash deployment/remove-user-trading-engine.sh <user_id>

# Comprehensive monitoring
bash deployment/pm2-monitor.sh
```

### 12.3 Health Checks

```bash
# Comprehensive health check
curl http://localhost:5500/api/v1/health

# Simple health check
curl http://localhost:5500/api/v1/health/simple
```

### 12.2 Log Locations

- PM2 logs: `~/.pm2/logs/`
- Nginx logs: `/var/log/nginx/`
- Application logs: Check `trading-engine/logs/` for Python logs

## Step 13: Maintenance Commands

### Update Application

Use the automated deployment script:

```bash
cd /home/scalpingbot/app
bash deployment/deploy.sh
```

This script:
- Pulls latest changes
- Updates dependencies
- Builds frontend
- Runs database migrations (with backup)
- Restarts base services
- Trading Engine Manager handles trading engine updates automatically

Or manually:

```bash
cd /home/scalpingbot/app
git pull
pnpm install
cd ui && pnpm install && pnpm build && cd ..
cd server && pnpm install && cd ..
cd trading-engine && source venv/bin/activate && pip install -r requirements.txt && deactivate && cd ..
pm2 restart backend mt5-api trading-engine-manager
# Trading engines are managed by the manager
```

### Restart Services

```bash
# Restart base services
pm2 restart backend
pm2 restart mt5-api
pm2 restart trading-engine-manager

# Trading engine instances are managed by the manager
# They will restart automatically if they fail
# Or the manager will recreate them on next poll cycle

# To restart all (including trading engines)
pm2 restart all
```

### Stop Services

```bash
pm2 stop all
```

### View Service Status

```bash
pm2 status
pm2 info frontend
pm2 info backend
```

## Troubleshooting

### Services Not Starting

1. Check PM2 logs: `pm2 logs`
2. Check environment variables: `pm2 env <service-name>`
3. Verify ports are available: `sudo netstat -tulpn | grep <port>`

### Database Connection Issues

1. Verify `DATABASE_URL` is correct
2. Test connection: `cd server && pnpm db:push`
3. Check PostgreSQL is running: `sudo systemctl status postgresql`

### Nginx Issues

1. Check Nginx config: `sudo nginx -t`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify services are running: `pm2 status`

### SSL Certificate Issues

1. Check certificate status: `sudo certbot certificates`
2. Manually renew: `sudo certbot renew`
3. Check Nginx SSL config in `/etc/nginx/sites-available/scalpingbot`

### MT5 Connection Issues

1. Verify MT5 API service is running: `pm2 status mt5-api`
2. Check MT5 API logs: `pm2 logs mt5-api`
3. Test health endpoint: `curl http://localhost:5001/health`
4. Verify MT5 terminal path is correct

## Security Checklist

- [ ] Firewall configured (UFW)
- [ ] SSL certificates installed and auto-renewing
- [ ] Environment variables secured (not in git)
- [ ] Database credentials are strong
- [ ] Firebase Admin SDK keys secured
- [ ] Trading Engine API key is strong and unique
- [ ] SSH key authentication enabled (disable password auth)
- [ ] Regular system updates enabled
- [ ] PM2 process monitoring enabled
- [ ] Log rotation configured
- [ ] Backups configured for database
- [ ] Internal API endpoints blocked from external access (Nginx)
- [ ] Rate limiting configured (Nginx and API middleware)
- [ ] IP whitelisting for internal endpoints (localhost only)

## Backup Strategy

### Database Backups

```bash
# For PostgreSQL (local)
sudo -u postgres pg_dump scalpingbot > backup_$(date +%Y%m%d).sql

# For Supabase - use Supabase dashboard or API
```

### Application Backups

```bash
# Backup application directory
tar -czf app_backup_$(date +%Y%m%d).tar.gz /home/scalpingbot/app
```

### Automated Backups

Set up cron jobs for automated backups:

```bash
crontab -e
# Add: 0 2 * * * /path/to/backup-script.sh
```

## Performance Optimization

1. **Enable Nginx caching** for static assets (already configured)
2. **Use CDN** for frontend assets (Cloudflare, etc.)
3. **Database connection pooling** via PgBouncer (recommended for multi-user)
4. **PM2 resource limits** per trading engine (configured in ecosystem.config.js)
5. **Monitor resource usage**: `bash deployment/pm2-monitor.sh`, `pm2 monit`, `htop`
6. **Trading Engine Manager** automatically manages process lifecycle

## Multi-User Considerations

### Resource Planning

- **Per Trading Engine**: ~200-500MB RAM, ~5-10% CPU
- **Recommended**: 20-30 concurrent users per VPS
- **Database Connections**: 25 shared via PgBouncer (regardless of user count)

### Scaling

- **Vertical**: Upgrade VPS resources (RAM, CPU)
- **Horizontal**: Deploy to multiple VPS instances
- **Connection Pooling**: Already implemented via PgBouncer

For detailed multi-user deployment guide, see [MULTI_USER_DEPLOYMENT.md](../deployment/MULTI_USER_DEPLOYMENT.md).

## Support

For issues or questions:
1. Check PM2 logs: `pm2 logs`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Review application logs in respective directories

---

**Deployment Complete!** 🚀

Your application should now be accessible at `https://yourdomain.com`

