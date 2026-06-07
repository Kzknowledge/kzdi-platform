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
        vector_strength: Number(e.event_data?.vector_strength ?? 0),
        graph_strength: Number(e.event_data?.graph_strength ?? 0),
        duration_ms: Number(e.event_data?.duration_ms ?? 0),
      }));
  }

  /**
   * Compute adaptive weights for decision engine (STABILIZED VERSION)
   */
  async computeAdaptiveWeights() {
    const signals = await this.fetchRecentSignals(100);

    if (signals.length < 5) {
      return {
        vectorWeight: 0.5,
        graphWeight: 0.5,
        agentBias: {},
      };
    }

    let vectorSuccessRate = 0;
    let graphSuccessRate = 0;

    const agentPerformance: Record<
      string,
      { success: number; total: number }
    > = {};

    for (const s of signals) {
      // 🔷 initialize agent stats
      if (!agentPerformance[s.agent]) {
        agentPerformance[s.agent] = { success: 0, total: 0 };
      }

      agentPerformance[s.agent].total += 1;
      if (s.success) agentPerformance[s.agent].success += 1;

      // 🔷 stable contribution logic (NOT comparison-based)
      const vectorContribution = s.vector_strength * (s.success ? 1 : 0);
      const graphContribution = s.graph_strength * (s.success ? 1 : 0);

      vectorSuccessRate += vectorContribution;
      graphSuccessRate += graphContribution;
    }

    const total = signals.length;

    // 🔷 normalized + smoothed weights
    const vectorWeight = Math.min(
      0.85,
      Math.max(0.3, vectorSuccessRate / total + 0.1)
    );

    const graphWeight = Math.min(
      0.85,
      Math.max(0.3, graphSuccessRate / total + 0.1)
    );

    // 🔷 agent bias scoring (smoothed)
    const agentBias: Record<string, number> = {};

    Object.entries(agentPerformance).forEach(([agent, stats]) => {
      const ratio = stats.success / stats.total;

      // smoothing to avoid overfitting
      agentBias[agent] = Number(
        (0.1 + ratio * 0.9).toFixed(3)
      );
    });

    return {
      vectorWeight,
      graphWeight,
      agentBias,
    };
  }

  /**
   * Suggest best agent based on learning history
   */
  async suggestBestAgent(candidates: string[]) {
    const weights = await this.computeAdaptiveWeights();

    let bestAgent = candidates[0];
    let bestScore = -Infinity;

    for (const agent of candidates) {
      const score = weights.agentBias[agent] ?? 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return {
      bestAgent,
      confidence: bestScore,
      weights,
    };
  }
}
