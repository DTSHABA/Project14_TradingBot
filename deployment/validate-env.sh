#!/bin/bash
# Environment Variable Validation Script
# Checks all required environment variables are set and valid
# Usage: ./validate-env.sh [server|ui|trading-engine]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

APP_DIR="${APP_DIR:-/home/scalpingbot/app}"
VALIDATION_FAILED=0

echo -e "${BLUE}Environment Variable Validation${NC}"
echo ""

# Function to check if variable is set
check_var() {
    local var_name=$1
    local var_value=$2
    local required=${3:-true}
    
    if [ -z "$var_value" ]; then
        if [ "$required" = "true" ]; then
            echo -e "${RED}✗ $var_name: NOT SET (required)${NC}"
            VALIDATION_FAILED=1
            return 1
        else
            echo -e "${YELLOW}⚠ $var_name: NOT SET (optional)${NC}"
            return 0
        fi
    else
        # Mask sensitive values
        if [[ "$var_name" == *"PASSWORD"* ]] || [[ "$var_name" == *"KEY"* ]] || [[ "$var_name" == *"SECRET"* ]]; then
            echo -e "${GREEN}✓ $var_name: SET${NC}"
        else
            echo -e "${GREEN}✓ $var_name: SET (${var_value:0:50}...)${NC}"
        fi
        return 0
    fi
}

# Function to validate connection string
validate_connection_string() {
    local var_name=$1
    local var_value=$2
    
    if [ -z "$var_value" ]; then
        return 1
    fi
    
    if [[ "$var_value" =~ ^postgresql:// ]]; then
        return 0
    else
        echo -e "${RED}✗ $var_name: Invalid connection string format${NC}"
        VALIDATION_FAILED=1
        return 1
    fi
}

# Validate server/.env
validate_server_env() {
    echo -e "${BLUE}Validating server/.env${NC}"
    echo "------------------------------"
    
    if [ ! -f "$APP_DIR/server/.env" ]; then
        echo -e "${RED}✗ server/.env file not found${NC}"
        VALIDATION_FAILED=1
        return
    fi
    
    # Source environment variables
    export $(grep -v '^#' "$APP_DIR/server/.env" | xargs 2>/dev/null || true)
    
    check_var "DATABASE_URL" "$DATABASE_URL" true
    validate_connection_string "DATABASE_URL" "$DATABASE_URL"
    
    check_var "FIREBASE_PROJECT_ID" "$FIREBASE_PROJECT_ID" true
    check_var "FIREBASE_PRIVATE_KEY" "$FIREBASE_PRIVATE_KEY" true
    check_var "FIREBASE_CLIENT_EMAIL" "$FIREBASE_CLIENT_EMAIL" true
    
    check_var "PORT" "$PORT" false
    check_var "NODE_ENV" "$NODE_ENV" false
    
    check_var "MT5_API_URL" "$MT5_API_URL" false
    check_var "TRADING_ENGINE_API_KEY" "$TRADING_ENGINE_API_KEY" false
    check_var "TRADING_ENGINE_API_URL" "$TRADING_ENGINE_API_URL" false
    
    # Check if PGDIRECT_URL is set (recommended for migrations)
    check_var "PGDIRECT_URL" "$PGDIRECT_URL" false
    
    echo ""
}

# Validate ui/.env.production
validate_ui_env() {
    echo -e "${BLUE}Validating ui/.env.production${NC}"
    echo "------------------------------"
    
    if [ ! -f "$APP_DIR/ui/.env.production" ]; then
        echo -e "${YELLOW}⚠ ui/.env.production file not found (optional for build)${NC}"
        echo ""
        return
    fi
    
    # Source environment variables
    export $(grep -v '^#' "$APP_DIR/ui/.env.production" | xargs 2>/dev/null || true)
    
    check_var "VITE_API_URL" "$VITE_API_URL" false
    check_var "VITE_USE_FIREBASE_EMULATOR" "$VITE_USE_FIREBASE_EMULATOR" false
    
    echo ""
}

# Validate trading-engine/.env
validate_trading_engine_env() {
    echo -e "${BLUE}Validating trading-engine/.env${NC}"
    echo "------------------------------"
    
    if [ ! -f "$APP_DIR/trading-engine/.env" ]; then
        echo -e "${YELLOW}⚠ trading-engine/.env file not found (instances managed dynamically)${NC}"
        echo ""
        return
    fi
    
    # Source environment variables
    export $(grep -v '^#' "$APP_DIR/trading-engine/.env" | xargs 2>/dev/null || true)
    
    check_var "DATABASE_URL" "$DATABASE_URL" false
    validate_connection_string "DATABASE_URL" "$DATABASE_URL"
    
    check_var "MT5_SYMBOL" "$MT5_SYMBOL" false
    check_var "MT5_TERMINAL_PATH" "$MT5_TERMINAL_PATH" false
    
    check_var "MT5_API_PORT" "$MT5_API_PORT" false
    check_var "MT5_API_HOST" "$MT5_API_HOST" false
    
    echo ""
}

# Check file permissions
check_permissions() {
    echo -e "${BLUE}Checking file permissions${NC}"
    echo "------------------------------"
    
    # Check .env files are readable
    if [ -f "$APP_DIR/server/.env" ]; then
        if [ -r "$APP_DIR/server/.env" ]; then
            echo -e "${GREEN}✓ server/.env is readable${NC}"
        else
            echo -e "${RED}✗ server/.env is not readable${NC}"
            VALIDATION_FAILED=1
        fi
        
        # Check if permissions are too open
        PERMS=$(stat -c "%a" "$APP_DIR/server/.env" 2>/dev/null || stat -f "%OLp" "$APP_DIR/server/.env" 2>/dev/null || echo "unknown")
        if [ "$PERMS" != "unknown" ] && [ "$PERMS" -gt 644 ]; then
            echo -e "${YELLOW}⚠ server/.env permissions are too open ($PERMS), should be 644 or less${NC}"
        fi
    fi
    
    echo ""
}

# Main validation
MAIN_TARGET=${1:-all}

if [ "$MAIN_TARGET" = "server" ] || [ "$MAIN_TARGET" = "all" ]; then
    validate_server_env
fi

if [ "$MAIN_TARGET" = "ui" ] || [ "$MAIN_TARGET" = "all" ]; then
    validate_ui_env
fi

if [ "$MAIN_TARGET" = "trading-engine" ] || [ "$MAIN_TARGET" = "all" ]; then
    validate_trading_engine_env
fi

if [ "$MAIN_TARGET" = "all" ]; then
    check_permissions
fi

# Summary
echo -e "${BLUE}Validation Summary${NC}"
echo "------------------------------"
if [ $VALIDATION_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All validations passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Validation failed. Please fix the errors above.${NC}"
    exit 1
fi


