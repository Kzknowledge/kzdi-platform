import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

/**
 * MCP Learning Brain
 * Learns from telemetry_events to improve future decisions
 */

type LearningSignal = {
  agent: string;
  success: boolean;
  vector_strength: number;
  graph_strength: number;
  duration_ms: number;
};

export class MCPLearningBrain {
  /**
   * Fetch recent traces from Supabase
   */
  async fetchRecentSignals(limit = 50): Promise<LearningSignal[]> {
    const { data, error } = await supabase
      .from("telemetry_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data
      .filter((e: any) => e.event_type === "trace_complete")
      .map((e: any) => ({
        agent: e.event_data?.agent || "unknown",
        success: e.event_data?.status === "success",
        vector_strength: e.event_data?.vector_strength || 0.5,
        graph_strength: e.event_data?.graph_strength || 0.5,
        duration_ms: e.event_data?.duration_ms || 0
      }));
  }

  /**
   * Compute adaptive weights for decision engine
   */
  async computeAdaptiveWeights() {
    const signals = await this.fetchRecentSignals(100);

    if (signals.length === 0) {
      return {
        vectorWeight: 0.5,
        graphWeight: 0.5,
        agentBias: {}
      };
    }

    let vectorSuccess = 0;
    let graphSuccess = 0;
    let total = signals.length;

    const agentPerformance: Record<string, { success: number; total: number }> = {};

    for (const s of signals) {
      if (s.vector_strength > s.graph_strength) {
        vectorSuccess += s.success ? 1 : 0;
      } else {
        graphSuccess += s.success ? 1 : 0;
      }

      if (!agentPerformance[s.agent]) {
        agentPerformance[s.agent] = { success: 0, total: 0 };
      }

      agentPerformance[s.agent].total += 1;
      if (s.success) agentPerformance[s.agent].success += 1;
    }

    // 🔷 Adaptive weights
    const vectorWeight = vectorSuccess / total || 0.5;
    const graphWeight = graphSuccess / total || 0.5;

    // 🔷 Agent bias scoring
    const agentBias: Record<string, number> = {};

    Object.entries(agentPerformance).forEach(([agent, stats]) => {
      agentBias[agent] = stats.success / stats.total;
    });

    return {
      vectorWeight,
      graphWeight,
      agentBias
    };
  }

  /**
   * Suggest best agent based on learning history
   */
  async suggestBestAgent(candidates: string[]) {
    const weights = await this.computeAdaptiveWeights();

    let bestAgent = candidates[0];
    let bestScore = 0;

    for (const agent of candidates) {
      const score = weights.agentBias[agent] || 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return {
      bestAgent,
      confidence: bestScore,
      weights
    };
  }
}
