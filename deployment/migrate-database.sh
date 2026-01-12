#!/bin/bash
# Database Migration Script
# Runs Drizzle migrations with backup
# Usage: ./migrate-database.sh [--skip-backup]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

APP_DIR="${APP_DIR:-/home/scalpingbot/app}"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/deployment/backups}"
SKIP_BACKUP=false

# Check for skip-backup flag
if [ "$1" = "--skip-backup" ]; then
    SKIP_BACKUP=true
fi

echo -e "${BLUE}Database Migration Script${NC}"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "$APP_DIR/server/package.json" ]; then
    echo -e "${RED}Error: server/package.json not found${NC}"
    echo "Please run from app directory or set APP_DIR environment variable"
    exit 1
fi

cd "$APP_DIR/server"

# Load environment variables
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: server/.env file not found${NC}"
    exit 1
fi

export $(grep -v '^#' .env | xargs)

# Determine database connection string
if [ -n "$PGDIRECT_URL" ]; then
    DB_URL="$PGDIRECT_URL"
    echo -e "${GREEN}Using direct PostgreSQL connection (PGDIRECT_URL)${NC}"
elif [ -n "$DATABASE_URL" ]; then
    DB_URL="$DATABASE_URL"
    echo -e "${YELLOW}Using DATABASE_URL (if using PgBouncer, consider setting PGDIRECT_URL for migrations)${NC}"
else
    echo -e "${RED}Error: DATABASE_URL or PGDIRECT_URL must be set${NC}"
    exit 1
fi

# Test database connection
echo -e "${GREEN}Testing database connection...${NC}"
if command -v psql &> /dev/null; then
    # Extract connection details from URL
    DB_HOST=$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "$DB_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")
    DB_NAME=$(echo "$DB_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    DB_USER=$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo "$DB_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    export PGPASSWORD="$DB_PASS"
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Database connection successful${NC}"
    else
        echo -e "${RED}✗ Database connection failed${NC}"
        exit 1
    fi
    unset PGPASSWORD
else
    echo -e "${YELLOW}⚠ psql not found, skipping connection test${NC}"
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
if [ "$SKIP_BACKUP" = false ]; then
    echo -e "${GREEN}Creating database backup...${NC}"
    BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if command -v pg_dump &> /dev/null; then
        export PGPASSWORD="$DB_PASS"
        pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
        unset PGPASSWORD
        
        if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
            echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
            
            # Compress backup
            gzip "$BACKUP_FILE" 2>/dev/null || true
            echo -e "${GREEN}✓ Backup compressed${NC}"
            
            # Keep only last 5 backups
            ls -t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
        else
            echo -e "${YELLOW}⚠ Backup file is empty or not created${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ pg_dump not found, skipping backup${NC}"
        echo -e "${YELLOW}  Consider installing postgresql-client for backups${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping backup (--skip-backup flag set)${NC}"
fi

# Verify schema status
echo -e "${GREEN}Checking current schema status...${NC}"
cd "$APP_DIR/server"

# Run migrations
echo -e "${GREEN}Running database migrations...${NC}"
echo ""

if pnpm db:push; then
    echo ""
    echo -e "${GREEN}✓ Database migrations completed successfully!${NC}"
    echo ""
    
    # Verify migrations
    echo -e "${GREEN}Verifying migrations...${NC}"
    if command -v psql &> /dev/null; then
        export PGPASSWORD="$DB_PASS"
        SCHEMA_CHECK=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'app';" 2>/dev/null || echo "0")
        unset PGPASSWORD
        
        if [ "$SCHEMA_CHECK" -gt 0 ]; then
            echo -e "${GREEN}✓ Schema verification passed ($SCHEMA_CHECK tables in app schema)${NC}"
        else
            echo -e "${YELLOW}⚠ No tables found in app schema${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ psql not found, skipping verification${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}Database migration complete!${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}✗ Database migration failed!${NC}"
    echo ""
    
    if [ "$SKIP_BACKUP" = false ] && [ -f "$BACKUP_FILE.gz" ]; then
        echo -e "${YELLOW}Backup available at: $BACKUP_FILE.gz${NC}"
        echo -e "${YELLOW}To restore, run:${NC}"
        echo "  gunzip < $BACKUP_FILE.gz | psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
    fi
    
    exit 1
fi


