import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";

// ─────────────────────────────────────────────────────────────
// MCP TELEMETRY CORE v1.1.0
// Observability ingestion layer for KZDI MCP system
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Internal utilities
// ─────────────────────────────────────────────────────────────

function createRequestId(body: any, req: Request) {
  return body?.request_id ||
         req.headers.get("x-request-id") ||
         crypto.randomUUID();
}

function normalizeEventType(event_type: string) {
  return event_type.trim().toLowerCase();
}

// ─────────────────────────────────────────────────────────────
// Edge Function
// ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {

  // ── AUTH LAYER ─────────────────────────────────────────────
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

    const request_id = createRequestId(body, req);
    const event_type = normalizeEventType(body.event_type);

    const {
      source_agent_id = "unknown-agent",
      skill_id = null,
      status,
      event_data = {},
      error_message = null,
    } = body;

    // ── VALIDATION ────────────────────────────────────────────
    if (!event_type || !status) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: event_type, status"
        }),
        { status: 400, headers: jsonHeaders }
      );
    }

    // ── INSERT TELEMETRY EVENT ───────────────────────────────
    const { data, error } = await supabase
      .from("telemetry_events")
      .insert([{
        request_id,
        event_type,
        source_agent_id,
        skill_id,
        status,
        event_data: {
          ...event_data,
          timestamp: new Date().toISOString(),
          runtime: "deno-edge"
        },
        error_message,
      }])
      .select("id")
      .single();

    if (error) throw error;

    // ── RESPONSE ─────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        request_id,
        tracking_id: data.id
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
