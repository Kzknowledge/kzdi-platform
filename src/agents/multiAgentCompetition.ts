import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * 🧠 AGENT INTERFACE
 */
type Agent = {
  id: string;
  weight: number;
  compute: (signals: any[]) => Promise<any>;
};

/**
 * 🤖 SIMPLE AGENT IMPLEMENTATIONS
 */
const agents: Agent[] = [
  {
    id: "agent_alpha",
    weight: 1.0,
    async compute(signals) {
      const strength = signals.length * 0.01;
      return {
        vector_bias: Math.max(0.5, 1 - strength),
        graph_bias: 0.9,
        stability_score: 0.6,
      };
    },
  },
  {
    id: "agent_beta",
    weight: 1.2,
    async compute(signals) {
      const noise = signals.length * 0.005;
      return {
        vector_bias: 0.85,
        graph_bias: Math.max(0.5, 1 - noise),
        stability_score: 0.65,
      };
    },
  },
  {
    id: "agent_gamma",
    weight: 0.9,
    async compute(signals) {
      const entropy = Math.random() * 0.1;
      return {
        vector_bias: 0.9 - entropy,
        graph_bias: 0.88,
        stability_score: 0.7,
      };
    },
  },
];

/**
 * 📊 SCORE FUNCTION (CORE OF COMPETITION)
 */
function scoreAgent(output: any, signalsCount: number): number {
  const stability = output.stability_score ?? 0.5;
  const biasPenalty = Math.abs(1 - (output.vector_bias + output.graph_bias) / 2);

  return stability * 0.6 + (1 - biasPenalty) * 0.4 - signalsCount * 0.001;
}

/**
 * 🧠 RUN COMPETITION
 */
export async function runCompetition() {
  console.log("⚔️ Multi-Agent Competition START");

  const { data: signals } = await supabase
    .from("telemetry_events")
    .select("*")
    .limit(200);

  const signalCount = signals?.length ?? 0;

  const results: any[] = [];

  for (const agent of agents) {
    const output = await agent.compute(signals || []);
    const score = scoreAgent(output, signalCount);

    results.push({
      agent_id: agent.id,
      output,
      score,
    });

    console.log(`🤖 ${agent.id} score:`, score.toFixed(4));
  }

  // 🏆 SELECT WINNER
  const winner = results.sort((a, b) => b.score - a.score)[0];

  console.log("🏆 Winner:", winner.agent_id);

  // 💾 STORE GLOBAL WINNER STATE
  await supabase.from("system_memory").upsert({
    key: "competition_winner",
    value: {
      winner: winner.agent_id,
      score: winner.score,
      output: winner.output,
      updated_at: new Date().toISOString(),
    },
  });

  // 📊 LOG EVENT
  await supabase.from("telemetry_events").insert({
    event_type: "competition_run",
    event_data: {
      winner: winner.agent_id,
      score: winner.score,
      agents: results.length,
    },
  });

  return winner;
}

/**
 * 🚀 EXECUTE
 */
runCompetition();
