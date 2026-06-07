import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { MCPGovernor } from "../core/mcpGovernor";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const governor = new MCPGovernor();

/**
 * 🧠 MCP REINFORCEMENT LOOP (FIXED VERSION)
 * - Persistent memory updates
 * - Signal history tracking
 * - Agent bias evolution
 * - Stability scoring
 */
async function runReinforcementLoop() {
  console.log("🔁 MCP Reinforcement Loop START");

  // ===============================
  // 1. LOAD TELEMETRY SIGNALS
  // ===============================
  const { data: signals, error } = await supabase
    .from("telemetry_events")
    .select("*")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (error) {
    console.error("❌ Telemetry fetch failed", error);
    return;
  }

  console.log("📊 Signals loaded:", signals?.length ?? 0);

  // ===============================
  // 2. LOAD CURRENT REINFORCEMENT STATE
  // ===============================
  const { data: memoryRow } = await supabase
    .from("system_memory")
    .select("*")
    .eq("key", "reinforcement_weights")
    .single();

  const current = memoryRow?.value ?? {
    vector_bias: 1,
    graph_bias: 1,
    agent_bias_map: {},
    signal_history: [],
    stability_score: 1,
  };

  // ===============================
  // 3. COMPUTE NEW WEIGHTS
  // ===============================
  const successRate =
    signals?.length > 0
      ? signals.filter((s) => s.event_data?.success === true).length /
        signals.length
      : 0.5;

  let vector_bias = current.vector_bias;
  let graph_bias = current.graph_bias;

  if (successRate > 0.7) vector_bias += 0.05;
  if (successRate < 0.5) vector_bias -= 0.05;

  vector_bias = clamp(vector_bias, 0.5, 1.5);
  graph_bias = clamp(graph_bias, 0.5, 1.5);

  const stability_score = clamp(
    1 - Math.abs(successRate - 0.5),
    0,
    1
  );

  // ===============================
  // 4. BUILD SIGNAL ENTRY (PERSISTENCE FIX)
  // ===============================
  const newSignal = {
    timestamp: new Date().toISOString(),
    successRate,
    vector_bias,
    graph_bias,
    stability_score,
  };

  // ===============================
  // 5. MERGE HISTORY (CRITICAL FIX)
  // ===============================
  const signal_history = [
    ...(current.signal_history ?? []).slice(-9),
    newSignal,
  ];

  // ===============================
  // 6. UPDATE AGENT BIAS MAP
  // ===============================
  const agent_bias_map = { ...(current.agent_bias_map ?? {}) };

  for (const s of signals ?? []) {
    const agent = s.event_data?.agent;
    if (!agent) continue;

    const success = s.event_data?.success ? 1 : 0;

    agent_bias_map[agent] =
      clamp((agent_bias_map[agent] ?? 1) * (success ? 1.02 : 0.98), 0.5, 1.5);
  }

  // ===============================
  // 7. GOVERNANCE CHECK
  // ===============================
  await governor.validateSystemChange({
    signal: newSignal,
  });

  // ===============================
  // 8. PERSIST STATE (CRITICAL FIX)
  // ===============================
  const updated = {
    vector_bias,
    graph_bias,
    agent_bias_map,
    signal_history,
    stability_score,
    updated_at: new Date().toISOString(),
  };

  const { error: saveError } = await supabase
    .from("system_memory")
    .update({ value: updated })
    .eq("key", "reinforcement_weights");

  if (saveError) {
    console.error("❌ Reinforcement save failed", saveError);
    return;
  }

  console.log("🧠 Computed update:", updated);
  console.log("✅ Reinforcement update saved");
  console.log("📦 New state:", updated);
}

// ===============================
// UTIL
// ===============================
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

// ===============================
// EXECUTE
// ===============================
runReinforcementLoop().catch(console.error);
