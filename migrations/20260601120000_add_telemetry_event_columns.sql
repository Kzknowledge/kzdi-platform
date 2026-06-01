-- =============================================================================
-- MIGRATION:    add_telemetry_event_columns
-- VERSION:      20260601120000
-- AUTHOR:       Kzknowledge
-- SCHEMA:       telemetry
-- DESCRIPTION:  Adds event_name, event_status, event_priority, message, and
--               metadata columns to telemetry.telemetry_events to align with
--               the KZDI Observability Pipeline payload format.
--               Resolves EDGE-001: INSERT 500 errors caused by schema mismatch.
-- ROLLBACK:     See ROLLBACK section at bottom of this file.
-- RISK:         LOW — additive only, no existing columns modified or dropped
-- REVIEWED_BY:  Kzknowledge
-- APPROVED_ON:  2026-06-01
-- TICKET:       EDGE-001
-- =============================================================================
-- Executed via Session Pooler port 5432 with ON_ERROR_STOP=on
-- Port 6543 (transaction pooler) is PROHIBITED for migrations.
-- Do NOT run this directly in Supabase SQL Editor during normal operations.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- STEP 1: Add missing columns (all idempotent via IF NOT EXISTS)
-- -----------------------------------------------------------------------------

ALTER TABLE telemetry.telemetry_events
  ADD COLUMN IF NOT EXISTS event_name     TEXT,
  ADD COLUMN IF NOT EXISTS event_status   TEXT,
  ADD COLUMN IF NOT EXISTS event_priority TEXT DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS message        TEXT,
  ADD COLUMN IF NOT EXISTS metadata       JSONB;

-- -----------------------------------------------------------------------------
-- STEP 2: Add index on event_name for observability query performance
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_telemetry_events_event_name
  ON telemetry.telemetry_events (event_name);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_event_priority
  ON telemetry.telemetry_events (event_priority);

CREATE INDEX IF NOT EXISTS idx_telemetry_events_event_status
  ON telemetry.telemetry_events (event_status);

-- -----------------------------------------------------------------------------
-- STEP 3: Post-migration assertions — fail transaction if any column missing
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  missing_cols TEXT := '';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'telemetry'
      AND table_name   = 'telemetry_events'
      AND column_name  = 'event_name'
  ) THEN
    missing_cols := missing_cols || 'event_name, ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'telemetry'
      AND table_name   = 'telemetry_events'
      AND column_name  = 'event_status'
  ) THEN
    missing_cols := missing_cols || 'event_status, ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'telemetry'
      AND table_name   = 'telemetry_events'
      AND column_name  = 'event_priority'
  ) THEN
    missing_cols := missing_cols || 'event_priority, ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'telemetry'
      AND table_name   = 'telemetry_events'
      AND column_name  = 'message'
  ) THEN
    missing_cols := missing_cols || 'message, ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'telemetry'
      AND table_name   = 'telemetry_events'
      AND column_name  = 'metadata'
  ) THEN
    missing_cols := missing_cols || 'metadata, ';
  END IF;

  IF missing_cols <> '' THEN
    RAISE EXCEPTION 'POST-MIGRATION ASSERTION FAILED: missing columns: %',
      rtrim(missing_cols, ', ');
  END IF;

  RAISE NOTICE 'EDGE-001: All assertions passed — schema aligned with pipeline payload';
END;
$$;

-- -----------------------------------------------------------------------------
-- STEP 4: Verify final schema state (logged in pipeline audit output)
-- -----------------------------------------------------------------------------

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'telemetry'
  AND table_name   = 'telemetry_events'
ORDER BY ordinal_position;

COMMIT;

-- =============================================================================
-- ROLLBACK (manual — execute in Supabase SQL Editor ONLY if post-deploy issues)
--
-- BEGIN;
--
-- DROP INDEX IF EXISTS telemetry.idx_telemetry_events_event_name;
-- DROP INDEX IF EXISTS telemetry.idx_telemetry_events_event_priority;
-- DROP INDEX IF EXISTS telemetry.idx_telemetry_events_event_status;
--
-- ALTER TABLE telemetry.telemetry_events
--   DROP COLUMN IF EXISTS event_name,
--   DROP COLUMN IF EXISTS event_status,
--   DROP COLUMN IF EXISTS event_priority,
--   DROP COLUMN IF EXISTS message,
--   DROP COLUMN IF EXISTS metadata;
--
-- COMMIT;
--
-- NEVER run rollback via the pipeline — manual execution only.
-- =============================================================================
