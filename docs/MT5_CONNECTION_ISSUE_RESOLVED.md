# MT5 Connection Issue - Resolution Guide

## Issue Summary

**Problem:** "Failed to create MT5 account" error when testing MT5 connection

**Screenshot Analysis:** The error message displayed in red: "Failed to create MT5 account"

**Root Cause:** The MT5 API Python service is not running

## What Was Actually Happening

Despite the error message saying "Failed to create MT5 account", the account was **actually being created successfully** in the database. The real issue was the **connection test** failing because it couldn't reach the MT5 API service.

### The Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐      ┌──────────┐
│  Frontend   │─────▶│   Backend    │─────▶│  MT5 API Service│─────▶│   MT5    │
│   React     │      │   Node.js    │      │     Python      │      │Terminal  │
│  Port 5501  │      │  Port 5500   │      │   Port 5001     │      │          │
└─────────────┘      └──────────────┘      └─────────────────┘      └──────────┘
                                                     ❌
                                              NOT RUNNING!
```

The chain was breaking at the MT5 API Service, which is why the error occurred.

## Evidence from Logs

From terminal 5 logs (lines 167-187), we can see:

```
[server] --> POST /api/v1/protected/mt5/accounts 201 364ms
[server] --> POST /api/v1/protected/mt5/accounts/86b1d6bf-01d6-4986-a4d1-90646d2c4f7a/test 200 537ms
```

**201 status** = Account created successfully ✅  
**200 status** = Test endpoint was called ✅  

But the test is returning an error because the Python service at `http://127.0.0.1:5001` is not responding.

## The Solution

You need to start the MT5 API Python service in a **separate terminal** and **keep it running**.

### Step-by-Step Fix

#### 1. Open a New Terminal Window
   - Use a terminal **outside** of the IDE or open a new IDE terminal
   - This terminal must stay open while you're working with MT5 features

#### 2. Navigate to the trading-engine folder
   ```bash
   cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot\trading-engine
   ```

#### 3. Start the MT5 API Service

   **Method A - Using the batch file (Recommended):**
   ```bash
   run_mt5_api.bat
   ```

   **Method B - Direct Python:**
   ```bash
   python mt5_api.py
   ```

   **Method C - If using conda/anaconda:**
   ```bash
   conda activate base
   python mt5_api.py
   ```

#### 4. Verify It's Running

   You should see output like:
   ```
   Starting MT5 API service on 127.0.0.1:5001
   Health check: http://127.0.0.1:5001/health
   Test endpoint: http://127.0.0.1:5001/mt5/test-connection
   * Running on http://127.0.0.1:5001
   ```

   Or visit in your browser: http://127.0.0.1:5001/health

   Expected response:
   ```json
   {
     "status": "healthy",
     "service": "mt5-api",
     "version": "1.0.0"
   }
   ```

#### 5. Test MT5 Connection Again

   - Go back to your browser
   - Navigate to Settings → MT5 Connection
   - Enter your MT5 credentials:
     - **Account Number:** Your MT5 account number
     - **Password:** Your MT5 password  
     - **Server:** Your broker's server (e.g., "MetaQuotes-Demo")
   - Click **"Test Connection"**

   It should now work! ✅

## Why This Happens

The MT5 integration requires a Python service because:

1. **MetaTrader 5 only has a Python API** - There's no official Node.js library
2. **The MT5 Python package (`MetaTrader5`)** only works in Python
3. **We need a bridge** - The Python Flask service acts as a bridge between Node.js and MT5

This is a common pattern when integrating systems that only have APIs in specific languages.

## Development Workflow

Going forward, you'll need **TWO terminals** for full MT5 functionality:

### Terminal 1 - Main Development Server
```bash
cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot
pnpm dev
```

This starts:
- ✅ Frontend (React) - port 5501
- ✅ Backend (Node.js) - port 5500
- ✅ Database (PostgreSQL) - port 5502
- ✅ Firebase Emulator - port 5503

### Terminal 2 - MT5 API Service
```bash
cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot\trading-engine
run_mt5_api.bat
```

This starts:
- ✅ MT5 API Service (Python/Flask) - port 5001

**Both must be running** for MT5 features to work.

## Common Questions

### Q: Do I always need to run the MT5 API service?
**A:** Only if you're using MT5-related features (connecting accounts, live trading, testing connections). For other parts of the app, it's not needed.

### Q: Can I automate this to start with `pnpm dev`?
**A:** Theoretically yes, but it's tricky because it requires Python and a virtual environment. It's more reliable to run it separately.

### Q: What if port 5001 is already in use?
**A:** You can change the port:
1. Set environment variable: `set MT5_API_PORT=5002`
2. Update `server/.env`: `MT5_API_URL=http://127.0.0.1:5002`
3. Run: `python mt5_api.py`

### Q: Can I use a different Python version?
**A:** Yes, but you need Python 3.8 or higher. The MT5 Python package has specific requirements.

### Q: Do I need MT5 installed on my machine?
**A:** 
- **For demo accounts**: Not necessarily (depends on broker)
- **For real accounts**: Yes, MT5 terminal must be installed
- The Python package will look for MT5 in standard installation paths

## Troubleshooting

### Error: "ModuleNotFoundError: No module named 'flask'"
**Solution:**
```bash
cd trading-engine
pip install -r requirements.txt
```

### Error: "ModuleNotFoundError: No module named 'MetaTrader5'"
**Solution:**
```bash
pip install MetaTrader5
```

### Error: Port 5001 already in use
**Solution:**
```bash
# Find and kill the process using port 5001
netstat -ano | findstr :5001
taskkill /PID <PID> /F
```

### Service starts but health check fails
**Solution:**
1. Check firewall settings
2. Try accessing `http://127.0.0.1:5001/health` directly
3. Check the terminal for error messages

## Additional Resources

- 📄 [MT5 API Service Setup Guide](./MT5_API_SERVICE_SETUP.md) - Detailed setup instructions
- 📄 [MT5 Integration Guide](./MT5_INTEGRATION_GUIDE.md) - Overall MT5 integration documentation
- 📄 [Port Handling](./PORT_HANDLING.md) - Port management and conflicts

## Summary

✅ **The issue is resolved by starting the MT5 API service**  
✅ **The account creation was actually working**  
✅ **Keep the MT5 API service running in a separate terminal**  
✅ **You now have complete documentation for future reference**

---

**Status:** Issue identified and documented. Follow the steps above to resolve.





