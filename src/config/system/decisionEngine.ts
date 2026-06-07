import { getSystemMemory } from "./system-memory";

type Agent = {
  id: string;
  alias?: string;
  mcp_layer?: string;
  capabilities?: string[];
};

export class MCPDecisionEngine {
  /**
   * 🧠 REINFORCEMENT-AWARE AGENT SELECTION
   */
  async selectAgent(input: {
    query: string;
    vectorResults: any[];
    graphNodes: string[];
    agents: Agent[];
  }) {
    const { vectorResults, graphNodes, agents } = input;

    // ===============================
    // 1. LOAD REINFORCEMENT WEIGHTS
    // ===============================
    const memory = await getSystemMemory("reinforcement_weights");

    const agentBiasMap: Record<string, number> =
      memory?.agent_bias_map || {};

    const vectorBias = memory?.vector_bias || 1.0;
    const graphBias = memory?.graph_bias || 1.0;

    // ===============================
    // 2. COMPETITION SCORING
    // ===============================
    let best: Agent = agents[0];
    let bestScore = -Infinity;

    const ranking: any[] = [];

    for (const agent of agents) {
      // base signals
      const vectorScore =
        vectorResults.reduce((s, v) => s + (v.score || 0), 0) *
        vectorBias;

      const graphScore = graphNodes.length * graphBias;

      const capabilityBonus = agent.capabilities?.includes(
        "ai_evaluation_0_100"
      )
        ? 0.3
        : 0;

      const agentBias = agentBiasMap[agent.id] || 1.0;

      // ===============================
      // FINAL SCORE MODEL (REINFORCED)
      // ===============================
      const score =
        (vectorScore + graphScore + capabilityBonus) *
        agentBias;

      ranking.push({
        agent,
        score,
      });

      if (score > bestScore) {
        bestScore = score;
        best = agent;
      }
    }

    // ===============================
    // 3. NORMALIZE RANKING
    // ===============================
    ranking.sort((a, b) => b.score - a.score);

    // ===============================
    // 4. OUTPUT
    // ===============================
    return {
      id: best.id,
      alias: best.alias,
      mcp_layer: best.mcp_layer,
      score: bestScore,

      ranking,

      memoryInfluenced: true,
      reinforcement_applied: true,
    };
  }
}
