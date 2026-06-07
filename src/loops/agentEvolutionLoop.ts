import "dotenv/config";
import "dotenv/config";
import { acquireLock, releaseLock } from "../utils/lock";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MIN_PERFORMANCE = 0.55;
const EVOLUTION_THRESHOLD = 0.75;

/**
 * 🧬 AGENT EVOLUTION LAYER (CONTROLLED)
 */
async function runEvolutionLoop() {
  console.log("🧬 MCP AGENT EVOLUTION START");

  // ===============================
  // 1. LOAD RL STATE
  // ===============================
  const { data: memoryRow } = await supabase
    .from("system_memory")
    .select("value")
    .eq("key", "reinforcement_weights")
    .single();

  const state = memoryRow?.value ?? {};
  const agent_policy = state.agent_policy ?? {};

  // ===============================
  // 2. COMPUTE PERFORMANCE TREND
  // ===============================
  const agents = Object.keys(agent_policy);

  const evolutionScores: Record<string, number> = {};

  for (const agent of agents) {
    const score = agent_policy[agent];

    // Simple stability-based evolution metric
    const stability =
      score > MIN_PERFORMANCE ? score : score * 0.9;

    evolutionScores[agent] = stability;
  }

  // ===============================
  // 3. IDENTIFY TOP & WEAK AGENTS
  // ===============================
  const topAgents = agents.filter(
    (a) => evolutionScores[a] >= EVOLUTION_THRESHOLD
  );

  const weakAgents = agents.filter(
    (a) => evolutionScores[a] < MIN_PERFORMANCE
  );

  console.log("🏆 Top agents:", topAgents);
  console.log("⚠️ Weak agents:", weakAgents);

  // ===============================
  // 4. GENERATE EVOLUTION CANDIDATES
  // ===============================
  const mutationCandidates = topAgents.map((agent) => {
    return {
      parent: agent,
      new_agent_id: `${agent}_v${Date.now()}`,
      mutation_type: "weight_variation",
      expected_bias: agent_policy[agent] * 1.05,
      status: "pending_approval",
      created_at: new Date().toISOString(),
    };
  });

  // ===============================
  // 5. STORE IN EVOLUTION REGISTRY
  // ===============================
  for (const candidate of mutationCandidates) {
    const { error } = await supabase
      .from("evolution_registry")
      .insert(candidate);

    if (error) {
      console.error("❌ Evolution insert failed:", error);
    }
  }

  // ===============================
  // 6. LOG EVOLUTION STATE
  // ===============================
  console.log("🧬 EVOLUTION CANDIDATES GENERATED:");
  console.log(mutationCandidates);

  console.log("🧠 SYSTEM STATE:");
  console.log({
    total_agents: agents.length,
    top_agents: topAgents.length,
    weak_agents: weakAgents.length,
  });
}

runEvolutionLoop().catch(console.error);
