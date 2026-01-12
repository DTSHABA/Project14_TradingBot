# MT5 Authentication Failed - Troubleshooting Guide

## Current Status
✅ MT5 API service is running  
✅ MT5 terminal is found (`C:\Program Files\MetaTrader\terminal64.exe`)  
✅ Connection reaches MT5  
❌ Authentication is failing  

## Common Causes & Solutions

### 1. **Server Name Mismatch** (Most Common)

The server name must match **exactly** what's shown in your MT5 terminal.

**How to find the correct server name:**
1. Open MetaTrader 5 terminal
2. Right-click on your account in the Navigator panel
3. Select "Properties" or "Account Information"
4. Look at the "Server" field - copy it **exactly** (case-sensitive)

**Common variations:**
- ❌ `MetaQuotes-Demo`
- ✅ `MetaQuotes-Demo` (exact case)
- ✅ `MetaQuotes-Demo Server`
- ✅ `MetaQuotes-Demo-Server`

**Fix:** Update the server name in your form to match exactly what's in MT5.

### 2. **Password Issues**

**Check:**
- Password is correct (no extra spaces)
- Using the **trading password** (not investor password)
- Password hasn't expired or been changed

**Fix:** Verify password in MT5 terminal by logging in manually.

### 3. **Account Status**

**Check if:**
- Account is active and not disabled
- Account hasn't been closed
- Account is accessible from your IP address

**Fix:** Log into MT5 terminal manually to verify account status.

### 4. **MT5 Terminal Not Logged In**

Sometimes MT5 Python library requires the terminal to be logged in first.

**Fix:**
1. Open MetaTrader 5 terminal
2. Log in with your credentials manually
3. Keep the terminal open
4. Try the connection test again

### 5. **Network/Firewall Issues**

**Check:**
- Internet connection is stable
- Firewall isn't blocking MT5
- VPN isn't interfering

**Fix:** Try disabling VPN/firewall temporarily to test.

## Getting Detailed Error Messages

After restarting the MT5 API service, you'll get more detailed error messages:

1. **Restart MT5 API Service:**
   ```bash
   # Stop current service (Ctrl+C in terminal 15)
   python C:\Users\x1carbon\Documents\Workspace\Project14_ScalptingBot\trading-engine\mt5_api.py
   ```

2. **Try connection again** - you'll now see specific error codes:
   - `-10004`: Invalid account or password
   - `-10003`: Invalid server name
   - `-10002`: Connection failed
   - Other codes: See MT5 documentation

## Verification Steps

1. **Verify credentials in MT5 terminal:**
   - Open MT5
   - Log in manually with: Account `10008463761`, your password, server `MetaQuotes-Demo`
   - If this works, note the **exact** server name shown

2. **Check server name format:**
   - Server names are case-sensitive
   - May include spaces or hyphens
   - Must match exactly

3. **Test with exact server name:**
   - Use the exact server name from MT5 terminal
   - Try the connection test again

## Next Steps

1. ✅ Restart MT5 API service (to get detailed errors)
2. ✅ Check exact server name in MT5 terminal
3. ✅ Verify password is correct
4. ✅ Try connection test again
5. ✅ Check Python service logs for detailed error

## Quick Test

Run this to test the connection directly:
```powershell
$body = @{
    account_number = '10008463761'
    password = 'your_password_here'
    server = 'MetaQuotes-Demo'  # Use exact server name from MT5
} | ConvertTo-Json

Invoke-WebRequest -Uri 'http://127.0.0.1:5001/mt5/test-connection' -Method POST -Body $body -ContentType 'application/json'
```

This will show you the exact error message from MT5.





