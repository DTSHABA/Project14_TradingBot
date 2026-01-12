# Hostinger VPS Deployment Guide

This guide provides step-by-step instructions for deploying your Scalping Bot application on Hostinger VPS.

## Hostinger-Specific Considerations

- **Control Panel**: Hostinger uses hPanel for DNS and domain management
- **OS**: Typically Ubuntu 22.04 LTS or Debian 11+
- **Access**: SSH access via root or sudo user
- **Firewall**: May have Hostinger's firewall enabled (check hPanel)
- **DNS**: Manage DNS records through hPanel or directly on VPS
- **IP Address**: Static IP provided with VPS

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] Hostinger VPS activated (Ubuntu 22.04+ recommended)
- [ ] SSH access to your VPS (root or sudo user)
- [ ] Domain name pointed to your VPS IP (via hPanel DNS)
- [ ] Firebase project configured
- [ ] Database ready (Supabase recommended, or local PostgreSQL)
- [ ] At least 4GB RAM VPS (for multi-user support)
- [ ] Git repository URL (or access to clone your code)

## Step 1: Access Your Hostinger VPS

### 1.1 Get SSH Credentials

1. Log in to **hPanel** (https://hpanel.hostinger.com)
2. Go to **VPS** → Select your VPS
3. Find **SSH Access** section
4. Note your:
   - IP Address
   - Root password (or create SSH key)
   - SSH Port (usually 22)

### 1.2 Connect via SSH

**Windows (PowerShell/CMD):**
```bash
ssh root@your-vps-ip
```

**Windows (using PuTTY):**
- Host: your-vps-ip
- Port: 22
- Username: root
- Password: (from hPanel)

**Mac/Linux:**
```bash
ssh root@your-vps-ip
```

## Step 2: Initial VPS Setup

### 2.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Run Automated Setup Script

The setup script will install all required software:

```bash
# Download or clone your repository first, then:
cd /root  # or your home directory
git clone <your-repo-url> temp-setup
cd temp-setup

# Run setup script as root
sudo bash deployment/setup-vps.sh
```

**OR manually install:**

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

# Install PgBouncer (recommended for multi-user)
sudo apt install -y pgbouncer

# Install Nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Install build essentials
sudo apt install -y build-essential

# Create application user
sudo adduser --disabled-password --gecos "" scalpingbot
sudo usermod -aG sudo scalpingbot
```

### 2.3 Configure Hostinger Firewall

**Option A: Via hPanel**
1. Go to hPanel → VPS → Firewall
2. Allow ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)

**Option B: Via Command Line**
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

## Step 3: Configure DNS (via hPanel)

### 3.1 Point Domain to VPS

1. Log in to **hPanel**
2. Go to **Domains** → Select your domain
3. Go to **DNS Zone Editor**
4. Add/Update A record:
   - **Type**: A
   - **Name**: @ (or leave blank for root domain)
   - **Value**: Your VPS IP address
   - **TTL**: 3600 (or default)

5. (Optional) Add www subdomain:
   - **Type**: A
   - **Name**: www
   - **Value**: Your VPS IP address
   - **TTL**: 3600

6. Wait for DNS propagation (5-60 minutes)

### 3.2 Verify DNS

```bash
# Check if DNS is pointing correctly
dig yourdomain.com
nslookup yourdomain.com
```

## Step 4: Clone and Setup Repository

### 4.1 Clone Repository

```bash
# Switch to application user
sudo su - scalpingbot

# Clone your repository
git clone <your-repo-url> /home/scalpingbot/app
cd /home/scalpingbot/app
```

### 4.2 Install Dependencies

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

## Step 5: Database Setup

### Option A: Use Supabase (Recommended)

1. Create Supabase project at https://supabase.com
2. Get connection string from Supabase dashboard
3. Use this in your `.env` file (see Step 6)

### Option B: Local PostgreSQL

```bash
# Run PostgreSQL setup script
sudo bash /home/scalpingbot/app/deployment/setup-postgresql.sh
```

**OR manually:**

```bash
sudo -u postgres psql
CREATE DATABASE scalpingbot;
CREATE USER scalpingbot WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE scalpingbot TO scalpingbot;
\q
```

### 5.1 Setup PgBouncer (Recommended for Multi-User)

PgBouncer provides connection pooling essential for multiple trading engine instances:

```bash
sudo bash /home/scalpingbot/app/deployment/setup-pgbouncer.sh
```

**Important**: After setup, use PgBouncer port (6432) in `DATABASE_URL`.

## Step 6: Configure Environment Variables

### 6.1 Backend Environment Variables

```bash
# Switch to application user
sudo su - scalpingbot
cd /home/scalpingbot/app

# Copy template
cp deployment/env.template server/.env

# Edit environment file
nano server/.env
```

**Required values in `server/.env`:**

```bash
# Database Configuration
# Use PgBouncer connection string (port 6432) for connection pooling
DATABASE_URL=postgresql://scalpingbot:your-password@localhost:6432/scalpingbot
# Direct PostgreSQL connection (for migrations only)
PGDIRECT_URL=postgresql://scalpingbot:your-password@localhost:5432/scalpingbot

# OR if using Supabase:
# DATABASE_URL=postgresql://user:password@db.supabase.co:5432/scalpingbot
# PGDIRECT_URL=postgresql://user:password@db.supabase.co:5432/scalpingbot

# Firebase Admin SDK Configuration
# Get from Firebase Console > Project Settings > Service Accounts
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

# Server Configuration
PORT=5500
NODE_ENV=production

# MT5 API Service URL (internal)
MT5_API_URL=http://localhost:5001

# Trading Engine API Configuration
# Generate a secure random key
TRADING_ENGINE_API_KEY=your-secure-api-key-here-change-this-in-production
TRADING_ENGINE_API_URL=http://localhost:5500
```

**Generate secure API key:**
```bash
openssl rand -base64 32
```

### 6.2 Frontend Environment Variables

```bash
# Still as scalpingbot user
nano ui/.env.production
```

**Required values:**

```bash
# API URL - Use your domain
VITE_API_URL=https://yourdomain.com/api

# Firebase Emulator (should be false in production)
VITE_USE_FIREBASE_EMULATOR=false
```

### 6.3 Trading Engine Environment Variables

```bash
nano trading-engine/.env
```

**Required values:**

```bash
# MT5 API Service Configuration
MT5_API_PORT=5001
MT5_API_HOST=127.0.0.1
DEBUG=false

# MT5 Terminal Path (if MT5 is installed on VPS)
MT5_TERMINAL_PATH=/opt/mt5/terminal64.exe

# Database Configuration (via PgBouncer)
DATABASE_URL=postgresql://scalpingbot:your-password@localhost:6432/scalpingbot
```

### 6.4 Validate Configuration

```bash
bash deployment/validate-env.sh
```

## Step 7: Build Application

### 7.1 Build Frontend

```bash
cd /home/scalpingbot/app/ui
pnpm build
```

This creates production build in `ui/dist/`.

### 7.2 Setup Database Schema

```bash
cd /home/scalpingbot/app

# Run migrations (with backup)
bash deployment/migrate-database.sh

# OR direct migration
cd server && pnpm db:push && cd ..
```

## Step 8: Configure Nginx

### 8.1 Copy Nginx Configuration

```bash
# As root or with sudo
sudo cp /home/scalpingbot/app/deployment/nginx.conf /etc/nginx/sites-available/scalpingbot
sudo ln -s /etc/nginx/sites-available/scalpingbot /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
```

### 8.2 Update Domain Name

```bash
sudo nano /etc/nginx/sites-available/scalpingbot
```

**Replace:**
- `yourdomain.com` → Your actual domain
- `www.yourdomain.com` → Your www subdomain (if using)

### 8.3 Test and Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Step 9: Setup SSL with Let's Encrypt

### 9.1 Obtain SSL Certificate

```bash
# For main domain
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow prompts:
# - Enter email for renewal notices
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

### 9.2 Test Auto-Renewal

```bash
sudo certbot renew --dry-run
```

Certbot automatically sets up renewal via cron.

## Step 10: Start Services with PM2

### 10.1 Start Services

```bash
# As scalpingbot user
sudo su - scalpingbot
cd /home/scalpingbot/app

# Start all services
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Enable PM2 on boot
pm2 startup
# Follow the instructions shown (usually run a sudo command)
```

### 10.2 Verify Services

```bash
# Check status
pm2 status

# Should see:
# - backend
# - mt5-api
# - trading-engine-manager

# Check logs
pm2 logs

# Test endpoints
curl http://localhost:5500/api/v1/health
curl http://localhost:5001/health
```

## Step 11: Update Firebase Configuration

### 11.1 Add Authorized Domain

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Authentication** → **Settings** → **Authorized domains**
4. Click **Add domain**
5. Add: `yourdomain.com`
6. Add: `www.yourdomain.com` (if using)

### 11.2 Update Frontend Firebase Config

If you have a production Firebase config file:

```bash
# Update ui/src/lib/firebase-config.json with production config
nano ui/src/lib/firebase-config.json
```

Then rebuild:
```bash
cd ui && pnpm build && cd ..
```

## Step 12: Verify Deployment

### 12.1 Check Services

```bash
pm2 status
pm2 logs
```

### 12.2 Test Public Access

```bash
# Test from your local machine
curl https://yourdomain.com/health
curl https://yourdomain.com/api/v1/health
```

### 12.3 Check Nginx Logs

```bash
sudo tail -f /var/log/nginx/scalpingbot-access.log
sudo tail -f /var/log/nginx/scalpingbot-error.log
```

## Step 13: Hostinger-Specific Optimizations

### 13.1 Check Resource Limits

Hostinger VPS may have resource limits. Monitor usage:

```bash
# Monitor resources
pm2 monit
htop

# Check PM2 monitoring script
bash deployment/pm2-monitor.sh
```

### 13.2 Configure Backups

**Database Backups:**

```bash
# For local PostgreSQL
sudo -u postgres pg_dump scalpingbot > /home/scalpingbot/backups/db_$(date +%Y%m%d).sql

# For Supabase - use Supabase dashboard or API
```

**Application Backups:**

```bash
# Backup application directory
tar -czf /home/scalpingbot/backups/app_$(date +%Y%m%d).tar.gz /home/scalpingbot/app
```

**Automated Backups (Cron):**

```bash
crontab -e
# Add daily backup at 2 AM
0 2 * * * /path/to/backup-script.sh
```

## Common Hostinger-Specific Issues

### Issue 1: DNS Not Propagating

**Solution:**
- Wait 5-60 minutes for DNS propagation
- Check DNS in hPanel → DNS Zone Editor
- Verify A record points to correct IP
- Use `dig yourdomain.com` to check DNS

### Issue 2: Port 80/443 Blocked

**Solution:**
- Check Hostinger firewall in hPanel
- Verify UFW firewall: `sudo ufw status`
- Allow ports: `sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`

### Issue 3: SSL Certificate Fails

**Solution:**
- Ensure DNS is pointing correctly
- Verify port 80 is accessible (for Let's Encrypt challenge)
- Check Nginx is running: `sudo systemctl status nginx`
- Try: `sudo certbot --nginx -d yourdomain.com --dry-run`

### Issue 4: Services Not Starting on Boot

**Solution:**
- Run `pm2 startup` and follow instructions
- Check PM2 save: `pm2 save`
- Verify systemd service if using: `sudo systemctl status pm2-scalpingbot`

### Issue 5: Low Memory Issues

**Solution:**
- Monitor with `pm2 monit` and `htop`
- Upgrade VPS plan if needed
- Optimize PM2 memory limits in `ecosystem.config.js`
- Consider using Supabase instead of local PostgreSQL

## Maintenance Commands

### Update Application

```bash
cd /home/scalpingbot/app
bash deployment/deploy.sh
```

### Restart Services

```bash
pm2 restart all
# Or individually:
pm2 restart backend
pm2 restart mt5-api
pm2 restart trading-engine-manager
```

### View Logs

```bash
pm2 logs                    # All services
pm2 logs backend            # Backend only
pm2 logs trading-engine-manager  # Trading engine manager
sudo tail -f /var/log/nginx/scalpingbot-error.log  # Nginx errors
```

### Monitor Resources

```bash
pm2 monit                   # Real-time monitoring
bash deployment/pm2-monitor.sh  # Comprehensive monitoring
htop                        # System resources
```

## Security Checklist

- [ ] Firewall configured (UFW or Hostinger firewall)
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
- [ ] Internal API endpoints blocked from external access

## Support Resources

- **Hostinger Support**: https://www.hostinger.com/contact
- **hPanel**: https://hpanel.hostinger.com
- **PM2 Documentation**: https://pm2.keymetrics.io/
- **Nginx Documentation**: https://nginx.org/en/docs/

## Next Steps After Deployment

1. ✅ Test all features in production
2. ✅ Monitor logs for errors
3. ✅ Set up monitoring alerts
4. ✅ Configure automated backups
5. ✅ Review security checklist
6. ✅ Test trading engine with real MT5 account
7. ✅ Monitor resource usage and optimize

---

**Deployment Complete!** 🚀

Your application should now be accessible at `https://yourdomain.com`

For detailed troubleshooting, see [VPS_DEPLOYMENT.md](./VPS_DEPLOYMENT.md)

