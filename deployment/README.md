# Deployment Files

This directory contains all files needed to deploy the Scalping Bot application to a VPS.

## Files Overview

### Documentation
- **[VPS_DEPLOYMENT.md](../docs/VPS_DEPLOYMENT.md)** - Complete step-by-step deployment guide
- **[QUICK_START.md](./QUICK_START.md)** - Quick reference for experienced users

### Configuration Files
- **[ecosystem.config.js](../ecosystem.config.js)** - PM2 process manager configuration
- **[nginx.conf](./nginx.conf)** - Nginx reverse proxy configuration
- **[env.template](./env.template)** - Environment variable templates

### Scripts
- **[setup-vps.sh](./setup-vps.sh)** - Initial VPS setup script (run as root)
- **[deploy.sh](./deploy.sh)** - Application deployment script (run as scalpingbot user)

### Systemd Services (Alternative to PM2)
- **[systemd/frontend.service](./systemd/frontend.service)** - Frontend service
- **[systemd/backend.service](./systemd/backend.service)** - Backend API service
- **[systemd/mt5-api.service](./systemd/mt5-api.service)** - MT5 API service
- **[systemd/trading-engine.service](./systemd/trading-engine.service)** - Trading engine service

## Quick Start

1. **Read the guide**: Start with [QUICK_START.md](./QUICK_START.md) for a condensed version
2. **Full guide**: See [VPS_DEPLOYMENT.md](../docs/VPS_DEPLOYMENT.md) for detailed instructions
3. **Run setup**: Execute `setup-vps.sh` on your VPS
4. **Deploy**: Use `deploy.sh` for updates

## Architecture

```
Internet
  ↓
Nginx (Port 80/443)
  ├─→ Static Files (ui/dist)
  └─→ API Proxy → Backend (Port 5500)
                    └─→ MT5 API (Port 5001)
                    └─→ Trading Engine
```

## Services

1. **Frontend** - React app served as static files by Nginx
2. **Backend** - Node.js/Hono API server (Port 5500)
3. **MT5 API** - Python Flask service (Port 5001, internal only)
4. **Trading Engine** - Python trading bot

## Process Management

### PM2 (Recommended)
- Configuration: `ecosystem.config.js`
- Start: `pm2 start ecosystem.config.js`
- Monitor: `pm2 monit`

### Systemd (Alternative)
- Service files in `systemd/` directory
- Install: `sudo cp systemd/*.service /etc/systemd/system/`
- Enable: `sudo systemctl enable scalpingbot-backend`

## Environment Variables

Copy `env.template` to create your environment files:

- `server/.env` - Backend configuration
- `ui/.env.production` - Frontend configuration
- `trading-engine/.env` - Trading engine configuration

See `env.template` for all required variables.

## Security Notes

- Never commit `.env` files to git
- Use strong database passwords
- Keep SSL certificates updated
- Configure firewall (UFW)
- Regularly update system packages
- Use SSH keys instead of passwords

## Support

For issues:
1. Check PM2 logs: `pm2 logs`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Review [VPS_DEPLOYMENT.md](../docs/VPS_DEPLOYMENT.md) troubleshooting section

