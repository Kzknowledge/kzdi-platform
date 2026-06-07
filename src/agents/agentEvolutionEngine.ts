import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Agent = {
  id: string;
  weights: {
    vector_bias: number;
    graph_bias: number;
    stability_bias: number;
  };
  score: number;
  generation: number;
};

/**
 * 🧠 LOAD CURRENT POPULATION
 */
async function loadAgents(): Promise<Agent[]> {
  const { data } = await supabase
    .from("system_memory")
    .select("*")
    .eq("key", "agent_population");

  return data?.[0]?.value || [];
}

/**
 * 💾 SAVE POPULATION
 */
async function saveAgents(agents: Agent[]) {
  await supabase.from("system_memory").upsert({
    key: "agent_population",
    value: agents,
    updated_at: new Date().toISOString(),
  });
}

/**
 * 🧬 MUTATION FUNCTION
 */
function mutate(weights: Agent["weights"]) {
  const jitter = () => (Math.random() - 0.5) * 0.1;

  return {
    vector_bias: Math.min(1, Math.max(0, weights.vector_bias + jitter())),
    graph_bias: Math.min(1, Math.max(0, weights.graph_bias + jitter())),
    stability_bias: Math.min(1, Math.max(0, weights.stability_bias + jitter())),
  };
}

/**
 * 👶 SPAWN CHILD AGENT
 */
function spawnChild(parent: Agent, generation: number): Agent {
  return {
    id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    weights: mutate(parent.weights),
    score: 0,
    generation,
  };
}

/**
 * 🧠 EVOLUTION CORE
 */
export async function runEvolutionEngine() {
  console.log("🧬 Agent Evolution Engine START");

  const agents = await loadAgents();

  if (!agents || agents.length === 0) {
    console.log("⚠️ No agents found. Bootstrapping population...");

    const seed = [
      {
        id: "agent_seed_1",
        weights: { vector_bias: 0.9, graph_bias: 0.9, stability_bias: 0.5 },
        score: 0.5,
        generation: 0,
      },
      {
        id: "agent_seed_2",
        weights: { vector_bias: 0.8, graph_bias: 0.85, stability_bias: 0.6 },
        score: 0.55,
        generation: 0,
      },
    ];

    await saveAgents(seed);
    return;
  }

  // 🏆 SORT BY FITNESS
  const sorted = agents.sort((a, b) => b.score - a.score);

  const top = sorted.slice(0, Math.ceil(agents.length * 0.4)); // survivors
  const bottom = sorted.slice(Math.ceil(agents.length * 0.4)); // losers

  console.log(`🏆 Survivors: ${top.length}`);
  console.log(`☠️ Removed: ${bottom.length}`);

  // 🧬 REPRODUCTION PHASE
  const children: Agent[] = [];

  for (const parent of top) {
    const childCount = 2; // reproduction rate

    for (let i = 0; i < childCount; i++) {
      children.push(spawnChild(parent, parent.generation + 1));
    }
  }

  // 🔁 NEW POPULATION
  const newPopulation = [...top, ...children];

  // 📊 NORMALIZE POPULATION SIZE
  const MAX_POP = 20;

  const finalPopulation = newPopulation
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_POP);

  // 💾 SAVE EVOLVED POPULATION
  await saveAgents(finalPopulation);

  // 📈 LOG EVOLUTION EVENT
  await supabase.from("telemetry_events").insert({
    event_type: "agent_evolution",
    event_data: {
      survivors: top.length,
      children: children.length,
      final_population: finalPopulation.length,
    },
  });

  console.log("✅ Evolution cycle complete");
  console.log("📦 Population size:", finalPopulation.length);
}

/**
 * 🚀 RUN
 */
runEvolutionEngine();
