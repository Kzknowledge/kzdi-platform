-- KZDI EDGE-001 Security Migration
-- Kriptomech | KZDI Technologies Ltd

-- Test telemetry insert
INSERT INTO telemetry.telemetry_events (event_type, payload)
VALUES (
  'migration_executed',
  '{"status":"success","source":"github_actions","version":"EDGE-001"}'::jsonb
);

-- Confirm row was inserted
SELECT id, event_type, created_at 
FROM telemetry.telemetry_events 
WHERE event_type = 'migration_executed'
ORDER BY created_at DESC 
LIMIT 1;
