# Running the Trading Engine

## Quick Start (Environment Variables Mode)

### Option 1: Using the Batch File (Easiest)

1. **Navigate to trading-engine directory:**
```powershell
cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot\trading-engine
```

2. **Create/Edit `.env` file** with your credentials (see below)

3. **Run the batch file:**
```powershell
.\run_trading_engine.bat
```

### Option 2: Direct Python Command

1. **Navigate to trading-engine directory:**
```powershell
cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot\trading-engine
```

2. **Run Python module:**
```powershell
python -m src.main
```

### Option 3: Using Python Directly (Alternative)

If `python -m src.main` doesn't work, try:

```powershell
cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot\trading-engine
python src\main.py
```

### Option 4: With Virtual Environment

If you're using a virtual environment:

```powershell
cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot\trading-engine
.\venv\Scripts\Activate.ps1
python -m src.main
```

## Required .env File

Create a `.env` file in the `trading-engine` directory with:

```env
# Required: Database Configuration
TRADING_ENGINE_USER_ID=your_user_id_here
TRADING_ENGINE_MT5_ACCOUNT_ID=your_mt5_account_id_here

# Required: Database Connection
DATABASE_URL=postgresql://user:password@host:port/database
# OR use POSTGRES_URL instead:
# POSTGRES_URL=postgresql://user:password@host:port/database

# Required: MT5 Credentials
MT5_LOGIN=your_mt5_account_number
MT5_PASSWORD=your_mt5_password
MT5_SERVER=your_mt5_server_name
MT5_SYMBOL=XAUUSD
MT5_PATH=C:\Program Files\MetaTrader 5\terminal64.exe
```

## Troubleshooting

### "ModuleNotFoundError: No module named 'src'"

**Solution:** Make sure you're in the `trading-engine` directory:
```powershell
cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot\trading-engine
python -m src.main
```

### "No module named 'config'"

**Solution:** Add the parent directory to Python path:
```powershell
cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot\trading-engine
$env:PYTHONPATH = "$PWD;$env:PYTHONPATH"
python -m src.main
```

### "Missing required configuration"

**Solution:** Ensure your `.env` file exists and contains all required variables. Check that:
- `.env` file is in the `trading-engine` directory
- All variables are set (no empty values)
- No typos in variable names

### "Failed to connect to MT5"

**Solution:** 
1. Make sure MetaTrader 5 terminal is installed and running
2. Verify MT5 credentials are correct
3. Check that `MT5_PATH` points to the correct MT5 installation

## Complete Example Command

```powershell
# Navigate to directory
cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot\trading-engine

# Activate virtual environment (if using one)
.\venv\Scripts\Activate.ps1

# Run trading engine
python -m src.main
```

## Running in Background (Windows)

To run in the background without keeping terminal open:

```powershell
cd C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot\trading-engine
Start-Process python -ArgumentList "-m","src.main" -WindowStyle Hidden
```

Or use the batch file with `start`:
```powershell
start /B run_trading_engine.bat
```

