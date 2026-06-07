import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * MCP REINFORCEMENT CLOSURE LOOP
 * Runs every 5 minutes
 */
export async function executeReinforcementLoop() {
  const { data: events } = await supabase
    .from("telemetry_events")
    .select("*")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (!events || events.length === 0) return;

  // -------------------------------
  // 1. GROUP SIGNALS
  // -------------------------------
  const agentStats: Record<string, any> = {};

  for (const e of events) {
    const agent = e.event_data?.agent_id || "unknown";

    if (!agentStats[agent]) {
      agentStats[agent] = {
        success: 0,
        total: 0,
        latency: [],
      };
    }

    if (e.event_type === "agent_execution_success") {
      agentStats[agent].success += 1;
    }

    agentStats[agent].total += 1;
  }

  // -------------------------------
  // 2. COMPUTE WEIGHTS
  // -------------------------------
  const agent_bias_map: Record<string, number> = {};

  for (const [agent, stats] of Object.entries(agentStats)) {
    const successRate = stats.success / Math.max(stats.total, 1);

    let bias = 1.0;

    if (successRate > 0.7) bias += 0.1;
    if (successRate < 0.5) bias -= 0.1;

    bias = Math.max(0.5, Math.min(1.5, bias));

    agent_bias_map[agent] = bias;
  }

  // -------------------------------
  // 3. LOAD CURRENT MEMORY
  // -------------------------------
  const { data: memory } = await supabase
    .from("system_memory")
    .select("*")
    .eq("key", "reinforcement_weights")
    .single();

  const current = memory?.value || {
    vector_bias: 1.0,
    graph_bias: 1.0,
    agent_bias_map: {},
    stability_score: 1.0,
    signal_history: [],
  };

  // -------------------------------
  // 4. UPDATE MEMORY (EMA STYLE)
  // -------------------------------
  const updated = {
    ...current,
    agent_bias_map,
    signal_history: (current.signal_history || []).slice(-9),
    stability_score: 0.85,
    updated_at: new Date().toISOString(),
  };

  await supabase
    .from("system_memory")
    .update({ value: updated })
    .eq("key", "reinforcement_weights");

  console.log("🔁 Reinforcement loop executed");
}
