-- MIGRATION:    pipeline_smoke_test
-- VERSION:      20260601000001
-- AUTHOR:       Kzknowledge
-- SCHEMA:       public
-- DESCRIPTION:  Verifies end-to-end pipeline connectivity and fail-fast behaviour
-- ROLLBACK:     DROP TABLE IF EXISTS public.kzdi_pipeline_smoke_test;
-- RISK:         LOW
-- REVIEWED_BY:  Kzknowledge
-- APPROVED_ON:  2026-06-01

BEGIN;

CREATE TABLE IF NOT EXISTS public.kzdi_pipeline_smoke_test (
  id         SERIAL PRIMARY KEY,
  run_id     TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.kzdi_pipeline_smoke_test (run_id)
VALUES ('smoke-test-20260601');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.kzdi_pipeline_smoke_test
    WHERE run_id = 'smoke-test-20260601'
  ) THEN
    RAISE EXCEPTION 'SMOKE TEST FAILED: insert not found';
  END IF;
  RAISE NOTICE 'Smoke test passed';
END;
$$;

COMMIT;
