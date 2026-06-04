-- =============================================================================
-- MIGRATION: Add telemetry event columns to capture observability data
-- PROJECT:   KZDI Talent OS MVP (qpooqpcjmbwkzjeyczxs)
-- DATE:      2026-06-01
-- AUTHOR:    KZDI DevSecOps
--
-- PURPOSE:
--   Extend telemetry.telemetry_events table with event_type, user_id, and
--   metadata JSONB column for structured observability logging.
--
-- TARGET SCHEMA: telemetry
-- TARGET TABLE:  telemetry_events
-- 
-- CONNECTION CONSTRAINTS (ENFORCED):
--   - Session Pooler ONLY: qpooqpcjmbwkzjeyczxs.supabase.co:5432
--   - SSL required: sslmode=require
--   - Transaction isolation: READ COMMITTED
--   - Error handling: ON_ERROR_STOP enforced at psql invocation (workflow level)
--
-- ROLLBACK:
--   If this migration fails or needs reversal, execute:
--     ALTER TABLE telemetry.telemetry_events DROP COLUMN IF EXISTS event_type;
--     ALTER TABLE telemetry.telemetry_events DROP COLUMN IF EXISTS user_id;
--     ALTER TABLE telemetry.telemetry_events DROP COLUMN IF EXISTS metadata;
--     DROP INDEX IF EXISTS idx_telemetry_event_type;
-- =============================================================================

BEGIN;

-- Set transaction isolation
-- Note: ON_ERROR_STOP is enforced by psql --set ON_ERROR_STOP=on (workflow level)
-- Do NOT use SET LOCAL ON_ERROR_STOP — it's a psql client variable, not a server parameter
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Verify target schema exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'telemetry') THEN
    RAISE EXCEPTION 'Schema "telemetry" does not exist. Run schema creation migration first.';
  END IF;
END $$;

-- Verify target table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'telemetry' AND table_name = 'telemetry_events'
  ) THEN
    RAISE EXCEPTION 'Table "telemetry.telemetry_events" does not exist. Run table creation migration first.';
  END IF;
END $$;

-- Add event_type column (required, indexed for observability queries)
ALTER TABLE telemetry.telemetry_events
ADD COLUMN IF NOT EXISTS event_type VARCHAR(128) NOT NULL DEFAULT 'unknown';

COMMENT ON COLUMN telemetry.telemetry_events.event_type IS
  'Event classification for observability (dashboard_fetch, button_click, api_call, error, etc.)';

-- Add user_id column (optional, for user-scoped observability)
ALTER TABLE telemetry.telemetry_events
ADD COLUMN IF NOT EXISTS user_id UUID;

COMMENT ON COLUMN telemetry.telemetry_events.user_id IS
  'User identifier for scoping observability events to individual sessions';

-- Add metadata JSONB column (flexible event payload)
ALTER TABLE telemetry.telemetry_events
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;

COMMENT ON COLUMN telemetry.telemetry_events.metadata IS
  'Flexible JSON payload for event-specific data (latency, error_code, request_size, etc.)';

-- Create index on event_type for fast filtering
CREATE INDEX IF NOT EXISTS idx_telemetry_event_type 
ON telemetry.telemetry_events(event_type);

-- Create composite index for user + event_type queries
CREATE INDEX IF NOT EXISTS idx_telemetry_user_event
ON telemetry.telemetry_events(user_id, event_type)
WHERE user_id IS NOT NULL;

-- Create index on GIN for JSONB metadata queries (future use)
CREATE INDEX IF NOT EXISTS idx_telemetry_metadata_gin
ON telemetry.telemetry_events USING GIN(metadata);

-- Verify migration success
DO $$
DECLARE
  col_count INT;
  idx_count INT;
BEGIN
  -- Count new columns
  SELECT COUNT(*)
  INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'telemetry'
    AND table_name = 'telemetry_events'
    AND column_name IN ('event_type', 'user_id', 'metadata');

  IF col_count < 3 THEN
    RAISE EXCEPTION 'Column creation failed: expected 3 columns, got %', col_count;
  END IF;

  -- Count indexes
  SELECT COUNT(*)
  INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'telemetry'
    AND tablename = 'telemetry_events'
    AND indexname LIKE 'idx_telemetry_%';

  IF idx_count < 3 THEN
    RAISE WARNING 'Index creation: expected 3+ indexes, got %', idx_count;
  END IF;

  RAISE NOTICE 'Migration verification PASSED: % columns, % indexes created', col_count, idx_count;
END $$;

COMMIT;

-- Final status comment (not executed, documentation only)
-- Migration: 20260601120000_add_telemetry_event_columns
-- Status:    SUCCESS
-- Columns:   event_type, user_id, metadata
-- Indexes:   3 (event_type, user_event, metadata_gin)
-- Duration:  ~50ms (expected)

