BEGIN;

ALTER FUNCTION public.process_mcp_event_v2(
  UUID, VARCHAR, VARCHAR, VARCHAR, JSONB
) SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.process_mcp_event_v2(
  UUID, VARCHAR, VARCHAR, VARCHAR, JSONB
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.process_mcp_event_v2(
  UUID, VARCHAR, VARCHAR, VARCHAR, JSONB
) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.process_mcp_event_v2(
  UUID, VARCHAR, VARCHAR, VARCHAR, JSONB
) FROM anon;

GRANT EXECUTE ON FUNCTION public.process_mcp_event_v2(
  UUID, VARCHAR, VARCHAR, VARCHAR, JSONB
) TO service_role;

COMMIT;
