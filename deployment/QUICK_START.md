# Quick Start Guide - VPS Deployment

This is a condensed guide for deploying to VPS with multi-user support. For detailed instructions, see [VPS_DEPLOYMENT.md](./VPS_DEPLOYMENT.md) or [MULTI_USER_DEPLOYMENT.md](./MULTI_USER_DEPLOYMENT.md).

## Prerequisites Checklist

- [ ] VPS with Ubuntu 22.04+ or Debian 11+
- [ ] Root/sudo access
- [ ] Domain name (for SSL)
- [ ] Firebase project configured
- [ ] PostgreSQL database (Supabase or local)
- [ ] At least 4GB RAM (for multiple users)

## Quick Deployment Steps

### 1. Initial VPS Setup

```bash
# Run as root
sudo bash deployment/setup-vps.sh
```

### 2. Clone Repository

```bash
sudo su - scalpingbot
git clone <your-repo-url> /home/scalpingbot/app
cd /home/scalpingbot/app
```

### 3. Setup Database (if using local PostgreSQL)

```bash
# Option A: Local PostgreSQL
sudo bash deployment/setup-postgresql.sh

# Option B: Use Supabase (skip this step)
```

### 4. Setup PgBouncer (Recommended for Multi-User)

PgBouncer provides connection pooling essential for multiple trading engine instances:

```bash
sudo bash deployment/setup-pgbouncer.sh
```

**Important**: After setup, use PgBouncer port (6432) in `DATABASE_URL`.

### 5. Configure Environment Variables

```bash
# Copy templates
cp deployment/env.template server/.env
cp deployment/env.template ui/.env.production

# Edit and fill in values
nano server/.env
nano ui/.env.production
```

**Required values in `server/.env`:**
- `DATABASE_URL` - PostgreSQL via PgBouncer (port 6432) or Supabase
- `PGDIRECT_URL` - Direct PostgreSQL (port 5432) for migrations
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_PRIVATE_KEY` - Firebase Admin SDK private key
- `FIREBASE_CLIENT_EMAIL` - Firebase Admin SDK client email
- `TRADING_ENGINE_API_KEY` - Secure API key for trading engines

**Required values in `ui/.env.production`:**
- `VITE_API_URL` - Your domain URL (e.g., `https://yourdomain.com/api`)

**Validate configuration:**
```bash
bash deployment/validate-env.sh
```

### 6. Install Dependencies & Build

```bash
cd /home/scalpingbot/app

# Install all dependencies
pnpm install
cd ui && pnpm install && pnpm build && cd ..
cd server && pnpm install && cd ..
cd trading-engine && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt && deactivate && cd ..
```

### 7. Setup Database Schema

```bash
# Run migrations (with backup)
bash deployment/migrate-database.sh

# Or direct migration
cd server && pnpm db:push && cd ..
```

### 8. Configure Nginx

```bash
# Edit nginx config with your domain
sudo nano /etc/nginx/sites-available/scalpingbot

# Copy from deployment/nginx.conf and replace:
# - yourdomain.com with your actual domain
# - Update paths if different

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 9. Setup SSL

```bash
sudo certbot --nginx -d yourdomain.com
```

### 10. Start Services with PM2

```bash
cd /home/scalpingbot/app
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions
```

This starts:
- Backend API
- MT5 API Service
- Trading Engine Manager (manages trading engine instances dynamically)

### 11. Verify Deployment

```bash
# Check PM2 status
pm2 status

# Should see: backend, mt5-api, trading-engine-manager

# Check logs
pm2 logs

# Test endpoints
curl http://localhost:5500/api/v1/hello
curl http://localhost:5500/api/v1/health
curl http://localhost:5001/health

# Check trading engine manager
pm2 logs trading-engine-manager
```

**Note**: Trading engine instances are created automatically by the manager when users have active MT5 accounts. They appear in `pm2 status` as `trading-engine-<user-id>-<account-id>`.

## Common Commands

### Update Application

```bash
cd /home/scalpingbot/app
bash deployment/deploy.sh
```

### PM2 Management

```bash
pm2 status              # View status
pm2 logs                 # View logs
pm2 restart backend      # Restart specific service
pm2 restart mt5-api      # Restart MT5 API
pm2 restart trading-engine-manager  # Restart manager
pm2 monit                # Monitor resources

# Note: Trading engine instances are managed by trading-engine-manager
# They will restart automatically if they fail
```

### Trading Engine Management

```bash
# View all trading engines
pm2 list | grep trading-engine

# View specific trading engine logs
pm2 logs trading-engine-<user-id>

# Manual user management (if needed)
bash deployment/add-user-trading-engine.sh <user_id> [mt5_account_id]
bash deployment/remove-user-trading-engine.sh <user_id>
```

### Monitoring

```bash
# Comprehensive monitoring dashboard
bash deployment/pm2-monitor.sh

# Health check API
curl http://localhost:5500/api/v1/health
```

### Nginx Management

```bash
sudo nginx -t            # Test config
sudo systemctl reload nginx
sudo systemctl status nginx
```

### View Logs

```bash
# PM2 logs
pm2 logs

# Nginx logs
sudo tail -f /var/log/nginx/scalpingbot-error.log
sudo tail -f /var/log/nginx/scalpingbot-access.log

# System logs
sudo journalctl -u scalpingbot-backend -f
```

## Troubleshooting

### Service won't start
```bash
pm2 logs <service-name>
pm2 env <service-name>  # Check environment variables
```

### Database connection error
```bash
cd server
pnpm db:push  # Test connection
```

### Nginx 502 Bad Gateway
```bash
# Check if backend is running
pm2 status
curl http://localhost:5500/api/v1/hello

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log
```

### SSL certificate issues
```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

## File Locations

- Application: `/home/scalpingbot/app`
- PM2 logs: `~/.pm2/logs/`
- Nginx config: `/etc/nginx/sites-available/scalpingbot`
- Environment files: `server/.env`, `ui/.env.production`, `trading-engine/.env`

## Multi-User Features

The deployment automatically supports multiple users:

1. **Automatic Process Management**: Trading Engine Manager spawns/stops processes for active users
2. **Connection Pooling**: PgBouncer manages database connections efficiently
3. **Health Monitoring**: Comprehensive health checks and monitoring scripts
4. **User Isolation**: Each user has their own trading engine instance

**How it works:**
- User signs up and adds MT5 account via UI
- Trading Engine Manager detects active user (polls every 60 seconds)
- Trading engine process is automatically spawned
- Process is monitored and restarted if it fails
- When user deactivates account, process is stopped

## Next Steps

1. Update Firebase authorized domains
2. Configure backups (see `deployment/migrate-database.sh`)
3. Review monitoring: `bash deployment/pm2-monitor.sh`
4. Read [MULTI_USER_DEPLOYMENT.md](./MULTI_USER_DEPLOYMENT.md) for detailed guide
5. Review security checklist in main deployment guide

