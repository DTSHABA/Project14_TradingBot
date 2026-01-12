-- Migration: Change ticket column from INTEGER to BIGINT
-- MT5 ticket numbers can exceed INTEGER max value (2,147,483,647)

-- Alter the ticket column to BIGINT
ALTER TABLE "app"."trades" 
ALTER COLUMN "ticket" TYPE bigint USING "ticket"::bigint;

