import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";

// ─────────────────────────────────────────────
// MCP TELEMETRY CORE v2.0 (STRICT MODE)
// KZDI Observability Ingestion Layer
// ─────────────────────────────────────────────

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const EDGE_SECRET = Deno.env.get("EDGE_SECRET");

if (!supabaseUrl || !supabaseServiceKey || !EDGE_SECRET) {
  throw new Error("CRITICAL CONFIG ERROR: Missing environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: "telemetry" }
});

const jsonHeaders = { "Content-Type": "application/json" };

// ─────────────────────────────────────────────
// CONTRACT VALIDATION (STRICT MODE)
// ─────────────────────────────────────────────

const REQUIRED_FIELDS = [
  "trace_id",
  "request_id",
  "event_type",
  "status",
  "source",
  "agent",
  "timestamp"
];

function validateContract(body: any) {
  for (const field of REQUIRED_FIELDS) {
    if (!body?.[field]) {
      return { valid: false, missing: field };
    }
  }
  return { valid: true };
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function normalizeEventType(event_type: string) {
  return event_type.trim().toLowerCase();
}

// ─────────────────────────────────────────────
// EDGE FUNCTION
// ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {

  // ── AUTH LAYER ─────────────────────────────
  const token = req.headers.get("x-edge-secret");

  if (token !== EDGE_SECRET) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: jsonHeaders }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "POST required" }),
      { status: 405, headers: jsonHeaders }
    );
  }

  try {
    const body = await req.json();

    // ── CONTRACT VALIDATION ─────────────────────
    const validation = validateContract(body);

    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "missing_required_field",
          field: validation.missing
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const event_type = normalizeEventType(body.event_type);

    const {
      trace_id,
      request_id,
      status,
      source,
      agent,
      timestamp,
      data = {},
      context = {}
    } = body;

    // ── INSERT TELEMETRY EVENT ─────────────────────
    const { data: result, error } = await supabase
      .from("telemetry_events")
      .insert([{
        trace_id,
        request_id,
        event_type,
        status,
        source,
        agent_id: agent,
        event_data: {
          ...data,
          context,
          timestamp: timestamp || new Date().toISOString(),
          runtime: "deno-edge"
        }
      }])
      .select("id")
      .single();

    if (error) throw error;

    // ── RESPONSE ─────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        trace_id,
        request_id,
        tracking_id: result.id,
        event_type
      }),
      { status: 200, headers: jsonHeaders }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "telemetry_ingestion_failed",
        detail: String(err)
      }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
