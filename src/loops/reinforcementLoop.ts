import "dotenv/config";
import "dotenv/config";
import { acquireLock, releaseLock } from "../utils/lock";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RLState = {
  vector_bias: number;
  graph_bias: number;
  agent_policy: Record<string, number>;
  signal_history: any[];
  stability_score: number;
  updated_at?: string;
};

const ALPHA = 0.25; // EMA smoothing factor
const CLAMP_MIN = 0.5;
const CLAMP_MAX = 1.5;

function clamp(v: number) {
  return Math.max(CLAMP_MIN, Math.min(CLAMP_MAX, v));
}

/**
 * 🧠 REINFORCEMENT LEARNING ENGINE (RL v2)
 */
async function runRL() {
  console.log("🔁 MCP RL ENGINE START");

  // ===============================
  // 1. LOAD TELEMETRY
  // ===============================
  const { data: signals } = await supabase
    .from("telemetry_events")
    .select("*")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  console.log("📊 Signals loaded:", signals?.length ?? 0);

  // ===============================
  // 2. LOAD MEMORY STATE
  // ===============================
  const { data: memoryRow } = await supabase
    .from("system_memory")
    .select("value")
    .eq("key", "reinforcement_weights")
    .single();

  const prev: RLState = memoryRow?.value ?? {
    vector_bias: 1,
    graph_bias: 1,
    agent_policy: {},
    signal_history: [],
    stability_score: 1,
  };

  // ===============================
  // 3. COMPUTE REWARD SIGNAL
  // ===============================
  const successRate =
    (signals?.filter((s) => s.event_data?.success).length ?? 0) /
    (signals?.length || 1);

  const avgLatency =
    signals?.reduce((a, b) => a + (b.event_data?.latency || 500), 0) /
    (signals?.length || 1);

  const confidence = 1 - Math.abs(successRate - 0.5);

  // FINAL REWARD FUNCTION (CORE RL SIGNAL)
  const reward =
    successRate * 0.5 +
    confidence * 0.3 +
    (avgLatency < 500 ? 0.2 : -0.2);

  // ===============================
  // 4. EMA UPDATE (SMOOTHING)
  // ===============================
  const vector_bias = clamp(
    prev.vector_bias + ALPHA * (reward - 0.5)
  );

  const graph_bias = clamp(
    prev.graph_bias + ALPHA * (0.5 - reward)
  );

  const stability_score = clamp(
    1 - Math.abs(reward - 0.5)
  );

  // ===============================
  // 5. AGENT POLICY LEARNING (RL CORE)
  // ===============================
  const agent_policy: Record<string, number> = {
    ...prev.agent_policy,
  };

  for (const s of signals ?? []) {
    const agent = s.event_data?.agent;
    if (!agent) continue;

    const success = s.event_data?.success ? 1 : 0;
    const latency = s.event_data?.latency || 500;

    const agent_reward =
      success * 0.6 + (latency < 500 ? 0.4 : -0.2);

    const prevVal = agent_policy[agent] ?? 1;

    // EMA policy update (TRUE RL behavior)
    agent_policy[agent] = clamp(
      prevVal + ALPHA * (agent_reward - 0.5)
    );
  }

  // ===============================
  // 6. SIGNAL HISTORY (ROLLING MEMORY)
  // ===============================
  const signal_history = [
    ...(prev.signal_history ?? []).slice(-9),
    {
      reward,
      successRate,
      vector_bias,
      graph_bias,
      stability_score,
      timestamp: new Date().toISOString(),
    },
  ];

  // ===============================
  // 7. FINAL STATE
  // ===============================
  const next: RLState = {
    vector_bias,
    graph_bias,
    agent_policy,
    signal_history,
    stability_score,
    updated_at: new Date().toISOString(),
  };

  // ===============================
  // 8. SAVE STATE
  // ===============================
  const { error } = await supabase.from("system_memory").upsert(
    {
      key: "reinforcement_weights",
      value: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    console.error("❌ RL save failed:", error);
    return;
  }

  // ===============================
  // 9. OUTPUT
  // ===============================
  console.log("🧠 RL STATE UPDATED:", {
    reward,
    vector_bias,
    graph_bias,
    stability_score,
  });

  console.log("📦 Agent Policy:", agent_policy);
}

runRL().catch(console.error);
