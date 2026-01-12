# MT5 API Service Setup Guide

## Overview

The MT5 integration requires **three services** to run simultaneously:

1. **Frontend (React/Vite)** - Port 5501
2. **Backend (Node.js/Hono)** - Port 5500  
3. **MT5 API Service (Python/Flask)** - Port 5001 ⚠️ **Must be started manually**

## Why is the MT5 API Service Needed?

The Node.js backend cannot directly communicate with MetaTrader 5 because MT5 only has a Python API (`MetaTrader5` package). Therefore, we have a Python Flask service that acts as a bridge:

```
Frontend → Backend (Node.js) → MT5 API Service (Python) → MetaTrader 5
```

## Starting the MT5 API Service

### Quick Start

1. **Open a new terminal** (separate from your main dev terminal)
2. **Navigate to the trading-engine folder:**
   ```bash
   cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot\trading-engine
   ```
3. **Run the service:**
   ```bash
   run_mt5_api.bat
   ```
   
   OR directly with Python:
   ```bash
   python mt5_api.py
   ```

### Expected Output

When the service starts successfully, you should see:

```
Starting MT5 API service on 127.0.0.1:5001
Health check: http://127.0.0.1:5001/health
Test endpoint: http://127.0.0.1:5001/mt5/test-connection
 * Running on http://127.0.0.1:5001
```

### Verify the Service is Running

Open a browser and visit: [http://127.0.0.1:5001/health](http://127.0.0.1:5001/health)

You should see:
```json
{
  "status": "healthy",
  "service": "mt5-api",
  "version": "1.0.0"
}
```

## Troubleshooting

### Error: "MT5 API service is not running"

**Symptom:** When testing MT5 connection in the UI, you see "Failed to create MT5 account" or "MT5 API service is not running"

**Solution:** The Python service isn't running. Follow the "Starting the MT5 API Service" steps above.

### Error: "Port 5001 already in use"

**Solution:** 
1. Kill the existing process using port 5001
2. Or change the port by setting the environment variable:
   ```bash
   set MT5_API_PORT=5002
   python mt5_api.py
   ```
   
   Then update `server/.env` to add:
   ```
   MT5_API_URL=http://127.0.0.1:5002
   ```

### Error: "ModuleNotFoundError: No module named 'flask'"

**Solution:** Install the dependencies:
```bash
cd trading-engine
pip install -r requirements.txt
```

### Error: "ModuleNotFoundError: No module named 'MetaTrader5'"

**Solution:** Install MetaTrader5 Python package:
```bash
pip install MetaTrader5
```

### Python Virtual Environment Issues

If you're having issues with the virtual environment:

1. **Delete the existing venv:**
   ```bash
   cd trading-engine
   rmdir /s venv
   ```

2. **Create a new virtual environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate it:**
   ```bash
   venv\Scripts\activate
   ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Run the service:**
   ```bash
   python mt5_api.py
   ```

## Development Workflow

### Full Development Setup

You need **TWO terminal windows**:

**Terminal 1 - Main Dev Server:**
```bash
cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot
pnpm dev
```
This starts:
- Frontend (port 5501)
- Backend (port 5500)
- Database (port 5502)
- Firebase Emulator (port 5503)

**Terminal 2 - MT5 API Service:**
```bash
cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot\trading-engine
run_mt5_api.bat
```
This starts:
- MT5 API Service (port 5001)

### Stopping Services

- **Terminal 1:** Press `Ctrl+C` to stop all services
- **Terminal 2:** Press `Ctrl+C` to stop MT5 API service

## Configuration

### Environment Variables

The MT5 API service can be configured with these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MT5_API_PORT` | `5001` | Port for the MT5 API service |
| `MT5_API_HOST` | `127.0.0.1` | Host for the MT5 API service |
| `DEBUG` | `false` | Enable Flask debug mode |

### Backend Configuration

The Node.js backend needs to know where to find the MT5 API service. This is configured in `server/.env`:

```env
MT5_API_URL=http://127.0.0.1:5001
```

If you change the MT5 API port, make sure to update this URL as well.

## API Endpoints

The MT5 API service provides these endpoints:

### Health Check
```
GET /health
```
Returns service status

### Test Connection
```
POST /mt5/test-connection
Content-Type: application/json

{
  "account_number": "10008463761",
  "password": "your_password",
  "server": "MetaQuotes-Demo"
}
```
Tests MT5 credentials and returns account info

### Connect (Persistent)
```
POST /mt5/connect
```
Establishes a persistent MT5 connection

### Disconnect
```
POST /mt5/disconnect
```
Disconnects from MT5

### Status
```
GET /mt5/status
```
Returns current connection status

## Next Steps

After starting the MT5 API service:

1. ✅ Ensure all three services are running (Frontend, Backend, MT5 API)
2. ✅ Visit the app: http://localhost:5501
3. ✅ Navigate to Settings → MT5 Connection
4. ✅ Enter your MT5 credentials
5. ✅ Click "Test Connection"

The connection should now work! 🎉

## Additional Notes

- The MT5 API service must be running **before** you test MT5 connections
- Keep the MT5 API service terminal open while developing
- If you're using a real MT5 account, ensure MT5 terminal is installed on your machine
- For demo accounts, the MT5 terminal doesn't need to be running





