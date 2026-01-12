# MT5 Integration Setup Guide

## Overview

Your application now has **real MT5 integration** through a Python API bridge. This guide explains how to set it up and test it.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   React UI      │  HTTP   │   Node.js API    │  HTTP   │  Python MT5 API │
│   (Frontend)    │ ───────>│   (Hono Server)  │ ───────>│   (Flask)       │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                                                    │
                                                                    │ MetaTrader5
                                                                    │ Python Library
                                                                    ▼
                                                           ┌─────────────────┐
                                                           │  MetaTrader 5   │
                                                           │    Terminal     │
                                                           └─────────────────┘
```

## Prerequisites

1. ✅ **MetaTrader 5** installed on your machine
   - Download from: https://www.metatrader5.com/
   - After installation, note the path (usually: `C:\Program Files\MetaTrader 5\terminal64.exe`)

2. ✅ **Python 3.8+** installed
   - Check: `python --version`
   - Download from: https://www.python.org/downloads/

3. ✅ **Valid MT5 account credentials**
   - Account Number: e.g., 10008463761
   - Password: your MT5 password
   - Server: e.g., MetaQuotes-Demo

## Setup Steps

### Step 1: Install Python Dependencies

```bash
cd trading-engine
pip install -r requirements.txt
```

This installs:
- `MetaTrader5` - Python library for MT5 integration
- `flask` - Web framework for the API
- `flask-cors` - CORS support for Node.js calls
- Other dependencies

### Step 2: Start the MT5 API Service

**Option A: Using the batch script (Windows)**
```bash
cd trading-engine
run_mt5_api.bat
```

**Option B: Manual start**
```bash
cd trading-engine
python mt5_api.py
```

The service will start on `http://127.0.0.1:5001`

You should see:
```
Starting MT5 API service on 127.0.0.1:5001
Health check: http://127.0.0.1:5001/health
Test endpoint: http://127.0.0.1:5001/mt5/test-connection
```

### Step 3: Configure Node.js Server

Add to your `server/.env` file:

```bash
# MT5 API Configuration
MT5_API_URL=http://127.0.0.1:5001

# Optional: Custom MT5 terminal path (if MT5 is installed in a non-standard location)
# MT5_TERMINAL_PATH=C:/Program Files/MetaTrader 5/terminal64.exe
```

### Step 4: Restart Your Development Server

```bash
# Stop current server (Ctrl+C)
pnpm dev
```

## Testing the Integration

### Test 1: Health Check

Open in browser or run:
```bash
curl http://127.0.0.1:5001/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "mt5-api",
  "version": "1.0.0"
}
```

### Test 2: MT5 Connection via API

```bash
curl -X POST http://127.0.0.1:5001/mt5/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "account_number": "10008463761",
    "password": "your_password",
    "server": "MetaQuotes-Demo"
  }'
```

Expected success response:
```json
{
  "connected": true,
  "account_info": {
    "equity": 10000.0,
    "balance": 10000.0,
    "margin": 0.0,
    "free_margin": 10000.0,
    "margin_level": 0.0,
    "currency": "USD"
  }
}
```

### Test 3: Full Integration via UI

1. Navigate to your app's MT5 setup page
2. Enter your MT5 credentials:
   - Account Number: 10008463761
   - Password: (your password)
   - Server: MetaQuotes-Demo
3. Click **"Test Connection"**
4. You should see: ✅ Connection successful with account details

## API Endpoints

The Python MT5 API service provides these endpoints:

### `GET /health`
Health check endpoint

### `POST /mt5/test-connection`
Test MT5 connection with credentials
```json
{
  "account_number": "10008463761",
  "password": "your_password",
  "server": "MetaQuotes-Demo",
  "path": "C:/Program Files/MetaTrader 5/terminal64.exe" // optional
}
```

### `POST /mt5/connect`
Establish persistent MT5 connection (for live trading)

### `POST /mt5/disconnect`
Disconnect from MT5

### `GET /mt5/status`
Check current MT5 connection status

## Troubleshooting

### Error: "MT5 API service is not running"

**Solution:** Start the MT5 API service
```bash
cd trading-engine
run_mt5_api.bat
```

### Error: "MT5 initialization failed"

**Possible causes:**
1. MetaTrader 5 terminal is not installed
2. MT5 is installed in a non-standard location

**Solution:**
1. Install MT5 from: https://www.metatrader5.com/
2. If installed in custom location, add to `server/.env`:
   ```
   MT5_TERMINAL_PATH=C:/Your/Custom/Path/terminal64.exe
   ```

### Error: "MT5 login failed"

**Possible causes:**
1. Incorrect account credentials
2. Wrong server name
3. Account is disabled

**Solution:**
1. Verify credentials in your MT5 terminal
2. Ensure server name is exactly as shown in MT5 terminal
3. Try logging into MT5 terminal manually to verify account is active

### Error: "Connection test timed out"

**Possible causes:**
1. Network issues
2. MT5 server is slow or down
3. Firewall blocking connection

**Solution:**
1. Check your internet connection
2. Verify MT5 server status
3. Check firewall settings

## Running in Production

For production deployment:

1. **Separate Server:** Deploy the Python MT5 API on a dedicated server or container
2. **Environment Variables:** Set proper environment variables:
   ```bash
   MT5_API_PORT=5001
   MT5_API_HOST=0.0.0.0  # To accept external connections
   ```
3. **Security:** Add authentication to the MT5 API endpoints
4. **Process Management:** Use PM2 or systemd to keep the service running
5. **Monitoring:** Set up health checks and alerts

## Files Created/Modified

### New Files
- `trading-engine/mt5_api.py` - Python Flask API service
- `trading-engine/run_mt5_api.bat` - Windows startup script
- `docs/MT5_INTEGRATION_GUIDE.md` - This guide

### Modified Files
- `server/src/lib/mt5-connector.ts` - Now calls Python API instead of mock
- `trading-engine/requirements.txt` - Added Flask dependencies

## Next Steps

1. ✅ Database tables created
2. ✅ Encryption key configured
3. ✅ MT5 API service created
4. ⏳ Start MT5 API service
5. ⏳ Test MT5 connection via UI
6. 🎉 Ready for live trading configuration

---

**Need help?** Check the logs:
- Python MT5 API logs: Terminal running `run_mt5_api.bat`
- Node.js server logs: Terminal running `pnpm dev`
- Trading engine logs: `trading-engine/logs/`





