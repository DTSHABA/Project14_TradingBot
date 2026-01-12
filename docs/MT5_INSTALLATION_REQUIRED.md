# MetaTrader 5 Installation Required

## Issue
The MT5 connection is timing out because **MetaTrader 5 terminal is not installed** on your system.

## Solution

### Option 1: Install MetaTrader 5 (Recommended)

1. **Download MetaTrader 5:**
   - Visit: https://www.metatrader5.com/en/download
   - Download and install the terminal

2. **After Installation:**
   - The default path will be: `C:\Program Files\MetaTrader 5\terminal64.exe`
   - Restart the MT5 API service
   - Try connecting again

### Option 2: Use Custom MT5 Path

If MT5 is installed in a different location:

1. Find your MT5 installation path (usually ends with `terminal64.exe`)
2. Add to your `server/.env`:
   ```
   MT5_TERMINAL_PATH=C:/Your/Custom/Path/terminal64.exe
   ```

3. Restart both services:
   - MT5 API service
   - Node.js server (`pnpm dev`)

### Option 3: Use Mock Mode (Development Only)

For testing without MT5 installed, add to `server/.env`:
```
MOCK_MT5=true
```

This will simulate successful connections but won't test real MT5 credentials.

## Quick Check

Run this in PowerShell to check if MT5 is installed:
```powershell
Test-Path "C:\Program Files\MetaTrader 5\terminal64.exe"
```

If it returns `False`, MT5 is not installed.

## After Installing MT5

1. Restart the MT5 API service:
   ```bash
   # Stop current service (Ctrl+C)
   cd trading-engine
   python mt5_api.py
   ```

2. Try the connection test again in your UI

---

**Note:** The MT5 Python library requires the actual MetaTrader 5 terminal to be installed on your system. It cannot connect to MT5 accounts without the terminal software.





