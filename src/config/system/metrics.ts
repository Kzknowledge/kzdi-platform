import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

export async function systemMetrics() {
  const { count: nodes } = await supabase
    .from("nodes")
    .select("*", { count: "exact", head: true });

  const { count: edges } = await supabase
    .from("edges")
    .select("*", { count: "exact", head: true });

  const { count: telemetry } = await supabase
    .from("telemetry_events")
    .select("*", { count: "exact", head: true });

  return {
    nodes,
    edges,
    telemetry_events: telemetry,
    timestamp: new Date().toISOString()
  };
}
