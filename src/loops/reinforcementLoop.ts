import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ReinforcementState = {
  vector_bias: number;
  graph_bias: number;
  agent_bias_map: Record<string, number>;
  signal_history: any[];
  stability_score: number;
  updated_at?: string;
};

function clamp(v: number, min = 0.5, max = 1.5) {
  return Math.max(min, Math.min(max, v));
}

/**
 * 🧠 MCP REINFORCEMENT LOOP (FINAL FIXED VERSION)
 */
async function runLoop() {
  console.log("🔁 MCP Reinforcement Loop START");

  // ===============================
  // 1. LOAD TELEMETRY
  // ===============================
  const { data: signals, error: sigErr } = await supabase
    .from("telemetry_events")
    .select("*")
    .gte(
      "created_at",
      new Date(Date.now() - 60 * 60 * 1000).toISOString()
    );

  if (sigErr) {
    console.error("❌ Telemetry fetch failed", sigErr);
    return;
  }

  console.log("📊 Signals loaded:", signals?.length ?? 0);

  // ===============================
  // 2. LOAD MEMORY (SAFE PARSE)
  // ===============================
  const { data: memoryRow, error: memErr } = await supabase
    .from("system_memory")
    .select("value")
    .eq("key", "reinforcement_weights")
    .single();

  if (memErr) {
    console.error("❌ Memory load error:", memErr);
  }

  const previous: ReinforcementState =
    memoryRow?.value &&
    typeof memoryRow.value === "object"
      ? (memoryRow.value as ReinforcementState)
      : {
          vector_bias: 1,
          graph_bias: 1,
          agent_bias_map: {},
          signal_history: [],
          stability_score: 1,
        };

  // ===============================
  // 3. COMPUTE SIGNAL METRICS
  // ===============================
  const successCount =
    signals?.filter((s) => s.event_data?.success === true).length ?? 0;

  const successRate =
    signals?.length > 0 ? successCount / signals.length : 0.5;

  // ===============================
  // 4. UPDATE BIASES
  // ===============================
  let vector_bias = previous.vector_bias;
  let graph_bias = previous.graph_bias;

  if (successRate > 0.7) vector_bias += 0.05;
  if (successRate < 0.5) vector_bias -= 0.05;

  vector_bias = clamp(vector_bias);
  graph_bias = clamp(graph_bias);

  const stability_score = clamp(1 - Math.abs(successRate - 0.5), 0, 1);

  // ===============================
  // 5. BUILD NEW SIGNAL
  // ===============================
  const newSignal = {
    timestamp: new Date().toISOString(),
    successRate,
    vector_bias,
    graph_bias,
    stability_score,
  };

  // ===============================
  // 6. MERGE HISTORY (CRITICAL FIX)
  // ===============================
  const signal_history = [
    ...(previous.signal_history ?? []).slice(-9),
    newSignal,
  ];

  // ===============================
  // 7. UPDATE AGENT BIAS MAP
  // ===============================
  const agent_bias_map: Record<string, number> = {
    ...(previous.agent_bias_map ?? {}),
  };

  for (const s of signals ?? []) {
    const agent = s.event_data?.agent;
    if (!agent) continue;

    const success = s.event_data?.success ? 1 : 0;

    agent_bias_map[agent] = clamp(
      (agent_bias_map[agent] ?? 1) * (success ? 1.02 : 0.98)
    );
  }

  // ===============================
  // 8. FINAL MERGED STATE
  // ===============================
  const merged: ReinforcementState = {
    vector_bias,
    graph_bias,
    agent_bias_map,
    signal_history,
    stability_score,
    updated_at: new Date().toISOString(),
  };

  // ===============================
  // 9. PERSIST (UPSERT SAFE)
  // ===============================
  const { error: saveErr } = await supabase.from("system_memory").upsert(
    {
      key: "reinforcement_weights",
      value: merged,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (saveErr) {
    console.error("❌ Save failed:", saveErr);
    return;
  }

  // ===============================
  // 10. OUTPUT
  // ===============================
  console.log("🧠 Computed update:", {
    vector_bias,
    graph_bias,
    stability_score,
    updated_at: merged.updated_at,
  });

  console.log("✅ Reinforcement update saved");
  console.log("📦 New state:", merged);
}

// ===============================
runLoop().catch(console.error);
