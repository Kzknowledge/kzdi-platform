import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";

// Hardware-constrained system signature for logging environment context
const SYSTEM_MEMORY = {
  hardware_constraints: { host_device: "Samsung Galaxy M15" },
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("CRITICAL CONFIGURATION ERROR: Environment variables are unmapped inside the runner execution context.");
}

// Instantiate the Supabase client pinned strictly to your isolated telemetry schema layer
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'telemetry' }
});

const jsonHeaders = { "Content-Type": "application/json" };

Deno.serve(async (req: Request) => {
  // Enforce rigid RESTful POST communication paths
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed. Use POST payload transactions." }), 
      { status: 405, headers: jsonHeaders }
    );
  }

  try {
    const body = await req.json();
    const { event_type, source_agent_id, skill_id, status, event_data, error_message } = body;

    // Rigid schema validation for core non-nullable keys
    if (!event_type || !status) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required tracking parameters: 'event_type' and 'status' are required fields." }), 
        { status: 400, headers: jsonHeaders }
      );
    }

    // Inject data payloads directly into telemetry.telemetry_events table
    const { data, error } = await supabase
      .from("telemetry_events")
      .insert([
        {
          event_type,
          source_agent_id: source_agent_id ?? "unknown-agent",
          skill_id,
          status,
          // Merges incoming JSON logs with your sovereign system metadata signature
          event_data: { 
            ...(event_data ?? {}), 
            device_host: SYSTEM_MEMORY.hardware_constraints.host_device 
          },
          error_message,
        }
      ])
      .select("id");

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, tracking_id: data?.[0]?.id }), 
      { status: 200, headers: jsonHeaders }
    );

  } catch (err: unknown) {
    const errorDetails = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ success: false, error: "Database transaction isolation write failure", msg: errorDetails }), 
      { status: 500, headers: jsonHeaders }
    );
  }
});
