# Multi-User Deployment Guide

This comprehensive guide covers deploying the Scalping Bot application to a VPS with support for multiple concurrent users, each with their own trading engine instance.

## Architecture Overview

The multi-user deployment architecture consists of:

- **Frontend**: React/Vite application served as static files via Nginx
- **Backend API**: Node.js/Hono API server handling authentication and business logic
- **MT5 API Service**: Python Flask service managing MT5 connections
- **Trading Engine Manager**: Node.js script that dynamically manages trading engine processes
- **Trading Engine Instances**: One Python process per active user with active MT5 account
- **PgBouncer**: Connection pooler for PostgreSQL (recommended)
- **PostgreSQL**: Database (local or Supabase)

### Process Flow

1. Users access the application via HTTPS
2. Frontend authenticates with Firebase Auth
3. Backend API handles all requests and manages user data
4. Trading Engine Manager polls database every 60 seconds for active users
5. For each active user with an active MT5 account, a trading engine process is spawned
6. Trading engines fetch credentials from backend API (internal endpoint)
7. Trading engines connect to MT5 via MT5 API service
8. All database connections go through PgBouncer for connection pooling

## Prerequisites

- VPS with Ubuntu 22.04+ or Debian 11+
- Root/sudo access
- Domain name (for SSL)
- At least 4GB RAM (2GB minimum, 4GB+ recommended for multiple users)
- 20GB+ storage
- Firebase project configured
- PostgreSQL database (Supabase or local)

## Step 1: Initial VPS Setup

Run the automated setup script:

```bash
sudo bash deployment/setup-vps.sh
```

This will install:
- Node.js 20.x
- pnpm
- Python 3.10+
- PostgreSQL (optional)
- PgBouncer (optional, recommended)
- Nginx
- PM2
- Certbot

## Step 2: Database Setup

### Option A: Local PostgreSQL

```bash
sudo bash deployment/setup-postgresql.sh
```

This will:
- Install PostgreSQL
- Create database and user
- Configure connection limits
- Create necessary extensions

### Option B: Supabase

1. Create a Supabase project at https://supabase.com
2. Get your connection string from the Supabase dashboard
3. Use it in your environment variables

### Step 2.1: Setup PgBouncer (Recommended)

PgBouncer provides connection pooling, essential for multiple trading engine instances:

```bash
sudo bash deployment/setup-pgbouncer.sh
```

This will:
- Install PgBouncer
- Configure connection pooling (25 connections shared)
- Set up authentication
- Create systemd service

**Important**: After setting up PgBouncer, update your `DATABASE_URL` to use port 6432 instead of 5432.

## Step 3: Clone and Configure Application

```bash
# Switch to application user
sudo su - scalpingbot

# Clone repository
git clone <your-repo-url> /home/scalpingbot/app
cd /home/scalpingbot/app
```

### Step 3.1: Install Dependencies

```bash
# Root dependencies
pnpm install

# UI dependencies
cd ui && pnpm install && cd ..

# Server dependencies
cd server && pnpm install && cd ..

# Python dependencies
cd trading-engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..
```

### Step 3.2: Configure Environment Variables

Copy and configure environment files:

```bash
# Copy templates
cp deployment/env.template server/.env
cp deployment/env.template ui/.env.production

# Edit configuration
nano server/.env
nano ui/.env.production
```

**Required variables in `server/.env`**:
- `DATABASE_URL`: PostgreSQL connection (via PgBouncer: port 6432)
- `PGDIRECT_URL`: Direct PostgreSQL connection (port 5432) for migrations
- `FIREBASE_PROJECT_ID`: Your Firebase project ID
- `FIREBASE_PRIVATE_KEY`: Firebase Admin SDK private key
- `FIREBASE_CLIENT_EMAIL`: Firebase Admin SDK client email
- `TRADING_ENGINE_API_KEY`: Secure API key for trading engines

**Required variables in `ui/.env.production`**:
- `VITE_API_URL`: Your domain URL (e.g., `https://yourdomain.com/api`)

### Step 3.3: Validate Environment

```bash
bash deployment/validate-env.sh
```

This checks all required environment variables are set correctly.

## Step 4: Database Migration

```bash
cd server
pnpm db:push
```

Or use the migration script with backup:

```bash
bash deployment/migrate-database.sh
```

## Step 5: Build Frontend

```bash
cd ui
pnpm build
cd ..
```

This creates the production build in `ui/dist/`.

## Step 6: Configure Nginx

```bash
# Copy Nginx configuration
sudo cp deployment/nginx.conf /etc/nginx/sites-available/scalpingbot
sudo ln -s /etc/nginx/sites-available/scalpingbot /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Edit configuration with your domain
sudo nano /etc/nginx/sites-available/scalpingbot
```

Replace `yourdomain.com` with your actual domain name.

```bash
# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx
```

## Step 7: Setup SSL

```bash
sudo certbot --nginx -d yourdomain.com
```

Certbot will automatically configure SSL and set up auto-renewal.

## Step 8: Start Services with PM2

```bash
cd /home/scalpingbot/app
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable PM2 on boot
```

This starts:
- Backend API
- MT5 API Service
- Trading Engine Manager (which will manage trading engine instances)

## Step 9: Verify Deployment

### Check PM2 Status

```bash
pm2 status
```

You should see:
- `backend`: online
- `mt5-api`: online
- `trading-engine-manager`: online

### Check Health Endpoint

```bash
curl http://localhost:5500/api/v1/health
```

### Check Trading Engine Manager

The trading engine manager will automatically:
- Query database for active users
- Spawn trading engine processes for users with active MT5 accounts
- Monitor and restart failed processes

View manager logs:

```bash
pm2 logs trading-engine-manager
```

## User Management

### Adding a User

1. User signs up via the frontend (Firebase Auth)
2. User adds their MT5 account via the UI
3. Trading Engine Manager automatically detects the new active user
4. A trading engine process is spawned within 60 seconds

### Manually Adding a Trading Engine

If you need to manually start a trading engine for a user:

```bash
bash deployment/add-user-trading-engine.sh <user_id> [mt5_account_id]
```

### Removing a User

1. Deactivate the user's MT5 account in the UI
2. Trading Engine Manager automatically stops the trading engine within 60 seconds

Or manually:

```bash
bash deployment/remove-user-trading-engine.sh <user_id>
```

## Monitoring

### PM2 Monitoring

```bash
# View status
pm2 status

# View logs
pm2 logs

# Monitor resources
pm2 monit

# View specific process
pm2 logs trading-engine-manager
pm2 logs backend
```

### Health Monitoring Script

```bash
bash deployment/pm2-monitor.sh
```

This displays:
- PM2 process status
- System resources (CPU, memory, disk)
- Recent logs
- Health check status

### Trading Engine Health Monitor

Run the health monitor (optional, can be added to PM2):

```bash
node deployment/trading-engine-monitor.js
```

This monitors:
- Trading engine process health
- System component status
- Generates status reports

### Health Check API

Access the comprehensive health check:

```bash
curl https://yourdomain.com/api/v1/health
```

Returns JSON with:
- Database connectivity
- MT5 API status
- Trading engine counts
- System resources
- Component status

## Deployment Updates

When deploying updates:

```bash
bash deployment/deploy.sh
```

This script:
- Pulls latest changes
- Installs/updates dependencies
- Builds frontend
- Runs database migrations
- Restarts base services
- Trading Engine Manager handles trading engine updates automatically

## Troubleshooting

### Trading Engine Not Starting

1. Check manager logs: `pm2 logs trading-engine-manager`
2. Check user has active MT5 account in database
3. Verify environment variables are set correctly
4. Check trading engine logs: `pm2 logs trading-engine-<user-id>`

### Database Connection Issues

1. Verify PgBouncer is running: `sudo systemctl status pgbouncer`
2. Check connection string uses correct port (6432 for PgBouncer)
3. Test direct connection: `psql $PGDIRECT_URL`
4. Check PgBouncer logs: `sudo journalctl -u pgbouncer -n 50`

### High Memory Usage

1. Check system resources: `bash deployment/pm2-monitor.sh`
2. Review trading engine memory limits in `ecosystem.config.js`
3. Consider reducing number of concurrent users
4. Check for memory leaks in logs

### Process Not Restarting

1. Check PM2 restart settings in `ecosystem.config.js`
2. Review process logs for errors
3. Verify min_uptime and max_restarts settings
4. Check system resources (may be OOM killing processes)

## Scaling Considerations

### Current Limits

- **Recommended**: 20-30 concurrent users per VPS
- **Maximum**: Depends on VPS resources (RAM, CPU)
- **Per Trading Engine**: ~200-500MB RAM, ~5-10% CPU

### Scaling Strategies

1. **Vertical Scaling**: Upgrade VPS resources (RAM, CPU)
2. **Horizontal Scaling**: Deploy to multiple VPS instances
3. **Connection Pooling**: Already implemented via PgBouncer
4. **Process Optimization**: Tune trading engine resource limits

### Resource Planning

For N users:
- RAM: 2GB base + (N × 300MB) for trading engines
- CPU: 2 cores base + (N × 0.1 cores) for trading engines
- Database connections: 25 shared via PgBouncer

Example: 10 users = ~5GB RAM, ~3 CPU cores

## Security Best Practices

1. **API Keys**: Use strong, unique API keys for `TRADING_ENGINE_API_KEY`
2. **Firewall**: Only expose ports 80, 443, 22
3. **SSL**: Always use HTTPS (Let's Encrypt)
4. **Internal Endpoints**: Blocked from external access via Nginx
5. **Rate Limiting**: Configured in Nginx and API middleware
6. **Environment Variables**: Never commit `.env` files to git
7. **Database**: Use strong passwords, limit connections

## Backup Strategy

### Database Backups

```bash
# Manual backup
bash deployment/migrate-database.sh  # Includes backup

# Automated backups (add to crontab)
0 2 * * * /home/scalpingbot/app/deployment/migrate-database.sh
```

### Application Backups

```bash
# Backup application directory
tar -czf app_backup_$(date +%Y%m%d).tar.gz /home/scalpingbot/app
```

## Maintenance

### Regular Tasks

1. **Weekly**: Review PM2 logs for errors
2. **Monthly**: Check disk space and clean old logs
3. **Quarterly**: Review and update dependencies
4. **As needed**: Update trading engine configurations

### Log Management

PM2 logs are stored in `~/.pm2/logs/`. Consider log rotation:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## Support

For issues:
1. Check PM2 logs: `pm2 logs`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/scalpingbot-error.log`
3. Check health endpoint: `curl http://localhost:5500/api/v1/health`
4. Review this guide's troubleshooting section

## Next Steps

1. Monitor system health regularly
2. Set up alerting for critical failures
3. Configure automated backups
4. Review and optimize resource limits
5. Plan for scaling as user base grows


