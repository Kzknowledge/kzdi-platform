import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALPHA = 0.2;
const MIN = 0.5;
const MAX = 1.5;

function clamp(v: number) {
  return Math.max(MIN, Math.min(MAX, v));
}

/**
 * ⚔️ MULTI-AGENT RL COMPETITION ENGINE
 */
async function runCompetitionLoop() {
  console.log("⚔️ MCP MULTI-AGENT RL START");

  // ===============================
  // 1. LOAD AGENT POLICIES
  // ===============================
  const { data: memoryRow } = await supabase
    .from("system_memory")
    .select("value")
    .eq("key", "reinforcement_weights")
    .single();

  const state = memoryRow?.value ?? {
    agent_policy: {},
  };

  const agent_policy: Record<string, number> =
    state.agent_policy ?? {};

  // ===============================
  // 2. LOAD RECENT SIGNALS
  // ===============================
  const { data: signals } = await supabase
    .from("telemetry_events")
    .select("*")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

  console.log("📊 Signals:", signals?.length ?? 0);

  // ===============================
  // 3. COMPUTE AGENT SCORES
  // ===============================
  const agent_scores: Record<string, number> = {};

  for (const s of signals ?? []) {
    const agent = s.event_data?.agent;
    if (!agent) continue;

    const success = s.event_data?.success ? 1 : 0;
    const latency = s.event_data?.latency || 500;

    const reward =
      success * 0.6 +
      (latency < 500 ? 0.4 : -0.2);

    if (!agent_scores[agent]) agent_scores[agent] = 0;
    agent_scores[agent] += reward;
  }

  // ===============================
  // 4. SOFTMAX COMPETITION (KEY UPGRADE)
  // ===============================
  const agents = Object.keys(agent_scores);

  const expScores = agents.map((a) =>
    Math.exp(agent_scores[a])
  );

  const sumExp = expScores.reduce((a, b) => a + b, 0);

  const probabilities: Record<string, number> = {};

  agents.forEach((a, i) => {
    probabilities[a] = expScores[i] / sumExp;
  });

  // Winner selection (competition result)
  const winner =
    agents.sort((a, b) =>
      agent_scores[b] - agent_scores[a]
    )[0];

  console.log("🏆 Winner:", winner);

  // ===============================
  // 5. REWARD DISTRIBUTION (CRITICAL RL STEP)
  // ===============================
  for (const agent of agents) {
    const prev = agent_policy[agent] ?? 1;

    const reward = probabilities[agent];

    // Winner gets stronger reinforcement
    const bonus = agent === winner ? 0.1 : -0.02;

    agent_policy[agent] = clamp(
      prev + ALPHA * (reward + bonus - 0.5)
    );
  }

  // ===============================
  // 6. SAVE UPDATED POLICY
  // ===============================
  const updatedState = {
    ...state,
    agent_policy,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("system_memory").upsert(
    {
      key: "reinforcement_weights",
      value: updatedState,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    console.error("❌ Competition save failed:", error);
    return;
  }

  // ===============================
  // 7. OUTPUT
  // ===============================
  console.log("⚔️ COMPETITION RESULTS:");
  console.log({
    winner,
    agent_scores,
    probabilities,
    agent_policy,
  });
}

runCompetitionLoop().catch(console.error);
