import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

export async function systemHealth() {
  const nodeCheck = await supabase.from("nodes").select("id").limit(1);
  const edgeCheck = await supabase.from("edges").select("id").limit(1);
  const telemetryCheck = await supabase.from("telemetry_events").select("id").limit(1);

  return {
    status:
      nodeCheck.error || edgeCheck.error || telemetryCheck.error
        ? "degraded"
        : "healthy",

    services: {
      nodes: nodeCheck.error ? "down" : "ok",
      edges: edgeCheck.error ? "down" : "ok",
      telemetry: telemetryCheck.error ? "down" : "ok"
    },

    timestamp: new Date().toISOString()
  };
}
